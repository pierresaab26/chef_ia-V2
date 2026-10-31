# CLAUDE.md — Chef IA

Read this first in every session. Keep it up to date when something important changes (state, decisions, rules).
Never put secrets here (keys, passwords, tokens): this repository may be public.

## 1. Project

- **Chef IA**: an AI cooking chat app. Users chat with virtual chefs, get recipes, adapt them, import them from a photo or a link, save, rate and share them.
- Live site: https://chefia-v3.vercel.app (Vercel project `chef_ia-v3`, auto-deploys every commit on `main`).
- Repository: `pierresaab26/chef_ia-V2`, branch `main`.
- Interface languages: fr, en, es, de, it, pt. Code, code comments and docs are in **English**.
- Model: `claude-haiku-5-5` (cheapest, kept on purpose). Override with env vars, not in code.
- Access is protected by `APP_PASSWORD` (shared with friends for now).
- Database: Upstash Redis (comments and ratings).

## 2. Architecture

No framework, no build step. `package.json` only sets `"type": "module"`.

| File | Role |
|---|---|
| `index.html` | The whole front end (vanilla JS): chat, chefs, recipe cards, history, favorites, sharing, ratings, imports, dish illustrations, i18n strings (`fr:{…}, en:{…}…`). `APP_VERSION` is defined here. |
| `api/chat.js` | Chat with the chef. Holds the chef system prompt (scope, recipe format, language rule, 5-star standard). |
| `api/import-photo.js` | Recipe extraction from a photo (vision model). |
| `api/import-link.js` | Recipe extraction from a public web page (structured data first, then the model). |
| `api/comments.js` | Recipe comments in Redis. |
| `api/ratings.js` | 1–5 star ratings in Redis, plus an analysis log. |
| `api/_lib.js` | Shared helpers used by every route: `authOk` (checks `x-code` against `APP_PASSWORD`), `fail` (error code → HTTP status), `callClaude` / `askClaude` (the only Anthropic call), `redis` / `hasRedis` (Upstash), `overLimit` (per-IP rate limit, never blocks if Redis is missing or fails), `clean`, JSON parsing. |
| `api/_page.js` | Web page fetching for link import (SSRF protection, redirect/size/time limits). |
| `vercel.json` | Functions: 60 s max duration. |

Files starting with `_` in `api/` are helpers, not routes.

