import { randomUUID, createHash } from "node:crypto";

import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";
import { isOffensive, isOffensiveText } from "./_words.js";
import { sendModMail } from "./_mod.js";
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
        .filter((c) => !c.h || (!!owner && c.o === owner)); // v361: a comment hidden after 3 reports is only seen by its author
      const me = owner ? pidOf(owner) : "";
      const rep = me ? await redis(comments.map((c) => (c.rp ? ["HEXISTS", "crp:" + key + ":" + c.id, me] : ["EXISTS", "__none__"]))) : [];
      const out = comments
        .filter((c, i) => !Number(rep[i]) || c.o === owner) // and the comments I reported myself are not shown to me any more
        .map((c) => ({ id: c.id, name: c.name, text: c.text, ts: c.ts, mine: !!owner && c.o === owner, edited: !!c.ed, ...(c.h && c.o === owner ? { pending: true } : {}) }));
      return res.status(200).json({ comments: out });
    }

    if (req.method === "POST" && body.act === "report") return await report(req, res, key, listKey, owner, body);
    if ((req.method === "POST" || req.method === "PUT") && owner) { // v361: author blocked after 10 reports
      const [ban] = await redis([["GET", "cbk:" + pidOf(owner)]]);
      if (ban) return res.status(403).json({ error: "cbanned" });
    }
    if ((req.method === "POST" || req.method === "PUT") && isOffensiveText(body.text)) return res.status(400).json({ error: "badword" }); // v361

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

// v361: REPORTS on comments. One report per person and comment (hash crp:<key>:<id>, reporter pid → reason, 90 days).
// 3 reports → the comment is hidden for everybody but its author (c.h) and the moderator gets an e-mail with
// « remettre en ligne » / « supprimer » links. Every new report also counts on its AUTHOR (cra:<pid>): at 3 the author gets a
// warning in « Activité » (kind cwarn), at 10 he can no longer comment (cbk:<pid>, kind cban, e-mail with an unblock link).
// Queue for the admin: hash cmq, field "<key>|<id>" → JSON. Admin actions live in api/moderation.js (&creports, &cok, &cdel, &cunban).
export const REASONS = ["hate", "spam", "bad", "other"];
async function report(req, res, key, listKey, owner, body) {
  if (!owner) return res.status(400).json({ error: "owner" });
  if (await overLimit(req, "rl:cr:", 10)) return res.status(429).json({ error: "rate" });
  const id = String(body.id || ""), why = REASONS.includes(body.why) ? body.why : "other";
  const [raw] = await redis([["LRANGE", listKey, 0, 99]]);
  const list = raw || [];
  const idx = list.findIndex((x) => { try { return JSON.parse(x).id === id; } catch { return false; } });
  if (idx < 0) return res.status(404).json({ error: "notfound" });
  const c = JSON.parse(list[idx]);
  if (c.o === owner) return res.status(400).json({ error: "own" });
  const me = pidOf(owner), rk = "crp:" + key + ":" + id;
  const [isNew] = await redis([["HSETNX", rk, me, why], ["EXPIRE", rk, String(90 * 86400)]]);
  if (!Number(isNew)) return res.status(200).json({ ok: true, already: true });
  const [n] = await redis([["HLEN", rk]]);
  c.rp = Number(n) || 1;
  const host = "https://" + String(req.headers.host || "chefia-v3.vercel.app");
  const adm = (q) => host + "/api/moderation?key=" + encodeURIComponent(process.env.CRON_SECRET || "") + "&" + q;
  const [reasons] = await redis([["HVALS", rk]]);
  const ref = key + "|" + id;
  const hideNow = c.rp >= 3 && !c.h;
  if (hideNow) c.h = 1;
  await redis([["LSET", listKey, idx, JSON.stringify(c)], ["HSET", "cmq", ref, JSON.stringify({ key, id, name: c.name, text: c.text, n: c.rp, hidden: !!c.h, why: reasons || [], at: Date.now(), title: String(body.title || "").slice(0, 120) })]]);
  if (hideNow) {
    await sendModMail("Chef IA : commentaire masqué après " + c.rp + " signalements",
      "Commentaire de " + c.name + (body.title ? " sur « " + body.title + " »" : "") + " :\n\n" + c.text + "\n\nMotifs : " + (reasons || []).join(", ") +
      "\n\n✅ Remettre en ligne : " + adm("cok=" + encodeURIComponent(ref)) + "\n❌ Supprimer définitivement : " + adm("cdel=" + encodeURIComponent(ref)));
  }
  if (c.o) {
    const ap = pidOf(c.o);
    const [cnt] = await redis([["INCR", "cra:" + ap]]);
    if (Number(cnt) === 3) await notifyOne(ap, { k: "cwarn" });
    if (Number(cnt) === 10) {
      await redis([["SET", "cbk:" + ap, "1"]]);
      await notifyOne(ap, { k: "cban" });
      await sendModMail("Chef IA : " + c.name + " ne peut plus commenter (10 signalements)",
        "Dernier commentaire signalé :\n\n" + c.text + "\n\n🔓 Le débloquer : " + adm("cunban=" + ap) + "\n📋 Tous les signalements : " + adm("creports=1"));
    }
  }
  return res.status(200).json({ ok: true, hidden: !!c.h });
}
