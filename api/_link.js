import { redis, overLimit, clean } from "./_lib.js";
import { load, save, merge, cut, LINK_TTL } from "./_family.js";
import { isOffensive } from "./_words.js";
import { aisleData } from "./_aisle.js";

// v378: PUBLIC shopping-list link. https://<site>/l/<code> (rewrite in vercel.json → /api/circle?via=lnk&c=<code>, so still 12 functions).
// No app, no account, no access code: the secret code in the address is the key (144 random bits, 30 days, renewed at every use,
// the owner can switch it off or renew it from the list). Whoever has it can tick, add and remove items, never rename or delete the list.
// GET /l/<code>              → the page (HTML, state embedded)
// GET /l/<code>?j=1&v=<v>    → JSON state, {same:true} when nothing changed since v
// POST /l/<code> {items,gone,by} → apply the changes (same item-by-item merge as the family lists) and answer the new state
const CODE = /^[A-Za-z0-9_-]{20,40}$/;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LANGS = ["fr", "en", "es", "de", "it", "pt"];
const pickLang = (req) => {
  const q = String((req.query && req.query.hl) || "").slice(0, 2).toLowerCase();
  if (LANGS.includes(q)) return q;
  const al = String(req.headers["accept-language"] || "").toLowerCase();
  for (const part of al.split(",")) { const l = part.trim().slice(0, 2); if (LANGS.includes(l)) return l; }
  return "fr";
};
const guestName = (s) => { const n = cut(clean(s, 24), 24).replace(/[<>"]/g, "").replace(/\s+/g, " ").trim(); return n && !isOffensive(n) ? n : ""; };
const view = (l) => ({ name: l.name, v: l.v, items: l.items.map((x) => x.i), ev: l.ev || {}, rec: Array.isArray(l.rec) ? l.rec : [], pp: Array.isArray(l.pp) ? l.pp : [] });

function headers(res, type) {
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

export default async function linkHandler(req, res) {
  const q = req.query || {}, code = String(q.c || "");
  const lang = pickLang(req);
  const gone = () => { if (req.method === "GET" && !q.j) { headers(res, "text/html; charset=utf-8"); return res.status(404).send(gonePage(lang)); } return res.status(404).json({ error: "gone" }); };
  if (!CODE.test(code)) return gone();
  try {
    if (await overLimit(req, "rl:lk:", 600)) return res.status(429).json({ error: "rate" });
    const [id] = await redis([["GET", "sk:" + code]]);
    const l = id ? await load(id) : null;
    if (!l || l.lk !== code) return gone();
    if (req.method === "GET") {
      await redis([["EXPIRE", "sk:" + code, String(LINK_TTL)]]);
      if (q.j) { headers(res, "application/json; charset=utf-8"); return res.status(200).json(q.v != null && Number(q.v) === l.v ? { same: true, v: l.v } : view(l)); }
      headers(res, "text/html; charset=utf-8");
      return res.status(200).send(page(lang, view(l), req));
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const by = guestName(body.by), now = Date.now();
    const ups = [];
    for (const raw of (Array.isArray(body.items) ? body.items : []).slice(0, 100)) {
      const i0 = raw && typeof raw === "object" ? (raw.i && typeof raw.i === "object" ? raw.i : raw) : null;
      const t = i0 ? cut(i0.t, 120).replace(/\s+/g, " ").trim() : "";
      if (!t) continue;
      const k = t.toLowerCase(), ex = l.items.find((x) => x.k === k);
      const src = !ex && raw && typeof raw.m === "string" ? l.items.find((x) => x.k === cut(raw.m, 200).toLowerCase().trim()) : null;
      const i = ex ? { ...ex.i } : src ? { ...src.i, t } : { t };
      if (src) { delete i.c; delete i.b; }
      i.d = !!i0.d;
      if (ex && Object.prototype.hasOwnProperty.call(i0, "a")) { const a = guestName(i0.a); if (a) i.a = a; else delete i.a; } // v385: "I take it" (assignee)
      if (ex) { if (i.d) { if (by) i.b = by; } else delete i.b; }
      else if (by) i.u = by;
      ups.push({ k, i, ts: now });
    }
    const dels = {};
    for (const k0 of (Array.isArray(body.gone) ? body.gone : []).slice(0, 100)) { const k = cut(k0, 200).toLowerCase().trim(); if (k) dels[k] = 1; }
    let ppCh = false;
    if (by) { let cur = Array.isArray(l.pp) ? [...l.pp] : [];
      if (typeof body.rn === "string") { const old = cut(body.rn, 24).toLowerCase().trim(); const n0 = cur.length; if (old && old !== by.toLowerCase()) { cur = cur.filter((x) => x.toLowerCase() !== old); if (cur.length !== n0) { l.pp = cur; ppCh = true; } } } if (cur.length < 30 && !cur.some((x) => x.toLowerCase() === by.toLowerCase())) { cur.push(by); l.pp = cur; ppCh = true; } } // v387: participants
    let evCh = false;
    if (body.ev && typeof body.ev === "object") { // guests may set the three event figures (guests, recipes, budget); null clears one
      const ev = { ...(l.ev || {}) };
      for (const [k, max, dec] of [["g", 9999, 0], ["r", 9999, 0], ["b", 999999, 2]]) {
        if (!(k in body.ev)) continue;
        const raw = body.ev[k], n = raw === null || raw === "" ? null : Number(raw);
        if (n !== null && !Number.isFinite(n)) continue;
        const nv = n === null ? null : Math.round(Math.min(Math.max(n, 0), max) * 10 ** dec) / 10 ** dec;
        if (nv === null ? k in ev : ev[k] !== nv) { evCh = true; if (nv === null) delete ev[k]; else ev[k] = nv; }
      }
      if (evCh) l.ev = ev;
    }
    let recCh = false;
    if (body.rec && typeof body.rec === "object") { // guests may add / remove the manual recipe names of the list
      const cur = Array.isArray(l.rec) ? [...l.rec] : [];
      for (const raw of (Array.isArray(body.rec.add) ? body.rec.add : []).slice(0, 10)) {
        const nm = cut(clean(raw, 60), 60).replace(/[<>"]/g, "").replace(/\s+/g, " ").trim();
        if (!nm || isOffensive(nm) || cur.length >= 30 || cur.some((x) => x.toLowerCase() === nm.toLowerCase())) continue;
        cur.push(nm); recCh = true;
      }
      for (const raw of (Array.isArray(body.rec.del) ? body.rec.del : []).slice(0, 10)) {
        const k = cut(clean(raw, 60), 60).toLowerCase().trim(), at = cur.findIndex((x) => x.toLowerCase() === k);
        if (at >= 0) { cur.splice(at, 1); recCh = true; }
      }
      if (recCh) l.rec = cur;
    }
    if (merge(l, ups, dels) || evCh || recCh || ppCh) { l.v++; await save(l); }
    await redis([["EXPIRE", "sk:" + code, String(LINK_TTL)]]);
    headers(res, "application/json; charset=utf-8");
    return res.status(200).json(view(l));
  } catch (e) { return res.status(502).json({ error: "storage" }); }
}

const T = {
  fr: { pt: "Participants", live: "En direct", off: "Reconnexion…", n1: "1 article", nN: "{n} articles", prog: "{d} sur {n} dans le panier", add: "Ajouter un article…", buy: "À acheter", cart: "Dans le panier", empty: "La liste est vide", emptyH: "Ajoute un premier article ci-dessus.", done: "Tout est dans le panier !", doneH: "Bonnes courses, et bon appétit.", chk: "coché par {n}", addb: "ajouté par {n}", you: "Tu es {n}", chg: "changer", who: "Comment t’appelles-tu ?", whoH: "Pour que les autres voient qui coche ou ajoute les articles.", ok: "Valider", later: "Plus tard", del: "Retirer", shared: "Liste partagée", foot: "Cette liste est partagée avec Chef IA, ton chef de poche.", cta: "Découvrir Chef IA", ghd: "Ce lien n’est plus valide", gtx: "Le propriétaire a désactivé ce lien ou il a expiré. Demande-lui un nouveau lien.", gcta: "Découvrir Chef IA", name: "Ton prénom", take: "Je m’en charge", untake: "Retirer mon nom", takeby: "pris par {n}", sel: "Sélectionner", selc: "Terminer", selN: "{n} sélectionné(s)", all: "Tout", none: "Aucun", asg: "Assigner à…", asgT: "Assigner à", me: "moi", nob: "Personne", oth: "Autre prénom…", unas: "Retirer l’attribution", tickS: "Acheté", delS: "Supprimer", delQ: "Supprimer {n} article(s) ?", rh: "Recettes à faire", ra: "Ajouter une recette…", gu: "Invités", rc: "Recettes", bu: "Budget", sa: "Tout cocher", sn: "Tout décocher", cd: "Retirer les cochés", mg: "Vous avez « {a} » dans la liste et vous ajoutez « {b} » : {n} au total. Les additionner ? (Annuler garde les deux lignes.)", my: "Additionner", no: "Annuler", ogd: "Liste de courses partagée" },
  en: { pt: "Participants", live: "Live", off: "Reconnecting…", n1: "1 item", nN: "{n} items", prog: "{d} of {n} in the cart", add: "Add an item…", buy: "To buy", cart: "In the cart", empty: "The list is empty", emptyH: "Add a first item above.", done: "Everything is in the cart!", doneH: "Happy shopping, and enjoy your meal.", chk: "ticked by {n}", addb: "added by {n}", you: "You are {n}", chg: "change", who: "What’s your name?", whoH: "So the others can see who ticks or adds items.", ok: "Save", later: "Later", del: "Remove", shared: "Shared list", foot: "This list is shared with Chef IA, your pocket chef.", cta: "Discover Chef IA", ghd: "This link is no longer valid", gtx: "The owner switched this link off or it has expired. Ask for a new link.", gcta: "Discover Chef IA", name: "Your first name", take: "I’ll get it", untake: "Remove my name", takeby: "taken by {n}", sel: "Select", selc: "Done", selN: "{n} selected", all: "All", none: "None", asg: "Assign to…", asgT: "Assign to", me: "me", nob: "Nobody", oth: "Other name…", unas: "Remove assignment", tickS: "Bought", delS: "Delete", delQ: "Delete {n} item(s)?", rh: "Recipes to make", ra: "Add a recipe…", gu: "Guests", rc: "Recipes", bu: "Budget", sa: "Tick all", sn: "Untick all", cd: "Remove ticked items", mg: "You have “{a}” in the list and you are adding “{b}”: {n} in total. Add them up? (Cancel keeps both lines.)", my: "Add up", no: "Cancel", ogd: "Shared shopping list" },
  es: { pt: "Participantes", live: "En directo", off: "Reconectando…", n1: "1 artículo", nN: "{n} artículos", prog: "{d} de {n} en el carrito", add: "Añadir un artículo…", buy: "Por comprar", cart: "En el carrito", empty: "La lista está vacía", emptyH: "Añade un primer artículo arriba.", done: "¡Todo está en el carrito!", doneH: "Buenas compras y buen provecho.", chk: "marcado por {n}", addb: "añadido por {n}", you: "Eres {n}", chg: "cambiar", who: "¿Cómo te llamas?", whoH: "Para que los demás vean quién marca o añade artículos.", ok: "Guardar", later: "Más tarde", del: "Quitar", shared: "Lista compartida", foot: "Esta lista se comparte con Chef IA, tu chef de bolsillo.", cta: "Descubrir Chef IA", ghd: "Este enlace ya no es válido", gtx: "El propietario ha desactivado este enlace o ha caducado. Pídele uno nuevo.", gcta: "Descubrir Chef IA", name: "Tu nombre", take: "Yo me encargo", untake: "Quitar mi nombre", takeby: "a cargo de {n}", sel: "Seleccionar", selc: "Terminar", selN: "{n} seleccionado(s)", all: "Todo", none: "Nada", asg: "Asignar a…", asgT: "Asignar a", me: "yo", nob: "Nadie", oth: "Otro nombre…", unas: "Quitar asignación", tickS: "Comprado", delS: "Eliminar", delQ: "¿Eliminar {n} artículo(s)?", rh: "Recetas por hacer", ra: "Añadir una receta…", gu: "Invitados", rc: "Recetas", bu: "Presupuesto", sa: "Marcar todo", sn: "Desmarcar todo", cd: "Quitar los marcados", mg: "Tienes «{a}» en la lista y añades «{b}»: {n} en total. ¿Sumarlos? (Cancelar mantiene las dos líneas.)", my: "Sumar", no: "Cancelar", ogd: "Lista de la compra compartida" },
  de: { pt: "Teilnehmer", live: "Live", off: "Verbinde neu…", n1: "1 Artikel", nN: "{n} Artikel", prog: "{d} von {n} im Korb", add: "Artikel hinzufügen…", buy: "Zu kaufen", cart: "Im Korb", empty: "Die Liste ist leer", emptyH: "Füge oben den ersten Artikel hinzu.", done: "Alles ist im Korb!", doneH: "Viel Spaß beim Einkaufen und guten Appetit.", chk: "abgehakt von {n}", addb: "hinzugefügt von {n}", you: "Du bist {n}", chg: "ändern", who: "Wie heißt du?", whoH: "Damit die anderen sehen, wer Artikel abhakt oder hinzufügt.", ok: "Speichern", later: "Später", del: "Entfernen", shared: "Geteilte Liste", foot: "Diese Liste wird mit Chef IA geteilt, deinem Taschenkoch.", cta: "Chef IA entdecken", ghd: "Dieser Link ist nicht mehr gültig", gtx: "Der Besitzer hat den Link deaktiviert oder er ist abgelaufen. Frag nach einem neuen Link.", gcta: "Chef IA entdecken", name: "Dein Vorname", take: "Ich übernehme", untake: "Meinen Namen entfernen", takeby: "übernommen von {n}", sel: "Auswählen", selc: "Fertig", selN: "{n} ausgewählt", all: "Alle", none: "Keine", asg: "Zuweisen an…", asgT: "Zuweisen an", me: "ich", nob: "Niemand", oth: "Anderer Name…", unas: "Zuweisung entfernen", tickS: "Gekauft", delS: "Löschen", delQ: "{n} Artikel löschen?", rh: "Rezepte zum Kochen", ra: "Rezept hinzufügen…", gu: "Gäste", rc: "Rezepte", bu: "Budget", sa: "Alle abhaken", sn: "Alle Haken entfernen", cd: "Abgehakte entfernen", mg: "Du hast „{a}“ in der Liste und fügst „{b}“ hinzu: insgesamt {n}. Zusammenzählen? (Abbrechen behält beide Zeilen.)", my: "Zusammenzählen", no: "Abbrechen", ogd: "Geteilte Einkaufsliste" },
  it: { pt: "Partecipanti", live: "In diretta", off: "Riconnessione…", n1: "1 articolo", nN: "{n} articoli", prog: "{d} su {n} nel carrello", add: "Aggiungi un articolo…", buy: "Da comprare", cart: "Nel carrello", empty: "La lista è vuota", emptyH: "Aggiungi un primo articolo qui sopra.", done: "Tutto è nel carrello!", doneH: "Buona spesa e buon appetito.", chk: "spuntato da {n}", addb: "aggiunto da {n}", you: "Sei {n}", chg: "cambia", who: "Come ti chiami?", whoH: "Così gli altri vedono chi spunta o aggiunge gli articoli.", ok: "Salva", later: "Più tardi", del: "Rimuovi", shared: "Lista condivisa", foot: "Questa lista è condivisa con Chef IA, il tuo chef tascabile.", cta: "Scopri Chef IA", ghd: "Questo link non è più valido", gtx: "Il proprietario ha disattivato questo link oppure è scaduto. Chiedi un nuovo link.", gcta: "Scopri Chef IA", name: "Il tuo nome", take: "Ci penso io", untake: "Rimuovi il mio nome", takeby: "preso da {n}", sel: "Seleziona", selc: "Fine", selN: "{n} selezionati", all: "Tutti", none: "Nessuno", asg: "Assegna a…", asgT: "Assegna a", me: "io", nob: "Nessuno", oth: "Altro nome…", unas: "Rimuovi assegnazione", tickS: "Comprato", delS: "Elimina", delQ: "Eliminare {n} articoli?", rh: "Ricette da fare", ra: "Aggiungi una ricetta…", gu: "Ospiti", rc: "Ricette", bu: "Budget", sa: "Spunta tutto", sn: "Togli tutte le spunte", cd: "Rimuovi gli spuntati", mg: "Hai «{a}» nella lista e aggiungi «{b}»: {n} in totale. Sommarli? (Annulla mantiene entrambe le righe.)", my: "Somma", no: "Annulla", ogd: "Lista della spesa condivisa" },
  pt: { pt: "Participantes", live: "Em direto", off: "A reconectar…", n1: "1 artigo", nN: "{n} artigos", prog: "{d} de {n} no carrinho", add: "Adicionar um artigo…", buy: "Para comprar", cart: "No carrinho", empty: "A lista está vazia", emptyH: "Adiciona um primeiro artigo acima.", done: "Está tudo no carrinho!", doneH: "Boas compras e bom apetite.", chk: "riscado por {n}", addb: "adicionado por {n}", you: "Tu és {n}", chg: "mudar", who: "Como te chamas?", whoH: "Para os outros verem quem risca ou adiciona artigos.", ok: "Guardar", later: "Mais tarde", del: "Retirar", shared: "Lista partilhada", foot: "Esta lista é partilhada com o Chef IA, o teu chef de bolso.", cta: "Descobrir o Chef IA", ghd: "Este link já não é válido", gtx: "O proprietário desativou este link ou expirou. Pede um novo link.", gcta: "Descobrir o Chef IA", name: "O teu nome", take: "Eu trato disso", untake: "Remover o meu nome", takeby: "a cargo de {n}", sel: "Selecionar", selc: "Concluir", selN: "{n} selecionado(s)", all: "Tudo", none: "Nada", asg: "Atribuir a…", asgT: "Atribuir a", me: "eu", nob: "Ninguém", oth: "Outro nome…", unas: "Remover atribuição", tickS: "Comprado", delS: "Eliminar", delQ: "Eliminar {n} artigo(s)?", rh: "Receitas para fazer", ra: "Adicionar uma receita…", gu: "Convidados", rc: "Receitas", bu: "Orçamento", sa: "Riscar tudo", sn: "Desriscar tudo", cd: "Remover os marcados", mg: "Tens «{a}» na lista e adicionas «{b}»: {n} no total. Somá-los? (Cancelar mantém as duas linhas.)", my: "Somar", no: "Cancelar", ogd: "Lista de compras partilhada" },
};

const HAT = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 33v-3.4a8 8 0 0 1 1.6-15.4 9 9 0 0 1 14.8 0A8 8 0 0 1 33 29.6V33z" fill="#fff" stroke="#e5195f" stroke-width="2.4" stroke-linejoin="round"/><path d="M15 33h18v6a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2z" fill="#ffe3ee" stroke="#e5195f" stroke-width="2.4" stroke-linejoin="round"/><circle cx="20.5" cy="21" r="1.6" fill="#e5195f"/><circle cx="27.5" cy="21" r="1.6" fill="#e5195f"/><path d="M21 25.5q3 2.4 6 0" fill="none" stroke="#e5195f" stroke-width="2" stroke-linecap="round"/></svg>';

const CSS = `
:root{--bg1:#fffaf2;--bg2:#f9eddc;--card:#fff;--ink:#16121a;--mut:#7b7684;--pink:#e5195f;--ps:#fde8f0;--pb:#f7bfd4;--bd:rgba(0,0,0,.08);--sh:0 2px 14px rgba(70,40,20,.08);--ok:#2f9d62}
@media(prefers-color-scheme:dark){:root{--bg1:#1f1b33;--bg2:#12101d;--card:#272339;--ink:#f4f1fa;--mut:#a29cb3;--ps:#3a2233;--pb:#6b2a47;--bd:rgba(255,255,255,.1);--sh:0 2px 14px rgba(0,0,0,.35)}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
[hidden]{display:none!important}
html{background:var(--bg2)}
body{margin:0;min-height:100vh;min-height:100dvh;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:linear-gradient(160deg,var(--bg1),var(--bg2)) fixed;padding:0 14px calc(28px + env(safe-area-inset-bottom))}
.w{max-width:560px;margin:0 auto}
.top{display:flex;align-items:center;gap:10px;padding:max(16px,env(safe-area-inset-top)) 2px 14px}
.logo{width:42px;height:42px;border-radius:50%;background:var(--ps);border:1px solid var(--pb);display:grid;place-items:center;flex:none}
.logo svg{width:30px;height:30px}
.brand{font-weight:700;font-size:16px;line-height:1.2}.brand small{display:block;font-weight:500;font-size:12px;color:var(--mut)}
.live{margin-left:auto;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ok);background:var(--card);border:1px solid var(--bd);padding:6px 11px;border-radius:999px;box-shadow:var(--sh)}
.live i{width:8px;height:8px;border-radius:50%;background:currentColor;animation:pl 1.8s ease-in-out infinite}
.live.off{color:#c27a00}.live.off i{animation:none}
@keyframes pl{0%,100%{box-shadow:0 0 0 0 currentColor;opacity:1}50%{box-shadow:0 0 0 5px transparent;opacity:.55}}
.hero{background:var(--card);border-radius:26px;box-shadow:var(--sh);padding:20px 20px 18px;border:1px solid var(--bd);position:relative;overflow:hidden}
.hero:before{content:"";position:absolute;right:-40px;top:-50px;width:150px;height:150px;border-radius:50%;background:var(--ps);opacity:.8}
.hero>*{position:relative}
.tag{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--pink);background:var(--ps);border:1px solid var(--pb);padding:4px 10px;border-radius:999px}
h1{font-size:28px;line-height:1.15;margin:10px 0 4px;font-weight:800;letter-spacing:-.01em;word-break:break-word}
.sub{color:var(--mut);font-size:14px}
.bar{height:10px;border-radius:999px;background:var(--ps);margin:16px 0 8px;overflow:hidden;border:1px solid var(--pb)}
.bar b{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#ff5c93,var(--pink));transition:width .45s cubic-bezier(.3,.9,.3,1)}
.prog{font-size:13px;font-weight:600}
.who{margin:12px 4px 2px;font-size:13px;color:var(--mut)}.who .wh{display:block;margin-bottom:6px}.wps{display:flex;flex-wrap:wrap;gap:6px}.wp{font:inherit;font-size:13px;border:1px solid var(--bd);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 11px}.wp.me{background:var(--psoft);border-color:var(--psbd);color:var(--pink);font-weight:600;cursor:pointer}.wp:disabled{opacity:1}
form.add{display:flex;gap:8px;margin:14px 0 6px;background:var(--card);border-radius:999px;padding:6px 6px 6px 18px;box-shadow:var(--sh);border:1px solid var(--bd);transition:box-shadow .2s,border-color .2s}
form.add:focus-within{border-color:var(--pink);box-shadow:0 0 0 4px var(--ps)}
form.add input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-size:16px;color:var(--ink);outline:0;padding:8px 0}
form.add input::placeholder{color:var(--mut)}
form.add button{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:var(--pink);color:#fff;font-size:26px;line-height:1;cursor:pointer;display:grid;place-items:center;transition:transform .15s}
form.add button:active{transform:scale(.9)}
.sec{margin:20px 6px 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);display:flex;align-items:center;gap:8px}
.sec{all:unset;box-sizing:border-box;width:calc(100% - 12px);margin:20px 6px 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);display:flex;align-items:center;gap:8px;cursor:pointer}
.sec .sl{flex:1;text-align:left}.sec .sl small{display:block;text-transform:none;letter-spacing:0;font-weight:500;font-size:12px}
.sec .ar{transition:transform .2s}.sec.fold .ar{transform:rotate(-90deg)}
.evs{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0 0}
.evt{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:12px 6px 10px;box-shadow:var(--sh);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;min-width:0}
.evt .ei{font-size:18px;line-height:1}.evt b{font-size:22px;font-weight:800;letter-spacing:-.01em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.evt b.nil{color:var(--mut);font-weight:600}.evt small{color:var(--mut);font-size:12.5px}
.evt:active{transform:scale(.97)}
.recs{margin:14px 0 0}.rh{margin:0 6px 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.rchips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.rchip{display:inline-flex;align-items:center;gap:6px;background:var(--ps);color:var(--pink);border:1px solid var(--pb);border-radius:999px;padding:7px 12px;font-weight:700;font-size:14px;max-width:100%}
.rchip>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rchip button{all:unset;cursor:pointer;font-size:14px;opacity:.7;padding:0 2px}
.recs form.add{margin:0}
.acts{display:flex;gap:8px;margin:12px 0}
.acts button{flex:1;font:inherit;font-weight:700;font-size:14px;padding:11px 8px;border-radius:999px;border:1px solid var(--pb);background:var(--ps);color:var(--pink);cursor:pointer}
.sec em{font-style:normal;background:var(--card);border:1px solid var(--bd);border-radius:999px;padding:0 8px;font-size:12px}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
li{display:flex;align-items:center;gap:12px;background:var(--card);border-radius:20px;padding:11px 8px 11px 12px;box-shadow:var(--sh);border:1px solid var(--bd);animation:in .3s ease both}
@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.ck{flex:none;width:28px;height:28px;border-radius:50%;border:2px solid #cdbfb0;background:transparent;cursor:pointer;display:grid;place-items:center;padding:0;transition:background .2s,border-color .2s,transform .2s}
@media(prefers-color-scheme:dark){.ck{border-color:#5d5575}}
.ck svg{width:15px;height:15px;stroke:#fff;stroke-width:3.4;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:22;stroke-dashoffset:22;transition:stroke-dashoffset .3s .05s}
li.d .ck{background:var(--pink);border-color:var(--pink);animation:pop .35s ease}
li.d .ck svg{stroke-dashoffset:0}
@keyframes pop{50%{transform:scale(1.22)}}
.tx{flex:1;min-width:0;cursor:pointer}
.tx span{display:block;font-weight:600;font-size:16px;word-break:break-word}
.tx small{display:block;color:var(--mut);font-size:12.5px;margin-top:1px}
li.d .tx span{text-decoration:line-through;text-decoration-color:var(--pink);color:var(--mut);font-weight:500}
.as{flex:none;max-width:42%;border:1px solid var(--bd);background:transparent;color:var(--mut);border-radius:999px;padding:6px 10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.as.on{background:var(--ps);color:var(--pink);border-color:var(--pb)}
li.d .as:not(.on){display:none}
.as:not(.on){padding:6px 9px;font-size:16px;line-height:1;opacity:.75}
.opts{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.opt{border:1px solid var(--pb);background:var(--ps);color:var(--pink);border-radius:999px;padding:9px 14px;font:inherit;font-weight:700;font-size:15px;cursor:pointer}
.opt.nob{background:transparent;color:var(--mut);border-color:var(--bd)}
.sk{flex:none;width:28px;height:28px;border-radius:50%;border:2px solid #cdbfb0;background:transparent;display:grid;place-items:center;padding:0;pointer-events:none}
@media(prefers-color-scheme:dark){.sk{border-color:#5d5575}}
.sk svg{width:15px;height:15px;stroke:#fff;stroke-width:3.4;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:22;stroke-dashoffset:22}
li.sel .sk{background:var(--pink);border-color:var(--pink)}li.sel .sk svg{stroke-dashoffset:0}
li.sel{border-color:var(--pink);box-shadow:0 0 0 3px var(--ps)}li.sm{cursor:pointer}li.sm .tx{pointer-events:none}.as.ro{cursor:default}
.sbar{position:fixed;left:0;right:0;bottom:0;z-index:8;background:var(--card);border-top:1px solid var(--bd);box-shadow:0 -6px 24px rgba(0,0,0,.12);padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
.sbar .in{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:8px}.sbar .r{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.sbar .sn{font-weight:700;font-size:14px;flex:1;min-width:90px}
.sbar button{border:1px solid var(--pb);background:var(--ps);color:var(--pink);border-radius:999px;padding:8px 12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.sbar button:disabled{opacity:.4;cursor:default}.sbar .dg{color:#c04a42;border-color:rgba(192,74,66,.35);background:transparent}
body.sm{padding-bottom:210px}
.x{flex:none;width:36px;height:36px;border-radius:50%;border:0;background:transparent;color:var(--mut);cursor:pointer;font-size:18px;display:grid;place-items:center;opacity:.65}
.x:hover,.x:active{background:var(--ps);color:var(--pink);opacity:1}
.empty,.alld{text-align:center;background:var(--card);border-radius:24px;padding:26px 18px;margin-top:16px;box-shadow:var(--sh);border:1px solid var(--bd)}
.empty b,.alld b{display:block;font-size:17px}.empty span,.alld span{color:var(--mut);font-size:14px}
.big{font-size:40px;display:block;margin-bottom:4px}
.alld{background:var(--ps);border-color:var(--pb)}
.foot{text-align:center;margin:30px 8px 0;color:var(--mut);font-size:13px}
.foot a,.cta{display:inline-block;margin-top:12px;background:var(--ps);color:var(--pink);border:1px solid var(--pb);font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:15px}
.sheetw{position:fixed;inset:0;background:rgba(20,10,30,.45);display:flex;align-items:flex-end;justify-content:center;z-index:9;animation:fd .2s}
@keyframes fd{from{opacity:0}}
.sheet{width:100%;max-width:560px;background:var(--card);border-radius:28px 28px 0 0;padding:24px 20px calc(22px + env(safe-area-inset-bottom));animation:up .3s cubic-bezier(.3,.9,.3,1)}
@keyframes up{from{transform:translateY(40px);opacity:0}}
.sheet h2{margin:0 0 4px;font-size:20px}.sheet p{margin:0 0 14px;color:var(--mut);font-size:14px}
.sheet input{width:100%;font:inherit;font-size:16px;padding:13px 16px;border-radius:999px;border:1.5px solid var(--bd);background:var(--bg1);color:var(--ink);outline:0}
.sheet input:focus{border-color:var(--pink);box-shadow:0 0 0 4px var(--ps)}
.row{display:flex;gap:10px;margin-top:14px}
.row button{flex:1;font:inherit;font-weight:700;font-size:15px;padding:13px;border-radius:999px;cursor:pointer;border:1px solid var(--bd);background:var(--card);color:var(--ink)}
.row .go{background:var(--pink);border-color:var(--pink);color:#fff}
.gone{max-width:420px;margin:0 auto;text-align:center;padding-top:14vh}
.gone .logo{width:84px;height:84px;margin:0 auto 18px}.gone .logo svg{width:60px;height:60px}
.gone h1{font-size:24px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

const doc = (lang, head, body) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#fffaf2"><meta name="apple-mobile-web-app-capable" content="yes">${head}<style>${CSS}</style></head><body>${body}</body></html>`;

function gonePage(lang) {
  const t = T[lang];
  return doc(lang, `<title>Chef IA</title>`, `<div class="gone"><div class="logo">${HAT}</div><h1>${esc(t.ghd)}</h1><p class="sub">${esc(t.gtx)}</p><a class="cta" href="/">${esc(t.gcta)}</a></div>`);
}

// the page script uses no back-tick and no « ${ »: it is kept as a plain string
const JS = `
(function(){
var D=JSON.parse(document.getElementById('init').textContent),L=D.L,S=D.s,U=location.pathname+(location.search&&/hl=/.test(location.search)?location.search:''),POST=location.pathname;
var $=function(s){return document.querySelector(s)},pend=[],gonep=[],busy=0,off=0,me='',joinP=0,rnP='';
try{me=localStorage.getItem('lkName')||''}catch(e){}
function K(i){return String(i&&i.t||'').toLowerCase().trim()}
function cap(s){s=String(s);return s.charAt(0).toUpperCase()+s.slice(1)}
function f(s,o){return String(s).replace(/\\{(\\w)\\}/g,function(m,k){return o[k]})}
function sub(i){if(i.d&&i.b)return f(L.chk,{n:i.b});if(i.u)return f(L.addb,{n:i.u});return i.r||''}
function row(i){var li=document.createElement('li');if(i.d)li.className='d';
 if(selMode){var on=!!SEL[K(i)];li.className+=' sm'+(on?' sel':'');var sk=document.createElement('button');sk.type='button';sk.className='sk';sk.setAttribute('aria-pressed',on?'true':'false');sk.setAttribute('aria-label',i.t);sk.innerHTML='<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';
  var t0=document.createElement('div');t0.className='tx';var a0=document.createElement('span');a0.textContent=cap(i.t);t0.appendChild(a0);var s0=sub(i);if(s0){var m0=document.createElement('small');m0.textContent=s0;t0.appendChild(m0)}
  if(i.a){var ap=document.createElement('span');ap.className='as on ro';ap.textContent='\\ud83d\\ude4b '+i.a;li.append(sk,t0,ap)}else li.append(sk,t0);
  li.onclick=function(){var k=K(i);if(SEL[k])delete SEL[k];else SEL[k]=1;render()};return li}
 var c=document.createElement('button');c.type='button';c.className='ck';c.setAttribute('aria-label',i.t);c.setAttribute('aria-pressed',i.d?'true':'false');c.innerHTML='<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';
 var t=document.createElement('div');t.className='tx';var a=document.createElement('span');a.textContent=cap(i.t);t.appendChild(a);var s=sub(i);if(s){var m=document.createElement('small');m.textContent=s;t.appendChild(m)}
 var x=document.createElement('button');x.type='button';x.className='x';x.setAttribute('aria-label',L.del+' '+i.t);x.textContent='\\u2715';
 var as=document.createElement('button');as.type='button';as.className='as'+(i.a?' on'+(i.a===me?' mine':''):'');as.textContent=i.a?('\ud83d\ude4b '+i.a):'\ud83d\ude4b';as.title=i.a?'':L.take;as.setAttribute('aria-label',i.a?(i.a===me?L.untake:f(L.takeby,{n:i.a})):L.take);
 as.onclick=function(e){e.stopPropagation();take(i)};
 c.onclick=t.onclick=function(){tog(i)};x.onclick=function(){rm(i)};li.append(c,t,as,x);return li}

var evp=null,EV=[['g','👥','gu'],['b','💶','bu']];
function evFmt(k,v){if(v==null)return'—';return k==='b'?Number(v).toLocaleString(D.l,{maximumFractionDigits:2})+' €':String(v)}
function evRender(){var box=$('#evs');box.textContent='';var ev=S.ev||{};EV.forEach(function(e){var b=document.createElement('button');b.type='button';b.className='evt';var ic=document.createElement('span');ic.className='ei';ic.textContent=e[1];var v=document.createElement('b');v.textContent=evFmt(e[0],ev[e[0]]);if(ev[e[0]]==null)v.className='nil';var l=document.createElement('small');l.textContent=L[e[2]];b.append(ic,v,l);b.onclick=function(){evEdit(e[0],e[2])};box.appendChild(b)})}
function evEdit(k,lk){var w=document.createElement('div');w.className='sheetw';w.innerHTML='<div class="sheet" role="dialog" aria-modal="true"><h2></h2><input type="text" inputmode="decimal" maxlength="9" autocomplete="off"><div class="row"><button type="button" class="lt"></button><button type="button" class="go"></button></div></div>';
 w.querySelector('h2').textContent=L[lk];var i=w.querySelector('input');var cur=(S.ev||{})[k];i.value=cur==null?'':String(cur).replace('.',',');w.querySelector('.lt').textContent=L.no;w.querySelector('.go').textContent=L.ok;
 var end=function(save){if(save){var s=i.value.replace(',','.').replace(/[^0-9.]/g,''),n=s===''?null:parseFloat(s);if(n!==null&&!isFinite(n))n=null;if(n!==null){n=k==='b'?Math.round(Math.min(n,999999)*100)/100:Math.round(Math.min(n,9999));}
  S.ev=S.ev||{};if(n===null)delete S.ev[k];else S.ev[k]=n;evp=evp||{};evp[k]=n;evRender();send()}w.remove()};
 w.querySelector('.go').onclick=function(){end(1)};w.querySelector('.lt').onclick=function(){end(0)};w.onclick=function(e){if(e.target===w)end(0)};i.onkeydown=function(e){if(e.key==='Enter')end(1)};document.body.appendChild(w);setTimeout(function(){i.focus();i.select()},60)}
var rcp=null;
function recAll(){var out=[],seen={};function add(n,man){var k=String(n).toLowerCase().trim();if(!k||seen[k])return;seen[k]=1;out.push({n:String(n).trim(),m:man})}
 (S.rec||[]).forEach(function(n){add(n,true)});(S.items||[]).forEach(function(i){if(i.r)add(i.r,false);(i.c||[]).forEach(function(c){if(c&&c.r)add(c.r,false)})});return out}
function recRender(){var box=$('#rchips');box.textContent='';var all=recAll();$('#rhd').hidden=!all.length;
 all.forEach(function(r){var c=document.createElement('span');c.className='rchip';var n=document.createElement('span');n.textContent=r.n;c.appendChild(n);
  if(r.m){var x=document.createElement('button');x.type='button';x.textContent='✕';x.setAttribute('aria-label',L.del+' '+r.n);x.onclick=function(){recDel(r.n)};c.appendChild(x)}box.appendChild(c)})}
function recAdd(v){v=v.replace(/\\s+/g,' ').trim().slice(0,60);if(!v)return;var k=v.toLowerCase();if(recAll().some(function(r){return r.n.toLowerCase()===k}))return;
 S.rec=(S.rec||[]).concat([v]);rcp=rcp||{add:[],del:[]};rcp.del=rcp.del.filter(function(d){return d.toLowerCase()!==k});rcp.add.push(v);render();send()}
function recDel(n){var k=n.toLowerCase();S.rec=(S.rec||[]).filter(function(x){return x.toLowerCase()!==k});rcp=rcp||{add:[],del:[]};rcp.add=rcp.add.filter(function(a){return a.toLowerCase()!==k});rcp.del.push(n);render();send()}
var AR={o:D.A.o.map(function(x){return[x[0],new RegExp(x[1])]}),h:new RegExp(D.A.h)};
function rank(line){var s=String(line).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/\u0153/g,'oe').replace(/\\bnoix(?: de)? muscade/g,'muscade');if(AR.h.test(s))return 11;var best=null,pos=1e9;AR.o.forEach(function(x){var m=x[1].exec(s);if(m&&m.index<pos){pos=m.index;best=x[0]}});return best===null?-1:best}
function aisleOf(t){var r=rank(t);for(var k=0;k<D.A.a.length;k++){if(D.A.a[k][2].indexOf(r)>=0)return k}return D.A.a.length-1}
function nm(t){return String(t).toLowerCase().replace(/^\\s*[\\d.,\\/\\s]+(kg|g|gr|cl|ml|l|c\\.?\\s?[a-z]+)?\\b\\s*/,'').replace(/^(de |d'|du |des |of )/,'').trim()}
function render(){var items=S.items||[],got=items.filter(function(i){return i.d});
 $('#ttl').textContent=S.name||'';document.title=(S.name||'Chef IA')+' \\u00b7 Chef IA';
 $('#sub').textContent=items.length===1?L.n1:f(L.nN,{n:items.length});
 var p=items.length?Math.round(got.length*100/items.length):0;$('#fill').style.width=p+'%';$('#prog').textContent=items.length?f(L.prog,{d:got.length,n:items.length}):'';
 $('#hero .bar').style.display=items.length?'':'none';
 var box=$('#aisles'),g=[];box.textContent='';D.A.a.forEach(function(){g.push([])});
 items.forEach(function(i){g[aisleOf(i.t)].push(i)});
 g.forEach(function(arr,k){if(!arr.length)return;arr.sort(function(a,b){return(a.d?1:0)-(b.d?1:0)||nm(a.t).localeCompare(nm(b.t),D.l)});
  var a=D.A.a[k],fo=!!FOLD[a[0]],h=document.createElement('button');h.type='button';h.className='sec'+(fo?' fold':'');h.setAttribute('aria-expanded',fo?'false':'true');var e=document.createElement('span');e.textContent=a[1];var lb=document.createElement('span');lb.className='sl';lb.textContent=a[3][D.i]||a[3][0];if(fo){var sm=document.createElement('small');sm.textContent=arr.length===1?L.n1:f(L.nN,{n:arr.length});lb.appendChild(sm)}var c=document.createElement('em');c.textContent=arr.filter(function(i){return i.d}).length+'/'+arr.length;var ar=document.createElement('span');ar.className='ar';ar.textContent='\\u25be';h.append(e,lb,c,ar);
  h.onclick=function(){if(FOLD[a[0]])delete FOLD[a[0]];else FOLD[a[0]]=1;try{localStorage.setItem('lkFold',JSON.stringify(FOLD))}catch(x){}render()};box.appendChild(h);if(fo)return;
  var ul=document.createElement('ul');arr.forEach(function(i){ul.appendChild(row(i))});box.appendChild(ul)});
 evRender();recRender();$('#acts').hidden=!items.length;$('#cdone').hidden=!got.length;
 Object.keys(SEL).forEach(function(k){if(!items.some(function(i){return K(i)===k}))delete SEL[k]});selPaint();$('#empty').hidden=items.length>0;$('#alld').hidden=!(items.length&&got.length===items.length)}
function adopt(st){if(pend.length||gonep.length||evp||rcp||!st||!st.items)return;S=st;render();who();setOff(0)}
function setOff(v){off=v;var e=$('#live');e.className='live'+(v?' off':'');$('#livet').textContent=v?L.off:L.live}
function send(){if(busy||(!pend.length&&!gonep.length&&!evp&&!rcp&&!joinP))return;busy=1;joinP=0;var body={items:pend.splice(0,100),gone:gonep.splice(0,100),by:me};if(rnP){body.rn=rnP;rnP=''}if(evp){body.ev=evp;evp=null}if(rcp){body.rec=rcp;rcp=null}
 fetch(POST,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){if(r.status===404){location.reload();throw 0}if(!r.ok)throw 1;return r.json()})
 .then(function(st){busy=0;adopt(st);if(pend.length||gonep.length||evp||rcp)send()})
 .catch(function(e){busy=0;if(e===0)return;pend=body.items.concat(pend);gonep=body.gone.concat(gonep);if(body.ev){evp=Object.assign({},body.ev,evp||{})}if(body.rec){rcp=rcp||{add:[],del:[]};rcp.add=body.rec.add.concat(rcp.add);rcp.del=body.rec.del.concat(rcp.del)}setOff(1);setTimeout(send,3000)})}
function tog(i){var k=K(i),it=S.items.filter(function(x){return K(x)===k})[0];if(!it)return;it.d=!it.d;if(it.d){if(me)it.b=me}else delete it.b;
 pend=pend.filter(function(x){return K(x)!==k});var pp={t:it.t,d:it.d};if(Object.prototype.hasOwnProperty.call(it,'a'))pp.a=it.a;pend.push(pp);render();send()}
function rm(i){var k=K(i);S.items=S.items.filter(function(x){return K(x)!==k});pend=pend.filter(function(x){return K(x)!==k});gonep.push(k);render();send()}
var QU={kg:['m',1000],g:['m',1],gr:['m',1],gramme:['m',1],grammes:['m',1],gram:['m',1],grams:['m',1],l:['v',1000],litre:['v',1000],litres:['v',1000],liter:['v',1000],liters:['v',1000],cl:['v',10],ml:['v',1]};
function qCount(t){var c=String(t).trim().match(/^(\\d+(?:[.,]\\d+)?)\\s+(.+)$/);if(!c)return null;return{n:parseFloat(c[1].replace(',','.')),g:'c',unit:'',f:1,rest:c[2],count:true}}
function qParse(t){var m=String(t).trim().match(/^(\\d+(?:[.,]\\d+)?)\\s*([a-zA-Zé]+)\\b\\s*(.*)$/);if(!m)return qCount(t);var u=QU[m[2].toLowerCase()];if(!u)return qCount(t);return{n:parseFloat(m[1].replace(',','.'))*u[1],g:u[0],unit:m[2],f:u[1],rest:m[3]}}
function qKey(t){var p=qParse(t),r=p?p.rest:String(t);r=r.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/œ/g,'oe').replace(/æ/g,'ae').toLowerCase();r=r.replace(/,.*$/,' ').replace(/\\([^)]*\\)/g,' ').replace(/\\bpour\\b.*$/,' ').replace(/\\b(frais|fraiche|gros|gross|grosse|moyen|moyens|moyenne|entier|entiers|entiere|entieres|bio|supplementaire|supplementaires|extra|environ)\\b/g,' ');
 return r.replace(/^\\s*(de |d'|du |des |of |the )/,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\\s+/g,' ').trim().replace(/s\\b/g,'').replace(/^jaune d oeuf$/,'oeuf')}
function qNoun(r){return String(r).replace(/\\([^)]*\\)/g,' ').replace(/,.*$/,'').replace(/\\bpour\\b.*$/i,'').replace(/\\bsuppl[eé]mentaires?\\b/gi,'').replace(/\\s+/g,' ').trim()}
function qWord(x){return String(x).replace(/\\([^)]*\\)/g,' ').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/œ/g,'oe').toLowerCase().replace(/^\\s*(de |d'|du |des )/,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\\s+/g,' ').trim().replace(/s\\b/g,'')}
function sameItem(a,b){if(qKey(a)!==qKey(b))return false;var pa=qParse(a),pb=qParse(b);if(pa&&pb)return pa.g===pb.g;return !pa&&!pb}
function mergeText(a,b){var pa=qParse(a),pb=qParse(b),v=Math.round((pa.n+pb.n)/pa.f*100)/100,num=v.toLocaleString(D.l,{maximumFractionDigits:2});
 var yk=function(x){return /^jaunes?\\b/i.test(String(x).replace(/^(de |d')/i,''))},nr=pa.count&&yk(pa.rest)&&!yk(pb.rest)?pb.rest:pa.rest;
 return{num:pa.count?num:num+' '+pa.unit,t:pa.count?num+' '+qNoun(nr):num+' '+pa.unit+(qNoun(pa.rest)?' '+qNoun(pa.rest):'')}}
function dlg(text,okL,noL){return new Promise(function(res){var w=document.createElement('div');w.className='sheetw';w.innerHTML='<div class="sheet" role="dialog" aria-modal="true"><p></p><div class="row"><button type="button" class="lt"></button><button type="button" class="go"></button></div></div>';
 w.querySelector('p').textContent=text;w.querySelector('.lt').textContent=noL;w.querySelector('.go').textContent=okL;var end=function(v){w.remove();res(v)};
 w.querySelector('.go').onclick=function(){end(true)};w.querySelector('.lt').onclick=function(){end(false)};w.onclick=function(e){if(e.target===w)end(false)};document.body.appendChild(w)})}
function swap(old,txt){var ok=K(old),nk=txt.toLowerCase();S.items=S.items.filter(function(x){return x!==old});pend=pend.filter(function(x){return K(x)!==ok});
 if(ok!==nk)gonep.push(ok);gonep=gonep.filter(function(g){return g!==nk});var n={t:txt,d:false};if(old.u)n.u=old.u;if(old.r)n.r=old.r;S.items.push(n);var p={t:txt,d:false};if(ok!==nk)p.m=ok;pend.push(p)}
function addItem(v){v=v.replace(/\\s+/g,' ').trim().slice(0,120);if(!v)return;
 var i=S.items.filter(function(x){return sameItem(x.t,v)})[0];
 if(i&&i.d){S.items=S.items.filter(function(x){return x!==i});var k0=K(i);pend=pend.filter(function(x){return K(x)!==k0});gonep.push(k0);i=null}
 if(!i){var k=v.toLowerCase();gonep=gonep.filter(function(g){return g!==k});var n={t:v,d:false};if(me)n.u=me;S.items.push(n);pend=pend.filter(function(x){return K(x)!==k});pend.push({t:v,d:false});render();send();return}
 var pa=qParse(i.t),pb=qParse(v);if(!pa||!pb)return;
 var m=mergeText(i.t,v);
 if(qWord(pa.rest)===qWord(pb.rest)){swap(i,m.t);render();send();return}
 dlg(f(L.mg,{a:i.t,b:v,n:m.num}),L.my,L.no).then(function(ok){if(ok&&S.items.indexOf(i)>=0){swap(i,m.t)}else{var k=v.toLowerCase();gonep=gonep.filter(function(g){return g!==k});var n={t:v,d:false};if(me)n.u=me;S.items.push(n);pend=pend.filter(function(x){return K(x)!==k});pend.push({t:v,d:false})}render();send()})}
function setAll(v){S.items.forEach(function(it){if(!!it.d===v)return;it.d=v;if(v){if(me)it.b=me}else delete it.b;var k=K(it);pend=pend.filter(function(x){return K(x)!==k});pend.push({t:it.t,d:v})});render();send()}
function clearDone(){S.items=S.items.filter(function(it){if(!it.d)return true;var k=K(it);pend=pend.filter(function(x){return K(x)!==k});gonep.push(k);return false});render();send()}
var FOLD={};try{FOLD=JSON.parse(localStorage.getItem('lkFold')||'{}')||{}}catch(e){}
var selMode=false,SEL={};
function pushP(it){var k=K(it);pend=pend.filter(function(x){return K(x)!==k});var pp={t:it.t,d:it.d};if(Object.prototype.hasOwnProperty.call(it,'a'))pp.a=it.a;pend.push(pp)}
function selItems(){return(S.items||[]).filter(function(i){return SEL[K(i)]})}
function cleanN(v){return String(v||'').replace(/[<>"]/g,'').replace(/\\s+/g,' ').trim().slice(0,24)}
function askWho(cb){var names0=names();
 var w=document.createElement('div');w.className='sheetw';w.innerHTML='<div class="sheet" role="dialog" aria-modal="true"><h2></h2><div class="opts"></div><input maxlength="24" autocomplete="off"><div class="row"><button type="button" class="lt"></button></div></div>';
 w.querySelector('h2').textContent=L.asgT;var o=w.querySelector('.opts'),inp=w.querySelector('input');inp.placeholder=L.oth;w.querySelector('.lt').textContent=L.no;
 var end=function(n){w.remove();if(n!=null)cb(n)};
 var btns=[];names0.forEach(function(n){var b=document.createElement('button');b.type='button';b.className='opt';b.textContent=n===me?n+' ('+L.me+')':n;b.onclick=function(){end(n)};o.appendChild(b);btns.push([n,b])});
 var nb=document.createElement('button');nb.type='button';nb.className='opt nob';nb.textContent=L.nob;nb.onclick=function(){end('')};o.appendChild(nb);
 function flt(){var q=inp.value.toLowerCase().trim();return btns.filter(function(x){var ok=!q||x[0].toLowerCase().indexOf(q)>=0;x[1].style.display=ok?'':'none';return ok})}
 inp.oninput=flt;
 inp.onkeydown=function(e){if(e.key==='Enter'){var v=cleanN(inp.value);if(!v)return;var m=flt();end(m.length===1?m[0][0]:v)}};
 w.querySelector('.lt').onclick=function(){end()};w.onclick=function(e){if(e.target===w)end()};document.body.appendChild(w);setTimeout(function(){inp.focus()},60)}
function setA(arr,name){arr.forEach(function(it){if(name)it.a=name;else it.a='';pushP(it)});render();send()}
function take(i){askWho(function(n){var k=K(i),it=S.items.filter(function(x){return K(x)===k})[0];if(it)setA([it],n)})}
function selDone(){SEL={};selMode=false;render()}
function selPaint(){var n=Object.keys(SEL).length;$('#sbar').hidden=!selMode;document.body.classList.toggle('sm',selMode);$('#sel').textContent=selMode?L.selc:L.sel;$('#sbn').textContent=f(L.selN,{n:n});$('#sbar').querySelectorAll('button[data-a]').forEach(function(b){b.disabled=!n})}
function selTick(){selItems().forEach(function(it){it.d=true;if(me)it.b=me;pushP(it)});selDone();send()}
function selRm(){var arr=selItems();if(!arr.length)return;dlg(f(L.delQ,{n:arr.length}),L.delS,L.no).then(function(ok){if(!ok)return;arr.forEach(function(it){var k=K(it);S.items=S.items.filter(function(x){return K(x)!==k});pend=pend.filter(function(x){return K(x)!==k});gonep.push(k)});selDone();send()})}
$('#sel').onclick=function(){selMode=!selMode;SEL={};render()};
$('#sbAll').onclick=function(){(S.items||[]).forEach(function(i){SEL[K(i)]=1});render()};$('#sbNone').onclick=function(){SEL={};render()};
$('#sbMe').onclick=function(){if(!me){ask(true);return}var a=selItems();setA(a,me);selDone()};
$('#sbTo').onclick=function(){var a=selItems();if(!a.length)return;askWho(function(n){var b=selItems();setA(b,n);selDone()})};
$('#sbUn').onclick=function(){var a=selItems();setA(a,'');selDone()};
$('#sbTk').onclick=selTick;$('#sbRm').onclick=selRm;
$('#sa').onclick=function(){setAll(true)};$('#sn').onclick=function(){setAll(false)};$('#cd').onclick=clearDone;
$('#radd').onsubmit=function(e){e.preventDefault();var inp=$('#rin');recAdd(inp.value);inp.value='';inp.focus()};
$('#add').onsubmit=function(e){e.preventDefault();var inp=$('#in');addItem(inp.value);inp.value='';inp.focus()};
function names(){var n=[];function ad(v){v=cleanN(v);if(v&&n.map(function(x){return x.toLowerCase()}).indexOf(v.toLowerCase())<0)n.push(v)}ad(me);(S.pp||[]).forEach(ad);(S.items||[]).forEach(function(i){ad(i.a);ad(i.b);ad(i.u)});return n}
function who(){var box=$('#who');box.textContent='';var ns=names();if(!ns.length)return;var h=document.createElement('span');h.className='wh';h.textContent=L.pt+' ('+ns.length+')';box.appendChild(h);var row=document.createElement('div');row.className='wps';ns.forEach(function(n){var b=document.createElement('button');b.type='button';b.className='wp'+(n===me?' me':'');b.textContent=n===me?n+' ('+L.me+')':n;if(n===me){b.title=L.chg;b.onclick=function(){ask(true)}}else b.disabled=true;row.appendChild(b)});box.appendChild(row)}
function ask(force){var w=document.createElement('div');w.className='sheetw';w.innerHTML='<div class="sheet" role="dialog" aria-modal="true"><h2></h2><p></p><input maxlength="24" autocomplete="given-name" autocapitalize="words"><div class="row"><button type="button" class="lt"></button><button type="button" class="go"></button></div></div>';
 w.querySelector('h2').textContent=L.who;w.querySelector('p').textContent=L.whoH;var i=w.querySelector('input');i.placeholder=L.name;i.value=me;w.querySelector('.lt').textContent=L.later;w.querySelector('.go').textContent=L.ok;
 var end=function(save){if(save){var v=i.value.replace(/[<>"]/g,'').replace(/\\s+/g,' ').trim().slice(0,24);if(v){if(me&&me!==v)rnP=me;me=v;try{localStorage.setItem('lkName',v)}catch(e){}joinP=1;send()}}else if(!force){try{localStorage.setItem('lkAsked','1')}catch(e){}}w.remove();who()};
 w.querySelector('.go').onclick=function(){end(1)};w.querySelector('.lt').onclick=function(){end(0)};i.onkeydown=function(e){if(e.key==='Enter')end(1)};document.body.appendChild(w);setTimeout(function(){i.focus()},60)}
var act=Date.now(),IDLE=180000;function wake(){var was=Date.now()-act>IDLE;act=Date.now();if(was)poll()}
function poll(){if(document.hidden||Date.now()-act>IDLE||busy||pend.length||gonep.length||evp||rcp)return;fetch(POST+'?j=1&v='+S.v,{cache:'no-store'}).then(function(r){if(r.status===404){location.reload();throw 0}if(!r.ok)throw 1;return r.json()}).then(function(st){setOff(0);if(!st.same)adopt(st)}).catch(function(e){if(e!==0)setOff(1)})}
setInterval(poll,2500);document.addEventListener('visibilitychange',function(){if(!document.hidden){act=Date.now();poll()}});['pointerdown','keydown','touchstart','scroll','mousemove'].forEach(function(n){window.addEventListener(n,wake,{passive:true})});window.addEventListener('online',poll);
render();who();if(me){joinP=1;send()}var asked=0;try{asked=localStorage.getItem('lkAsked')}catch(e){}if(!me&&!asked)setTimeout(function(){ask(false)},700);
})();
`;

function page(lang, st, req) {
  const t = T[lang], host = String(req.headers["x-forwarded-host"] || req.headers.host || "").replace(/[^a-z0-9.:-]/gi, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0] === "http" ? "http" : "https";
  const init = JSON.stringify({ L: t, s: st, A: aisleData(), i: LANGS.indexOf(lang), l: lang }).replace(/</g, "\\u003c").split(String.fromCharCode(8232)).join("\\u2028").split(String.fromCharCode(8233)).join("\\u2029");
  const head = `<title>${esc(st.name)} · Chef IA</title><meta property="og:title" content="🛒 ${esc(st.name)}"><meta property="og:description" content="${esc(t.ogd)} · Chef IA"><meta property="og:type" content="website">${host ? `<meta property="og:image" content="${proto}://${host}/icons/icon-512.png"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">` : ""}`;
  const body = `<div class="w">
<header class="top"><div class="logo">${HAT}</div><div class="brand">Chef IA<small>${esc(t.shared)}</small></div><div class="live" id="live"><i></i><span id="livet">${esc(t.live)}</span></div></header>
<section class="hero" id="hero"><span class="tag">🛒 ${esc(t.shared)}</span><h1 id="ttl"></h1><div class="sub" id="sub"></div><div class="bar"><b id="fill"></b></div><div class="prog" id="prog"></div></section>
<div class="evs" id="evs"></div>
<div class="recs"><div class="rh" id="rhd" hidden>${esc(t.rh)}</div><div class="rchips" id="rchips"></div><form class="add radd" id="radd" autocomplete="off"><input id="rin" type="text" maxlength="60" enterkeyhint="done" placeholder="${esc(t.ra)}" aria-label="${esc(t.ra)}"><button type="submit" aria-label="+">+</button></form></div>
<div class="who" id="who"></div>
<form class="add" id="add" autocomplete="off"><input id="in" type="text" maxlength="120" enterkeyhint="done" placeholder="${esc(t.add)}" aria-label="${esc(t.add)}"><button type="submit" aria-label="+">+</button></form>
<div class="alld" id="alld" hidden><span class="big">🎉</span><b>${esc(t.done)}</b><span>${esc(t.doneH)}</span></div>
<div class="acts" id="acts" hidden><button type="button" id="sel">${esc(t.sel)}</button><button type="button" id="sa">${esc(t.sa)}</button><button type="button" id="sn">${esc(t.sn)}</button></div>
<div id="aisles"></div>
<div class="acts" id="cdone" hidden><button type="button" id="cd">${esc(t.cd)}</button></div>
<div class="sbar" id="sbar" hidden><div class="in"><div class="r"><span class="sn" id="sbn"></span><button type="button" id="sbAll">${esc(t.all)}</button><button type="button" id="sbNone">${esc(t.none)}</button></div>
<div class="r"><button type="button" id="sbMe" data-a="1">🙋 ${esc(t.take)}</button><button type="button" id="sbTo" data-a="1">${esc(t.asg)}</button><button type="button" id="sbUn" data-a="1">${esc(t.unas)}</button></div>
<div class="r"><button type="button" id="sbTk" data-a="1">✓ ${esc(t.tickS)}</button><button type="button" id="sbRm" data-a="1" class="dg">${esc(t.delS)}</button></div></div></div>
<div class="empty" id="empty" hidden><span class="big">🧺</span><b>${esc(t.empty)}</b><span>${esc(t.emptyH)}</span></div>
<footer class="foot">${esc(t.foot)}<br><a href="/">${esc(t.cta)}</a></footer></div>
<script type="application/json" id="init">${init}</script><script>${JS}</script>`;
  return doc(lang, head, body);
}
