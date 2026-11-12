import { authOk, fail, askClaude, parseJsonLoose, normRecipe, EXTRACT_RULES, overLimit } from "./_lib.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!(await authOk(req, res))) return;
  // Protects the Anthropic credit (vision calls are the most expensive): 6 photo imports per minute per IP.
  if (await overLimit(req, "rl:ip:", 6)) return fail(res, "rate");

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
