import { redis, overLimit, clean } from "./_lib.js";
import { load, save, merge, cut, LINK_TTL } from "./_family.js";
import { isOffensive } from "./_words.js";

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
const view = (l) => ({ name: l.name, v: l.v, items: l.items.map((x) => x.i) });

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
    for (const raw of (Array.isArray(body.items) ? body.items : []).slice(0, 20)) {
      const i0 = raw && typeof raw === "object" ? (raw.i && typeof raw.i === "object" ? raw.i : raw) : null;
      const t = i0 ? cut(i0.t, 120).replace(/\s+/g, " ").trim() : "";
      if (!t) continue;
      const k = t.toLowerCase(), ex = l.items.find((x) => x.k === k);
      const i = ex ? { ...ex.i } : { t };
      i.d = !!i0.d;
      if (ex) { if (i.d) { if (by) i.b = by; } else delete i.b; }
      else if (by) i.u = by;
      ups.push({ k, i, ts: now });
    }
    const dels = {};
    for (const k0 of (Array.isArray(body.gone) ? body.gone : []).slice(0, 20)) { const k = cut(k0, 200).toLowerCase().trim(); if (k) dels[k] = 1; }
    if (merge(l, ups, dels)) { l.v++; await save(l); }
    await redis([["EXPIRE", "sk:" + code, String(LINK_TTL)]]);
    headers(res, "application/json; charset=utf-8");
    return res.status(200).json(view(l));
  } catch (e) { return res.status(502).json({ error: "storage" }); }
}

