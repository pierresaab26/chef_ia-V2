// v512: SEO. Public, server-rendered pages for the PUBLISHED recipes (the ones in the public index « pub:ck »), so that Google / Gemini can read them:
//   /recettes            → list of the public recipes (hub)            (vercel.json rewrite → /api/shared?seo=hub)
//   /recette/<slug>-<id> → one recipe, with JSON-LD « Recipe »         (rewrite → /api/shared?seo=r&slug=…)
//   /sitemap.xml         → home, hub, legal, every public recipe       (rewrite → /api/shared?seo=sitemap)
// Not a route (the "_" prefix): it is called by api/shared.js. Only PUBLIC copies are shown (never a copy shared by link or in a circle).
// Everything that comes from the recipe is escaped; the page is plain HTML (no script except the JSON-LD data block).
// The author's name is NOT shown (the structured data names « Communauté CheffeEvalie »).

import { redis, overLimit } from "./_lib.js";

const PUB = "pub:ck";
export const base = () => { const u = String(process.env.SEO_BASE || "").replace(/\/$/, ""); return /^https:\/\/[a-z0-9.-]+$/i.test(u) ? u : "https://www.cheffeevalie.com"; };
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nz = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const slugOf = (t) => nz(t).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "recette";
export const recipePath = (ps, title) => "/recette/" + slugOf(title) + "--" + ps; // « -- » never occurs inside a slug, so the id is always found
const LANGS = ["fr", "en", "es", "de", "it", "pt"];
const lg = (l) => (LANGS.includes(l) ? l : "fr");
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const ldJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

