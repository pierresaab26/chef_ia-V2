import { createHash, randomBytes, randomInt } from "node:crypto";
import { authOk, hasRedis, redis, overLimit, clean } from "./_lib.js";

// v354: user accounts, sign-in by e-mail (magic link + 6-digit code). Served as « /api/auth » by api/circle.js (rewrite in vercel.json),
// to stay within the 12 functions of the Vercel Hobby plan.
// An account is identified by an internal id (uid), never by the e-mail (Apple can hide the real address).
// The account keeps the device « owner » secret of its first device: signing in on another device gives that device the SAME owner,
// so the pseudo, the circle, ratings and publications (all keyed by pidOf(owner)) follow the person with no migration.
// Sign-in methods are listed per account (m.email, later m.google / m.apple). Google and Apple are PREPARED, not active:
// providers() reports them off until AUTH_GOOGLE_CLIENT_ID / AUTH_APPLE_CLIENT_ID are set AND AUTH_GOOGLE / AUTH_APPLE = "on".
// Redis:
//   ae:<h(email)> → uid                       au:<uid> → JSON {e, o, at, m}         ap:<provider>:<sub> → uid (reserved for Google / Apple)
//   al:<h(link token)> → JSON {e, ch} 15 min    ac:<h(email)> → JSON {ch, n, lt} 15 min (code hash, tries, link token hash)
//   as:<h(session)> → uid 1 year              aS:<uid> set of session hashes        am:<h(email)> mails sent this hour
const TTL_LOGIN = 15 * 60, TTL_SESSION = 365 * 86400, MAX_MAILS = 5, MAX_TRIES = 5, MAX_SESSIONS = 20;
const h = (s) => createHash("sha256").update("auth|" + s).digest("hex").slice(0, 32);
const normMail = (s) => String(s || "").trim().toLowerCase().slice(0, 254);
const mailOk = (s) => /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(s);

export function providers() {
  const on = (k) => process.env["AUTH_" + k] === "on" && !!process.env["AUTH_" + k + "_CLIENT_ID"];
  return { email: true, google: on("GOOGLE"), apple: on("APPLE") };
}

// Session token sent by the browser as « x-session ». Returns the uid or "".
export async function sessionUid(req) {
  const s = String(req.headers["x-session"] || "");
  if (!/^[a-f0-9]{48}$/.test(s) || !hasRedis()) return "";
  try { const [uid] = await redis([["GET", "as:" + h(s)]]); return uid || ""; } catch { return ""; }
}

const MAIL = {
  fr: ["Votre connexion à Chef IA", "Bonjour,\n\nVotre code de connexion : {code}\n\nOu ouvrez ce lien sur l'appareil à connecter :\n{link}\n\nLe code et le lien sont valables 15 minutes. Si vous n'avez rien demandé, ignorez ce message.\n\nChef IA"],
  en: ["Your Chef IA sign-in", "Hello,\n\nYour sign-in code: {code}\n\nOr open this link on the device to sign in:\n{link}\n\nThe code and the link are valid for 15 minutes. If you did not ask for this, ignore this message.\n\nChef IA"],
  es: ["Tu acceso a Chef IA", "Hola:\n\nTu código de acceso: {code}\n\nO abre este enlace en el dispositivo que quieres conectar:\n{link}\n\nEl código y el enlace son válidos 15 minutos. Si no lo has pedido, ignora este mensaje.\n\nChef IA"],
  de: ["Deine Anmeldung bei Chef IA", "Hallo,\n\nDein Anmeldecode: {code}\n\nOder öffne diesen Link auf dem Gerät, das du anmelden willst:\n{link}\n\nCode und Link sind 15 Minuten gültig. Wenn du nichts angefordert hast, ignoriere diese Nachricht.\n\nChef IA"],
  it: ["Il tuo accesso a Chef IA", "Ciao,\n\nIl tuo codice di accesso: {code}\n\nOppure apri questo link sul dispositivo da collegare:\n{link}\n\nCodice e link valgono 15 minuti. Se non hai chiesto nulla, ignora questo messaggio.\n\nChef IA"],
  pt: ["O teu acesso ao Chef IA", "Olá,\n\nO teu código de acesso: {code}\n\nOu abre este link no dispositivo a ligar:\n{link}\n\nO código e o link são válidos durante 15 minutos. Se não pediste nada, ignora esta mensagem.\n\nChef IA"],
};