const T = {
  fr: { live: "En direct", off: "Reconnexion…", n1: "1 article", nN: "{n} articles", prog: "{d} sur {n} dans le panier", add: "Ajouter un article…", buy: "À acheter", cart: "Dans le panier", empty: "La liste est vide", emptyH: "Ajoute un premier article ci-dessus.", done: "Tout est dans le panier !", doneH: "Bonnes courses, et bon appétit.", chk: "coché par {n}", addb: "ajouté par {n}", you: "Tu es {n}", chg: "changer", who: "Comment t’appelles-tu ?", whoH: "Pour que les autres voient qui coche ou ajoute les articles.", ok: "Valider", later: "Plus tard", del: "Retirer", shared: "Liste partagée", foot: "Cette liste est partagée avec Chef IA, ton chef de poche.", cta: "Découvrir Chef IA", ghd: "Ce lien n’est plus valide", gtx: "Le propriétaire a désactivé ce lien ou il a expiré. Demande-lui un nouveau lien.", gcta: "Découvrir Chef IA", name: "Ton prénom", ogd: "Liste de courses partagée" },
  en: { live: "Live", off: "Reconnecting…", n1: "1 item", nN: "{n} items", prog: "{d} of {n} in the cart", add: "Add an item…", buy: "To buy", cart: "In the cart", empty: "The list is empty", emptyH: "Add a first item above.", done: "Everything is in the cart!", doneH: "Happy shopping, and enjoy your meal.", chk: "ticked by {n}", addb: "added by {n}", you: "You are {n}", chg: "change", who: "What’s your name?", whoH: "So the others can see who ticks or adds items.", ok: "Save", later: "Later", del: "Remove", shared: "Shared list", foot: "This list is shared with Chef IA, your pocket chef.", cta: "Discover Chef IA", ghd: "This link is no longer valid", gtx: "The owner switched this link off or it has expired. Ask for a new link.", gcta: "Discover Chef IA", name: "Your first name", ogd: "Shared shopping list" },
  es: { live: "En directo", off: "Reconectando…", n1: "1 artículo", nN: "{n} artículos", prog: "{d} de {n} en el carrito", add: "Añadir un artículo…", buy: "Por comprar", cart: "En el carrito", empty: "La lista está vacía", emptyH: "Añade un primer artículo arriba.", done: "¡Todo está en el carrito!", doneH: "Buenas compras y buen provecho.", chk: "marcado por {n}", addb: "añadido por {n}", you: "Eres {n}", chg: "cambiar", who: "¿Cómo te llamas?", whoH: "Para que los demás vean quién marca o añade artículos.", ok: "Guardar", later: "Más tarde", del: "Quitar", shared: "Lista compartida", foot: "Esta lista se comparte con Chef IA, tu chef de bolsillo.", cta: "Descubrir Chef IA", ghd: "Este enlace ya no es válido", gtx: "El propietario ha desactivado este enlace o ha caducado. Pídele uno nuevo.", gcta: "Descubrir Chef IA", name: "Tu nombre", ogd: "Lista de la compra compartida" },
  de: { live: "Live", off: "Verbinde neu…", n1: "1 Artikel", nN: "{n} Artikel", prog: "{d} von {n} im Korb", add: "Artikel hinzufügen…", buy: "Zu kaufen", cart: "Im Korb", empty: "Die Liste ist leer", emptyH: "Füge oben den ersten Artikel hinzu.", done: "Alles ist im Korb!", doneH: "Viel Spaß beim Einkaufen und guten Appetit.", chk: "abgehakt von {n}", addb: "hinzugefügt von {n}", you: "Du bist {n}", chg: "ändern", who: "Wie heißt du?", whoH: "Damit die anderen sehen, wer Artikel abhakt oder hinzufügt.", ok: "Speichern", later: "Später", del: "Entfernen", shared: "Geteilte Liste", foot: "Diese Liste wird mit Chef IA geteilt, deinem Taschenkoch.", cta: "Chef IA entdecken", ghd: "Dieser Link ist nicht mehr gültig", gtx: "Der Besitzer hat den Link deaktiviert oder er ist abgelaufen. Frag nach einem neuen Link.", gcta: "Chef IA entdecken", name: "Dein Vorname", ogd: "Geteilte Einkaufsliste" },
  it: { live: "In diretta", off: "Riconnessione…", n1: "1 articolo", nN: "{n} articoli", prog: "{d} su {n} nel carrello", add: "Aggiungi un articolo…", buy: "Da comprare", cart: "Nel carrello", empty: "La lista è vuota", emptyH: "Aggiungi un primo articolo qui sopra.", done: "Tutto è nel carrello!", doneH: "Buona spesa e buon appetito.", chk: "spuntato da {n}", addb: "aggiunto da {n}", you: "Sei {n}", chg: "cambia", who: "Come ti chiami?", whoH: "Così gli altri vedono chi spunta o aggiunge gli articoli.", ok: "Salva", later: "Più tardi", del: "Rimuovi", shared: "Lista condivisa", foot: "Questa lista è condivisa con Chef IA, il tuo chef tascabile.", cta: "Scopri Chef IA", ghd: "Questo link non è più valido", gtx: "Il proprietario ha disattivato questo link oppure è scaduto. Chiedi un nuovo link.", gcta: "Scopri Chef IA", name: "Il tuo nome", ogd: "Lista della spesa condivisa" },
  pt: { live: "Em direto", off: "A reconectar…", n1: "1 artigo", nN: "{n} artigos", prog: "{d} de {n} no carrinho", add: "Adicionar um artigo…", buy: "Para comprar", cart: "No carrinho", empty: "A lista está vazia", emptyH: "Adiciona um primeiro artigo acima.", done: "Está tudo no carrinho!", doneH: "Boas compras e bom apetite.", chk: "riscado por {n}", addb: "adicionado por {n}", you: "Tu és {n}", chg: "mudar", who: "Como te chamas?", whoH: "Para os outros verem quem risca ou adiciona artigos.", ok: "Guardar", later: "Mais tarde", del: "Retirar", shared: "Lista partilhada", foot: "Esta lista é partilhada com o Chef IA, o teu chef de bolso.", cta: "Descobrir o Chef IA", ghd: "Este link já não é válido", gtx: "O proprietário desativou este link ou expirou. Pede um novo link.", gcta: "Descobrir o Chef IA", name: "O teu nome", ogd: "Lista de compras partilhada" },
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
.who{margin:12px 4px 2px;font-size:13px;color:var(--mut)}.who button{all:unset;cursor:pointer;color:var(--pink);font-weight:600;text-decoration:underline;text-underline-offset:2px}
form.add{display:flex;gap:8px;margin:14px 0 6px;background:var(--card);border-radius:999px;padding:6px 6px 6px 18px;box-shadow:var(--sh);border:1px solid var(--bd);transition:box-shadow .2s,border-color .2s}
form.add:focus-within{border-color:var(--pink);box-shadow:0 0 0 4px var(--ps)}
form.add input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-size:16px;color:var(--ink);outline:0;padding:8px 0}
form.add input::placeholder{color:var(--mut)}
form.add button{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:var(--pink);color:#fff;font-size:26px;line-height:1;cursor:pointer;display:grid;place-items:center;transition:transform .15s}
form.add button:active{transform:scale(.9)}
.sec{margin:20px 6px 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);display:flex;align-items:center;gap:8px}
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
var $=function(s){return document.querySelector(s)},pend=[],gonep=[],busy=0,off=0,me='';
try{me=localStorage.getItem('lkName')||''}catch(e){}
function K(i){return String(i&&i.t||'').toLowerCase().trim()}
function cap(s){s=String(s);return s.charAt(0).toUpperCase()+s.slice(1)}
function f(s,o){return String(s).replace(/\\{(\\w)\\}/g,function(m,k){return o[k]})}
function sub(i){if(i.d&&i.b)return f(L.chk,{n:i.b});if(i.u)return f(L.addb,{n:i.u});return i.r||''}
function row(i){var li=document.createElement('li');if(i.d)li.className='d';
 var c=document.createElement('button');c.type='button';c.className='ck';c.setAttribute('aria-label',i.t);c.setAttribute('aria-pressed',i.d?'true':'false');c.innerHTML='<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';
 var t=document.createElement('div');t.className='tx';var a=document.createElement('span');a.textContent=cap(i.t);t.appendChild(a);var s=sub(i);if(s){var m=document.createElement('small');m.textContent=s;t.appendChild(m)}
 var x=document.createElement('button');x.type='button';x.className='x';x.setAttribute('aria-label',L.del+' '+i.t);x.textContent='\\u2715';
 c.onclick=t.onclick=function(){tog(i)};x.onclick=function(){rm(i)};li.append(c,t,x);return li}