// ---- texts of the public pages (6 languages) ----
const T = {
  fr: { home: "Accueil", all: "Toutes les recettes", ingr: "Ingrédients", ut: "Ustensiles", steps: "Préparation", tip: "Astuce du chef", prep: "Préparation", rest: "Repos", cook: "Cuisson", total: "Total", serv: (n) => n + (n > 1 ? " personnes" : " personne"),
    ctaT: "Cette recette n’est pas tout à fait la vôtre ?", ctaP: "Adaptez-la à vos goûts, à votre régime ou à ce que vous avez dans le frigo : sans gluten, sans lactose, végane, plus rapide, pour 2 ou 8 personnes… La cheffe IA réécrit la recette complète en quelques secondes.", ctaB: "Personnaliser cette recette",
    chips: ["Sans gluten", "Sans lactose", "Végane", "Plus rapide", "Pour 2 ou 8"], more: "Autres recettes de la communauté", photo: "Photo", legal: "Infos légales", by: "Recette de la communauté CheffeEvalie",
    metaD: (t, n, m) => t + " : recette en " + n + " ingrédients" + (m ? ", prête en " + m + " min" : "") + ". Personnalisez-la à votre façon (sans gluten, végane, pour 2 ou 8…) avec CheffeEvalie.",
    hubT: "Recettes de la communauté CheffeEvalie", hubH: "Recettes de la communauté", hubP: "Des recettes publiées par la communauté, toutes personnalisables : choisissez-en une, puis demandez à la cheffe IA de l’adapter à vos goûts, à votre régime ou à votre frigo.", hubD: "Recettes publiées par la communauté CheffeEvalie. Choisissez-en une et personnalisez-la : sans gluten, végane, plus rapide, pour 2 ou 8 personnes.", none: "Les premières recettes arrivent bientôt.", open: "Ouvrir l’application", gone: "Cette recette n’est plus disponible.", ing: (n) => n + " ingrédients", min: "min" },
  en: { home: "Home", all: "All recipes", ingr: "Ingredients", ut: "Utensils", steps: "Method", tip: "Chef’s tip", prep: "Prep", rest: "Rest", cook: "Cook", total: "Total", serv: (n) => "Serves " + n,
    ctaT: "Not quite your recipe?", ctaP: "Adapt it to your taste, your diet or what is in your fridge: gluten-free, lactose-free, vegan, faster, for 2 or 8 people… The AI chef rewrites the whole recipe in seconds.", ctaB: "Customise this recipe",
    chips: ["Gluten-free", "Lactose-free", "Vegan", "Faster", "For 2 or 8"], more: "More community recipes", photo: "Photo", legal: "Legal", by: "CheffeEvalie community recipe",
    metaD: (t, n, m) => t + ": a recipe with " + n + " ingredients" + (m ? ", ready in " + m + " min" : "") + ". Make it your own (gluten-free, vegan, for 2 or 8…) with CheffeEvalie.",
    hubT: "CheffeEvalie community recipes", hubH: "Community recipes", hubP: "Recipes published by the community, all customisable: pick one, then ask the AI chef to adapt it to your taste, your diet or your fridge.", hubD: "Recipes published by the CheffeEvalie community. Pick one and customise it: gluten-free, vegan, faster, for 2 or 8 people.", none: "The first recipes are coming soon.", open: "Open the app", gone: "This recipe is no longer available.", ing: (n) => n + " ingredients", min: "min" },
  es: { home: "Inicio", all: "Todas las recetas", ingr: "Ingredientes", ut: "Utensilios", steps: "Preparación", tip: "Consejo del chef", prep: "Preparación", rest: "Reposo", cook: "Cocción", total: "Total", serv: (n) => n + (n > 1 ? " personas" : " persona"),
    ctaT: "¿No es del todo tu receta?", ctaP: "Adáptala a tu gusto, a tu dieta o a lo que tienes en la nevera: sin gluten, sin lactosa, vegana, más rápida, para 2 u 8 personas… La chef IA reescribe la receta completa en segundos.", ctaB: "Personalizar esta receta",
    chips: ["Sin gluten", "Sin lactosa", "Vegana", "Más rápida", "Para 2 u 8"], more: "Más recetas de la comunidad", photo: "Foto", legal: "Aviso legal", by: "Receta de la comunidad CheffeEvalie",
    metaD: (t, n, m) => t + ": receta con " + n + " ingredientes" + (m ? ", lista en " + m + " min" : "") + ". Personalízala a tu manera (sin gluten, vegana, para 2 u 8…) con CheffeEvalie.",
    hubT: "Recetas de la comunidad CheffeEvalie", hubH: "Recetas de la comunidad", hubP: "Recetas publicadas por la comunidad, todas personalizables: elige una y pide a la chef IA que la adapte a tu gusto, tu dieta o tu nevera.", hubD: "Recetas publicadas por la comunidad CheffeEvalie. Elige una y personalízala: sin gluten, vegana, más rápida, para 2 u 8 personas.", none: "Las primeras recetas llegan pronto.", open: "Abrir la aplicación", gone: "Esta receta ya no está disponible.", ing: (n) => n + " ingredientes", min: "min" },
  de: { home: "Start", all: "Alle Rezepte", ingr: "Zutaten", ut: "Utensilien", steps: "Zubereitung", tip: "Tipp des Küchenchefs", prep: "Vorbereitung", rest: "Ruhezeit", cook: "Garzeit", total: "Gesamt", serv: (n) => n + " Portionen",
    ctaT: "Nicht ganz dein Rezept?", ctaP: "Passe es an deinen Geschmack, deine Ernährung oder deinen Kühlschrank an: glutenfrei, laktosefrei, vegan, schneller, für 2 oder 8 Personen … Die KI-Köchin schreibt das ganze Rezept in Sekunden um.", ctaB: "Dieses Rezept anpassen",
    chips: ["Glutenfrei", "Laktosefrei", "Vegan", "Schneller", "Für 2 oder 8"], more: "Weitere Rezepte der Community", photo: "Foto", legal: "Rechtliches", by: "Rezept der CheffeEvalie-Community",
    metaD: (t, n, m) => t + ": Rezept mit " + n + " Zutaten" + (m ? ", fertig in " + m + " Min." : "") + ". Mach es zu deinem Rezept (glutenfrei, vegan, für 2 oder 8 …) mit CheffeEvalie.",
    hubT: "Rezepte der CheffeEvalie-Community", hubH: "Rezepte der Community", hubP: "Von der Community veröffentlichte Rezepte, alle anpassbar: such eines aus und bitte die KI-Köchin, es an deinen Geschmack, deine Ernährung oder deinen Kühlschrank anzupassen.", hubD: "Von der CheffeEvalie-Community veröffentlichte Rezepte. Such eines aus und passe es an: glutenfrei, vegan, schneller, für 2 oder 8 Personen.", none: "Die ersten Rezepte kommen bald.", open: "App öffnen", gone: "Dieses Rezept ist nicht mehr verfügbar.", ing: (n) => n + " Zutaten", min: "Min." },
  it: { home: "Home", all: "Tutte le ricette", ingr: "Ingredienti", ut: "Utensili", steps: "Preparazione", tip: "Consiglio dello chef", prep: "Preparazione", rest: "Riposo", cook: "Cottura", total: "Totale", serv: (n) => n + (n > 1 ? " persone" : " persona"),
    ctaT: "Non è proprio la tua ricetta?", ctaP: "Adattala ai tuoi gusti, alla tua dieta o a ciò che hai in frigo: senza glutine, senza lattosio, vegana, più veloce, per 2 o 8 persone… La chef IA riscrive la ricetta completa in pochi secondi.", ctaB: "Personalizza questa ricetta",
    chips: ["Senza glutine", "Senza lattosio", "Vegana", "Più veloce", "Per 2 o 8"], more: "Altre ricette della community", photo: "Foto", legal: "Note legali", by: "Ricetta della community CheffeEvalie",
    metaD: (t, n, m) => t + ": ricetta con " + n + " ingredienti" + (m ? ", pronta in " + m + " min" : "") + ". Personalizzala a modo tuo (senza glutine, vegana, per 2 o 8…) con CheffeEvalie.",
    hubT: "Ricette della community CheffeEvalie", hubH: "Ricette della community", hubP: "Ricette pubblicate dalla community, tutte personalizzabili: scegline una e chiedi alla chef IA di adattarla ai tuoi gusti, alla tua dieta o al tuo frigo.", hubD: "Ricette pubblicate dalla community CheffeEvalie. Scegline una e personalizzala: senza glutine, vegana, più veloce, per 2 o 8 persone.", none: "Le prime ricette arrivano presto.", open: "Apri l’app", gone: "Questa ricetta non è più disponibile.", ing: (n) => n + " ingredienti", min: "min" },
  pt: { home: "Início", all: "Todas as receitas", ingr: "Ingredientes", ut: "Utensílios", steps: "Preparação", tip: "Dica do chef", prep: "Preparação", rest: "Repouso", cook: "Cozedura", total: "Total", serv: (n) => n + (n > 1 ? " pessoas" : " pessoa"),
    ctaT: "Não é bem a sua receita?", ctaP: "Adapte-a ao seu gosto, à sua dieta ou ao que tem no frigorífico: sem glúten, sem lactose, vegana, mais rápida, para 2 ou 8 pessoas… A chef IA reescreve a receita completa em segundos.", ctaB: "Personalizar esta receita",
    chips: ["Sem glúten", "Sem lactose", "Vegana", "Mais rápida", "Para 2 ou 8"], more: "Mais receitas da comunidade", photo: "Foto", legal: "Informações legais", by: "Receita da comunidade CheffeEvalie",
    metaD: (t, n, m) => t + ": receita com " + n + " ingredientes" + (m ? ", pronta em " + m + " min" : "") + ". Personalize-a à sua maneira (sem glúten, vegana, para 2 ou 8…) com o CheffeEvalie.",
    hubT: "Receitas da comunidade CheffeEvalie", hubH: "Receitas da comunidade", hubP: "Receitas publicadas pela comunidade, todas personalizáveis: escolha uma e peça à chef IA que a adapte ao seu gosto, à sua dieta ou ao seu frigorífico.", hubD: "Receitas publicadas pela comunidade CheffeEvalie. Escolha uma e personalize-a: sem glúten, vegana, mais rápida, para 2 ou 8 pessoas.", none: "As primeiras receitas chegam em breve.", open: "Abrir a aplicação", gone: "Esta receita já não está disponível.", ing: (n) => n + " ingredientes", min: "min" },
};

