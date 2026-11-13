import { LIST } from "./_wordlist.js"; // v357: ~5,900 imported words (LDNOOBW, cuss, profane-words, 2toad), whole words only

// v356: offensive-name filter (pure, no network). Used for the @handle, the pseudo, the comment author name and the e-mail of a new sign-in.
// Two lists, checked on a normalised copy of the text (lower case, no accents, look-alike digits / signs turned into letters):
//  - STRONG: unambiguous roots, refused anywhere in the text, even glued to other letters or hidden with separators (« n.a.z.i », « h1tler »);
//  - WORDS: short or ambiguous words (« con », « pute », « cul », « nique », « râpé »…), refused only as a whole word, so that « dispute »,
//    « habiter », « technique », « fromage râpé », « pain bâtard », « arroz negro », « cocktail », « pipette », « spicy » stay allowed.
// Food words that are also insults in another sense are left OUT on purpose (« râpé » = rape, « pain bâtard », « hure », « raton laveur », « Isis »);
// « negro » stays blocked even though it blocks « arroz.negro » (too risky as an insult). The lists cover the 6 languages of the app (fr, en, es, de, it, pt). They are not exhaustive: add words here when the moderation finds new ones.
const STRONG = [
  "pornhub", "chingad", "nazi", "hitler", "heilhitler", "siegheil", "kukluxklan", "daesh", "jihad", "terroris", "genocid", "auschwitz", "holocaust", "shoah", "goebbels", "himmler", "mussolini", "whitepower", "whitesupremac", "1488", "nigger", "nigga", "negresse", "bougnoul", "bougnoule", "youpin", "youtre", "bicot", "chintok", "chinetoque", "sandnigger", "wetback", "gook", "faggot", "tarlouze", "gouine", "maricon", "frocio", "schwuchtel", "kanake", "zigeuner", "tranny", "untermensch", "encule", "enculer", "salope", "salaud", "connard", "connasse", "pouffiasse", "petasse", "fdp", "filsdepute", "putain", "branleur", "branlette", "suceur", "suceuse", "couille", "partouze", "fuck", "fucker", "motherfucker", "shit", "bitch", "whore", "slut", "pussy", "blowjob", "cabron", "gilipollas", "joder", "mierda", "zorra", "pendejo", "fotze", "wichser", "arschloch", "scheisse", "ficken", "schlampe", "cazzo", "vaffanculo", "stronzo", "puttana", "minchia", "caralho", "buceta", "piroca", "porno", "xxx", "hentai", "pedophil", "paedo", "pedofil", "zoophil", "inceste", "incest", "violeur",
];
const WORDS = [
  "ntm", "viado", "conne", "pute", "putes", "cul", "sexe", "sex", "anal", "ass", "arse", "tits", "boobs", "nude", "nudes", "pd", "tg", "fion", "teub", "zob", "zizi", "kill", "suicide", "pene", "culo", "coglione", "merde", "merdeux", "idiot", "debile", "abruti", "cretin", "imbecile", "nazis", "ss", "sa", "hh", "admin", "moderateur", "moderator", "staff", "support", "bordel", "chatte", "chink", "cock", "cunt", "dick", "fagot", "figa", "foder", "foutre", "kike", "mongol", "negre", "negro", "nique", "niquer", "paki", "pedo", "polla", "porn", "porra", "puta", "puto", "spic", "tapette", "troia", "verga", "viol", "adolf", "fuhrer", "fuehrer", "rapist", "rapists", "kkk",
];
// v357: food words that a cruder rule would catch (« shiitake » contains « shit » once the doubled « i » is collapsed): removed before checking.
const ALLOW = new Set(["shiitake", "shitake", "matsutake", "cocktail", "cocktails", "scunthorpe", "penistone", "cockle", "cockles", "hancock", "dickens", "sussex", "essex", "middlesex", "assiette", "assiettes", "bassine", "cassis", "cassoulet", "cassonade", "tassement", "titicaca"]);
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "€": "e", "|": "i" };

export function normWord(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/ß/g, "ss");
}
const deLeet = (s) => s.replace(/[0134578@$!€|]/g, (c) => LEET[c] || c);
const squeeze = (s) => s.replace(/(.)\1{2,}/g, "$1$1"); // « nazzzi » → « nazzi »; doubled letters are also tried without the double

// true when the text contains an offensive word. Numbers alone (« 1488 ») are checked before the look-alike digits are turned into letters.
// v357: « con » alone is « with » in es / it / pt (« arroz con leche »), so only French insulting phrases with it are refused (text glued);
// « pédé » is refused with its accents only (« pede » = « asks » in Portuguese).
const PHRASES = new Set(["groscon", "grossecon", "grosseconne", "salecon", "saleconne", "pauvrecon", "pauvreconne", "petitcon", "petiteconne", "vieuxcon", "vieilleconne", "espececon", "especedecon", "bandedecons", "tetedecon", "fdp", "ntm"]);
const ACCENTED = /(^|[^\p{L}])p[ée]d[ée]s?([^\p{L}]|$)/u;
export function isOffensive(text) {
  if (ACCENTED.test(String(text || "").toLowerCase()) && /é/.test(String(text).toLowerCase())) return true;
  const raw = normWord(text).split(/([^a-z0-9]+)/).map((p) => (ALLOW.has(p) ? " " : p)).join("");
  if (!raw.trim()) return false;
  const plain = raw.replace(/[^a-z0-9]/g, "");
  const tries = new Set([plain, deLeet(raw).replace(/[^a-z]/g, "")]);
  for (const t of [...tries]) { tries.add(squeeze(t)); tries.add(t.replace(/(.)\1+/g, "$1")); }
  // « nazi » is a root, but « nazione / nazionale / destinazione / combinazione » (it) are not: « nazio » is read as « natio » first.
  for (const t of tries) { const u = t.replace(/nazio/g, "natio"); for (const w of STRONG) if (u.includes(w)) return true; }
  const words = new Set();
  for (const v of [raw, deLeet(raw)]) v.split(/[^a-z0-9]+/).forEach((x) => x && words.add(x.replace(/[0-9]+$/, "")));
  for (const w of WORDS) if (words.has(w)) return true;
  // v357: imported lists, whole words only: each word of the text (also with look-alikes turned into letters and repeated letters squeezed),
  // and the whole text glued together (« f.u.c.k », « mother fucker », « 2 girls 1 cup » written with dots or underscores).
  for (const w of words) if (w.length >= 3 && (LIST.has(w) || LIST.has(squeeze(w)))) return true; // no full collapse of doubled letters here: « cook » ≠ « cok », « penne » ≠ « pene »
  const glued = [raw.replace(/[^a-z0-9]/g, ""), deLeet(raw).replace(/[^a-z]/g, "")];
  for (const t of glued) if (t.length >= 3 && (LIST.has(t) || LIST.has(squeeze(t)) || PHRASES.has(t))) return true;
  return false;
}
