import { authOk, fail, askClaude, parseJsonLoose, normRecipe, EXTRACT_RULES } from "./_lib.js";

const SYSTEM =
  "You extract a food or drink recipe from an image: book page, handwritten recipe, screenshot, " +
  "photo of a recipe card or an image found on the internet. " + EXTRACT_RULES +
  ' If the image only shows a dish or a drink with no recipe text, set "found":false.';

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!authOk(req, res)) return;

  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body || {}).image || ""));
  if (!m) return fail(res, "badimage");
  if (m[2].length > 3_400_000) return fail(res, "toobig");

  try {
    const out = await askClaude({
      system: SYSTEM,
      model: process.env.VISION_MODEL || "claude-haiku-5-5",
      max_tokens: 3000,
      content: [
        { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
        { type: "text", text: "Extract the recipe from this image." },
      ],
    });
    const recipe = normRecipe(parseJsonLoose(out));
    if (!recipe) return fail(res, "norecipe");
    return res.status(200).json({ recipe, source: "photo" });
  } catch (e) {
    return fail(res, e.code || "upstream");
  }
}