// ---- reading the recipe text (format of api/chat.js: « ## Title », header lines, « ## Ingredients » …) ----
const RE_SERV = /^(servings?|portions?|personnes?|raciones|porciones|personas|portionen|porzioni|doses|por[cç][oõ]es)\s*:\s*(\d{1,3})/i;
const RE_PREP = /^(prep|pr[eé]paration|preparaci[oó]n|zubereitung|vorbereitung|preparazione|prepara[cç][aã]o|preparo)\s*:\s*(.+)$/i;
const RE_REST = /^(rest|repos|reposo|ruhezeit|riposo|descanso|repouso)\s*:\s*(.+)$/i;
const RE_COOK = /^(cook|cuisson|cocci[oó]n|cottura|cozedura|cozimento|garzeit|kochzeit|backzeit)\s*:\s*(.+)$/i;
const K_ING = /^(ingr|zutat)/i, K_UT = /^(ustens|utens|utensil)/i, K_STEP = /^(pr[eé]p|steps?|method|instruc|zubereit|schritt|passag|passos|pasos|modo|directions)/i, K_TIP = /(conseil|astuce|tip\b|tipp|consejo|consiglio|dica|truco|truque|trick)/i;

// « 15 min », « 1 h 30 », « 2 hours » → minutes (0 when unreadable)
export function minutes(s) {
  const t = nz(s).replace(/\(.*?\)/g, " ");
  let m = 0, ok = false, x;
  if ((x = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h|heures?|hours?|std|stunden?|ore|horas?)\b\s*(\d{1,2})?/))) { m += Math.round(parseFloat(x[1].replace(",", ".")) * 60); if (x[2]) m += parseInt(x[2], 10); ok = true; }
  if ((x = t.match(/(\d+)\s*(?:min(?:ute)?s?|mn|minuten|minutos?|minuti)\b/))) { m += parseInt(x[1], 10); ok = true; }
  if (!ok && (x = t.match(/^\s*(\d{1,3})\s*$/))) m = parseInt(x[1], 10);
  return m > 0 && m < 60 * 24 * 3 ? m : 0;
}
const iso = (m) => (m > 0 ? "PT" + (m >= 60 ? Math.floor(m / 60) + "H" : "") + (m % 60 ? (m % 60) + "M" : "") : "");

