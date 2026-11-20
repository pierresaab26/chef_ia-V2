// v511: automatic deletion of INACTIVE accounts (legal.html promises it: 2 years without activity, warning e-mail first).
// Not a route (the "_" prefix): it is called by api/moderation.js (&inactive=1), which the daily Vercel cron hits with CRON_SECRET (vercel.json).
//   GET /api/moderation?key=<CRON_SECRET>&inactive=1          → DRY RUN: what would be warned / erased (no e-mail address in the answer)
//   GET /api/moderation?key=<CRON_SECRET>&inactive=1&run=1    → does it (the cron uses this one)
// Redis: ax:act zset uid → time of the last activity (written by touchActive in _lib.js: every request with a session, every sign-in)
//        ax:rem hash uid → time of the warning e-mail (any later activity removes it) · ax:lang hash uid → language of the e-mails
//        ax:bf flag « accounts created before v511 got their starting point (creation date) »
// Rules: at 700 days without activity (2 years minus 30) the account gets ONE warning e-mail; at 730 days it is erased, but only if the warning
// was sent at least 29 days earlier and nothing happened since. No warning sent (no e-mail service, send error) = no deletion.
// Erased: account, e-mail, @handle, pseudo, sessions, synchronised data, circle / family / follows, shopping lists, search index, notifications,
// the person's comments and ratings (found by scanning), and the recipes shared only to the circle or by link.
// PUBLISHED recipes are KEPT, anonymised (no name, no @, no owner key); a person can ask for their removal at contact@ (legal.html).
// Idempotent: a run stopped halfway is simply done again the next day (the account is deleted last).

import { createHash } from "node:crypto";
import { redis } from "./_lib.js";

const DAY = 86400000;
export const INACTIVE_DAYS = 730, WARN_DAYS = 30;
const MAX_WARN = 50, MAX_ERASE = 20, CONTACT = "contact@cheffeevalie.com";
const pidOf = (owner) => createHash("sha256").update("circle|" + owner).digest("hex").slice(0, 16); // same formula as api/circle.js
const h = (s) => createHash("sha256").update("auth|" + s).digest("hex").slice(0, 32); // same as api/_auth.js (ae:<h(email)>, as:<h(session)>)
const PUB = "pub:ck"; // public index (api/shared.js)

