import { authOk, fail, askClaude, parseJsonLoose, normRecipe, EXTRACT_RULES } from "./_lib.js";

const SYSTEM =
  "Tu extrais une recette de cuisine ou de boisson depuis une image : page de livre, recette manuscrite, capture d'écran, " +
  "photo d'une fiche ou image trouvée sur Internet. " + EXTRACT_RULES +
  " Si l'image ne montre qu'un plat ou une boisson sans texte de recette, mets « found »:false.";

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
        { type: "text", text: "Extrais la recette de cette image." },
      ],
    });
    const recipe = normRecipe(parseJsonLoose(out));
    if (!recipe) return fail(res, "norecipe");
    return res.status(200).json({ recipe, source: "photo" });
  } catch (e) {
    return fail(res, e.code || "upstream");
  }
}