export function parseRecipe(text) {
  const out = { servings: 0, prep: 0, rest: 0, cook: 0, ingredients: [], utensils: [], steps: [], tip: "" };
  let kind = "", sec = "";
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^##\s*(.+)$/);
    if (h) {
      const name = h[1].trim();
      kind = K_ING.test(name) ? "ing" : K_UT.test(name) ? "ut" : K_STEP.test(name) ? "step" : K_TIP.test(name) ? "tip" : "";
      sec = kind ? "" : sec;
      continue;
    }
    if (!kind) { // header lines right after the title
      let m;
      if ((m = line.match(RE_SERV))) out.servings = parseInt(m[2], 10);
      else if ((m = line.match(RE_PREP))) out.prep = minutes(m[2]);
      else if ((m = line.match(RE_REST))) out.rest = minutes(m[2]);
      else if ((m = line.match(RE_COOK))) out.cook = minutes(m[2]);
      continue;
    }
    const item = line.replace(/^[-•*]\s*/, "");
    if (kind === "ing" && /^[-•*]\s/.test(line)) out.ingredients.push(item.slice(0, 200));
    else if (kind === "ut" && /^[-•*]\s/.test(line)) out.utensils.push(item.slice(0, 200));
    else if (kind === "step") out.steps.push(line.replace(/^\d+\s*[.)]\s*/, "").slice(0, 1200));
    else if (kind === "tip") out.tip = (out.tip ? out.tip + " " : "") + item.slice(0, 600);
  }
  out.ingredients = out.ingredients.slice(0, 60); out.utensils = out.utensils.slice(0, 12); out.steps = out.steps.slice(0, 40);
  out.ok = out.ingredients.length >= 2 && out.steps.length >= 1;
  return out;
}