// ---- the warning e-mail ({date} = deletion date, {url} = the app) ----
const LOC = { fr: "fr-FR", en: "en-GB", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT" };
const MAIL = {
  fr: ["Votre compte CheffeEvalie sera supprimé le {date}", "Bonjour,\n\nVous ne vous êtes pas connecté(e) à CheffeEvalie depuis presque 2 ans. Pour protéger vos données, les comptes inactifs sont supprimés.\n\nSans connexion de votre part d'ici le {date}, votre compte, vos recettes synchronisées, vos listes et vos commentaires seront supprimés définitivement. Vos recettes publiées restent visibles, sans votre nom ni votre @.\n\nPour garder votre compte, il suffit de vous connecter : {url}\n\nUne question, ou une recette publiée à retirer ? Écrivez-nous : {contact}\n\nCheffeEvalie"],
  en: ["Your CheffeEvalie account will be deleted on {date}", "Hello,\n\nYou have not signed in to CheffeEvalie for almost 2 years. To protect your data, inactive accounts are deleted.\n\nIf you do not sign in before {date}, your account, synced recipes, lists and comments will be permanently deleted. Your published recipes stay visible, without your name or your @.\n\nTo keep your account, just sign in: {url}\n\nA question, or a published recipe to remove? Write to us: {contact}\n\nCheffeEvalie"],
  es: ["Tu cuenta de CheffeEvalie se eliminará el {date}", "Hola:\n\nLlevas casi 2 años sin iniciar sesión en CheffeEvalie. Para proteger tus datos, las cuentas inactivas se eliminan.\n\nSi no inicias sesión antes del {date}, tu cuenta, tus recetas sincronizadas, tus listas y tus comentarios se eliminarán definitivamente. Tus recetas publicadas seguirán visibles, sin tu nombre ni tu @.\n\nPara conservar tu cuenta, basta con iniciar sesión: {url}\n\n¿Una pregunta, o una receta publicada que quieres retirar? Escríbenos: {contact}\n\nCheffeEvalie"],
  de: ["Dein CheffeEvalie-Konto wird am {date} gelöscht", "Hallo,\n\ndu hast dich seit fast 2 Jahren nicht mehr bei CheffeEvalie angemeldet. Zum Schutz deiner Daten werden inaktive Konten gelöscht.\n\nMeldest du dich nicht bis zum {date} an, werden dein Konto, deine synchronisierten Rezepte, Listen und Kommentare endgültig gelöscht. Deine veröffentlichten Rezepte bleiben sichtbar, ohne deinen Namen und dein @.\n\nUm dein Konto zu behalten, melde dich einfach an: {url}\n\nEine Frage, oder ein veröffentlichtes Rezept, das entfernt werden soll? Schreib uns: {contact}\n\nCheffeEvalie"],
  it: ["Il tuo account CheffeEvalie sarà eliminato il {date}", "Ciao,\n\nnon accedi a CheffeEvalie da quasi 2 anni. Per proteggere i tuoi dati, gli account inattivi vengono eliminati.\n\nSe non accedi entro il {date}, il tuo account, le ricette sincronizzate, le liste e i commenti saranno eliminati definitivamente. Le tue ricette pubblicate restano visibili, senza il tuo nome né il tuo @.\n\nPer tenere il tuo account basta accedere: {url}\n\nUna domanda, o una ricetta pubblicata da rimuovere? Scrivici: {contact}\n\nCheffeEvalie"],
  pt: ["A tua conta CheffeEvalie será eliminada a {date}", "Olá,\n\nnão inicias sessão no CheffeEvalie há quase 2 anos. Para proteger os teus dados, as contas inativas são eliminadas.\n\nSe não iniciares sessão até {date}, a tua conta, as receitas sincronizadas, as listas e os comentários serão eliminados definitivamente. As tuas receitas publicadas continuam visíveis, sem o teu nome nem o teu @.\n\nPara manter a tua conta, basta iniciares sessão: {url}\n\nUma pergunta, ou uma receita publicada para retirar? Escreve-nos: {contact}\n\nCheffeEvalie"],
};
const appBase = () => { const u = String(process.env.APP_URL || "").replace(/\/$/, ""); return /^https:\/\/[a-z0-9.-]+$/i.test(u) ? u : "https://www.cheffeevalie.com"; };
export function warnMail(lang, deleteAt) {
  const l = MAIL[lang] ? lang : "fr", [subject, body] = MAIL[l];
  const date = new Date(deleteAt).toLocaleDateString(LOC[l], { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const fill = (s) => s.replaceAll("{date}", date).replaceAll("{url}", appBase()).replaceAll("{contact}", CONTACT);
  return { subject: fill(subject), text: fill(body) };
}
async function sendMail(to, subject, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error("inactive: RESEND_API_KEY missing"); return false; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.AUTH_FROM || process.env.MOD_FROM || "CheffeEvalie <onboarding@resend.dev>", to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error("inactive: mail failed", r.status);
    return r.ok;
  } catch (e) { console.error("inactive: mail error", String((e && e.message) || e)); return false; }
}

// ---- small Redis helpers (Upstash pipeline, sent in slices) ----
async function pipe(cmds, size = 200) {
  const out = [];
  for (let i = 0; i < cmds.length; i += size) out.push(...(await redis(cmds.slice(i, i + size))));
  return out;
}
async function scan(pat, cap = 50000) {
  let cur = "0", keys = [], loops = 0;
  do {
    const [r] = await redis([["SCAN", cur, "MATCH", pat, "COUNT", "500"]]);
    cur = String(r[0]);
    keys.push(...r[1]);
  } while (cur !== "0" && keys.length < cap && ++loops < 400);
  return keys;
}
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

// Accounts created before v511 have no activity entry: they start at their creation date (once).
async function backfill(dry) {
  const [done] = await redis([["GET", "ax:bf"]]);
  if (done) return 0;
  const keys = (await scan("au:*", 20000)).filter((k) => /^au:[a-f0-9]{24}$/.test(k));
  const raws = await pipe(keys.map((k) => ["GET", k]));
  const cmds = keys.map((k, i) => { const a = parse(raws[i]); return a ? ["ZADD", "ax:act", "NX", String(Number(a.at) || Date.now()), k.slice(3)] : null; }).filter(Boolean);
  if (!dry) { await pipe(cmds); await redis([["SET", "ax:bf", "1"]]); }
  return cmds.length;
}

// ---- erasing ----
// Published recipes of these people: the frozen public copy s:<ps> loses its author (name, @, owner key). The recipe itself stays.
async function anonymisePublic(accs) {
  const owners = new Set(accs.map((a) => a.o)), pids = new Set(accs.map((a) => pidOf(a.o)));
  const [idx, ...pp] = await redis([["HKEYS", PUB], ...[...pids].map((p) => ["ZRANGE", "pp:" + p, "0", "-1"])]);
  const sids = [...new Set([...(idx || []), ...pp.flat()])].filter((x) => /^[a-zA-Z0-9_-]{4,80}$/.test(x));
  let n = 0;
  for (let i = 0; i < sids.length; i += 100) {
    const part = sids.slice(i, i + 100);
    const [raws] = await redis([["MGET", ...part.map((x) => "s:" + x)]]);
    const cmds = [];
    raws.forEach((raw, j) => {
      const d = raw ? parse(raw) : null;
      if (!d || !d.pub || !((d.o && owners.has(d.o)) || (d.bp && pids.has(d.bp)))) return;
      d.o = ""; d.by = ""; d.bp = ""; // « og » (the author of the ROOT recipe, someone else) is not touched
      cmds.push(["SET", "s:" + part[j], JSON.stringify(d), "KEEPTTL"]);
    });
    if (cmds.length) { await redis(cmds); n += cmds.length; }
  }
  return n;
}

// Comments (list c:<recipe>, entry {o: owner}) and ratings / « cooked » / tags / adjustment votes (hashes keyed by the owner key): found by scanning.
async function eraseTraces(accs) {
  const owners = [...new Set(accs.map((a) => a.o).filter(Boolean))];
  if (!owners.length) return { comments: 0, ratings: 0 };
  const os = new Set(owners);
  const keys = [...(await scan("c:*")), ...(await scan("r:*")), ...(await scan("rc:*")), ...(await scan("rt:*")), ...(await scan("ra:*"))];
  const types = await pipe(keys.map((k) => ["TYPE", k]));
  let comments = 0, ratings = 0;
  const lists = keys.filter((k, i) => k.startsWith("c:") && types[i] === "list");
  const hashes = keys.filter((k, i) => /^r[cta]?:/.test(k) && types[i] === "hash");
  for (let i = 0; i < lists.length; i += 50) {
    const part = lists.slice(i, i + 50);
    const all = await redis(part.map((k) => ["LRANGE", k, "0", "-1"]));
    const cmds = [];
    all.forEach((arr, j) => (arr || []).forEach((s) => { const c = parse(s); if (c && c.o && os.has(c.o)) { cmds.push(["LREM", part[j], "1", s]); comments++; } }));
    if (cmds.length) await pipe(cmds);
  }
  const plain = hashes.filter((k) => !k.startsWith("ra:")), adj = hashes.filter((k) => k.startsWith("ra:"));
  if (plain.length) { const r = await pipe(plain.map((k) => ["HDEL", k, ...owners])); ratings += r.reduce((a, b) => a + Number(b || 0), 0); }
  for (let i = 0; i < adj.length; i += 100) {
    const part = adj.slice(i, i + 100);
    const all = await redis(part.map((k) => ["HKEYS", k]));
    const cmds = [];
    all.forEach((f, j) => { const mine = (f || []).filter((x) => os.has(String(x).slice(String(x).indexOf(":") + 1))); if (mine.length) { cmds.push(["HDEL", part[j], ...mine]); ratings += mine.length; } });
    if (cmds.length) await pipe(cmds);
  }
  return { comments, ratings };
}

// One account. The account record (au:) goes LAST, so a failure leaves it for tomorrow's run.
async function eraseOne(uid, acc) {
  const pid = pidOf(acc.o);
  const [cp, cf, fm, fo, fw, sm, hxn, sess, hp] = await redis([
    ["ZRANGE", "cp:" + pid, "0", "-1"], ["SMEMBERS", "cf:" + pid], ["SMEMBERS", "fm:" + pid], ["SMEMBERS", "fo:" + pid], ["SMEMBERS", "fw:" + pid],
    ["SMEMBERS", "sm:" + pid], ["GET", "hxn:" + pid], ["SMEMBERS", "aS:" + uid], ["GET", "hp:" + pid],
  ]);
  const cmds = [];
  // recipes put in the circle / shared by link by this person (NOT the published ones: those are kept, anonymised above)
  const cps = (cp || []).filter((x) => /^[a-zA-Z0-9_-]{4,80}$/.test(x));
  if (cps.length) {
    const [raws] = await redis([["MGET", ...cps.map((x) => "s:" + x)]]);
    raws.forEach((raw, i) => { const d = raw ? parse(raw) : null; if (d && !d.pub && d.o === acc.o) cmds.push(["DEL", "s:" + cps[i]]); });
  }
  // shared shopping lists: mine are deleted, the others just lose me
  const ids = (sm || []).filter((x) => /^[a-zA-Z0-9_-]{4,80}$/.test(x));
  if (ids.length) {
    const [raws] = await redis([["MGET", ...ids.map((x) => "sl:" + x)]]);
    raws.forEach((raw, i) => {
      const l = raw ? parse(raw) : null;
      if (!l) return;
      if (l.o === pid) cmds.push(["DEL", "sl:" + ids[i]], ...(l.lk ? [["DEL", "sk:" + l.lk]] : []), ...(l.m || []).filter((p) => p !== pid).map((p) => ["SREM", "sm:" + p, ids[i]]));
      else { l.m = (l.m || []).filter((p) => p !== pid); l.v = (Number(l.v) || 0) + 1; cmds.push(["SET", "sl:" + ids[i], JSON.stringify(l), "KEEPTTL"]); }
    });
  }
  // circle, family, follows: the other side forgets me
  (cf || []).forEach((p) => cmds.push(["SREM", "cf:" + p, pid]));
  (fm || []).forEach((p) => cmds.push(["SREM", "fm:" + p, pid], ["HDEL", "fq:" + p, pid]));
  (fo || []).forEach((p) => cmds.push(["SREM", "fw:" + p, pid]));
  (fw || []).forEach((p) => cmds.push(["SREM", "fo:" + p, pid]));
  // search index
  const members = parse(hxn) || [];
  if (Array.isArray(members) && members.length) cmds.push(["ZREM", "hx", ...members]);
  // handle (only if it is really mine)
  const hd = acc.h || hp || "";
  if (hd && /^[a-z0-9_.]{3,20}$/.test(hd)) { const [who] = await redis([["GET", "ah:" + hd]]); if (who === uid || who === "p:" + pid) cmds.push(["DEL", "ah:" + hd]); }
  // sessions
  (sess || []).forEach((x) => cmds.push(["DEL", "as:" + x]));
  cmds.push(["DEL", "cu:" + pid, "cf:" + pid, "cp:" + pid, "cn:" + pid, "cnr:" + pid, "fm:" + pid, "fq:" + pid, "fw:" + pid, "fo:" + pid, "pp:" + pid, "hxn:" + pid, "hp:" + pid,
    "cbk:" + pid, "cra:" + pid, "cr:" + pid, "sm:" + pid, "sy:" + uid, "sy:" + uid + ":c", "aq:" + uid, "ag:" + uid, "aqr:" + uid, "aS:" + uid]);
  await pipe(cmds);
  // the account itself, last
  await redis([["DEL", "ae:" + h(acc.e || ""), "au:" + uid], ["ZREM", "ax:act", uid], ["HDEL", "ax:rem", uid], ["HDEL", "ax:lang", uid]]);
}

// ---- the daily run ----
export async function runInactive({ dry = true, now = Date.now() } = {}) {
  const out = { dry, backfilled: 0, orphans: 0, toWarn: 0, warned: 0, mailFailed: 0, toErase: 0, erased: 0, anonymised: 0, comments: 0, ratings: 0, details: [] };
  out.backfilled = await backfill(dry);
  const warnAt = now - (INACTIVE_DAYS - WARN_DAYS) * DAY, killAt = now - INACTIVE_DAYS * DAY;
  const [rows] = await redis([["ZRANGEBYSCORE", "ax:act", "-inf", String(warnAt), "WITHSCORES", "LIMIT", "0", "300"]]);
  const cands = []; for (let i = 0; i + 1 < (rows || []).length; i += 2) cands.push({ uid: rows[i], last: Number(rows[i + 1]) });
  if (!cands.length) return out;
  const info = await pipe(cands.flatMap((c) => [["GET", "au:" + c.uid], ["HGET", "ax:rem", c.uid], ["HGET", "ax:lang", c.uid]]), 300);
  const warn = [], kill = [];
  cands.forEach((c, i) => {
    const acc = parse(info[i * 3]), rem = Number(info[i * 3 + 1]) || 0, lang = info[i * 3 + 2] || "fr";
    if (!acc || !acc.o) { out.orphans++; if (!dry) redis([["ZREM", "ax:act", c.uid], ["HDEL", "ax:rem", c.uid], ["HDEL", "ax:lang", c.uid]]).catch(() => {}); return; }
    if (!rem) { if (acc.e) warn.push({ ...c, acc, lang }); }
    else if (c.last <= killAt && rem <= now - (WARN_DAYS - 1) * DAY) kill.push({ ...c, acc });
  });
  out.toWarn = warn.length; out.toErase = Math.min(kill.length, MAX_ERASE);
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  warn.slice(0, MAX_WARN).forEach((w) => out.details.push({ action: "warn", account: w.uid.slice(0, 6), lastActivity: day(w.last), lang: w.lang }));
  kill.slice(0, MAX_ERASE).forEach((k) => out.details.push({ action: "erase", account: k.uid.slice(0, 6), lastActivity: day(k.last) }));
  if (dry) return out;

  for (const w of warn.slice(0, MAX_WARN)) { // 1. the warning e-mail; the date is only recorded once it is really sent
    const m = warnMail(w.lang, now + WARN_DAYS * DAY);
    if (await sendMail(w.acc.e, m.subject, m.text)) { await redis([["HSET", "ax:rem", w.uid, String(now)]]); out.warned++; }
    else out.mailFailed++;
  }
  const batch = [];
  for (const k of kill.slice(0, MAX_ERASE)) { // 2. last check: nothing happened since
    const [score] = await redis([["ZSCORE", "ax:act", k.uid]]);
    if (score !== null && Number(score) <= killAt) batch.push(k);
  }
  if (batch.length) {
    out.anonymised = await anonymisePublic(batch.map((k) => k.acc));
    const t = await eraseTraces(batch.map((k) => k.acc));
    out.comments = t.comments; out.ratings = t.ratings;
    for (const k of batch) { await eraseOne(k.uid, k.acc); out.erased++; }
  }
  return out;
}
