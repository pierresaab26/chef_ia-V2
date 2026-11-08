// Helpers of the shared « chef's weekly menu » (used by api/week-menu.js). Pure functions only (no network): unit-testable,
// and copied as-is (import/export removed) into the claude.ai preview bridge.
// A « week » starts on a Sunday at 9:00 Paris time and lasts 7 days; week 0 starts on the anchor Sunday. The menu has 21 dishes:
// Monday … Sunday × starter, main course, dessert (index = day * 3 + course).
import { parisParts, parisToEpoch, OCC, occasionNowFR, langRule } from "./_season.js";

const WK_ANCHOR = Date.UTC(2026, 10, 8) / 864e5; // day number of Sunday 8 Nov 2026
const WK_HOUR = 9; // Paris time
const wkIso = (dayNum) => new Date(dayNum * 864e5).toISOString().slice(0, 10);

// Week with this id: { id, from, to, until } — from/to are Paris dates, `until` the instant the next week starts.
export function weekById(id) {
  const a = WK_ANCHOR + id * 7, b = a + 7;
  const [y, m, d] = wkIso(b).split("-").map(Number);
  return { id, from: wkIso(a), to: wkIso(b), until: parisToEpoch(y, m, d, WK_HOUR) };
}

// Week running at this instant: the day changes at 9:00 Paris time, not at midnight.
export function weekOf(now = new Date()) {
  const p = parisParts(now);
  const day = Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 864e5) - (p.h < WK_HOUR ? 1 : 0);
  return weekById(Math.max(0, Math.floor((day - WK_ANCHOR) / 7)));
}

// Up to 21 lines « - Name: sentence » from the chef, in order. Tolerant on purpose (v247): bullets or « 1. », bold names, « : » or a dash
// as separator, and a second pass on plain « Name: sentence » lines when the bullets give too few. Titles such as « Lundi : » are ignored.
const WK_HEAD = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miercoles|jueves|viernes|sabado|domingo|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|segunda|terca|quarta|quinta|sexta|entree|plat|dessert|starter|main|main course|entrada|plato|postre|vorspeise|hauptgericht|nachtisch|antipasto|primo|secondo|dolce|prato|sobremesa)$/i;
export function parseMenu(text) {
  const clean = (s) => s.replace(/\*\*/g, "").trim();
  const pass = (re) => {
    const out = [];
    String(text || "").split("\n").forEach((l) => {
      const m = l.trim().match(re);
      if (!m || out.length >= 21) return;
      const name = clean(m[1]), sentence = clean(m[2]);
      if (!name || !sentence || name.length > 60) return;
      if (WK_HEAD.test(name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ) return;
      out.push([name, sentence]);
    });
    return out;
  };
  const a = pass(/^(?:[-•*]|\d{1,2}[.)])\s+\*{0,2}([^:：*]{1,70}?)\*{0,2}\s*(?:[:：]|\s[—–-]\s)\s*(.+)$/);
  if (a.length >= 18) return a;
  const b = pass(/^\*{0,2}([^:：*]{1,70}?)\*{0,2}\s*[:：]\s*(.+)$/);
  return b.length > a.length ? b : a;
}

// English request sent to the chef (the « [UI] » prefix makes him answer in the interface language, see api/chat.js).
export function menuPrompt(avoid = [], lang = "", now = new Date()) {
  const occ = OCC[occasionNowFR(now)];
  let msg = "[UI] Plan a menu for the 7 days of the coming week, Monday to Sunday. For each day, give exactly 3 lines in this order: one starter, one main course, one dessert. That makes exactly 21 lines in total, and nothing else (no introduction, no day names, no headings, no closing sentence). Each line is written « - Dish name: one appetizing sentence » (the dish name is 1 to 5 words)."
    + ` Everything must fit this time of year (${occ[1]}): nothing that belongs to another season. Vary the week: different main ingredients each day, at most 2 fish or seafood mains, 1 or 2 vegetarian mains, cuisines from several countries, realistic home cooking, a lighter dish after a rich one, and a more festive Sunday. No dish may appear twice.`;
  if (avoid.length) msg += ` Not these: ${avoid.join(", ")}.`;
  return msg + langRule(lang);
}

// v248: the menu no longer uses the chef's recipe instructions (13 000 characters that impose « ## Title, Servings… » and made the
// chef answer with headings the parser could not read). Short dedicated instructions + a JSON answer instead.
export const MENU_SYS = "You are Chef IA, a Michelin-starred chef who plans weekly home menus. You answer ONLY with the JSON object that is asked for: no text before or after it, no code fence.";

// picks: community recipes [{ id:"C1", t:title, a:avg, n:votes }] that the chef may place in the menu (the best rated and shared ones).
export function menuPromptJ(avoid = [], lang = "", picks = [], now = new Date()) {
  const occ = OCC[occasionNowFR(now)];
  let msg = "Plan a menu for the 7 days of the coming week, Monday to Sunday, 3 dishes a day in this order: starter, main course, dessert (21 dishes)."
    + ` Everything must fit this time of year (${occ[1]}): nothing that belongs to another season. Vary the week: different main ingredients each day, at most 2 fish or seafood mains, 1 or 2 vegetarian mains, cuisines from several countries, realistic home cooking, a lighter dish after a rich one, and a more festive Sunday. No dish may appear twice.`;
  if (picks.length) msg += " Our users' favourite recipes (best rated and most shared) are listed below. Use as many of them as fit well, up to 7, each at most once and only in a slot where it really fits (right course, right season); for those dishes write its id in « c » and copy its title exactly in « n ». Skip any title that is not a real, appropriate dish. The other dishes are your own ideas (« c »: \"\").\n"
    + picks.map((p) => `${p.id}: ${p.t}`).join("\n");
  if (avoid.length) msg += `\nNot these (last week): ${avoid.join(", ")}.`;
  msg += '\nAnswer with exactly this JSON object: {"menu":[{"n":"dish name (1 to 5 words)","s":"one appetizing sentence","c":""}, … 21 entries in order: Monday starter, Monday main, Monday dessert, Tuesday starter, …]}';
  return msg + langRule(lang);
}

// JSON answer → up to 21 items [name, sentence] or [title, sentence, sid, avg] for a community recipe. Falls back to the text parser.
export function parseMenuJ(text, picks = []) {
  const raw = String(text || "");
  let arr = null;
  try {
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    if (a >= 0 && b > a) { const o = JSON.parse(raw.slice(a, b + 1)); arr = Array.isArray(o) ? o : o && Array.isArray(o.menu) ? o.menu : null; }
  } catch {}
  if (!arr) return parseMenu(raw);
  const byId = new Map(picks.map((p) => [p.id, p])), used = new Set(), out = [];
  for (const x of arr) {
    if (out.length >= 21) break;
    if (!x || typeof x !== "object") { out.push(null); continue; }
    const n = String(x.n || x.name || "").replace(/\*\*/g, "").trim().slice(0, 80), sn = String(x.s || x.sentence || "").trim().slice(0, 240);
    const p = byId.get(String(x.c || "").trim().toUpperCase());
    if (p && !used.has(p.id)) { used.add(p.id); out.push([p.t, sn || n, p.sid, Math.round(p.a * 10) / 10]); continue; }
    out.push(n && sn ? [n, sn] : null);
  }
  return out;
}