const okUnsplash = (u) => typeof u === "string" && /^https:\/\/images\.unsplash\.com\//.test(u) && u.length < 600;
const okUnsplashLink = (u) => typeof u === "string" && /^https:\/\/unsplash\.com\//.test(u) && u.length < 400;

const CSS = ":root{--bg:#fffaf2;--card:#fff;--ink:#16121a;--mut:#6b6674;--pink:#e5195f;--soft:#fde6ee;--bd:rgba(0,0,0,.09)}@media(prefers-color-scheme:dark){:root{--bg:#1f1b33;--card:#272339;--ink:#f4f1fa;--mut:#b4aec3;--soft:#3a2740;--bd:rgba(255,255,255,.12)}}"
  + "*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}a{color:var(--pink)}"
  + "header.top{max-width:760px;margin:0 auto;padding:14px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}header.top a.brand{font-weight:800;text-decoration:none;font-size:18px}header.top nav{display:flex;gap:14px;font-size:14px}"
  + "main{max-width:760px;margin:0 auto;padding:0 18px 40px}h1{font-size:30px;line-height:1.2;margin:6px 0 10px}h2{font-size:20px;margin:26px 0 10px}"
  + ".photo{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:22px;background:var(--soft);display:block}.credit{font-size:12px;color:var(--mut);margin:4px 2px 0}"
  + ".meta{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.meta span{background:var(--card);border:1px solid var(--bd);border-radius:999px;padding:5px 12px;font-size:14px}"
  + "ul.ing{padding-left:20px}ul.ing li,ol.st li{margin:6px 0}ol.st{padding-left:22px}.tip{background:var(--soft);border-radius:16px;padding:12px 16px}"
  + ".cta{background:var(--card);border:1px solid var(--bd);border-radius:22px;padding:18px;margin:28px 0;box-shadow:0 2px 12px rgba(0,0,0,.06)}.cta h2{margin-top:0}"
  + ".chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}.chips span{background:var(--soft);color:var(--pink);border-radius:999px;padding:4px 12px;font-size:14px;font-weight:600}"
  + "a.btn{display:inline-block;background:var(--pink);color:#fff;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 22px}"
  + "ul.list{list-style:none;padding:0;margin:0;display:grid;gap:12px}ul.list li{background:var(--card);border:1px solid var(--bd);border-radius:18px;overflow:hidden}ul.list a{display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;padding:10px}"
  + "ul.list img{width:84px;height:64px;object-fit:cover;border-radius:12px;flex:none;background:var(--soft)}ul.list b{display:block}ul.list small{color:var(--mut)}"
  + "footer{max-width:760px;margin:0 auto;padding:10px 18px 40px;font-size:13px;color:var(--mut);display:flex;gap:16px;flex-wrap:wrap}";

