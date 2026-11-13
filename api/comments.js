import { randomUUID, createHash } from "node:crypto";

import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";
import { isOffensive } from "./_words.js";
import { notifyOne } from "./_notify.js";

// Recipe comments, stored in Upstash Redis (list "c:<recipe>", last 100).
export default async function handler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  if (!(await authOk(req, res))) return;

  const owner = clean(req.headers["x-owner"], 60);
  const q = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const key = String(req.method === "POST" || req.method === "PUT" ? body.key : q.key || "");
  if (!/^[a-z0-9-]{1,60}$/.test(key)) return res.status(400).json({ error: "key" });
  const listKey = "c:" + key;

  try {
    if (req.method === "GET") {
      const [raw] = await redis([["LRANGE", listKey, 0, 49]]);
      const comments = (raw || [])
        .map((s) => {
          try { return JSON.parse(s); } catch { return null; }
        })
        .filter(Boolean)
        .reverse()
        .map((c) => ({ id: c.id, name: c.name, text: c.text, ts: c.ts, mine: !!owner && c.o === owner, edited: !!c.ed }));
      return res.status(200).json({ comments });
    }

    if (req.method === "POST") {
      const text = clean(body.text, 500);
      let name = clean(body.name, 30) || "Anonymous";
      if (isOffensive(name)) name = "Anonymous"; // v356: an offensive author name is replaced, the comment itself is kept
      if (!text) return res.status(400).json({ error: "text" });

      // Limit: 5 comments per minute per IP address
      if (await overLimit(req, "rl:", 5)) return res.status(429).json({ error: "rate" });

      const c = { id: randomUUID(), name, text, ts: Date.now(), o: owner };
      await redis([["LPUSH", listKey, JSON.stringify(c)], ["LTRIM", listKey, 0, 99]]);
      let mentioned = 0;
      try { mentioned = await notifyMentions(text, owner, name, key, clean(body.title, 120)); } catch {} // v360: never blocks the comment
      return res.status(201).json({ comment: { id: c.id, name, text, ts: c.ts, mine: true }, mentioned });
    }

    // v129: the author edits his own comment (the server checks that he is the author)
    if (req.method === "PUT") {
      const id = String(body.id || "");
      const text = clean(body.text, 500);
      if (!owner || !id || !text) return res.status(400).json({ error: "text" });
      if (await overLimit(req, "rl:e:", 10)) return res.status(429).json({ error: "rate" });
      const [raw] = await redis([["LRANGE", listKey, 0, 99]]);
      const list = raw || [];
      const idx = list.findIndex((s) => {
        try {
          const c = JSON.parse(s);
          return c.id === id && c.o === owner;
        } catch { return false; }
      });
      if (idx < 0) return res.status(403).json({ error: "forbidden" });
      const c = JSON.parse(list[idx]);
      c.text = text;
      c.ed = 1;
      await redis([["LSET", listKey, idx, JSON.stringify(c)]]);
      return res.status(200).json({ comment: { id: c.id, name: c.name, text, ts: c.ts, mine: true, edited: true } });
    }

    if (req.method === "DELETE") {
      // v129: ?all=1 — the CREATOR of a recipe erases ALL its comments (and ratings, and the shared copy).
      // Only for the unique keys of v129 ("u-…"); the creator is the first person who shared it (key "o:<key>").
      if (q.all) {
        if (!owner || !/^u-[a-z0-9]{10,}$/.test(key)) return res.status(400).json({ error: "key" });
        const [cr] = await redis([["GET", "o:" + key]]);
        if (cr && cr !== owner) return res.status(403).json({ error: "forbidden" });
        await redis([["DEL", listKey], ["DEL", "r:" + key], ["DEL", "rc:" + key], ["DEL", "rt:" + key], ["DEL", "ra:" + key], ["SREM", "r:index", key], ["DEL", "o:" + key], ["DEL", "s:" + key]]);
        return res.status(200).json({ ok: true });
      }
      // v129: ?mine=1 — erases only the comments written by the caller (old recipes, whose key is shared by title)
      if (q.mine) {
        if (!owner) return res.status(400).json({ error: "id" });
        const [raw] = await redis([["LRANGE", listKey, 0, 99]]);
        const mine = (raw || []).filter((s) => {
          try { return JSON.parse(s).o === owner; } catch { return false; }
        });
        if (mine.length) await redis(mine.map((s) => ["LREM", listKey, 1, s]));
        return res.status(200).json({ ok: true, n: mine.length });
      }
      const id = String(q.id || "");
      if (!owner || !id) return res.status(400).json({ error: "id" });
      const [raw] = await redis([["LRANGE", listKey, 0, 99]]);
      const hit = (raw || []).find((s) => {
        try {
          const c = JSON.parse(s);
          return c.id === id && c.o === owner;
        } catch { return false; }
      });
      if (!hit) return res.status(403).json({ error: "forbidden" });
      await redis([["LREM", listKey, 1, hit]]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}

// v360: @mentions. Every « @handle » of a NEW comment (max 5) notifies that person in « Mon cercle → Activité »
// (kind "men": author name + @, recipe title, start of the comment, comment key). A handle is an account
// (ah:<h> → uid → au.o) or a device given an @ by the admin (ah:<h> → "p:<pid>"). Unknown @, my own @ and
// people over the limit are skipped silently. 30 mention notifications a day per author (mn:<pid>:<day>).
export const MENTION_RE = /(^|[^a-z0-9_.@])@([a-z0-9_.]{3,20})/gi;
export function mentionsIn(text) {
  const out = [];
  for (const m of String(text || "").matchAll(MENTION_RE)) {
    const h = m[2].toLowerCase().replace(/\.+$/, "");
    if (h.length >= 3 && !out.includes(h)) out.push(h);
    if (out.length >= 5) break;
  }
  return out;
}
const pidOf = (owner) => createHash("sha256").update("circle|" + owner).digest("hex").slice(0, 16); // same as api/circle.js
async function notifyMentions(text, owner, name, key, title) {
  const hs = mentionsIn(text);
  if (!hs.length || !owner) return 0;
  const me = pidOf(owner);
  const day = new Date().toISOString().slice(0, 10);
  const [used] = await redis([["GET", "mn:" + me + ":" + day]]);
  let left = 30 - Number(used || 0);
  if (left <= 0) return 0;
  const vals = await redis(hs.map((h) => ["GET", "ah:" + h]));
  const [myName, myH] = await redis([["GET", "cu:" + me], ["GET", "hp:" + me]]);
  let n = 0;
  for (let i = 0; i < hs.length && left > 0; i++) {
    const v = vals[i];
    if (!v) continue;
    let pid = "";
    if (String(v).startsWith("p:")) pid = String(v).slice(2);
    else { const [raw] = await redis([["GET", "au:" + v]]); try { pid = pidOf(JSON.parse(raw).o); } catch {} }
    if (!pid || pid === me) continue;
    await notifyOne(pid, { k: "men", by: myName || name || "", bh: myH || "", t: title || "", x: text, ck: key });
    n++; left--;
  }
  if (n) { try { await redis([["INCRBY", "mn:" + me + ":" + day, String(n)], ["EXPIRE", "mn:" + me + ":" + day, "90000"]]); } catch {} }
  return n;
}
