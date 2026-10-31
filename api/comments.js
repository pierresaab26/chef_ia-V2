import { randomUUID } from "node:crypto";

import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";

// Recipe comments, stored in Upstash Redis (list "c:<recipe>", last 100).
export default async function handler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  if (!authOk(req, res)) return;

  const owner = clean(req.headers["x-owner"], 60);
  const q = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const key = String(req.method === "POST" ? body.key : q.key || "");
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
        .map((c) => ({ id: c.id, name: c.name, text: c.text, ts: c.ts, mine: !!owner && c.o === owner }));
      return res.status(200).json({ comments });
    }

    if (req.method === "POST") {
      const text = clean(body.text, 500);
      const name = clean(body.name, 30) || "Anonymous";
      if (!text) return res.status(400).json({ error: "text" });

      // Limit: 5 comments per minute per IP address
      if (await overLimit(req, "rl:", 5)) return res.status(429).json({ error: "rate" });

      const c = { id: randomUUID(), name, text, ts: Date.now(), o: owner };
      await redis([["LPUSH", listKey, JSON.stringify(c)], ["LTRIM", listKey, 0, 99]]);
      return res.status(201).json({ comment: { id: c.id, name, text, ts: c.ts, mine: true } });
    }

    if (req.method === "DELETE") {
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