function shell({ lang, title, desc, canonical, noindex, ld, body, img }) {
  const b = base(), t = T[lg(lang)];
  return '<!DOCTYPE html><html lang="' + lg(lang) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + "<title>" + esc(title) + "</title>"
    + (desc ? '<meta name="description" content="' + esc(desc) + '">' : "")
    + (noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index,follow,max-image-preview:large">')
    + (canonical ? '<link rel="canonical" href="' + esc(canonical) + '">' : "")
    + '<meta property="og:type" content="' + (ld && ld["@type"] === "Recipe" ? "article" : "website") + '"><meta property="og:site_name" content="CheffeEvalie"><meta property="og:title" content="' + esc(title) + '">'
    + (desc ? '<meta property="og:description" content="' + esc(desc) + '">' : "") + (canonical ? '<meta property="og:url" content="' + esc(canonical) + '">' : "")
    + '<meta property="og:image" content="' + esc(img || b + "/icons/icon-512.png") + '"><meta name="twitter:card" content="' + (img ? "summary_large_image" : "summary") + '">'
    + '<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48.png"><link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">'
    + (ld ? '<script type="application/ld+json">' + ldJson(ld) + "</script>" : "")
    + "<style>" + CSS + "</style></head><body>"
    + '<header class="top"><a class="brand" href="/">🍳 CheffeEvalie</a><nav><a href="/">' + esc(t.open) + '</a><a href="/recettes">' + esc(t.all) + "</a></nav></header>"
    + body
    + '<footer><a href="/">' + esc(t.home) + '</a><a href="/recettes">' + esc(t.all) + '</a><a href="/legal">' + esc(t.legal) + "</a></footer></body></html>";
}

async function allPublic() {
  const [flat] = await redis([["HGETALL", PUB]]);
  const items = [];
  for (let i = 0; i + 1 < (flat || []).length; i += 2) { const m = parse(flat[i + 1]); if (m && m.sid && m.t && /^[a-z0-9-]{8,64}$/.test(m.sid)) items.push({ ps: m.sid, ck: m.ck || flat[i], t: String(m.t).slice(0, 100), l: lg(m.l) }); }
  return items;
}

function send(res, code, html, cache) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", cache || "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(code).send(html);
}
const notFound = (res) => send(res, 404, shell({ lang: "fr", title: "CheffeEvalie", noindex: true, body: '<main><h1>' + esc(T.fr.gone) + '</h1><p><a class="btn" href="/recettes">' + esc(T.fr.all) + "</a></p></main>" }), "public, s-maxage=60");