**Environment variables** (values live in Vercel only):
`ANTHROPIC_API_KEY` (required), `APP_PASSWORD`, `MODEL`, `VISION_MODEL`, `EXTRACT_MODEL`,
`KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).

**Redis keys**:
- `c:<recipe>` — comments list
- `r:<recipe>` — ratings hash; `r:index` — set of rated recipes
- `r:log` — rating log (title, stars, language, date), last 5,000 entries, for later analysis
- `rl:<ip>:<minute>` (comments, 5/min), `rl:r:<ip>:<minute>` (ratings, 30/min), `rl:c:<ip>:<minute>` (chat, 20/min) — rate limiting

## 3. Working rules (from the owner)

- **Reply to the owner in French**, concise, structured, direct. Few clarification loops.
- When something changes, start the reply with **"Bonjour, point N fait"**.
- **Bump `APP_VERSION`** in `index.html` on every app update (badge "▲ Vercel · vN"). Commit message format: `vN: short description`. A docs-only change (like this file) does not bump the version.
- **Do not rebuild the app from scratch.** Keep the AI chat, the virtual chefs and the `/api/chat` connection.
- **Never put an API key in the browser.** Keys are read only on the server.
- Must work well on **phone and tablet**.
- **No fake buttons**: no simulated image recognition or link extraction. Every visible feature must really work.
- **Examine the structure before changing anything. Test before delivering** (at least `node --check api/*.js`, and load `index.html` in Playwright/Chromium on a phone and a tablet viewport).
- **Push to GitHub yourself** (`main`), then tell the owner which files changed.
- The owner reports problems with screenshots.

## 4. Chef behavior (api/chat.js)

- Michelin-starred chef persona, "5 stars" standard: only top-quality, best-in-class recipes.
- Food and drink only; politely refuses anything else.
- One language per answer (the user's interface language).
- Replacing an ingredient (↔ button or "not available" circle) creates a **new, separate recipe**; the original and its favorite stay untouched.
- New recipes always include a « Utensils » section (3–8 items) between ingredients and steps, in the user's language. Imported recipes get none unless asked (no invented content). The card shows utensils as plain chips (nothing to tick or replace); detection is `UT_RE` in `index.html`.
- Cut-off answers are detected and completed automatically.
- Simple questions (side dish, pairing, substitution, technique) are answered as one sentence + 2–5 « - Label: text » options, no `##` headings; the app shows them as cards and does not save them as recipes.
- A free-text change in the chat (e.g. « no lactose ») updates the same saved recipe; only ↔ / « not available » creates a separate recipe.
- Ideas requests are answered with exactly 4 `- Name: sentence` lines and no recipe; a complete recipe is only given when asked for one idea (« Give me the complete recipe for « X » »).
- The claude.ai artifact preview is built from `index.html` plus a preview-only bridge that sends `/api/chat` to Claude through the artifact `sample` capability with the same `BASE` prompt. The bridge is never committed to the repo.

## 5. Done (up to v48)

Chat with chefs; import from photo and link; edit a recipe with the chef; history; favorites; sharing; comments; 1–5 star ratings (`r:log`); code-drawn dish illustrations + custom photo; ingredient replacement (↔ and "not available" circle); auto-resume of cut-off answers; single language per answer; Michelin-starred 5-star chef; aligned bottom bar; code/docs in English; v35: utensils section in recipes; v36: action bar (favorite, share, card, rating) under the latest recipe in the chat (`chatActions()`); v37: one single action bar (no duplicate), comments under the latest recipe in the chat, quick options as 4 columns (`drawQuick()`: Servings 2/6/8, Without gluten/lactose, Vegetarian/Vegan, Faster), fix: a conversation is now saved from the first reply that is a recipe (a leading question or refusal no longer blocks saving). v38: favorite heart in the chat header (`#tofav`, `syncFavUI()`). v39: « back to top » button (`#totop`, `updTop()`) and the Utensils section folded by default (tap the title to open). v40: the quick options (`quickCols()`) are also on the recipe card (picking one reopens the chat on that recipe and sends the request); time column titled with ⏱️. v41–v42: centered column titles, even bottom spacing; the ↑ button sits in the empty space under « Faster » in the chat so it never covers content. v43 (clean-up): chat rate limit 20/min per IP; `chat.js` uses `_lib.js` (one Claude call, one auth check, same error codes); Redis code shared in `_lib.js`; all interface texts in ONE `I18` block (one block per language, one key per line; add new keys to all 6 languages); unused texts/styles removed; in-app dialog `ask()` / `askCode()` replaces prompt()/confirm(); in-memory store cache (`storeCache`, dropped on failed write or on a change from another tab). v44: a crossed-out ingredient offers two choices, « Without » (`noMsg`: recipe without it, no replacement) or « Replace » (`swapMsg`), both create a new separate recipe (`.swbar`); advice answers (« - Label: text » lines, no `##`) render as option cards (`.adv`, in `render()`) and are not saved as recipes; the quick options are now FILTERS (`quickCols()`, `qf`: one choice per column, several for « Without ») with one green button: « Suggest a recipe » (no recipe on screen) or « Adapt the recipe » (recipe on screen / recipe card), sending one combined request. v45–v48 (ideas → recipes in the thread): the chef answers « ideas » requests (category buttons, « Suggest ideas », « Other ideas ») with EXACTLY 4 `- Name: sentence` lines (rule IDEAS in `api/chat.js`); the app renders them as option cards (`.adv`, `data-ideas`) that can be ticked in ANY ideas list of the thread (3 max in total, `ideaPicks()`); the filters (`quickCols()`, `qf`) apply to the request; the green buttons are « Generate the recipe(s) » (`genRecipes()`: one chef request per ticked idea, appended to the SAME thread below the lists, each recipe saved as its own entry with `ideas:{at,pick}`; generated ideas get a ✓) and « Other ideas » (new list, ticked ideas = inspiration). Each assistant recipe message carries a `rid` (saved recipe it belongs to; stored in `entry.messages[].rid`); `chatActions()` puts one action bar under the latest version of each recipe, the comments under the newest, and — as soon as the thread has 2+ recipe messages — a hide/show button under EACH recipe (`hiddenIdx`, `.chrow` / `.chhide`, hidden recipes also hide their bar and comments). « ↩ Ideas » (`openIdeas()`) never removes recipes: it scrolls to the ideas list of that recipe's thread (opening the thread first if needed). Entry `messages` = the thread up to that recipe, so reopening a recipe from the history shows the ideas + the recipes before it. Cards use plain block layout (a flex layout rendered them empty in some browsers).

## 6. Current status and decisions

- **New features are on hold.** Priority: stability, then a test phase with friends (do they come back each week?).
- Still to check with the owner:
  - real recipe quality with the real model (earlier tests used mocked answers);
  - that Vercel is linked to this repo and shows the current version.
- Possible next steps (not decided):
  - Measurement: Vercel Web Analytics (cookieless) + a few anonymous internal counters; Sentry (free, browser errors, EU region, no session replay). No Grafana. No ad pixels until paid ads (they need a consent banner).
  - Monetization (later, after validation): freemium with a daily quota + Premium (~2.99 €/month or ~24.99 €/year), Stripe on the web, installable web app to avoid store fees. Needs accounts first.
- Feature ideas backlog: shopping list, cooking mode (one step at a time + timers), portion slider, home screen install, import from an Instagram/TikTok caption, fridge photo, accounts and multi-device sync, hands-free voice, weekly menu, rating analysis to tune the chef.
