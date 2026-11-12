import { captchaOk, authOk, fail, askClaude, parseJsonLoose, normRecipe, EXTRACT_RULES, overLimit } from "./_lib.js";

// v330: two cases. (1) the image contains a WRITTEN recipe: faithful extraction (kind "text").
// (2) the image shows a prepared dish or drink with no recipe text: the model recognises it and reconstructs a plausible recipe (kind "dish").
const LANGS = { fr: "French", en: "English", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese" };
const systemFor = (lang) =>
  "You turn an image into a food or drink recipe. There are two cases. " +
  "CASE 1 - the image contains a written recipe (book page, handwritten recipe, screenshot, photo of a recipe card or an image found on the internet): " +
  'extract it. ' + EXTRACT_RULES + ' Add "kind":"text" to the JSON object. ' +
  "CASE 2 - the image shows a prepared dish or drink and no readable recipe: recognise the dish or drink, then write the classic, reliable recipe for it, " +
  "in " + (LANGS[lang] || "French") + ". The rule about not inventing quantities applies to CASE 1 only: in CASE 2 you must give realistic quantities for 4 servings, " +
  'times and a temperature when relevant. Use the same JSON form with "kind":"dish", the usual name of the dish as "title", and in "notes" one short sentence saying that ' +
  "the recipe was reconstructed from the photo and may differ from the dish shown. " +
  'If the image shows neither a written recipe nor food or drink (a person, a landscape, an object, an unrecognisable plate), set "found":false.';

// v331: « Photo ou image non reconnue, contactez-nous »: the user sends the image that was not recognised to the support by email.
// The image is only forwarded as an attachment (Resend); nothing is stored on the server.
async function reportImage(req, res, body) {
  if (await overLimit(req, "rl:ir:", 3)) return fail(res, "rate");
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ""));
  if (!m) return fail(res, "badimage");
  if (m[2].length > 3_400_000) return fail(res, "toobig");
  const key = process.env.RESEND_API_KEY, to = process.env.SUPPORT_EMAIL || process.env.MOD_EMAIL;
  if (!key || !to) return fail(res, "nomail");
  const lang = String(body.lang || "").slice(0, 5).replace(/[^a-z-]/gi, "");
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.MOD_FROM || "Chef IA <onboarding@resend.dev>",
        to: [to],
        subject: body.appeal ? "Chef IA : photo mal reconnue (appel)" : "Chef IA : photo ou image non reconnue",
        text: "Un utilisateur signale une photo ou une image " + (body.appeal ? "mal reconnue" : "non reconnue") + " à l'import (langue : " + (lang || "?") + "). L'image est en pièce jointe : elle a été envoyée pour un contrôle manuel uniquement, à supprimer une fois le contrôle fait.",
        attachments: [{ filename: "image-non-reconnue." + (m[1] === "jpeg" ? "jpg" : m[1]), content: m[2] }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return fail(res, "upstream");
    return res.status(200).json({ ok: true });
  } catch {
    return fail(res, "upstream");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!(await authOk(req, res))) return;
  if (req.body && req.body.report) return reportImage(req, res, req.body);
  // Protects the Anthropic credit (vision calls are the most expensive): 6 photo imports per minute per IP.
  if (await overLimit(req, "rl:ip:", 6)) return fail(res, "rate");
  if (!(await captchaOk(req))) return fail(res, "captcha"); // v343

  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body || {}).image || ""));
  if (!m) return fail(res, "badimage");
  if (m[2].length > 3_400_000) return fail(res, "toobig");
  const lang = String((req.body || {}).lang || "").slice(0, 2).toLowerCase();

  try {
    const out = await askClaude({
      system: systemFor(lang),
      model: process.env.VISION_MODEL || "claude-haiku-5-5",
      max_tokens: 3000,
      content: [
        { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
        { type: "text", text: "Extract the recipe from this image, or recognise the dish and write its recipe." },
      ],
    });
    const parsed = parseJsonLoose(out);
    const recipe = normRecipe(parsed);
    if (!recipe) return fail(res, "norecipe");
    const kind = parsed && parsed.kind === "dish" ? "dish" : "text";
    return res.status(200).json({ recipe, source: "photo", kind });
  } catch (e) {
    return fail(res, e.code || "upstream");
  }
}
