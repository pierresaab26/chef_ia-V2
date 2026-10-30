import { authOk, fail, askClaude, parseJsonLoose, normRecipe, EXTRACT_RULES } from "./_lib.js";
import { fetchPage, recipeFromJsonLd, pageText, looksBlocked, looksLogin } from "./_page.js";

const SYSTEM =
  "Tu extrais une recette de cuisine ou de boisson depuis le texte d'une page web (balises <page>). " + EXTRACT_RULES;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!authOk(req, res)) return;

  const body = req.body || {};
  let target = String(body.url || "").trim();
  if (!target || target.length > 2000) return fail(res, "badurl");
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;
  const lang = String(body.lang || "").slice(0, 5);

  let page;
  try {
    page = await fetchPage(target, { lang });
  } catch (e) {
    return fail(res, e.code || "unreachable");
  }

  const host = page.url.hostname.replace(/^www\./, "");
  if (page.status === 401) return fail(res, "login");
  if (page.status === 403 || page.status === 429) return fail(res, "blocked");
  if (page.status === 404 || page.status === 410) return fail(res, "notfound");
  if (page.status >= 400 || page.status < 200) return fail(res, "unreachable");

  const ct = String(page.headers["content-type"] || "");
  if (ct && !/html|xml|text\/plain/i.test(ct)) return fail(res, "norecipe");

  // 1) Données structurées publiées par le site (sans IA, donc sans clé API)
  const direct = recipeFromJsonLd(page.body);
  if (direct) return res.status(200).json({ recipe: direct, source: "structured", host });

  // 2) Sinon, lecture du texte de la page par l'IA
  const { title, text } = pageText(page.body);
  if (looksBlocked(page.body, text.length)) return fail(res, "blocked");
  if (looksLogin(page.url, page.body, text.length)) return fail(res, "login");
  if (text.length < 200) return fail(res, "norecipe");

  try {
    const out = await askClaude({
      system: SYSTEM,
      model: process.env.EXTRACT_MODEL || process.env.MODEL || "claude-haiku-5-5",
      content: [{ type: "text", text: `<page host="${host}" title="${title.replace(/"/g, "'")}">\n${text}\n</page>` }],
    });
    const recipe = normRecipe(parseJsonLoose(out));
    if (!recipe) return fail(res, "norecipe");
    return res.status(200).json({ recipe, source: "text", host });
  } catch (e) {
    return fail(res, e.code || "upstream");
  }
}
