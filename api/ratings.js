import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";

// 1-to-5 star ratings per recipe. Storage: Upstash Redis (same variables as the comments).
// Each person (identified by x-owner) has ONE rating per recipe, which they can change.
// In addition, every rating is appended to a log (r:log): title, stars, language, date,
// origin of the recipe (chef / import / remix / shared) and the optional quick tag (v252).
// That log is the raw material to later analyse what people like and adapt the chef.
// v252: « I cooked it » (rc:<key>, owner -> time) comes BEFORE the rating in the app; a rating always counts as cooked.
// The optional one-word tag (rt:<key>, owner -> code) is a fixed list, stored as a code (language independent).
const TAGS = ["salty", "easy", "kids", "long"];
const ORIGINS = ["chef", "import", "remix", "shared"]; // shared = received through a share link
export default async function handler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  if (!authOk(req, res)) return;

  const owner = clean(req.headers["x-owner"], 60);
  const q = req.query || {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const key = String(req.method === "POST" ? body.key : q.key || "");
  if (!/^[a-z0-9-]{1,60}$/.test(key)) return res.status(400).json({ error: "key" });
  const hk = "r:" + key, ck = "rc:" + key, tk = "rt:" + key;

  const summary = (h, c, tg) => {
    const v = Object.values(h || {}).map(Number).filter((n) => n >= 1 && n <= 5);
    const count = v.length;
    const tags = {};
    Object.values(tg || {}).forEach((t) => { if (TAGS.includes(t)) tags[t] = (tags[t] || 0) + 1; });
    const cooked = new Set([...Object.keys(h || {}), ...Object.keys(c || {})]).size; // people who cooked it (rated or marked)
    return {
      count,
      avg: count ? v.reduce((a, b) => a + b, 0) / count : 0,
      mine: owner && h && h[owner] ? Number(h[owner]) : 0,
      cooked,
      mineCooked: !!(owner && ((c && c[owner]) || (h && h[owner]))),
      tags,
      mineTag: owner && tg && TAGS.includes(tg[owner]) ? tg[owner] : "",
    };
  };
  const toObj = (arr) => {
    const o = {};
    for (let i = 0; i + 1 < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1];
    return o;
  };

  try {
    if (req.method === "GET") {
      const [h, c, tg] = await redis([["HGETALL", hk], ["HGETALL", ck], ["HGETALL", tk]]);
      return res.status(200).json(summary(toObj(h), toObj(c), toObj(tg)));
    }

    if (req.method === "POST") {
      // One POST carries ONE thing: a rating (stars), « I cooked it » (cooked) or the quick tag (tag).
      const stars = body.stars == null ? 0 : Math.round(Number(body.stars));
      const cooked = body.cooked === true || body.cooked === 1;
      const tag = body.tag === "none" ? "none" : TAGS.includes(body.tag) ? body.tag : "";
      if (!owner) return res.status(400).json({ error: "stars" });
      if (body.stars != null && !(stars >= 1 && stars <= 5)) return res.status(400).json({ error: "stars" });
      if (!stars && !cooked && !tag) return res.status(400).json({ error: "stars" });

      if (await overLimit(req, "rl:r:", 30)) return res.status(429).json({ error: "rate" });

      const cmds = [];
      if (stars) {
        const origin = ORIGINS.includes(body.origin) ? body.origin : "";
        const entry = { k: key, t: clean(body.title, 80), s: stars, l: clean(body.lang, 5), o: origin, ts: Date.now() };
        cmds.push(["HSET", hk, owner, String(stars)], ["HSET", ck, owner, String(Date.now())], ["SADD", "r:index", key],
          ["LPUSH", "r:log", JSON.stringify(entry)], ["LTRIM", "r:log", 0, 4999]);
      } else if (cooked) {
        cmds.push(["HSET", ck, owner, String(Date.now())]); // not added to r:index: that set lists RATED recipes only
      }
      if (tag) {
        if (!stars) { // a tag on its own is only accepted from someone who rated this recipe
          const [mine] = await redis([["HGET", hk, owner]]);
          if (!mine) return res.status(400).json({ error: "tag" });
        }
        cmds.push(tag === "none" ? ["HDEL", tk, owner] : ["HSET", tk, owner, tag]);
      }
      await redis(cmds);
      const [h, c, tg] = await redis([["HGETALL", hk], ["HGETALL", ck], ["HGETALL", tk]]);
      return res.status(200).json(summary(toObj(h), toObj(c), toObj(tg)));
    }

    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}