function render(){var items=S.items||[],buy=items.filter(function(i){return!i.d}),got=items.filter(function(i){return i.d});
 $('#ttl').textContent=S.name||'';document.title=(S.name||'Chef IA')+' \\u00b7 Chef IA';
 $('#sub').textContent=items.length===1?L.n1:f(L.nN,{n:items.length});
 var p=items.length?Math.round(got.length*100/items.length):0;$('#fill').style.width=p+'%';$('#prog').textContent=items.length?f(L.prog,{d:got.length,n:items.length}):'';
 $('#hero .bar').style.display=items.length?'':'none';
 var b=$('#buy'),g=$('#got');b.textContent='';g.textContent='';buy.forEach(function(i){b.appendChild(row(i))});got.forEach(function(i){g.appendChild(row(i))});
 $('#sbuy').hidden=!buy.length;$('#sgot').hidden=!got.length;$('#nb').textContent=buy.length;$('#ng').textContent=got.length;
 $('#empty').hidden=items.length>0;$('#alld').hidden=!(items.length&&!buy.length)}
function adopt(st){if(pend.length||gonep.length||!st||!st.items)return;S=st;render();setOff(0)}
function setOff(v){off=v;var e=$('#live');e.className='live'+(v?' off':'');$('#livet').textContent=v?L.off:L.live}
function send(){if(busy||(!pend.length&&!gonep.length))return;busy=1;var body={items:pend,gone:gonep,by:me};pend=[];gonep=[];
 fetch(POST,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){if(r.status===404){location.reload();throw 0}if(!r.ok)throw 1;return r.json()})
 .then(function(st){busy=0;adopt(st);if(pend.length||gonep.length)send()})
 .catch(function(e){busy=0;if(e===0)return;pend=body.items.concat(pend);gonep=body.gone.concat(gonep);setOff(1);setTimeout(send,3000)})}
function tog(i){var k=K(i),it=S.items.filter(function(x){return K(x)===k})[0];if(!it)return;it.d=!it.d;if(it.d){if(me)it.b=me}else delete it.b;
 pend=pend.filter(function(x){return K(x)!==k});pend.push({t:it.t,d:it.d});render();send()}
function rm(i){var k=K(i);S.items=S.items.filter(function(x){return K(x)!==k});pend=pend.filter(function(x){return K(x)!==k});gonep.push(k);render();send()}
function addItem(v){v=v.replace(/\\s+/g,' ').trim().slice(0,120);if(!v)return;var k=v.toLowerCase(),ex=S.items.filter(function(x){return K(x)===k})[0];
 if(ex){if(ex.d){ex.d=false;delete ex.b;pend.push({t:ex.t,d:false})}}else{var n={t:v,d:false};if(me)n.u=me;S.items.push(n);pend.push({t:v,d:false})}render();send()}
