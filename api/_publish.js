import { authOk, hasRedis, redis, overLimit, clean, callClaude, parseJsonLoose } from "./_lib.js";
import { pidOf, liveRoots } from "./circle.js";
import { notifyCircle, notifyOne, notifyFollowers } from "./_notify.js";
import { PUB } from "./shared.js";
import { sendModMail } from "./_mod.js";

// v291: « 🌍 Publique »; v293: file renamed _publish.js (not a route), served as /api/publish through /api/circle?via=pub (community plan step 9, first version) + reports (step 8).
// The author publishes the shared copy « s:<sid> » of one of his recipe versions. Conditions:
//  - he tapped « J'ai cuisiné » (or rated it) on that version (rc:<ck> / r:<ck>);
//  - the chef (model) checks it: food, complete, safe; a recipe received from someone (copy with « rs ») must ALSO be a real
//    remix (another dish), not an adjustment (quantities, seasoning, minor swap); and its root author must still share it;
//  - refused → the author can appeal: the recipe waits in the manual queue « pub:queue » (admin link below).
// Published = a FROZEN copy « s:pub-<sid> » (later edits do not change it), listed in the public index « pub:ck »
// (read by the community search and the weekly menu), with the author's nickname. Its circle is notified.
// Reports: 3 different people → hidden from the public index until reviewed.
// Redis: pb:<sid> = {st: public|refused|pending|hidden, ps, reason, at} · pub:rep:<ps> set of reporters · pub:queue (200 last)
// Admin (browser): GET /api/publish?key=<CRON_SECRET> = queue; &approve=<sid> publishes; &reject=<sid> keeps it refused;
// &remove=<ps> takes a public recipe down; &restore=<ps> puts a hidden (reported) one back. v292: an email (Resend, MOD_EMAIL) with these
// links is sent for every appeal and when a recipe is hidden after 3 reports.
const pubSid = (sid) => ("pub-" + sid).slice(0, 64);
const REPORTS_TO_HIDE = 3;
const site = (req) => "https://" + String(req.headers["x-forwarded-host"] || req.headers.host || "chefia-v3.vercel.app").split(",")[0].trim();
const adminLink = (req, p) => site(req) + "/api/publish?key=" + encodeURIComponent(process.env.CRON_SECRET || "<CRON_SECRET>") + p;

