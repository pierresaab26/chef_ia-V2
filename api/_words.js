// v356: offensive-name filter (pure, no network). Used for the @handle, the pseudo, the comment author name and the e-mail of a new sign-in.
// Two lists, checked on a normalised copy of the text (lower case, no accents, look-alike digits / signs turned into letters):
//  - STRONG: unambiguous roots, refused anywhere in the text, even glued to other letters or hidden with separators (« n.a.z.i », « h1tler »);
//  - WORDS: short or ambiguous words (« con », « pute », « cul », « nique », « râpé »…), refused only as a whole word, so that « dispute »,
//    « habiter », « technique », « fromage râpé », « pain bâtard », « arroz negro », « cocktail », « pipette », « spicy » stay allowed.
// Food words that are also insults in another sense are left OUT on purpose (« râpé » = rape, « pain bâtard », « hure », « raton laveur », « Isis »);
// « negro » stays blocked even though it blocks « arroz.negro » (too risky as an insult). The lists cover the 6 languages of the app (fr, en, es, de, it, pt). They are not exhaustive: add words here when the moderation finds new ones.
const STRONG = [
  "nazi", "hitler", "heilhitler", "siegheil", "adolf", "fuhrer", "fuehrer", "kkk", "kukluxklan", "daesh", "jihad", "terroris", "genocid", "auschwitz", "holocaust", "shoah", "goebbels", "himmler", "mussolini", "whitepower", "whitesupremac", "1488", "88heil", "nigger", "nigga", "negresse", "bougnoul", "bougnoule", "youpin", "youtre", "bicot", "chintok", "chinetoque", "sandnigger", "wetback", "gook", "faggot", "tarlouze", "gouine", "maricon", "frocio", "schwuchtel", "kanake", "zigeuner", "tranny", "untermensch", "encule", "enculer", "salope", "salaud", "connard", "connasse", "pouffiasse", "petasse", "ntm", "fdp", "filsdepute", "putain", "branleur", "branlette", "suceur", "suceuse", "couille", "partouze", "fuck", "fucker", "motherfucker", "shit", "bitch", "whore", "slut", "pussy", "blowjob", "rapist", "cabron", "gilipollas", "joder", "mierda", "zorra", "pendejo", "fotze", "wichser", "arschloch", "scheisse", "ficken", "schlampe", "cazzo", "vaffanculo", "stronzo", "puttana", "minchia", "caralho", "buceta", "piroca", "viado", "porno", "xxx", "hentai", "pedophil", "paedo", "pedofil", "zoophil", "inceste", "incest", "violeur",
];
const WORDS = [
  "con", "cons", "conne", "pute", "putes", "cul", "bite", "bites", "sexe", "sex", "anal", "ass", "arse", "tits", "boobs", "nude", "nudes", "pd", "tg", "fion", "gland", "teub", "zob", "zizi", "kill", "suicide", "pene", "culo", "coglione", "merde", "merdeux", "idiot", "debile", "abruti", "cretin", "imbecile", "nazis", "ss", "sa", "hh", "admin", "moderateur", "moderator", "staff", "support", "bordel", "chatte", "chink", "cock", "cono", "cunt", "dick", "fagot", "figa", "foder", "foutre", "kike", "mongol", "negre", "negro", "nique", "niquer", "paki", "pedale", "pedo", "pipe", "polla", "porn", "porra", "puta", "puto", "retard", "spic", "tapette", "troia", "verga", "viol",
];
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "€": "e", "|": "i" };

export function normWord(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/ß/g, "ss");
}
const deLeet = (s) => s.replace(/[0134578@$!€|]/g, (c) => LEET[c] || c);
const squeeze = (s) => s.replace(/(.)\1{2,}/g, "$1$1"); // « nazzzi » → « nazzi »; doubled letters are also tried without the double

// true when the text contains an offensive word. Numbers alone (« 1488 ») are checked before the look-alike digits are turned into letters.
export function isOffensive(text) {
  const raw = normWord(text);
  if (!raw.trim()) return false;
  const plain = raw.replace(/[^a-z0-9]/g, "");
  const tries = new Set([plain, deLeet(raw).replace(/[^a-z]/g, "")]);
  for (const t of [...tries]) { tries.add(squeeze(t)); tries.add(t.replace(/(.)\1+/g, "$1")); }
  for (const t of tries) for (const w of STRONG) if (t.includes(w)) return true;
  const words = new Set();
  for (const v of [raw, deLeet(raw)]) v.split(/[^a-z0-9]+/).forEach((x) => x && words.add(x.replace(/[0-9]+$/, "")));
  for (const w of WORDS) if (words.has(w)) return true;
  return false;
}
