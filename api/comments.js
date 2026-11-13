import { randomUUID } from "node:crypto";

import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";
import { isOffensive } from "./_words.js";

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
      return res.status(201).json({ comment: { id: c.id, name, text, ts: c.ts, mine: true } });
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
