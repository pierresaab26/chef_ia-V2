// Pure helpers for the « silly / dangerous request » safety (no network, unit-tested).
// The chef starts his answer with [[FLAG:silly]] or [[FLAG:danger]] when he declines such a request;
// the server removes the marker, counts it per device and per IP, warns at 3, blocks at 10.
// Also copied as-is (export keywords removed) into the claude.ai preview bridge.
export const FLAG_WARN = 3; // from this count on, a warning is added to the answer
export const FLAG_BLOCK = 10; // at this count: moderation is told and the user is blocked
export const FLAG_WEEK = 7 * 24 * 3600; // the counter lives 7 days from the first flag
export const FLAG_BLOCK_S = 24 * 3600; // length of the block

const FLAG_RE = /\[\[\s*FLAG\s*:\s*(silly|danger)(?:\s*:\s*([a-z]{2}))?\s*\]\]/gi;

// Removes every marker from the model's answer; kind = the first one found (or ""), lang = the language
// the chef wrote his answer in (marker [[FLAG:silly:fr]]), so the warning matches the user's own language.
export function stripFlag(text) {
  let kind = "", lang = "";
  const out = String(text || "").replace(FLAG_RE, (_, k, l) => {
    if (!kind) { kind = k.toLowerCase(); lang = l ? l.toLowerCase() : ""; }
    return "";
  });
  return { text: kind ? out.replace(/^\s+/, "") : out, kind, lang };
}

const WARN = {
  fr: { silly: "Ceci n’est pas sérieux. Je suis là pour de vraies recettes : dis-moi ce qui te ferait envie !", danger: "Cette demande est dangereuse ou illégale : je ne peux pas t’aider avec ça." },
  en: { silly: "This is not serious. I’m here for real recipes: tell me what you feel like eating!", danger: "This request is dangerous or illegal: I can’t help with that." },
  es: { silly: "Esto no es serio. Estoy aquí para recetas de verdad: ¡dime qué te apetece!", danger: "Esta petición es peligrosa o ilegal: no puedo ayudarte con eso." },
  de: { silly: "Das ist nicht ernst gemeint. Ich bin für echte Rezepte da: Sag mir, worauf du Lust hast!", danger: "Diese Anfrage ist gefährlich oder illegal: Dabei kann ich nicht helfen." },
  it: { silly: "Non è una cosa seria. Sono qui per ricette vere: dimmi cosa ti va di mangiare!", danger: "Questa richiesta è pericolosa o illegale: non posso aiutarti." },
  pt: { silly: "Isto não é sério. Estou aqui para receitas a sério: diz-me o que te apetece!", danger: "Este pedido é perigoso ou ilegal: não posso ajudar com isso." },
};
export function warnText(lang, kind) {
  const l = WARN[String(lang || "").slice(0, 2).toLowerCase()] || WARN.fr;
  return l[kind === "danger" ? "danger" : "silly"];
}