export default async function handler(req, res) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  const q = req.query || {};
  if (req.method === "GET" && q.key != null) return admin(req, res, q);
  if (!(await authOk(req, res))) return;
  const owner = clean(req.headers["x-owner"], 60);
  if (!owner || owner.length < 8) return res.status(400).json({ error: "key" });
  const me = pidOf(owner), body = req.body && typeof req.body === "object" ? req.body : {};
  try {
    if (req.method === "GET") { // state of my version: none | public | refused | pending | hidden
      const sid = String(q.state || "");
      if (!/^[a-z0-9-]{8,64}$/.test(sid)) return res.status(400).json({ error: "key" });
      const [raw] = await redis([["GET", "pb:" + sid]]);
      let st = null; try { st = JSON.parse(raw); } catch {}
      return res.status(200).json(st ? { state: st.st, reason: st.reason || "", ps: st.ps || "" } : { state: "none" });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method" });
    const act = String(body.act || "");

    if (act === "report") { // anyone except the author, once per person
      const ps = String(body.sid || "");
      if (!/^pub-[a-z0-9-]{4,60}$/.test(ps)) return res.status(400).json({ error: "key" });
      if (await overLimit(req, "rl:rp:", 10)) return res.status(429).json({ error: "rate" });
      const [raw] = await redis([["GET", "s:" + ps]]);
      let d = null; try { d = JSON.parse(raw); } catch {}
      if (!d) return res.status(404).json({ error: "notfound" });
      if (d.o === owner) return res.status(409).json({ error: "self" });
      const [, n] = await redis([["SADD", "pub:rep:" + ps, me], ["SCARD", "pub:rep:" + ps]]);
      await redis([["LPUSH", "pub:queue", JSON.stringify({ k: "report", ps, t: d.title, n: Number(n), at: Date.now(), why: clean(body.why, 200) })], ["LTRIM", "pub:queue", "0", "199"]]);
      if (Number(n) >= REPORTS_TO_HIDE) {
        const [was] = await redis([["HDEL", PUB, ps]]);
        if (d.src) await redis([["SET", "pb:" + d.src, JSON.stringify({ st: "hidden", ps, at: Date.now() })]]);
        if (Number(was)) await sendModMail("Chef IA : recette masquée après " + n + " signalements", // once, when it leaves the public index
          "La recette publique « " + d.title + " » (par " + (d.by || "?") + ") a été signalée par " + n + " personnes : elle est masquée.\n\n" +
          "✅ La remettre en ligne : " + adminLink(req, "&restore=" + ps) + "\n❌ La retirer définitivement : " + adminLink(req, "&remove=" + ps) +
          "\n\nToute la file : " + adminLink(req, "") + "\n\nRecette :\n" + String(d.text || "").slice(0, 3000));
      }
      return res.status(200).json({ ok: true });
    }

    const sid = String(body.sid || "");
    if (!/^[a-z0-9-]{8,64}$/.test(sid) || sid.startsWith("pub-")) return res.status(400).json({ error: "key" });
    const [raw] = await redis([["GET", "s:" + sid]]);
    let d = null; try { d = JSON.parse(raw); } catch {}
    if (!d) return res.status(404).json({ error: "notfound" });
    if (d.o !== owner) return res.status(403).json({ error: "forbidden" }); // only the author of this copy

    // v300: the recipe exactly as received (same comment key as its root copy) belongs to its author: the receiver cannot publish it
    if ((act === "publish" || act === "appeal") && await notOwner(d)) return res.status(403).json({ error: "notowner" });

    if (act === "unpublish") {
      const ps = pubSid(sid);
      await redis([["DEL", "s:" + ps], ["HDEL", PUB, ps], ["DEL", "pb:" + sid], ["DEL", "pub:rep:" + ps]]);
      return res.status(200).json({ ok: true });
    }
    if (act === "appeal") {
      const [st] = await redis([["GET", "pb:" + sid]]);
      let s = null; try { s = JSON.parse(st); } catch {}
      if (!s || s.st !== "refused" || s.final) return res.status(409).json({ error: "state" }); // final = already turned down by the admin
      await redis([["SET", "pb:" + sid, JSON.stringify({ ...s, st: "pending", at: Date.now() })],
        ["LPUSH", "pub:queue", JSON.stringify({ k: "appeal", sid, t: d.title, reason: s.reason, at: Date.now() })], ["LTRIM", "pub:queue", "0", "199"]]);
      const [nm] = await redis([["GET", "cu:" + me]]);
      await sendModMail("Chef IA : appel de publication « " + d.title + " »",
        (nm || "Un utilisateur") + " fait appel du refus de publication de « " + d.title + " ».\nRaison du chef : " + (s.reason || "?") + (d.rs ? "\n(Recette reçue et modifiée : remix d'une autre recette.)" : "") +
        "\n\n👉 Répondre (avec un commentaire pour l'auteur) : " + adminLink(req, "&review=" + sid) +
        "\n\nOu directement, sans commentaire :\n✅ Publier : " + adminLink(req, "&approve=" + sid) + "\n❌ Laisser refusée : " + adminLink(req, "&reject=" + sid) +
        "\n\nToute la file : " + adminLink(req, "") + "\n\nRecette :\n" + String(d.text || "").slice(0, 3000));
      return res.status(200).json({ ok: true, state: "pending" });
    }
    if (act !== "publish") return res.status(400).json({ error: "act" });

    const [r1, r2] = await redis([["HGET", "rc:" + d.ck, owner], ["HGET", "r:" + d.ck, owner]]);
    if (!r1 && !r2) return res.status(409).json({ error: "cook" }); // « J'ai cuisiné » first
    let parent = "";
    if (d.rs) {
      if (!(await liveRoots([d.rs])).has(d.rs)) return res.status(409).json({ error: "gone" }); // its author took it back
      const [pr] = await redis([["GET", "s:" + d.rs]]);
      try { parent = JSON.parse(pr).text || ""; } catch {}
    }
    if (await overLimit(req, "rl:pb:", 5)) return res.status(429).json({ error: "rate" });
    const lang = clean(body.lang || d.lang, 5) || "fr";
    let verdict;
    try { verdict = await review(d, parent, lang); } catch (e) { return res.status(502).json({ error: e && e.code || "upstream" }); }
    if (!verdict.ok) {
      await redis([["SET", "pb:" + sid, JSON.stringify({ st: "refused", reason: verdict.reason, kind: verdict.kind, at: Date.now() })]]);
      return res.status(200).json({ ok: false, state: "refused", reason: verdict.reason });
    }
    const ps = await makePublic(sid, d, me);
    return res.status(200).json({ ok: true, state: "public", ps });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}

// The frozen public copy + index + circle notification (also used by the admin « approve »).
async function makePublic(sid, d, me) {
  const ps = pubSid(sid);
  const [name] = await redis([["GET", "cu:" + me]]);
  const copy = { title: d.title, text: d.text, ck: d.ck, lang: d.lang, ph: d.ph || null, o: d.o, ts: Date.now(), pub: 1, src: sid, by: name || "", og: d.by || "", bp: me };
  await redis([["SET", "s:" + ps, JSON.stringify(copy)], ["HSET", PUB, ps, JSON.stringify({ sid: ps, ck: d.ck, t: d.title, l: d.lang })],
    ["SET", "pb:" + sid, JSON.stringify({ st: "public", ps, at: Date.now() })], ["DEL", "pub:rep:" + ps]]);
  await notifyCircle(me, { k: "pub", sid: ps, t: d.title });
  try { await redis([["ZADD", "pp:" + me, String(Date.now()), ps]]); } catch {} // v363: the author's public recipes (profile page)
  await notifyFollowers(me, { k: "fpub", sid: ps, t: d.title }); // v363: people who follow him
  return ps;
}

const SYS = `You review recipes before they are published in the public community of a cooking app. Answer ONLY with JSON:
{"ok": true|false, "kind": "original"|"remix"|"adjust"|"same"|"invalid", "reason": "<one short, kind sentence for the author, in the language LANG>"}
Accept (ok true) only if ALL hold:
1. It is a real food or drink recipe (not another topic, not a joke, nothing offensive, no personal data, no advertising).
2. It is complete enough to cook: ingredients with quantities and clear steps.
3. It is safe: no dangerous practice (raw or undercooked risky food without warning, toxic ingredients, unsafe preservation).
4. If a PARENT recipe is given: the new one must be a REMIX, i.e. a different dish (main ingredient changed, another technique, another flavour profile such as a vegetarian or fusion version). Only changing quantities, servings, seasoning, a minor swap (butter/oil) or an allergen adaptation is an ADJUSTMENT: refuse with kind "adjust" and say it is too close to the original. Identical: kind "same".
Without a parent, kind is "original" when accepted. The reason explains the refusal, or says briefly why it is accepted.`;

async function review(d, parent, lang) {
  const content = `LANG: ${lang}\n\nRECIPE TO PUBLISH:\n${String(d.text).slice(0, 12000)}` + (parent ? `\n\nPARENT RECIPE (the one it comes from):\n${parent.slice(0, 12000)}` : "\n\n(No parent: the author's own recipe.)");
  const { text } = await callClaude({ model: process.env.MODEL || "claude-haiku-5-5", max_tokens: 2000, system: SYS, content });
  const j = parseJsonLoose(text);
  if (!j || typeof j.ok !== "boolean") throw Object.assign(new Error("upstream"), { code: "upstream" });
  const kind = ["original", "remix", "adjust", "same", "invalid"].includes(j.kind) ? j.kind : (j.ok ? "original" : "invalid");
  const ok = j.ok && (!parent || kind === "remix"); // a received recipe goes public only as a real remix
  return { ok, kind, reason: clean(j.reason, 300) };
}

// v300: true when this shared copy is a recipe RECEIVED and not changed by the receiver (same comment / rating key as the root copy).
// His own new versions get their own key, so they can still go through the chef's « remix » check.
export async function notOwner(d) {
  if (!d || !d.rs) return false;
  try { const [pr] = await redis([["GET", "s:" + d.rs]]); const p = JSON.parse(pr); return !!(p && p.ck && p.ck === d.ck); } catch { return false; }
}

// v302: the moderator's page for an appeal (link « Répondre » of the email): the recipe, the chef's reason, a comment for the author
// and two buttons; the form calls &approve= / &reject= with &note= and &html=1 (answer as a small page instead of JSON).
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function page(res, code, title, body) {
  res.setHeader("content-type", "text/html; charset=utf-8");
  return res.status(code).send(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<body style="margin:0;background:#fffaf2;color:#16121a;font:16px/1.5 system-ui,-apple-system,sans-serif"><main style="max-width:560px;margin:0 auto;padding:24px 16px">${body}</main></body></html>`);
}
const card = (h) => `<section style="background:#fff;border-radius:22px;box-shadow:0 2px 12px rgba(0,0,0,.06);padding:18px;margin:0 0 14px">${h}</section>`;
function answer(res, q, code, json, msg) {
  if (!q.html) return res.status(code).json(json);
  return page(res, code, "Chef IA", card(`<p style="font-size:18px;font-weight:600;margin:0">${esc(msg)}</p>`));
}

async function admin(req, res, q) {
  const secret = process.env.CRON_SECRET;
  if (!secret || String(q.key) !== secret) return res.status(401).json({ error: "code" });
  const note = clean(q.note, 300); // v302: the moderator's comment, sent to the author with the answer
  try {
    if (q.review) {
      const sid = String(q.review);
      const [raw, st] = await redis([["GET", "s:" + sid], ["GET", "pb:" + sid]]);
      let d = null, s = null; try { d = JSON.parse(raw); } catch {} try { s = JSON.parse(st); } catch {}
      if (!d) return page(res, 404, "Chef IA", card("<p>Recette introuvable (supprimée par son auteur ?).</p>"));
      const [nm] = d.o ? await redis([["GET", "cu:" + pidOf(d.o)]]) : [null];
      const done = s && s.st !== "pending" ? `<p style="color:#b5645e;margin:0 0 10px">Déjà traité : ${esc(s.st === "public" ? "publiée" : s.st === "refused" ? "refusée" : s.st)}.</p>` : "";
      const b = "padding:12px 18px;border-radius:999px;font:inherit;font-weight:600;cursor:pointer;flex:1";
      return page(res, 200, "Appel · " + d.title, card(`<h1 style="font-size:22px;margin:0 0 6px">${esc(d.title)}</h1><p style="margin:0;color:#7b7684">par ${esc(nm || "?")}${d.rs ? " · recette reçue et modifiée" : ""}</p>`) +
        card(`<b>Raison du chef</b><p style="margin:6px 0 0">${esc(s && s.reason || "?")}</p>`) +
        card(`<details><summary style="cursor:pointer;font-weight:600">Voir la recette</summary><pre style="white-space:pre-wrap;font:inherit;margin:10px 0 0">${esc(String(d.text || "").slice(0, 6000))}</pre></details>`) +
        card(`${done}<form method="get" action="/api/publish"><input type="hidden" name="key" value="${esc(q.key)}"><input type="hidden" name="html" value="1">
<label for="n" style="font-weight:600">Commentaire pour l'auteur (facultatif)</label>
<textarea id="n" name="note" maxlength="300" rows="4" style="width:100%;box-sizing:border-box;margin:8px 0 14px;padding:10px 12px;border-radius:14px;border:1px solid rgba(0,0,0,.15);font:inherit"></textarea>
<div style="display:flex;gap:10px"><button name="approve" value="${esc(sid)}" style="${b};border:1px solid rgba(229,25,95,.22);background:#fde6ee;color:#e5195f">✅ Publier</button>
<button name="reject" value="${esc(sid)}" style="${b};border:1px solid rgba(0,0,0,.12);background:#fff;color:#16121a">❌ Laisser refusée</button></div></form>`));
    }
    if (q.approve) {
      const sid = String(q.approve);
      const [raw] = await redis([["GET", "s:" + sid]]);
      let d = null; try { d = JSON.parse(raw); } catch {}
      if (!d) return answer(res, q, 404, { error: "notfound" }, "Recette introuvable.");
      if (await notOwner(d)) return answer(res, q, 403, { error: "notowner" }, "Refusé : ce n'est pas sa recette (recette reçue)."); // v300: not his recipe
      const [st0] = await redis([["GET", "pb:" + sid]]);
      let s0 = null; try { s0 = JSON.parse(st0); } catch {}
      const ps = await makePublic(sid, d, pidOf(d.o));
      if (s0 && s0.st === "pending") await notifyOne(pidOf(d.o), { k: "appok", sid: ps, t: d.title, m: note }); // v301: the author learns the answer to his appeal (v302: + comment)
      return answer(res, q, 200, { ok: true, ps }, "✅ Recette publiée." + (s0 && s0.st === "pending" ? " L'auteur a été prévenu." : ""));
    }
    if (q.reject) { // the appeal is turned down: back to « refused » (the author sees the selector without « En vérification »)
      const sid = String(q.reject);
      const [st] = await redis([["GET", "pb:" + sid]]);
      let s = null; try { s = JSON.parse(st); } catch {}
      if (!s) return answer(res, q, 404, { error: "notfound" }, "Recette introuvable.");
      await redis([["SET", "pb:" + sid, JSON.stringify({ ...s, st: "refused", at: Date.now(), final: 1 })]]);
      let told = false;
      if (s.st === "pending") { // v301: tell the author (once: a second click finds « refused »)
        const [raw] = await redis([["GET", "s:" + sid]]);
        let d = null; try { d = JSON.parse(raw); } catch {}
        if (d && d.o) { await notifyOne(pidOf(d.o), { k: "appno", sid, t: d.title, m: note }); told = true; } // v302: + comment
      }
      return answer(res, q, 200, { ok: true, state: "refused" }, "❌ Recette laissée refusée." + (told ? " L'auteur a été prévenu." : ""));
    }
    if (q.restore) { // a recipe hidden by reports goes back to the public index
      const ps = String(q.restore);
      const [raw] = await redis([["GET", "s:" + ps]]);
      let d = null; try { d = JSON.parse(raw); } catch {}
      if (!d) return res.status(404).json({ error: "notfound" });
      await redis([["HSET", PUB, ps, JSON.stringify({ sid: ps, ck: d.ck, t: d.title, l: d.lang })], ["DEL", "pub:rep:" + ps]].concat(d.src ? [["SET", "pb:" + d.src, JSON.stringify({ st: "public", ps, at: Date.now() })]] : []));
      return res.status(200).json({ ok: true, state: "public" });
    }
    if (q.remove) {
      const ps = String(q.remove);
      const [raw] = await redis([["GET", "s:" + ps]]);
      let d = null; try { d = JSON.parse(raw); } catch {}
      await redis([["HDEL", PUB, ps], ["DEL", "s:" + ps]].concat(d && d.src ? [["SET", "pb:" + d.src, JSON.stringify({ st: "hidden", ps, at: Date.now() })]] : []));
      return res.status(200).json({ ok: true });
    }
    const [list, n] = await redis([["LRANGE", "pub:queue", "0", "99"], ["HLEN", PUB]]);
    return res.status(200).json({ published: Number(n) || 0, queue: (list || []).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean) });
  } catch { return res.status(502).json({ error: "storage" }); }
}
