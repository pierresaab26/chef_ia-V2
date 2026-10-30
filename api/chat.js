const BASE =
  "Tu es un chef cuisinier convivial et précis. " +
  "Quand on te demande une recette, donne : un titre, le nombre de portions (4 par défaut), " +
  "les ingrédients avec quantités, les étapes numérotées avec temps et températures. " +
  "La toute première ligne d’une nouvelle recette est son titre, sous la forme « ## Titre du plat », sans phrase d’introduction avant. " +
  "Quand l’utilisateur demande une adaptation (ingrédient manquant, changement de portions, régime, matériel), " +
  "redonne la recette COMPLÈTE mise à jour (quantités recalculées, étapes ajustées) en commençant par une phrase courte " +
  "sur ce qui change. Sois concis. Format : texte brut, titres de section précédés de '## ', pas d’autre markdown. " +
  "Tu ne réponds qu’à des questions de cuisine. " +
  "LANGUE : réponds dans la langue du dernier message de l’utilisateur (n’importe quelle langue), et garde cette langue pour la recette adaptée. " +
  "Les messages commençant par [UI] sont des demandes automatiques de l’interface : ignore ce préfixe et réponds alors dans la langue de l’interface.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  // Code d'accès optionnel (variable APP_PASSWORD sur Vercel)
  const need = process.env.APP_PASSWORD;
  if (need && req.headers["x-code"] !== need) {
    return res.status(401).json({ error: "code" });
  }

  const body = req.body || {};
  const lang = typeof body.lang === "string" ? body.lang.slice(0, 5) : "";
  const persona = typeof body.persona === "string" ? body.persona.slice(0, 300) : "";
  let messages = Array.isArray(body.messages)
    ? body.messages
        .slice(-20)
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[0].role !== "user" || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "messages" });
  }

  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "nokey" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.MODEL || "claude-haiku-5-5",
        max_tokens: 1500,
        system: BASE + (lang ? " Langue de l’interface : " + lang + "." : "") + (persona ? " " + persona : ""),
        messages,
      }),
    });
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: "upstream" });
    const data = await r.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: "network" });
  }
}