async function recipe(req, res, slug) {
  const b = base();
  const cut = String(slug || "").indexOf("--");
  const ps = cut >= 0 ? String(slug).slice(cut + 2) : "";
  if (!/^pub-[a-z0-9-]{4,60}$/.test(ps)) return notFound(res);
  const [raw, inIdx] = await redis([["GET", "s:" + ps], ["HEXISTS", PUB, ps]]);
  const d = raw ? parse(raw) : null;
  if (!d || !d.pub || !Number(inIdx) || !d.title) return notFound(res); // not public (or hidden / removed): no page
  const R = parseRecipe(d.text);
  if (!R.ok) return notFound(res); // not a complete recipe: nothing to index
  const path = recipePath(ps, d.title);
  let asked = ""; try { asked = decodeURIComponent(String((req.query && req.query.slug) || "")).toLowerCase(); } catch {}
  if (asked !== path.slice("/recette/".length)) { res.setHeader("Location", path); res.setHeader("Cache-Control", "public, s-maxage=3600"); return res.status(301).end(); }
  const lang = lg(d.lang), t = T[lang];
  const [rh, all] = await Promise.all([
    d.ck && /^[a-z0-9-]{1,60}$/.test(d.ck) ? redis([["HGETALL", "r:" + d.ck]]).then((x) => x[0]).catch(() => []) : [],
    allPublic().catch(() => []),
  ]);
  const votes = []; for (let i = 1; rh && i < rh.length; i += 2) { const n = Number(rh[i]); if (n >= 1 && n <= 5) votes.push(n); }
  const avg = votes.length ? votes.reduce((p, r) => p + r, 0) / votes.length : 0;
  const total = R.prep + R.rest + R.cook;
  const img = d.ph && okUnsplash(d.ph.u) ? d.ph.u : d.ph && okUnsplash(d.ph.t) ? d.ph.t : "";
  const canonical = b + path;
  const desc = t.metaD(d.title, R.ingredients.length, total || R.prep + R.cook).slice(0, 300);
  const ld = {
    "@context": "https://schema.org", "@type": "Recipe", name: d.title, description: desc, inLanguage: lang, url: canonical, mainEntityOfPage: canonical,
    author: { "@type": "Organization", name: "Communauté CheffeEvalie", url: b + "/" }, publisher: { "@type": "Organization", name: "CheffeEvalie", url: b + "/" },
    ...(d.ts ? { datePublished: new Date(Number(d.ts)).toISOString().slice(0, 10) } : {}),
    ...(img ? { image: [img] } : {}),
    ...(iso(R.prep) ? { prepTime: iso(R.prep) } : {}), ...(iso(R.cook) ? { cookTime: iso(R.cook) } : {}), ...(iso(total) ? { totalTime: iso(total) } : {}),
    ...(R.servings ? { recipeYield: String(R.servings) } : {}),
    recipeIngredient: R.ingredients,
    recipeInstructions: R.steps.map((s) => ({ "@type": "HowToStep", text: s })),
    ...(R.utensils.length ? { tool: R.utensils } : {}),
    ...(votes.length ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Math.round(avg * 10) / 10, ratingCount: votes.length, bestRating: 5, worstRating: 1 } } : {}),
  };
  const others = all.filter((o) => o.ps !== ps && o.l === lang).slice(0, 4);
  const cred = d.ph && d.ph.by && okUnsplashLink(d.ph.bu) && okUnsplashLink(d.ph.pg);
  const chips = [R.servings ? t.serv(R.servings) : "", R.prep ? t.prep + " " + R.prep + " " + t.min : "", R.rest ? t.rest + " " + R.rest + " " + t.min : "", R.cook ? t.cook + " " + R.cook + " " + t.min : "", total ? t.total + " " + total + " " + t.min : ""].filter(Boolean);
  const body = "<main><article>"
    + (img ? '<img class="photo" src="' + esc(img) + '" alt="' + esc(d.title) + '" width="1080" height="720" fetchpriority="high">' + (cred ? '<p class="credit">' + esc(t.photo) + ' : <a href="' + esc(d.ph.bu + (d.ph.bu.includes("?") ? "&" : "?") + "utm_source=chef_ia&utm_medium=referral") + '" rel="nofollow noopener">' + esc(String(d.ph.by).slice(0, 80)) + '</a> · <a href="' + esc(d.ph.pg + (d.ph.pg.includes("?") ? "&" : "?") + "utm_source=chef_ia&utm_medium=referral") + '" rel="nofollow noopener">Unsplash</a></p>' : "") : "")
    + "<h1>" + esc(d.title) + "</h1>" + '<p style="color:var(--mut);margin:0">' + esc(t.by) + (votes.length ? " · ⭐ " + (Math.round(avg * 10) / 10) + "/5 (" + votes.length + ")" : "") + "</p>"
    + (chips.length ? '<div class="meta">' + chips.map((c) => "<span>" + esc(c) + "</span>").join("") + "</div>" : "")
    + "<h2>" + esc(t.ingr) + '</h2><ul class="ing">' + R.ingredients.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>"
    + (R.utensils.length ? "<h2>" + esc(t.ut) + '</h2><ul class="ing">' + R.utensils.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "")
    + "<h2>" + esc(t.steps) + '</h2><ol class="st">' + R.steps.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ol>"
    + (R.tip ? '<h2>' + esc(t.tip) + '</h2><p class="tip">' + esc(R.tip) + "</p>" : "")
    + "</article>"
    + '<section class="cta"><h2>' + esc(t.ctaT) + "</h2><p>" + esc(t.ctaP) + '</p><div class="chips">' + t.chips.map((c) => "<span>" + esc(c) + "</span>").join("") + '</div><a class="btn" href="/?s=' + encodeURIComponent(ps) + '">' + esc(t.ctaB) + "</a></section>"
    + (others.length ? "<h2>" + esc(t.more) + '</h2><ul class="list">' + others.map((o) => '<li><a href="' + esc(recipePath(o.ps, o.t)) + '"><div><b>' + esc(o.t) + "</b></div></a></li>").join("") + "</ul>" : "")
    + "</main>";
  return send(res, 200, shell({ lang, title: d.title + " – CheffeEvalie", desc, canonical, ld, body, img }));
}

