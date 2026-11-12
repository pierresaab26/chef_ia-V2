# Import of recipes — complete documentation (state at v348)

Single reference for everything that brings a recipe INTO the app from outside: photo, web link, manual entry. (Sharing links `/?s=`, circle and community recipes are documented in FEATURES.md and are not "imports" in this sense.) Update this file whenever the import changes.

## 1. Overview

| Way | Entry | Server | Model | Result | Limits |
|---|---|---|---|---|---|
| Photo (camera / gallery) | Import page, 📎 of the chat | `POST /api/import-photo` | vision (`VISION_MODEL`, default `claude-haiku-5-5`) | full recipe: title, servings, time, temperature, ingredients, steps, notes | 6 per minute per IP, human check, image ≤ ~2.5 MB |
| Web link | Import page, 📎 of the chat | `POST /api/import-link` | structured data first (no model), else `EXTRACT_MODEL` / `MODEL` | **title + ingredients ONLY** (v335) | 10 per minute per IP, **3 successful per day** per device AND per IP, human check |
| Manual entry | Import page, section « ✍️ Saisie manuelle » (v342) | none (nothing sent) | none | what the user typed | none |

Entry points: the « Importer une recette » tile on the home screen (`#impHome`) and the 📎 button of the chat bar (`#impChat`); both call `openImp()` → view `#imp`. (The left-menu entry was removed in v108.)

No fake feature: if extraction fails the user sees an explicit error. Nothing imported is invented, except the deliberate « dish reconstruction » of the photo import (labelled as such).

## 2. The import page (`#imp`)

Top to bottom:
1. Header (☰, ←, 🏠) and the hint line `#impHint`.
2. `#impOut` — result area: status line (« Analyse en cours… »), errors, preview. Since v344 it sits at the TOP of the page, and the page scrolls to the top (`scrollTop=0`) when a result or an error appears (before, the user was thrown down onto the manual form).
3. Photo buttons (📷 camera `#impCamB` → `#fileCam`, 🖼️ gallery `#impGalB` → `#fileGal`).
4. Link field `#impUrl` + button `#impGo` (Enter also starts it).
5. « ✍️ Saisie manuelle » (`.manhd`, `#manForm`): FOLDED by default (v345); the « ▾ Déplier / ▴ Replier » button `#manFold` (`manOpen`, `manFoldPaint()`, keys `hUnfold` / `hFold`) has the size, font and shape of the History « Replier / Déplier » buttons, in cream with a thin border so it stands out on the white card (v348–v349). The state lasts until the page is reloaded.
6. `resetImp()` clears everything when the page is opened (token `impTok`, preview, fields, `impLast`, `impUrlLast`).

`impTok` is a request token: when the user cancels or starts another import, a late answer of the previous one is ignored.

## 3. Photo import

**Client (`importPhoto`, `prepareImage`).** The file is decoded (`createImageBitmap` with the image orientation, `<img>` fallback), redrawn on a white canvas and re-encoded as JPEG: tries 1800 / 1400 / 1100 / 800 px at quality .85 until the data URL is ≤ 3.2 MB (otherwise error `toobig`). A thumbnail (360 px) and a 900 px copy are made for the preview only. The image is kept in memory (`impLast`) ONLY for the « contactez-nous » / appeal buttons; it is never saved with the recipe (v332).

**Server (`api/import-photo.js`).** Accepts `data:image/(jpeg|png|webp);base64,…` ≤ 3.4 M characters (`badimage` / `toobig`). One vision call (`max_tokens` 3000) with two cases (v330):
- CASE 1 — the image contains a WRITTEN recipe (book page, handwriting, screenshot, card): faithful extraction using `EXTRACT_RULES` (`api/_lib.js`: copy faithfully, no invented quantities), `kind:"text"`.
- CASE 2 — a prepared DISH or DRINK with no readable recipe: the model recognises it and writes the classic recipe in the interface language (`lang` sent by the browser), realistic quantities for 4 servings, times / temperature when relevant, and a note saying the recipe is a reconstruction; `kind:"dish"`.
- Neither (person, landscape, object, unreadable plate) → `norecipe` (HTTP 422).
`normRecipe()` validates and cleans the JSON. Answer: `{recipe, source:"photo", kind}`.

**Client display.** Preview text `imCheck` (written recipe) or `imCheckD` (dish: « reconstitution du chef »). Saved message `imMsgP` / `imMsgD`; the entry keeps `src:'photo'` and `dish:1` for a reconstruction.

## 4. Link import

