import { redis } from "./_lib.js";

// v358: people search index (accounts with an @handle only). One Redis sorted set « hx » where every member is « <key>|<pid> » with score 0,
// so ZRANGEBYLEX finds every key that STARTS with what is typed. Keys of one person: the @handle, the whole pseudo and each word of it
// (lower case, no accents), so « marie », « dupont » and « marie.d » all find « Marie Dupont @marie.d ». « hxn:<pid> » = the members
// written last time, to remove the old ones when the pseudo or the handle changes. Nothing else is stored: no e-mail, no recipe.
export const normIx = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9 ._]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

export async function indexPerson(pid) {
  if (!/^[a-f0-9]{16}$/.test(pid)) return;
  const [h, name, old] = await redis([["GET", "hp:" + pid], ["GET", "cu:" + pid], ["GET", "hxn:" + pid]]);
  let prev = [];
  try { prev = JSON.parse(old || "[]"); } catch {}
  const keys = new Set();
  if (h) {
    keys.add(h);
    const n = normIx(name);
    if (n) { keys.add(n); n.split(/[ ._]/).forEach((w) => { if (w.length >= 2) keys.add(w); }); }
  }
  const now = [...keys].map((k) => k + "|" + pid).slice(0, 12);
  const gone = prev.filter((e) => !now.includes(e)), add = now.filter((e) => !prev.includes(e));
  if (!gone.length && !add.length) return;
  const cmds = [];
  if (gone.length) cmds.push(["ZREM", "hx", ...gone]);
  if (add.length) cmds.push(["ZADD", "hx", ...add.flatMap((e) => ["0", e])]);
  cmds.push(now.length ? ["SET", "hxn:" + pid, JSON.stringify(now)] : ["DEL", "hxn:" + pid]);
  await redis(cmds);
}

// Up to `max` pids whose handle, pseudo or a word of the pseudo starts with `q` (3+ characters).
export async function searchPeople(q, max = 10) {
  const s = normIx(String(q || "").replace(/^@+/, ""));
  if (s.length < 3) return [];
  const [raw] = await redis([["ZRANGEBYLEX", "hx", "[" + s, "[" + s + "ÿ", "LIMIT", "0", "60"]]);
  const out = [];
  for (const e of raw || []) { const p = String(e).split("|").pop(); if (/^[a-f0-9]{16}$/.test(p) && !out.includes(p)) out.push(p); if (out.length >= max) break; }
  return out;
}