async function hub(res) {
  const b = base();
  const all = await allPublic();
  const docs = all.length ? (await redis([["MGET", ...all.map((o) => "s:" + o.ps)]]))[0] : [];
  const rows = all.map((o, i) => { const d = parse(docs[i]); return d && d.pub ? { ...o, img: d.ph && okUnsplash(d.ph.t) ? d.ph.t : "", ts: Number(d.ts) || 0, ing: parseRecipe(d.text) } : null; }).filter((o) => o && o.ing.ok).sort((p, r) => r.ts - p.ts);
  const t = T.fr, canonical = b + "/recettes";
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: t.hubT, url: canonical, inLanguage: "fr", description: t.hubD,
    mainEntity: { "@type": "ItemList", itemListElement: rows.slice(0, 100).map((o, i) => ({ "@type": "ListItem", position: i + 1, url: b + recipePath(o.ps, o.t), name: o.t })) } };
  const body = "<main><h1>" + esc(t.hubH) + "</h1><p>" + esc(t.hubP) + "</p>"
    + (rows.length ? '<ul class="list">' + rows.map((o) => '<li><a href="' + esc(recipePath(o.ps, o.t)) + '" hreflang="' + o.l + '">' + (o.img ? '<img src="' + esc(o.img) + '" alt="" width="84" height="64" loading="lazy">' : "") + "<div><b>" + esc(o.t) + "</b><small>" + esc(T[o.l].ing(o.ing.ingredients.length)) + (o.ing.prep + o.ing.cook ? " · " + (o.ing.prep + o.ing.cook) + " " + T[o.l].min : "") + "</small></div></a></li>").join("") + "</ul>" : "<p>" + esc(t.none) + "</p>")
    + '<div class="cta"><h2>' + esc(t.ctaT) + "</h2><p>" + esc(t.ctaP) + '</p><div class="chips">' + t.chips.map((c) => "<span>" + esc(c) + "</span>").join("") + '</div><a class="btn" href="/">' + esc(t.open) + "</a></div></main>";
  return send(res, 200, shell({ lang: "fr", title: t.hubT, desc: t.hubD, canonical, ld, body }));
}

async function sitemap(res) {
  const b = base();
  let urls = [[b + "/", ""], [b + "/recettes", ""], [b + "/legal", ""]];
  try {
    const all = await allPublic();
    const docs = all.length ? (await redis([["MGET", ...all.map((o) => "s:" + o.ps)]]))[0] : [];
    all.forEach((o, i) => { const d = parse(docs[i]); if (d && d.pub && parseRecipe(d.text).ok) urls.push([b + recipePath(o.ps, o.t), d.ts ? new Date(Number(d.ts)).toISOString().slice(0, 10) : ""]); });
  } catch {}
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(([u, d]) => "<url><loc>" + esc(u) + "</loc>" + (d ? "<lastmod>" + d + "</lastmod>" : "") + "</url>").join("") + "</urlset>");
}

export async function seoHandler(req, res) {
  if (await overLimit(req, "rl:seo:", 120)) return res.status(429).send("Too many requests");
  const k = String((req.query && req.query.seo) || "");
  try {
    if (k === "sitemap") return await sitemap(res);
    if (k === "hub") return await hub(res);
    if (k === "r") return await recipe(req, res, String((req.query && req.query.slug) || "").toLowerCase());
  } catch { return res.status(502).send("Temporarily unavailable"); }
  return notFound(res);
}
