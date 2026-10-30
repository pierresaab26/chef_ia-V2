// Récupération sécurisée d'une page web + extraction d'une recette.
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { normRecipe } from "./_lib.js";

const MAX_BYTES = 2_000_000;
const err = (code) => Object.assign(new Error(code), { code });

// ---------- Protection contre l'accès à des adresses internes (SSRF) ----------
export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0) ||
      (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    const dotted = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateIp(dotted[1]);
    const hex = x.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const n = (parseInt(hex[1], 16) * 65536) + parseInt(hex[2], 16);
      return isPrivateIp([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
    }
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x) ||
      x.startsWith("64:ff9b:") || x.startsWith("2002:") || x.startsWith("2001:0:") || x.startsWith("2001:db8");
  }
  return true;
}

// Vérifie l'adresse au moment même de la connexion (évite le détournement par DNS).
function safeLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true, verbatim: true }, (e, addrs) => {
    if (e) return cb(e);
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      return cb(Object.assign(new Error("private"), { code: "EPRIVATE" }));
    }
    if (options && options.all) return cb(null, addrs);
    return cb(null, addrs[0].address, addrs[0].family);
  });
}

function checkUrl(u, allowPrivate) {
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw err("badurl");
  if (allowPrivate) return;
  if (u.port && u.port !== "80" && u.port !== "443") throw err("badurl");
  const h = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(h) ? isPrivateIp(h) : /^localhost$|\.local$|\.internal$|\.localhost$/i.test(h)) throw err("private");
}

function decodeBody(buf, contentType) {
  const m = /charset=["']?([\w-]+)/i.exec(contentType || "") || /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 4096).toString("latin1"));
  try { return new TextDecoder(m ? m[1] : "utf-8").decode(buf); } catch { return buf.toString("utf8"); }
}

function once(u, allowPrivate, lang) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === "https:" ? https : http;
    let done = false, timer;
    const fin = (f, v) => { if (!done) { done = true; clearTimeout(timer); f(v); } };
    const req = lib.request(u, {
      method: "GET",
      lookup: allowPrivate ? undefined : safeLookup,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ChefIA/1.0; +recipe-import)",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "accept-language": (lang || "en") + ",en;q=0.7",
        "accept-encoding": "gzip, deflate, br",
      },
    }, (res) => {
      const status = res.statusCode, location = res.headers.location;
      if (status >= 300 && status < 400) { res.resume(); return fin(resolve, { status, location, headers: res.headers, body: "" }); }
      const enc = String(res.headers["content-encoding"] || "").toLowerCase();
      let stream = res;
      if (enc === "gzip") stream = res.pipe(zlib.createGunzip());
      else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
      else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
      const chunks = []; let size = 0;
      stream.on("data", (c) => {
        size += c.length;
        if (size > MAX_BYTES) { req.destroy(); fin(reject, err("toobig")); } else chunks.push(c);
      });
      stream.on("end", () => fin(resolve, { status, headers: res.headers, body: decodeBody(Buffer.concat(chunks), res.headers["content-type"]) }));
      stream.on("error", () => fin(reject, err("unreachable")));
    });
    timer = setTimeout(() => { req.destroy(); fin(reject, err("timeout")); }, 8000);
    req.on("error", (e) => fin(reject, e && (e.code === "EPRIVATE" || e.message === "private") ? err("private") : err("unreachable")));
    req.end();
  });
}

export async function fetchPage(input, { allowPrivate = false, lang = "en" } = {}) {
  let u;
  try { u = new URL(input); } catch { throw err("badurl"); }
  for (let hop = 0; hop <= 4; hop++) {
    checkUrl(u, allowPrivate);
    const r = await once(u, allowPrivate, lang);
    if (r.status >= 300 && r.status < 400 && r.location) {
      try { u = new URL(r.location, u); } catch { throw err("unreachable"); }
      continue;
    }
    return { ...r, url: u };
  }
  throw err("unreachable");
}

// ---------- Extraction ----------
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", laquo: "«", raquo: "»", deg: "°", frac12: "½", frac14: "¼", frac34: "¾" };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const txt = (s) => decodeEntities(String(s ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function isoDuration(v) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(v || ""));
  if (!m) return "";
  const min = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
  if (!min) return "";
  const h = Math.floor(min / 60), r = min % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}

function findRecipe(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n, depth + 1); if (r) return r; } return null; }
  if (typeof node !== "object") return null;
  const t = node["@type"];
  if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
  return findRecipe(node["@graph"], depth + 1) || findRecipe(node.mainEntity, depth + 1) || findRecipe(node.itemListElement, depth + 1);
}

function stepsOf(x) {
  if (!x) return [];
  if (typeof x === "string") return x.split(/\r?\n+|<br\s*\/?>/i).map(txt).filter(Boolean);
  if (Array.isArray(x)) return x.flatMap(stepsOf);
  if (typeof x === "object") {
    if (x.itemListElement) return stepsOf(x.itemListElement);
    if (x.text) return stepsOf(x.text);
    if (x.name) return stepsOf(x.name);
  }
  return [];
}

export function recipeFromJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const n = findRecipe(data);
    if (!n) continue;
    const y = Array.isArray(n.recipeYield) ? n.recipeYield.find(Boolean) : n.recipeYield;
    const r = normRecipe({
      title: txt(n.name),
      servings: txt(y),
      time: isoDuration(n.totalTime) || isoDuration(n.cookTime) || isoDuration(n.prepTime),
      ingredients: (Array.isArray(n.recipeIngredient) ? n.recipeIngredient : n.ingredients || []).map(txt),
      steps: stepsOf(n.recipeInstructions),
    });
    if (r && r.ingredients.length && r.steps.length) return r;
  }
  return null;
}

export function pageText(html) {
  const title = txt((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "");
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|form|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  return { title, text: text.slice(0, 14000) };
}

export const looksBlocked = (html, textLen) =>
  textLen < 2500 && /just a moment|cf-chl|captcha|are you a robot|access denied|verify you are human|enable javascript and cookies/i.test(html);
export const looksLogin = (url, html, textLen) =>
  /\/(log-?in|sign-?in|signin|connexion|authenticate|auth)(\/|$|\?)/i.test(url.pathname) ||
  (textLen < 3000 && /<input[^>]+type=["']?password/i.test(html));