**Server (`api/import-link.js`).**
1. Per-minute limit (`rl:il:`, 10/min per IP), human check, URL normalised (`https://` added), length ≤ 2000.
2. Daily quota (see section 6) → `daily`.
3. `fetchPage()` (`api/_page.js`): only http(s); SSRF protection (private / loopback / link-local addresses and names such as `localhost`, `.local`, `.internal` are refused, also after DNS resolution and on every redirect); redirects limited; body ≤ 2 MB; 8 s time limit; page language header from `lang`.
4. HTTP status mapping: 401 → `login`, 403 / 429 → `blocked`, 404 / 410 → `notfound`, other errors → `unreachable`; non-HTML content → `norecipe`.
5. Structured data first: `recipeFromJsonLd()` reads the schema.org Recipe JSON-LD of the page (no model call, no API key needed) → `source:"structured"`.
6. Otherwise the model reads the visible text (`pageText()`, ≥ 200 characters, blocked / login pages detected by `looksBlocked` / `looksLogin`) with a prompt that asks ONLY for `{found,title,ingredients}`; the page is passed as data, instructions inside it are never executed → `source:"text"`; `found:false` → `norecipe`.
7. `slim()` keeps ONLY the title (≤ 120 chars) and up to 80 ingredient lines (≤ 200 chars each). No steps, servings, time, temperature, notes; the site name and the address are neither returned nor stored (no « Source » line, no 🔗 badge).
8. Only a SUCCESS counts in the quota.

**Client.** `importLink()` checks the address (`URL`, must contain a dot), sends `{url, lang, dev, ts}` (`dev` = `devId()`), shows the preview (`src:'link'`). The address is kept in memory (`impUrlLast`) only for the appeal. Texts: `imCheckL`, `imMsgL`.

## 5. Manual entry (v342)

Form `#manForm`: name (required, `#manT`), servings, time, ingredients one per line (required, `#manI`), steps one per line, notes. Leading `-`, `•`, `*`, `1.` / `1)` are stripped from each line. « Voir l’aperçu » → same preview as the other imports (`showPreview({src:'manual'})`); missing name or ingredients → message `imManNeed`. Nothing is sent to the server, no limit, no human check, no appeal block. Texts: `imCheckM`, `imMsgM`. Counted as an import (`originOf()` → `import`).

## 6. Limits and protections (summary)

| Protection | Photo | Link | Manual |
|---|---|---|---|
| Access code / personal invitation token (`authOk`) | yes | yes | n/a |
| Per-minute rate limit per IP | 6 (`rl:ip:`) | 10 (`rl:il:`) | – |
| Human check (Cloudflare Turnstile, v343) | yes | yes | no |
| Daily quota | none | **3 per day** per device AND per IP (`DAILY_MAX` in `api/import-link.js`; Redis `rl:ild:dev:<id>:<day>`, `rl:ild:ip:<ip>:<day>`, Paris calendar day, 48 h expiry; no Redis = no limit) | none |
| Size | image ≤ 3.2 MB (client) / 3.4 M chars (server) | page ≤ 2 MB, 8 s | – |

Beyond the daily quota: HTTP 429 `daily` → message `e_daily` (explains the limit, what is imported, resets at midnight Paris time). Beyond the minute limit: 429 `rate` → `e429`. To change the quota edit `DAILY_MAX` (set 0 to disable, as in v340, for tests only).

**Human check (Cloudflare Turnstile).** Server: `captchaOk(req)` in `api/_lib.js` verifies the token `ts` of the body with Cloudflare `siteverify` (secret `TURNSTILE_SECRET`, 5 s limit; a network failure refuses); called after the rate limit and BEFORE any model call; refusal = 403 `captcha`. It is INACTIVE (always true) while `TURNSTILE_SECRET` is unset. The public site key `TURNSTILE_SITE_KEY` is served by `GET /api/photo?status=1` (`tsKey`). Client: `tsToken()` loads the Cloudflare script on demand and renders an `interaction-only` widget for every import (one fresh single-use token each time); a small modal appears ONLY if Cloudflare asks for a click (45 s limit); no site key = nothing asked. Error text `e_captcha`.

## 7. Preview and saving

`showPreview(st)` (shared by the three ways; `st` = `{recipe, src, dish?, thumb?}`): recipe name as a heading (`.imtitle`, v336), the recipe text (`renderRecipe`), a soft-pink warning card `.imcheck` (what was read and that the user must check it), the « Mal reconnu ? Faire appel » card for photo and link (section 8), then two stacked full-width buttons « Utiliser cette recette » / « Annuler » (`#impOut .cact`). The page is scrolled to the top.

« Utiliser cette recette » → `useImport()`: opens a chat thread with a `[UI]` user message (`imMsgP` / `imMsgD` / `imMsgL` / `imMsgM`) and the recipe as the chef's answer (`recipeToText()`), saves it (`saveCurrent()` with `pendingMeta = {src, dish, …}`; no photo kept), then opens the recipe card (v121). The recipe then behaves like any other: its own Unsplash photo (`ensurePhoto`), history, favorites, rating, comments, adjustments with the chef, shopping list. Imported recipes carry NO « Utensils » section unless the chef is asked to add one (no invented content). Origin badge « 📥 Importée » (`originOf()`: `src` = photo / link / manual). Analytics events: `import_request` (kind photo / link), `import_saved`.