async function sendLoginMail(to, code, link, lang) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const [subject, body] = MAIL[lang] || MAIL.fr;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.AUTH_FROM || process.env.MOD_FROM || "Chef IA <onboarding@resend.dev>", to: [to], subject, text: body.replace("{code}", code).replace("{link}", link) }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch { return false; }
}

function appUrl(req) {
  const fixed = String(process.env.APP_URL || "").replace(/\/$/, "");
  if (/^https:\/\/[a-z0-9.-]+$/i.test(fixed)) return fixed;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? (/^localhost|^127\./.test(host) ? "http://" : "https://") + host : "https://chefia-v3.vercel.app";
}

// Opens a session for the e-mail: creates the account on first sign-in (it adopts the device owner), returns the account owner.
async function openSession(email, owner, pidOf) {
  const eh = h(email);
  let [uid] = await redis([["GET", "ae:" + eh]]);
  let acc = null, created = false;
  if (uid) { const [raw] = await redis([["GET", "au:" + uid]]); try { acc = JSON.parse(raw); } catch {} }
  if (!uid || !acc) {
    uid = randomBytes(12).toString("hex");
    acc = { e: email, o: owner, at: Date.now(), m: { email: true } };
    const [ok] = await redis([["SET", "ae:" + eh, uid, "NX"]]);
    if (!ok) { [uid] = await redis([["GET", "ae:" + eh]]); const [raw] = await redis([["GET", "au:" + uid]]); acc = JSON.parse(raw); } // two devices at once
    else { await redis([["SET", "au:" + uid, JSON.stringify(acc)]]); created = true; }
  }
  const tok = randomBytes(24).toString("hex"), th = h(tok);
  const [, , n] = await redis([["SET", "as:" + th, uid, "EX", String(TTL_SESSION)], ["SADD", "aS:" + uid, th], ["SCARD", "aS:" + uid]]);
  if (Number(n) > MAX_SESSIONS) { // the oldest sessions are not known: drop extra ones at random, never the new one
    const [all] = await redis([["SMEMBERS", "aS:" + uid]]);
    const drop = (all || []).filter((x) => x !== th).slice(0, Number(n) - MAX_SESSIONS);
    if (drop.length) await redis([["SREM", "aS:" + uid, ...drop], ...drop.map((x) => ["DEL", "as:" + x])]);
  }
  const [name] = await redis([["GET", "cu:" + pidOf(acc.o)]]);
  return { ok: true, session: tok, owner: acc.o, email: acc.e, created, name: name || "" };
}

