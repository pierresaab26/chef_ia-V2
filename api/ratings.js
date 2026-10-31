import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";

// 1-to-5 star ratings per recipe. Storage: Upstash Redis (same variables as the comments).
// Each person (identified by x-owner) has ONE rating per recipe, which they can change.
// In addition, every rating is appended to a log (r:log): title, stars, language, date.
// That log is the raw material to later analyse what people like and adapt the chef.
export default async function handler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  if (!authOk(req, res)) return;

  const owner = clean(req.headers["x-owner"], 60);
  const q = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const key = String(req.method === "POST" ? body.key : q.key || "");
  if (!/^[a-z0-9-]{1,60}$/.test(key)) return res.status(400).json({ error: "key" });
  const hk = "r:" + key;

  const summary = (h) => {
    const v = Object.values(h || {}).map(Number).filter((n) => n >= 1 && n <= 5);
    const count = v.length;
    return { count, avg: count ? v.reduce((a, b) => a + b, 0) / count : 0, mine: owner && h && h[owner] ? Number(h[owner]) : 0 };
  };
  const toObj = (arr) => {
    const o = {};
    for (let i = 0; i + 1 < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1];
    return o;
  };

  try {
    if (req.method === "GET") {
      const [h] = await redis([["HGETALL", hk]]);
      return res.status(200).json(summary(toObj(h)));
    }

    if (req.method === "POST") {
      const stars = Math.round(Number(body.stars));
      if (!owner || !(stars >= 1 && stars <= 5)) return res.status(400).json({ error: "stars" });

      if (await overLimit(req, "rl:r:", 30)) return res.status(429).json({ error: "rate" });

      const entry = { k: key, t: clean(body.title, 80), s: stars, l: clean(body.lang, 5), ts: Date.now() };
      await redis([
        ["HSET", hk, owner, String(stars)],
        ["SADD", "r:index", key],
        ["LPUSH", "r:log", JSON.stringify(entry)],
        ["LTRIM", "r:log", 0, 4999],
      ]);
      const [h] = await redis([["HGETALL", hk]]);
      return res.status(200).json(summary(toObj(h)));
    }

    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}