## 8. Errors and the « contact us » / appeal buttons

**Error messages** (`impMsg(code)`, keys `e_*`, 6 languages): `badurl`, `badimage`, `toobig`, `private`, `login` and `blocked` (suggest a screenshot imported as a photo), `notfound`, `unreachable`, `timeout`, `norecipe`, `rate`, `daily`, `captcha`, `credit` / `badkey` / `upstream` (technical). The error is a soft-pink card (v333).

**After a failed PHOTO import (`norecipe`) — « Recette mal ou non reconnue, contactez-nous » (v331 / v339).** A white card with a note (`imRepN`: the image is sent to the team for a manual check, only for that check, then deleted) and a full-width soft-pink button (`.imrep`) → `POST /api/import-photo {report:1, image, lang}`: the image is attached to an email through Resend to `SUPPORT_EMAIL` (else `MOD_EMAIL`); 3 per minute per IP (`rl:ir:`); `nomail` (503) when no email is configured. Confirmation `imRepOk`.

**After a SUCCESSFUL analysis — « Mal reconnu ? Faire appel » (v337 / v338).** `appealBlock()`: photo → same route with `appeal:1` (subject « photo mal reconnue (appel) »); link → `POST /api/import-link {report:1, url, lang}` (`reportLink()`, 3 per minute per IP `rl:ilr:`, email with the address). Notes `imAppealN` / `imAppealNL`, confirmation `imAppealOk` / `imRepOk`. Does not count in the daily quota.

**Privacy promise.** The server stores NOTHING (no image, no address, no log of the content). The promise « then deleted » depends on the support deleting the email after the check. The manual-check emails need `RESEND_API_KEY` + `SUPPORT_EMAIL` or `MOD_EMAIL` (+ optional `MOD_FROM`) in Vercel.

## 9. Configuration (Vercel Production variables)

`ANTHROPIC_API_KEY` (required for photo and for link pages without structured data), `VISION_MODEL`, `EXTRACT_MODEL` / `MODEL` (optional overrides), `APP_PASSWORD`, `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Redis: rate limits, daily quota; no Redis = no limits), `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET` (human check), `RESEND_API_KEY` + `SUPPORT_EMAIL` / `MOD_EMAIL` / `MOD_FROM` (manual-check emails).

## 10. Code map

- `index.html`: `openImp`, `resetImp`, `impStatus`, `impBusy`, `impMsg`, `prepareImage`, `importPhoto`, `importLink`, `tsKey` / `tsLoad` / `tsToken`, `showPreview`, `appealBlock`, `impReport`, `useImport`, `recipeToText`, manual form handler (`#manForm`), `manFoldPaint`; i18n keys `im*`, `e_*` in the 6 `I18` blocks.
- `api/import-photo.js`, `api/import-link.js`, `api/_page.js` (fetch + SSRF + JSON-LD + page text), `api/_lib.js` (`captchaOk`, `askClaude`, `parseJsonLoose`, `normRecipe`, `EXTRACT_RULES`, `overLimit`, status table), `api/photo.js` (`?status=1` → `tsKey`).

## 11. Tests and known limits

Tests used so far (scripts are NOT in the repo): server checks with a fake Redis / fake fetch / fake model (quota 3 then `daily`, other device on the same IP blocked, captcha refused / accepted / inactive), Playwright on iPhone SE, iPhone 13 and iPad (preview, save without photo, daily message, fold button, result at the top, no JS error). NOT tested live: the real Cloudflare widget in every browser, the real Resend emails, real recipe pages at scale, the real vision model on many photos.

Known limits: link import gives title + ingredients only (by decision); the daily quota is per device AND per IP (people behind one IP share it); a site that blocks robots can only be imported through a screenshot (photo); the photo import has no daily quota; imported recipes without a typed utensil list have none; two recipes with the same title are treated as one by the shopping-list cleanup.

## 12. Version history of the import

v-early photo and link import · v108 left-menu entry removed · v121 imported recipe opens on its card · v330 dish photos (reconstruction) · v331 photo « contact us » button · v332 photo not stored, Unsplash photo instead · v333 error / contact cards in the charter, privacy note · v334 exact wording · v335 link = title + ingredients, 3 per day · v336 title heading in the preview · v337 appeal card (photo and link) · v338 / v339 wording « contactez-nous » · v340–v341 daily limit off then back to 3 · v342 manual entry form · v343 Cloudflare Turnstile · v344 result at the top, fold button on the manual form · v345 manual form folded by default · v346 fold button in the pink import style (replaced in v348) · v348 fold button in the History style.