$('#add').onsubmit=function(e){e.preventDefault();var inp=$('#in');addItem(inp.value);inp.value='';inp.focus()};
function who(){$('#who').textContent='';if(me){var s=document.createElement('span');s.textContent=f(L.you,{n:me})+' \\u00b7 ';var b=document.createElement('button');b.type='button';b.textContent=L.chg;b.onclick=function(){ask(true)};$('#who').append(s,b)}}
function ask(force){var w=document.createElement('div');w.className='sheetw';w.innerHTML='<div class="sheet" role="dialog" aria-modal="true"><h2></h2><p></p><input maxlength="24" autocomplete="given-name" autocapitalize="words"><div class="row"><button type="button" class="lt"></button><button type="button" class="go"></button></div></div>';
 w.querySelector('h2').textContent=L.who;w.querySelector('p').textContent=L.whoH;var i=w.querySelector('input');i.placeholder=L.name;i.value=me;w.querySelector('.lt').textContent=L.later;w.querySelector('.go').textContent=L.ok;
 var end=function(save){if(save){var v=i.value.replace(/[<>"]/g,'').replace(/\\s+/g,' ').trim().slice(0,24);if(v){me=v;try{localStorage.setItem('lkName',v)}catch(e){}}}else if(!force){try{localStorage.setItem('lkAsked','1')}catch(e){}}w.remove();who()};
 w.querySelector('.go').onclick=function(){end(1)};w.querySelector('.lt').onclick=function(){end(0)};i.onkeydown=function(e){if(e.key==='Enter')end(1)};document.body.appendChild(w);setTimeout(function(){i.focus()},60)}
function poll(){if(document.hidden||busy||pend.length||gonep.length)return;fetch(POST+'?j=1&v='+S.v,{cache:'no-store'}).then(function(r){if(r.status===404){location.reload();throw 0}if(!r.ok)throw 1;return r.json()}).then(function(st){setOff(0);if(!st.same)adopt(st)}).catch(function(e){if(e!==0)setOff(1)})}
setInterval(poll,2500);document.addEventListener('visibilitychange',function(){if(!document.hidden)poll()});window.addEventListener('online',poll);
render();who();var asked=0;try{asked=localStorage.getItem('lkAsked')}catch(e){}if(!me&&!asked)setTimeout(function(){ask(false)},700);
})();
`;

function page(lang, st, req) {
  const t = T[lang], host = String(req.headers["x-forwarded-host"] || req.headers.host || "").replace(/[^a-z0-9.:-]/gi, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0] === "http" ? "http" : "https";
  const init = JSON.stringify({ L: t, s: st }).replace(/</g, "\\u003c").split(String.fromCharCode(8232)).join("\\u2028").split(String.fromCharCode(8233)).join("\\u2029");
  const head = `<title>${esc(st.name)} · Chef IA</title><meta property="og:title" content="🛒 ${esc(st.name)}"><meta property="og:description" content="${esc(t.ogd)} · Chef IA"><meta property="og:type" content="website">${host ? `<meta property="og:image" content="${proto}://${host}/icons/icon-512.png"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">` : ""}`;
  const body = `<div class="w">
<header class="top"><div class="logo">${HAT}</div><div class="brand">Chef IA<small>${esc(t.shared)}</small></div><div class="live" id="live"><i></i><span id="livet">${esc(t.live)}</span></div></header>
<section class="hero" id="hero"><span class="tag">🛒 ${esc(t.shared)}</span><h1 id="ttl"></h1><div class="sub" id="sub"></div><div class="bar"><b id="fill"></b></div><div class="prog" id="prog"></div></section>
<div class="who" id="who"></div>
<form class="add" id="add" autocomplete="off"><input id="in" type="text" maxlength="120" enterkeyhint="done" placeholder="${esc(t.add)}" aria-label="${esc(t.add)}"><button type="submit" aria-label="+">+</button></form>
<div class="alld" id="alld" hidden><span class="big">🎉</span><b>${esc(t.done)}</b><span>${esc(t.doneH)}</span></div>
<div class="sec" id="sbuy">${esc(t.buy)} <em id="nb"></em></div><ul id="buy"></ul>
<div class="sec" id="sgot">${esc(t.cart)} <em id="ng"></em></div><ul id="got"></ul>
<div class="empty" id="empty" hidden><span class="big">🧺</span><b>${esc(t.empty)}</b><span>${esc(t.emptyH)}</span></div>
<footer class="foot">${esc(t.foot)}<br><a href="/">${esc(t.cta)}</a></footer></div>
<script type="application/json" id="init">${init}</script><script>${JS}</script>`;
  return doc(lang, head, body);
}
