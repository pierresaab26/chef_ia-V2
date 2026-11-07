// Helpers of the shared « chef's weekly menu » (used by api/week-menu.js). Pure functions only (no network): unit-testable,
// and copied as-is (import/export removed) into the claude.ai preview bridge.
// A « week » starts on a Sunday at 9:00 Paris time and lasts 7 days; week 0 starts on the anchor Sunday. The menu has 21 dishes:
// Monday … Sunday × starter, main course, dessert (index = day * 3 + course).
import { parisParts, parisToEpoch, OCC, occasionNowFR } from "./_season.js";

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

// 21 lines « - Name: sentence » from the chef, in order (same line format as the seasonal ideas).
export function parseMenu(text) {
  const out = [];
  String(text || "").split("\n").forEach((l) => {
    const m = l.trim().match(/^[-•*]\s+\*{0,2}([^:*]{1,60}?)\*{0,2}\s*[:：]\s*(.+)$/);
    if (m && out.length < 21) out.push([m[1].trim(), m[2].replace(/\*\*/g, "").trim()]);
  });
  return out;
}

// English request sent to the chef (the « [UI] » prefix makes him answer in the interface language, see api/chat.js).
export function menuPrompt(avoid = [], now = new Date()) {
  const occ = OCC[occasionNowFR(now)];
  let msg = "[UI] Plan a menu for the 7 days of the coming week, Monday to Sunday. For each day, give exactly 3 lines in this order: one starter, one main course, one dessert. That makes exactly 21 lines in total, and nothing else (no introduction, no day names, no headings, no closing sentence). Each line is written « - Dish name: one appetizing sentence » (the dish name is 1 to 5 words)."
    + ` Everything must fit this time of year (${occ[1]}): nothing that belongs to another season. Vary the week: different main ingredients each day, at most 2 fish or seafood mains, 1 or 2 vegetarian mains, cuisines from several countries, realistic home cooking, a lighter dish after a rich one, and a more festive Sunday. No dish may appear twice.`;
  if (avoid.length) msg += ` Not these: ${avoid.join(", ")}.`;
  return msg;
}
