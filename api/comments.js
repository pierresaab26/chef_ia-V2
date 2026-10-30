import { randomUUID } from "node:crypto";

// Stockage : Upstash Redis (intégration Vercel). Les deux jeux de noms de variables sont acceptés.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(cmds) {
  const r = await fetch(URL_.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("redis");
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

const clean = (s, n) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, n);

export default async function handler(req, res) {
  if (!URL_ || !TOKEN) return res.status(501).json({ error: "storage" });

  // Code d'accès optionnel (même variable que le chat)
  const need = process.env.APP_PASSWORD;
  if (need && req.headers["x-code"] !== need) return res.status(401).json({ error: "code" });

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
      const name = clean(body.name, 30) || "Anonyme";
      if (!text) return res.status(400).json({ error: "text" });

      // Limite : 5 commentaires par minute et par adresse IP
      const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
      const rk = "rl:" + ip + ":" + Math.floor(Date.now() / 60000);
      const [n] = await redis([["INCR", rk], ["EXPIRE", rk, 120]]);
      if (Number(n) > 5) return res.status(429).json({ error: "rate" });

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