export default async function authHandler(req, res, pidOf) {
  if (!hasRedis()) return res.status(501).json({ error: "storage" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const q = req.query || {};
  try {
    if (req.method === "GET" && q.providers) return res.status(200).json(providers());
    if (req.method === "GET" && q.me) {
      const uid = await sessionUid(req);
      if (!uid) return res.status(401).json({ error: "session" });
      const [raw] = await redis([["GET", "au:" + uid]]);
      const acc = JSON.parse(raw || "{}");
      return res.status(200).json({ email: acc.e || "", methods: Object.keys(acc.m || {}), providers: providers() });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method" });

    if (body.act === "logout" || body.act === "logoutAll") {
      const s = String(req.headers["x-session"] || "");
      const uid = await sessionUid(req);
      if (!uid) return res.status(200).json({ ok: true });
      if (body.act === "logout") await redis([["DEL", "as:" + h(s)], ["SREM", "aS:" + uid, h(s)]]);
      else { const [all] = await redis([["SMEMBERS", "aS:" + uid]]); await redis([...(all || []).map((x) => ["DEL", "as:" + x]), ["DEL", "aS:" + uid]]); }
      return res.status(200).json({ ok: true });
    }

    // Starting or finishing a sign-in needs app access (shared code or invitation), like every other feature.
    if (!(await authOk(req, res))) return;
    const owner = clean(req.headers["x-owner"], 60);
    if (!owner || owner.length < 8) return res.status(400).json({ error: "key" });

    if (body.act === "start") {
      if (await overLimit(req, "rl:au:", 10)) return res.status(429).json({ error: "rate" });
      const email = normMail(body.email);
      if (!mailOk(email)) return res.status(400).json({ error: "email" });
      const eh = h(email);
      const [sent] = await redis([["INCR", "am:" + eh], ["EXPIRE", "am:" + eh, "3600", "NX"]]);
      if (Number(sent) > MAX_MAILS) return res.status(429).json({ error: "rate" });
      const code = String(randomInt(0, 1000000)).padStart(6, "0"), lt = randomBytes(16).toString("hex");
      await redis([
        ["SET", "ac:" + eh, JSON.stringify({ ch: h(code), n: 0, lt: h(lt) }), "EX", String(TTL_LOGIN)],
        ["SET", "al:" + h(lt), JSON.stringify({ e: email }), "EX", String(TTL_LOGIN)],
      ]);
      const lang = MAIL[body.lang] ? body.lang : "fr";
      if (!(await sendLoginMail(email, code, appUrl(req) + "/?login=" + lt, lang))) return res.status(503).json({ error: "nomail" });
      return res.status(200).json({ ok: true });
    }

    if (body.act === "verify") {
      if (await overLimit(req, "rl:av:", 20)) return res.status(429).json({ error: "rate" });
      let email = "";
      if (body.token) { // magic link: single use
        const lt = String(body.token);
        if (!/^[a-f0-9]{32}$/.test(lt)) return res.status(400).json({ error: "badcode" });
        const [raw] = await redis([["GET", "al:" + h(lt)]]);
        if (!raw) return res.status(410).json({ error: "expired" });
        email = JSON.parse(raw).e;
        await redis([["DEL", "al:" + h(lt)], ["DEL", "ac:" + h(email)]]);
      } else { // 6-digit code: MAX_TRIES tries, then a new mail is needed
        email = normMail(body.email);
        const code = String(body.code || "").replace(/\D/g, "");
        if (!mailOk(email) || code.length !== 6) return res.status(400).json({ error: "badcode" });
        const eh = h(email);
        const [raw] = await redis([["GET", "ac:" + eh]]);
        if (!raw) return res.status(410).json({ error: "expired" });
        const c = JSON.parse(raw);
        if (c.ch !== h(code)) {
          c.n = (c.n || 0) + 1;
          if (c.n >= MAX_TRIES) await redis([["DEL", "ac:" + eh], ["DEL", "al:" + c.lt]]);
          else await redis([["SET", "ac:" + eh, JSON.stringify(c), "KEEPTTL"]]);
          return res.status(c.n >= MAX_TRIES ? 410 : 400).json({ error: c.n >= MAX_TRIES ? "expired" : "badcode", left: Math.max(0, MAX_TRIES - c.n) });
        }
        await redis([["DEL", "ac:" + eh], ["DEL", "al:" + c.lt]]);
      }
      return res.status(200).json(await openSession(email, owner, pidOf));
    }

    if (body.act === "oauth") return res.status(501).json({ error: "disabled" }); // v354: Google / Apple prepared, not active (see providers())
    return res.status(400).json({ error: "act" });
  } catch (e) {
    return res.status(502).json({ error: "storage" });
  }
}
