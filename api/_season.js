// Helpers of the shared « chef's ideas » of the seasonal menu (used by api/season-ideas.js).
// A « period » lasts 3 days and starts at 9:00 Paris time. Period 0 starts on the anchor date.
// Pure functions only (no network): they are unit-tested and also copied as-is into the claude.ai preview build.
// The "_" prefix tells Vercel this file is not a route.

export const LANGS = ["fr", "en", "es", "de", "it", "pt"];
// Language names for the request sent to the chef (he must write the names and sentences in the interface language).
export const LANG_NAME = { fr: "French", en: "English", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese" };
export const langRule = (lang) => LANG_NAME[lang] ? ` Write EVERY dish name and EVERY sentence in ${LANG_NAME[lang]} (use the usual ${LANG_NAME[lang]} name of each dish, never English unless that is the language).` : "";

// Occasion key → [kind, English name]. Keys are the `SN` keys of index.html (kind: "s" season, "f" holiday or festival).
export const OCC = {
  hiver: ["s", "Winter"], chandeleur: ["f", "Candlemas (La Chandeleur)"], printemps: ["s", "Spring"], paques: ["f", "Easter"],
  ete: ["s", "Summer"], automne: ["s", "Autumn"], halloween: ["f", "Halloween"], noel: ["f", "Christmas"],
  cny: ["f", "Chinese New Year"], holi: ["f", "Holi"], thanksgiving: ["f", "Thanksgiving"],
  muertos: ["f", "Día de los Muertos"], diwali: ["f", "Diwali"],
};

export const PERIOD_DAYS = 3;
export const PERIOD_HOUR = 9; // Paris time
const ANCHOR = Date.UTC(2026, 10, 3) / 864e5; // day number of 3 Nov 2026: the first period starts that day at 9:00 (Paris)

// Paris wall-clock parts of an instant (DST included).
export function parisParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour };
}

// Instant (ms since epoch) of a Paris wall-clock time on the hour.
export function parisToEpoch(y, m, d, h) {
  const target = Date.UTC(y, m - 1, d, h);
  let t = target;
  for (let i = 0; i < 2; i++) {
    const p = parisParts(new Date(t));
    t -= Date.UTC(p.y, p.m - 1, p.d, p.h) - target;
  }
  return t;
}

const iso = (dayNum) => new Date(dayNum * 864e5).toISOString().slice(0, 10);

// Period with this id: { id, from, to, until } — from/to are Paris dates (YYYY-MM-DD), `until` the instant the next period starts.
export function periodById(id) {
  const a = ANCHOR + id * PERIOD_DAYS, b = a + PERIOD_DAYS;
  const [y, m, d] = iso(b).split("-").map(Number);
  return { id, from: iso(a), to: iso(b), until: parisToEpoch(y, m, d, PERIOD_HOUR) };
}

// Period running at this instant: the day changes at 9:00 Paris time, not at midnight.
export function periodOf(now = new Date()) {
  const p = parisParts(now);
  const day = Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 864e5) - (p.h < PERIOD_HOUR ? 1 : 0);
  return periodById(Math.max(0, Math.floor((day - ANCHOR) / PERIOD_DAYS)));
}

// Same calendar as the app for France (index.html: snWindow / snCurrent): used to warm up the right occasion every period.
function easterUTC(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, mo - 1, da);
}
export function occasionNowFR(now = new Date()) {
  const p = parisParts(now), md = p.m * 100 + p.d, t = Date.UTC(p.y, p.m - 1, p.d), D = 864e5, E = easterUTC(p.y);
  if (md >= 125 && md <= 202) return "chandeleur";
  if (t >= E - 14 * D && t <= E + D) return "paques";
  if (md >= 1015 && md <= 1031) return "halloween";
  if (md >= 1201 && md <= 1226) return "noel";
  return p.m === 12 || p.m <= 2 ? "hiver" : p.m <= 5 ? "printemps" : p.m <= 8 ? "ete" : "automne";
}

// The chef answers with 4 lines « - Name: sentence » (rule IDEAS of api/chat.js). Same parser as the app (`snParse`).
export function parseIdeas(text) {
  const out = [];
  String(text || "").split("\n").forEach((l) => {
    const m = l.trim().match(/^[-•*]\s+\*{0,2}([^:*]{1,60}?)\*{0,2}\s*[:：]\s*(.+)$/);
    if (m && out.length < 4) out.push([m[1].trim(), m[2].replace(/\*\*/g, "").trim()]);
  });
  return out;
}

// Name comparison key: lower case, no accents, single spaces (« Crème brûlée » = « creme brulee »).
export const norm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// English request sent to the chef (the « [UI] » prefix makes him answer in the interface language, see api/chat.js).
export function ideasPrompt(occ, avoid = [], lang = "") {
  const [kind, name] = OCC[occ];
  const course = " One starter, one main course, one dessert and one drink, in that order.";
  const season = " Everything must fit this exact time of year: nothing that belongs to another season (for example no hot mulled wine or heavy stews in summer, no ice cream or cold fresh salads in winter).";
  let msg = kind === "s"
    ? `[UI] Suggest 4 recipe ideas for the period « ${name} »: dishes and drinks typical of this season (the ones people crave at this time of year) and/or that showcase its seasonal produce, drawing on the cuisines of several countries.` + course + season
    : `[UI] Suggest 4 traditional recipe ideas for « ${name} », drawing on the specialities of several countries and using seasonal produce.` + course + season;
  if (avoid.length) msg += ` Not these: ${avoid.join(", ")}.`;
  return msg + langRule(lang);
}
