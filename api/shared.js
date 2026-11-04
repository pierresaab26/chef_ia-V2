import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";

// v129: shared recipes. The sender publishes a copy of the recipe ("s:<sid>") and gets a link /?s=<sid>.
// The friend opens the link: the recipe lands in his app with the SAME comment key, so both see the same comments.
// The first person who shares a comment key becomes its creator ("o:<key>"): only him can erase all its comments.
export default async function handler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  if (!authOk(req, res)) return;

  const owner = clean(req.headers["x-owner"], 60);
  const q = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const sid = String((req.method === "POST" ? body.sid : q.sid) || "");
  if (!/^[a-z0-9-]{8,64}$/.test(sid)) return res.status(400).json({ error: "key" });

  try {
    if (req.method === "GET") {
      const [raw] = await redis([["GET", "s:" + sid]]);
      if (!raw) return res.status(404).json({ error: "notfound" });
      const d = JSON.parse(raw);
      return res.status(200).json({ title: d.title, text: d.text, ck: d.ck, lang: d.lang, ph: d.ph || null });
    }

    if (req.method === "POST") {
      const ck = String(body.ck || "");
      if (!owner || !/^[a-z0-9-]{1,60}$/.test(ck)) return res.status(400).json({ error: "key" });
      const text = clean(body.text, 20000);
      const title = clean(body.title, 120);
      if (!text || !title) return res.status(400).json({ error: "text" });
      if (await overLimit(req, "rl:s:", 20)) return res.status(429).json({ error: "rate" });

      const [old] = await redis([["GET", "s:" + sid]]);
      if (old) {
        let o = null;
        try { o = JSON.parse(old).o; } catch {}
        if (o && o !== owner) return res.status(403).json({ error: "forbidden" });
      }
      let ph = null;
      try {
        const p = body.ph;
        if (p && typeof p === "object" && JSON.stringify(p).length < 800) ph = p;
      } catch {}
      const d = { title, text, ck, lang: clean(body.lang, 5), ph, o: owner, ts: Date.now() };
      await redis([["SET", "s:" + sid, JSON.stringify(d)], ["SETNX", "o:" + ck, owner]]);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const [old] = await redis([["GET", "s:" + sid]]);
      if (!old) return res.status(200).json({ ok: true });
      let o = null;
      try { o = JSON.parse(old).o; } catch {}
      if (!owner || o !== owner) return res.status(403).json({ error: "forbidden" });
      await redis([["DEL", "s:" + sid]]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}
