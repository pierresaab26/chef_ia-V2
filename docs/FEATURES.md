# Chef IA — Feature notes (one section per area of the app)

Living documentation. For each area: what it is, how it behaves, what was done (version), where it lives in the code, what is stored and known limits.
Keep it up to date whenever one of these areas changes (same rule as `CLAUDE.md`). A docs-only change does not bump `APP_VERSION`.
Last update: v109 (2026-11-03). Never put secrets in this file (the repository may be public).

## Map of the app

| # | Area | Where the user finds it |
|---|---|---|
| 1 | Recipe generation with a chef, « Trouver mes recettes », import | Home: chefs, search box, import card |
| 2 | History and favorites | Home history block, ☰ menu, Favorites view |
| 3 | Weekly menu | Home, « Menu de la semaine » |
| 4 | Seasonal menu | Home, « Menu de saison » + seasonal background |
| 5 | Chef IA (free chat and cooking questions) | Bottom bar 💬 (chat), « Chef libre » card, « Discuter / Questions » switch at the top of the chat |

Home order (top to bottom, since v95): search box « Trouver mes recettes » (results right under it) → « Importer une recette » card → history → Weekly menu → Seasonal menu → chefs and « Chef libre ».

Shared rules for every area: one language per answer (interface language, 6 languages fr/en/es/de/it/pt, one `I18` block, every new key goes in all 6); model `claude-haiku-5-5`; access code in the `x-code` header; works on phone and tablet; ingredient lines are capitalised at display time only (`cap1()`, v83); a chef reply that arrives after the user left the conversation is dropped (`convTok` / `newConv()`, v84); every browser call has a time limit (`fetchT()`, v84).

---

## 1. Recipe generation (chefs, « Trouver mes recettes », import)

**What it is.** Three ways to get a recipe: talk to a chef, search what is already saved, or import one.

**Chefs (v75).** 4 chefs by cuisine on the home screen: Italian (Giulia, index 0), French (Marcel, 2), Asian (Hiro, 1), World and fusion (Lina, 3). Indices are stable because saved recipes use them (`CHEF_ORDER` only changes the display order). Chef personas live on the server (`CHEFS` in `api/chat.js`); the browser only sends the index.
- Tap a chef → panel with 4 buttons Starters / Mains / Desserts / Drinks. One tap opens the chat and sends `crsMsg` (« Propose-moi 4 idées de … »). « Discuter › » opens a plain chat with that chef.
- « Chef libre » card (`.chfree`): free text → `frMsg`, no chef index (plain Chef IA).

**From ideas to recipes (v45–v49).** The chef answers an « ideas » request with exactly 4 `- Name: sentence` lines (rule IDEAS). The app shows them as cards that can be ticked (3 max over the whole thread, `ideaPicks()`). Green buttons: « Generate the recipe(s) » (`genRecipes()`: one request per ticked idea, all appended to the same thread, each saved as its own entry) and « Other ideas ». A new recipe keeps its START in view (`showStart()`).

**Recipe format.** Every new recipe has header lines `Servings`, `Prep`, (`Rest`), (`Cook`), `Health: N/3`, a Utensils section (3–8 items, folded by default) between ingredients and steps. The app turns the header into bubbles (date, servings, health leaves; 🔪 prep, ⏳ rest, 🔥 cook). Imported or older recipes keep the old display; nothing is invented.

**Adapting a recipe.**
- Quick filters (`quickCols()`, `qf`): Servings 2/6/8, Without gluten/lactose, Vegetarian/Vegan, « Autres » (Plus rapide, Low Fat, High protein). One green button: « Suggest a recipe » or « Adapt the recipe ».
- Free-text change in the chat (« sans lactose ») updates the SAME saved recipe as a new version.
- Crossed-out ingredient circle → bar « Sans » / « Remplacer » → creates a NEW separate recipe (a variant) that keeps `from` = id of the original (v90).
- Under each version: hide/show button; « ✂️ Je cache les anciennes versions » / « 👁️ Revoir les versions précédentes (N) » (display only, nothing deleted, `oldHidden`, v85–v86); « ↩ Idées proposées précédemment » scrolls to the ideas list the recipe came from (v89).

**Mode fourneau (recipe card, v87–v94).** Green « 🍳 Mode fourneau » button under EACH recipe of the chat opens the card: a simplified reading view for cooking. Shows the title of the version on screen, time bubbles with values only, utensils, ingredients (can still be crossed out), steps, rating, comments. No filters and no help text on the card (adapting stays in the chat).
- « ↺ Recette originale » (top right, chat header and card header, `resetInfo()` / `resetInfoFor()` / `eraseToOriginal()`): after confirmation, a variant is deleted and its original opened; otherwise later changes of the recipe are cut and the first version stays. Shown only when there is something to erase.
- « ↩ Recette d’origine »: opens the original of a variant (chat action bar and card) while it still exists. Variants saved before v90 have no `from`, so no button.

**« Trouver mes recettes » (home search, v57–v64, v95).** Box with 🔍 and a ❤️ toggle inside it. Searches ALL saved recipes by title or category name (accents and case ignored). While there is text or the toggle is on, the results replace the history block and show a count. Hidden when there are no saved recipes. ✕ delete button on each result (v95).

**Import (v-early, shared with the chat 📎).** Entry points: the « Importer une recette » card on the home screen and the 📎 button of the chat (the left-menu entry was removed in v108: it duplicated the home card). Photo (camera or gallery) → `api/import-photo.js` (vision model); web link → `api/import-link.js` (structured data first, then the model; `api/_page.js` blocks private addresses, limits redirects, size and time). Limits per IP: photos 6/min (`rl:ip:`), links 10/min (`rl:il:`). No fake import: if extraction fails the user sees an error. **v330 — dish photos:** `api/import-photo.js` now handles two cases in one call: a WRITTEN recipe in the image (faithful extraction, `kind:"text"`) or a prepared dish / drink with no text (the model recognises it and reconstructs a classic recipe in the interface language, estimated amounts for 4 servings, a note saying it is a reconstruction, `kind:"dish"`); neither → `norecipe`. The preview then shows `imCheckD` (« reconstitution du chef »), the saved message is `imMsgD`, the entry keeps `dish:1` and the user's photo as thumbnail. The browser sends `lang` with the photo. **v331 — « Photo ou image non reconnue, contactez-nous »:** when a photo import ends in `norecipe`, a button under the error (`imRep`) sends that image by email to the support (`POST /api/import-photo {report:1,image,lang}`, Resend attachment, to `SUPPORT_EMAIL` or else `MOD_EMAIL`; 3 per minute per IP; error `nomail` if no email is configured). The image is kept in memory only (`impLast`) and nothing is stored on the server.

**A photo for every recipe (v109).** Each saved recipe gets its OWN photo, free of charge, from Unsplash (free licence; the photographer and Unsplash are credited, which the owner accepts). Pexels was tried first and dropped: it no longer issues API keys. The server route `api/photo.js` (v111): (1) the model turns the recipe title into two English search phrases, a precise one and a broader one; (2) Unsplash returns 8 landscape photos (`content_filter=high`) for the precise phrase; (3) the model LOOKS at the 8 thumbnails and gives each a score from 0 to 10 (0–3: another dish, or unusable: a face as the subject, a big logo, a text overlay, a menu, a restaurant front; 4–10: the dish, higher when appetising, sharp and well lit; the prompt asks it to be practical, not picky); scores ≥ 4 are kept, best first, up to 6; (4) nothing kept → same with the broader phrase; (5) if the scoring itself fails, the Unsplash order is used (a photo beats no photo); (6) the ranking is cached in Redis for 90 days, so a dish costs two searches at most and two or three small model calls once. The app sends the ids already used on the device (`skip`), so two recipes never share a photo. The lookup runs by itself after a recipe is saved or generated, and when an older recipe is opened. Shown: ABOVE each recipe in the chat (v110, as on the recipe card: picture with its credit, then the recipe title and its info bubbles, then — since v112/v113 — the action bar Favori / Partager / Mode fourneau / rating, then the ingredients and steps; comments stay after the recipe; a thread of several generated recipes shows one picture per recipe), on the recipe card, and as the thumbnail in History / Favorites / search. Credit: « Photo : Name · Unsplash » (both links, with `utm_source=chef_ia&utm_medium=referral` as Unsplash requires) under the photo on the card and as a chip on the picture in the chat. Photos are hot-linked from `images.unsplash.com`, never copied (Unsplash rule). A picture chosen by the user, or an imported photo, always wins; « reset » brings the Unsplash photo back.
- **Sharing.** The ↗ button sends the title, the recipe text, then — when the recipe has an Unsplash photo — a line « 📷 Photo : Name · Unsplash » followed by the link of that photo's page, and the site link, so the recipient can see the SAME photo and its credit (`shareRecipe()`). No image file is sent and a recipe with the user's own picture gets no photo line. The recipient cannot open the recipe in the app: a real shared-recipe page is in the backlog (see CLAUDE.md, section 6).
- **Nothing good (manual check).** If Unsplash finds nothing usable for both phrases, the recipe keeps the code-drawn illustration (the card may try Wikipedia) and the title is added to a list with the reason (`noresult` = no photo found, `rejected` = photos found but none good enough): open `/api/photo?missing=1` (public, titles only, newest first, 100 max) and tell Claude, who decides what to do (reword the search, choose a photo by hand…). The app does not ask again for the same recipe for 30 minutes (`e.phNo2`); the server remembers « nothing found » for 2 hours (`phn2:`); the answer and the console say why (`noresult` / `rejected`). A rate limit or a failure is never listed (retried silently).
- **Setup.** `UNSPLASH_ACCESS_KEY` (the « Access Key » of an app created at unsplash.com/developers) in Vercel → Production, then redeploy. Without it `/api/photo` answers 503 and the app silently keeps the old behaviour. **Diagnosis:** open `/api/photo?status=1` (public, yes / no only: `unsplashKey`, `anthropicKey`, `redis`, `accessCode`); a failed lookup also leaves a line « Chef IA photo: <status> <error> » in the browser console (Network tab: the `/api/photo` answer). A new Unsplash app starts in **demo mode: 50 requests per hour**, enough for the test phase with friends thanks to the cache; before the app is public, apply for **Production** (5,000 per hour) with screenshots showing the attribution, and re-read the Unsplash API guidelines (not checked: whether an app that earns money is accepted).
- **Cost.** Two small model calls per NEW dish (the search phrases, then one look at 8 thumbnails), three when the broader phrase is needed; well under a cent, then cached.
- **Limits.** « Beautiful » is subjective: the model removes poor or off-topic photos but cannot guarantee that every choice pleases the owner (the 📷 button changes a photo). Tags and likes are not available in Unsplash search results, so the selection relies on the model. The « download » ping that Unsplash asks for when a user downloads a photo is not sent (nothing is downloaded). The preview artifact cannot show these photos (its page blocks remote images and the route is not emulated).

**Code.** `index.html`: `drawChefs`, `genRecipes`, `branchWith`, `saveCurrent`, `resetInfo*`, `drawHomeSearch`, `openImp`, `ensurePhoto` / `phFetch` / `phCreditInto`, `dishPic`, `repaintImgViews`. Server: `api/chat.js` (`systemFor`, `PARTS`, `CHEFS`, `GUARD`), `api/import-*.js`, `api/photo.js`.
**Stored.** Recipes in `localStorage` key `chefStore` (device only); a recipe's photo is `e.ph={id,u,t,by,bu,pg}`, or `e.phNo` (time of a « nothing found »). Redis: `ph:*`, `phn:*`, `ph:missing`, `rl:ph:*`.
**Limits.** The chef may answer « without X » with a list of options instead of the full recipe (open point since v71). Quality with the real model was only checked by the 55-question bench (scope) and manual tests.

---

**Look of the recipe views (v115).** One accent (pink) on a cream background; the metadata row (`metaBar()`) shows prep / rest / cook / servings / health as icon + value in the chat and on the card; the recipe card has a full-width photo, a floating header (round buttons, « ⋯ » menu with « Recette originale », frosted + title after scrolling), tabs Ingrédients / Ustensiles / Préparation (`cardTabs()`) and a sticky « Ajuster avec le chef » button (`#cardcta`) instead of the bottom bar. The rating pill sits next to the heart (average + number of votes in brackets once shared); « Ajuster avec le chef », « Publier » and ↑ use a soft pale-pink style. v117: on the card the action row (heart, rating, share) sits under the title and date, above the metadata row; share is an icon only on phones. v121: every new, adapted, regenerated, imported or generated recipe opens on the recipe card (the first one when several are generated). v122: the same tabs are used in the chat. v123: hiding a recipe in the chat keeps its picture; the chef's tip is kept on adapted recipes and shown above « what changed ». v124: version badge under the title (« Originale », « 2ème recette »…; variants continue the numbering). v125: badge on the date line; « Afficher toutes les variantes » lists every version and variant; the reset button lives only in the card « ⋯ » menu (« Supprimer les versions suivantes »). v126: « Afficher toutes les variantes » opens the chat with every version (oldest first), each with its own « Mode fourneau » opening that exact version. v127: each version has its own favorite, rating, comments (folded in the chat) and share; « Mode fourneau » is now « Commencer la recette » (full width). v128: one favorite per recipe (all its versions); « Afficher toutes les variantes » only on the card; « Supprimer cette version » under each version except the Originale.

### « 5 ingrédients » tile (v217)
Home tile (4th of the row, 🖐️). `fiveChat()` reuses the « Surprends-moi » screen (`surpChat()`): the four course buttons, but each one sends `fiveM` (6 languages): a recipe with 5 ingredients at most (salt, pepper, oil and water do not count), ready in 30 minutes or less. It is only a request to the chef (no server change); the limit is not enforced by code, so check the answer when testing.

## 2. History and favorites

**History.** Every recipe is saved automatically from the first reply that is a recipe (a leading question or refusal does not block saving). Home shows the latest ones; « more » opens the full History view (search + filter). Opening an entry reopens the thread up to that recipe (ideas + earlier recipes). ✕ with confirmation (`delq`) on every row in history, home search and favorites; after a delete, history, favorites, home search and weekly menu are redrawn (a weekly-menu slot of a deleted recipe becomes empty).

**Favorites (v54–v58).** ❤️ in the chat header, the action bar, and the search results. The Favorites view shows category tiles (3-recipe preview + « +N »); a tile opens its category (back button); a search box above matches title or category name and lists results flat.
- Categories come from the heuristic `recipeCat(e)` (reads title and content). Order `FAV_ORDER = [0,1,8,6,7,2,3,'q']`: 🍲 Plats du quotidien (default), 🍰 Desserts et pâtisseries, 🍬 Chocolats et glaces, 🍞 Boulangerie et pains, 🧂 Sauces et accompagnements, 🍹 Cocktails, 🥤 Boissons, ❓ Questions de cuisine.
- 11 labels exist in the `cats` list; 4 are never assigned automatically (Cuisine du monde, Végétarien et régimes, Ingrédients et techniques, Menus et idées de repas). An integer `e.cat` on an entry would override the heuristic (no UI for it yet).

**History: selection, move, archive (v100).** In the History view the chip « ☑️ Sélectionner » starts a selection mode: each row gets a round checkbox (tap the row to toggle), the bottom navigation is replaced by a bar with the count, « Tout / Aucune », « Annuler » and three actions.
- 🗑️ Supprimer: one confirmation « Supprimer N recette(s) ? », then everything is refreshed (history, favorites, home search, weekly menu).
- 📁 Déplacer: dialog with the 7 favorite categories + « ↺ Automatique ». Sets `e.cat` (the override `recipeCat()` already honoured); « Automatique » removes it. Visible in Favorites and in the home search by category name.
- 🗄️ Archiver / ↩ Désarchiver (in the archive tab): flag `e.arch`. Since v105 each recipe of the archive tab also has its own « ↩ Désarchiver » button (one tap, no confirmation). A tab « 🗄️ Archivées (N) » appears next to « Toutes » and « Favoris » when something is archived. Archived recipes are hidden from the home history, the home search, Favorites and the weekly-menu picker; they are never removed by the 50-recipe trim; their ❤️ is kept and they return everywhere when restored. A weekly-menu slot that already holds an archived recipe still opens it.
- Changing tab, leaving the History view or tapping Annuler ends the selection mode. The ↑ button (v101) is also available in the History and Favorites lists (above the bottom bar, or above the selection bar). Code: `drawHistory`, `selBar`, `selDelete`, `selMove`, `selArchive`, `pickCat`, `refreshAll`, 4th argument of `rowFor`.

**History tabs (v102, counters v107).** The tabs read « Toutes (N) », « ❤️ Favoris (N) » and « 🗄️ Archivées (N) »; archived recipes are counted only in « Archivées ». « Toutes » and « Archivées » are flat lists; « ❤️ Favoris » is grouped by category, like the Favorites view (headers with emoji, name and count; same order; search and selection mode keep the groups). Since v103 each category can be folded / unfolded one by one with a visible button next to its title (« ▴ Replier » / « ▾ Déplier », v104; the count stays on the title), « Tout replier / Tout déplier » folds all, the choice is remembered on the device (`hFold`), a search ignores the folds, and only the recipes on screen can be selected.

**Back from a recipe to the History (v106).** A recipe opened from the History view (any tab) shows a « ← » button in the card header; it returns to the History on the same tab and scroll position. Not shown when the card is opened from elsewhere (home, search, Favorites, chat).

**Action bar of each recipe (v36–v37; at the TOP of the recipe since v112, under its picture).** ❤️ Favorite, ↗ Share, rating (1–5 stars), comments under the latest version only.
**Share.** Native share / link; shared recipes can be commented by others (`api/comments.js`, 5/min per IP) and rated (`api/ratings.js`, 30/min per IP; `r:log` keeps the last 5,000 ratings for analysis).

**Code.** `drawHistory`, `drawFavs`, `recipeCat`, `rowFor(e,del,heart)`, `toggleFav`, `chatActions`.
**Stored.** `chefStore` (recipes, favorites flag, `from`, `messages[]` with `rid`), Redis `c:<recipe>`, `r:<recipe>`, `r:index`, `r:log`.
**Limits.** Everything personal is on the device (no account, no sync). Storage full → message `stFull` instead of a silent failure (v84).

---

## 3. Weekly menu (v65)

**What it is.** Home section « Menu de la semaine »: 7 day cards × Entrée / Plat / Dessert, plus a full-width « Autres » card.
**Behavior.** « + » on a slot opens `pickRecipe()`: search among the saved recipes, or « ✨ Ask the chef » which starts a chat request for that day and course. A filled slot opens the recipe; ✕ empties the slot; « Clear the menu » empties everything. Saved cooking questions (❓) never appear in the picker.
**Code.** `drawMenu()`, `pickRecipe()`, `#menuBox`.
**Stored.** `localStorage` key `chefMenu` = `{d:[7×[id|null×3]], o:[ids]}`, device only. Deleting a recipe empties its slots.
**Limits.** Not shared between devices; no shopping list yet (backlog).

---

## 4. Seasonal menu (v76–v97)

**What it is.** Home section « Menu de saison » showing ONLY the current occasion (`snCurrent()`): the season, or a holiday while its window is on. 13 occasions in `SN`: hiver, chandeleur, printemps, pâques, été, automne, halloween, noël, plus world festivals (Chinese New Year, Holi, Thanksgiving, Día de los Muertos, Diwali). Ramadan/Eid and Hanukkah were removed at the owner’s request (v77). Lunar dates are in `SN_DATES`, known up to 2028 (extend the table). Southern hemisphere inverts seasons (`SN_SOUTH`). The country is read silently from the browser region (`snCountry()`), no picker (v79).

**« Seasonal » means** (v82): BOTH dishes and drinks typical of the season (winter: tartiflette, mulled wine…) AND recipes built on the season’s produce, drawing on several countries’ cuisines. The prompt names no dishes, so « other ideas » do not loop.

**Seasonal background (v76, v81).** `applyAmb()` sets `data-amb` on `<html>` from the date; always on, no switch; redrawn at start, on return to the app and on a new day. Light mode changes only `--bg1/--bg2`; Halloween and Christmas have their own dark palettes. The mascot also changes outfit by event (`eventOf()`, `EVENTS`, v59–v61).

**Chef’s ideas = the same for everybody (v96–v97).**
- 4 ideas (one starter, main, dessert, drink) per language and occasion, renewed every 3 days at 9:00 Paris time (the day changes at 9:00, not midnight; DST handled with `Intl`). Period 0 starts 3 Nov 2026.
- **3-month rule (v98):** an idea that was published is never proposed again for 90 days, same language, ALL occasions. Redis sorted set `sh:<lang>` (member = idea name, score = publication time; older entries are dropped on read). When a series is generated, the 150 most recent names are sent as « Not these » and the answer is checked against ALL of them (case and accents ignored); up to 3 attempts, a repeated slot is refilled from the next attempt (order starter/main/dessert/drink kept); if it still fails nothing is stored and the app falls back. The route also returns `seen` so « Autres idées » avoids them. The fallback mode (server unreachable) cannot know this memory.
- **In season only (v98):** the server request and the app prompts (`snSugS`, `snSugF`, `snMsg`, 6 languages) say that nothing may belong to another season (no mulled wine in summer, no ice cream in winter).
- Server `api/season-ideas.js` (+ `api/_season.js`): `GET /api/season-ideas?lang=..&occ=..` → `{period, current, previous≤3}`. Generated on demand when missing, first writer wins (Redis `SET NX`), so everyone sees the same series; 2 attempts if fewer than 4 lines; nothing stored on failure. Previous ideas are sent as « Not these ».
- Warm-up cron `?run=1` (needs `CRON_SECRET`) prepares the current FRENCH occasion in 6 languages (≤ 6 small model calls per period). Vercel crons are UTC only and, on the free plan, run once a day each anywhere in the hour: hence two entries (07:00 and 08:00 UTC) and on-demand generation as the safety net. Other occasions are generated on first use.
- Title « ✨ Les idées du chef · du 3 nov. au 6 nov. ». « 🔄 Autres idées » adds 4 PERSONAL ideas below (never repeating names); the shared series does not change.
- Folded menu « ▸ Recettes précédentes » (up to the 3 previous series, with dates), always shown when the series comes from the server (v97); empty message says when the first past series will appear.
- Tapping an idea opens a plain Chef IA chat with `idGen` (complete recipe). Course buttons stay below (« More ideas by course »).
- Fallback if the server cannot answer (route missing, no Redis, model error, offline): the app asks the chef itself, caches 3 days in `snSug2`, « Autres idées » replaces the list, no dates, no previous menu. 401 → « 🔒 Show the chef’s ideas » asks for the code.
- The panel redraws itself when the period ends (timer + `visibilitychange`).

**Code.** `drawSeason`, `snFill`, `snServer`, `snAsk`, `snParse`, `snCurrent`, `snWindow`, `applyAmb`; server `season-ideas.js`, `_season.js`, `vercel.json` crons.
**Stored.** Device: `snSer` (server series until `period.until`), `snSug2` (personal ideas, 3 days, 24 keys max). Redis: `si:<lang>:<occ>:<period>` (40 days), `sh:<lang>` (names published in the last 90 days), `rl:si:` (30/min).
**Setup needed.** `CRON_SECRET` (random value) in Vercel Production + redeploy. Without it the cron is refused (401) and series are simply generated on first use.
**Cost.** ≤ 6 small model calls every 3 days (a little more when a repeat forces a retry, max 3 attempts per series), plus first use of other occasions and personal « Autres idées ».
**Limits.** Real Vercel cron behaviour not yet observed; « 3 previous » means the last 3 series (up to 12 ideas).

---

## 5. Chef IA (free chat and cooking questions)

**Free chat (💬, v-early).** The bottom-bar 💬 opens a plain chat (no chef index, header « Chef libre » / Chef IA). Same engine as the chefs: recipes, ideas cards, filters, attachments (📎 photo/link import), 🎤 voice input. Michelin-starred persona, « 5 stars » standard, food and drink only.

**Scope protection (v70).** The system prompt is built on the server by `systemFor(PARTS,{lang,chef,mode})` and always ENDS with `GUARD` (off-topic, jailbreaks, fake assistant turns, prompt reveal, disguised harmful requests, no medical dosage). The browser never sends free-text persona. Chat limit 20/min per IP; one model call, 55 s timeout (`timeout` error 504); cut-off answers are detected and completed automatically. Checked on 2026-11-02 with the 55-question bench: 55/55 correct; rerun after ANY prompt change. Not run on the server or daily (cost).

**Cooking questions (v66–v69, v150: switch « Questions » in the chat instead of a bottom-bar button).** `openQA()` / `qaMode` → `mode:"qa"` to `/api/chat`: 2–5 plain sentences, no recipe, no headings, food only. Permanent notice above the input: informational only, does not engage the chef’s responsibility. Under each answer: ❤️ Favorite (saved only in Favorites under « ❓ Questions de cuisine », hidden from history, home search and weekly menu), ↗ Share (question + answer + notice + deep link `/?q=<question>`), 💬 Comment (shared comments visible at once, refreshed every 20 s). Opening a shared link asks the chef again (the answer may be worded differently; answers are not stored on the server).

**Simple questions in the normal chat.** Side dish, pairing, substitution, technique → one sentence + 2–5 option cards, not saved as recipes.

**Code.** `api/chat.js`, `openChat`, `openQA`, `qaActions`, `buildComments`.
**Stored.** Favorited questions in `chefStore` (`qa:true`); comments in Redis `c:q-<slug>`.
**Limits.** The « Questions » thread and the 💬 thread are separate; no memory of past conversations on the server.

---

## Test and tooling notes (not in the repo)

Throw-away suites were used each version (22-journey Playwright QA on iPhone 13 and iPad, series UI checks, Node tests of the season-ideas handler with a fake Redis and model, calendar cross-check over 428 days, i18n key consistency). Minimum before delivering: `node --check api/*.js` and load `index.html` in Chromium on a phone and a tablet viewport. A real-iPhone test and a rerun of the 55-question bench are still to be done by the owner.

**Shared comments, sharing link, comment edit (v129).** The heart (v147: PER VERSION — Originale, « 2ème recette », « 3ème recette », variants — in the chat and on the card; each one is independent, stored in `messages[i].fav`) (favorites open the Originale's card). Each new recipe version has a unique comment / rating key; deleting a recipe or version erases its comments if you are the creator (only your own comments for older recipes; nothing for a received recipe). « Partager » adds a link `/?s=…`: the friend gets the recipe with the same comments, can add, edit (« Éditer ») and delete his own comments. Backend: `api/shared.js`, `api/comments.js` (PUT, `?all=1`, `?mine=1`).

**Landing on the Originale (v130).** A tap on any recipe row (History, Favorites, home search) opens the card of the Originale of its family; the other versions are reached with « Afficher toutes les variantes ».

**Multi-line fields (v131).** The message bar, the comment field, the comment edit (buttons below) and the « Chef libre » field are textareas that grow with their text; on a touch screen Entrée makes a new line (send with the button), on a computer Entrée sends and Maj+Entrée makes a new line. Searches, name, access code and link import stay single-line.

**Removing / replacing an ingredient (v132).** « Sans » / « Remplacer » behaves like the quick filters: same conversation, the answer is a new version of the same recipe (badge « 2ème recette »…), its card opens afterwards; the Originale is untouched. No separate variant is created any more.

**Unsuitable combinations (v133).** The chef warns about a senseless combination (chocolate in hummus), explains why and asks whether to continue; if the user confirms, he gives the recipe. Bold pairings that work are not blocked.

**Moderation safety (v134).** Silly requests (houmous au coca) and dangerous / illegal ones are flagged by the chef; from the 3rd in 7 days a warning is added to the answer, at the 10th the user (IP + device) is blocked 24 h and the moderation gets an email (Resend, optional) and a log entry (`/api/moderation?key=CRON_SECRET`). Off-topic questions are only refused, not counted.

**Unblock (v135).** `/api/moderation?key=CRON_SECRET&unblock=<id>` lifts the block and resets the counters of one user (id from the log / email); `&unblock=all` does it for everybody. The block message tells the user that support has been notified.

**Warning language (v136).** The moderation warning is written in the language the chef answered in (marker `[[FLAG:kind:xx]]`), not in the interface language.

- v137 (owner's request): (1) STAY IN THE CONVERSATION: `api/chat.js` BASE rule « STAY IN THE CONVERSATION »: when the user says what THEY will do / cook / serve (« je vais faire des pommes de terre au four »), the chef answers in 1–2 plain sentences (acknowledges, one tip, offers the recipe) and writes NO recipe, no rewrite, no new ideas list; a recipe only when asked. PROMPT CHANGED: rerun the 55-question bench. (2) INGREDIENT LABELS: a version shows pink « Nouveau » (ingredient not in the previous version) and amber « Modifié » (same ingredient, other quantity) pills next to the ingredient, and a « Retiré : … » line under the list (`ingKey()`, `ingMap()`, `prevVerAt()` / `prevVerOf()`, 6th argument `prevTxt` of `renderRecipe()`; keys `ingNew` / `ingMod` / `ingRem` in 6 languages). The previous version = the previous recipe message of the same `rid`; the Originale has no labels; if most quantities differ and nothing is new (servings change) the « Modifié » labels are not shown. Works in the chat, the family view and the card.

- v138 (owner's screenshot: « je vais faire du riz avec » got only advice, the beef roast recipe was not updated): `api/chat.js` rule STAY IN THE CONVERSATION reworded: if a recipe is already in the thread, the chef UPDATES THAT recipe for the user's plan (full recipe via the MODIFICATION steps, « What changed » mentions the accompaniment; so it becomes a new version « 2ème recette » with the ingredient labels, card opens) and never writes a separate recipe for the side; if nothing needs to change, or no recipe exists yet (ideas only), plain 1–2 sentences and no recipe. PROMPT CHANGED: rerun the 55-question bench. Not tested with the real model.

- Tests (2026-11-05, owner's request « 55 questions dans toutes les langues »): new `api/_selftest-i18n.js` = the SAME 55 questions in each of the 6 languages (275 added versions, ids `<id>-<lang>`; `CASES_I18N`, `ALL_CASES` = 330 cases, 55 per language). `api/selftest.js` (daily cron, costs model calls) still runs the 55 original `CASES` only. The morning check (scheduled task « Contrôle matinal Chef IA », 7:25 Paris) runs `ALL_CASES` with haiku sub-agents (approximate measure; the artifact bench stays the reference).

## Ingredient order (v227)
Ingredients are always displayed in the same logical order (meat, fish, vegetables, fruit, flour/starch, butter/dairy, sugar, eggs, herbs/spices, oils/sauces, liquids), whatever order the chef wrote them in. The sort (`sortIng` in `index.html`) runs at display time with keyword lists in the 6 languages, is stable (unknown items keep their place), and is skipped when the block has sub-headings or fewer than 3 bullets.

## Shopping list by aisle (v228)
Like Apple Reminders' « Groceries » list, a shopping list is grouped by aisle (fruit & vegetables, meat & fish, dairy & eggs, pantry, spices/oils/sauces, drinks, other), in supermarket-walk order. The aisle comes from the same keyword lists as the ingredient order (`aisleOf` → `ingRank`), in 6 languages; unknown items go to « Other ». Empty aisles are hidden, a header tap folds the aisle (remembered in `chefAisleCol`), the header shows « left/total », ticked items sit at the bottom of their aisle. Not done yet: moving an item to another aisle by hand.
(v229) Aisle headers are now cards with a coloured round icon, a « left/total » pill and a round chevron button; a folded aisle shows « N items »; a one-time hint « Tap an aisle to fold or unfold it » disappears after the first tap (`chefAisleHint`).

## Lists screen (v233)
Each list card has a ⋯ menu (rename, duplicate, share, delete). « Edit » switches to selection mode: tick several lists, then « Select all », « Merge » (the other lists go into the first selected one; identical items add up, already-ticked items are not carried over) or « Delete ». Deleting or merging asks for confirmation and then offers « Undo » in the toast.
(v234) « Merge » now asks which list is the primary one (the others are merged into it); the list with the most items is preselected.
(v235) « Choose the list » sheet: 3 lists shown (the chosen one always visible), the others in a drop-down « Other lists (n)… », and a ✕ on each row to delete a list from there (confirmation + undo).
(v236) The « Other lists » drop-down is no longer the native select: it opens an inline panel with the same compact rows (radio, count, ✕) as the first 3 lists.

## Weekly menu suggested by the chef (v238)
Every Monday at 9:00 (Paris) the chef proposes the SAME weekly menu to everybody: 21 dish names (Monday…Sunday × starter, main, dessert), generated once per week on the first request (`GET /api/week-menu?lang=…`, `api/week-menu.js` + helpers in `api/_week.js`, Redis key `wm:<lang>:<week>`, no cron; the previous week's dishes are excluded). Only names are generated: tapping a dish opens the chat with « Give me the full recipe of … » and the new recipe fills that slot (`menuPend`/`menuAssign`). ✎ on a suggested slot opens the usual « pick one of my recipes / ask the chef » dialog; a slot filled by the user is never replaced. The toggle « The chef suggests the weekly menu » (`chefMenu.auto`, default on) hides the suggestions. The app keeps the menu in `chefMenuSug` until the next Sunday 9:00. Without Redis the route answers 501 and the menu works as before (manual).
(v239) The chef's requests for the weekly menu and the seasonal ideas now say explicitly in which language to write (`langRule` in api/_season.js); the weekly menu keys moved to `wm2:` and the app cache to v2 so English menus are regenerated.
(v240) Each suggested slot shows two visible round buttons: 🔄 « Another idea » (asks the chef for one other dish for that course, kept on this device in `chefMenuSug`) and ✏️ « Pick my own ».
(v241) Weekly menu redesigned as plain rows (label · dish · ⋯ menu): tap the dish to generate the recipe; ⋯ = another idea / pick my own / remove (a removed suggestion is remembered in `chefMenu.hid` for that week). Filled slots show a green ✓.
(v242) The « Others » card of the weekly menu was removed (only the 7 days remain).
(v243) Weekly menu ergonomics: today's card is open (badge « Today »), the other days are folded (tap a day to open it; a folded day shows « ✓ n/3 »); a suggested dish ends with a pink › (tappable); the ⋯ button is 44 px; after a recipe is generated for a slot, a toast « Added to the weekly menu · See the menu ».
(v244) Weekly menu shown as tiles like the chefs: Monday–Saturday in 3 columns × 2 rows, Sunday full width; each tile lists the 3 dishes. A tap opens the day in a bottom sheet (`daySheet`) with the 3 rows (generate / ⋯ another idea, pick my own, remove). Today's tile has a pink border and a « Today » badge.
(v246) Weekly menu redesigned after the owner's mockup: a week strip (Mon … Sun with the dates of the suggestion week, today marked) and the selected day as one card with a PHOTO per dish (the saved recipe's own photo, else the Unsplash photo of the dish name via /api/photo, cached in `chefMenuPh`; « Photos: Unsplash » credit under the card). Rows keep the ⋯ menu. The 21 dishes are still generated Monday→Sunday; the strip only shows Sunday first. In the claude.ai preview photos do not load (remote images blocked): a plate placeholder is shown.

### v247 — Weekly menu hardening
- `parseMenu` accepts bullets or `1.` lists, bold names, `:` or dash separators, plain `Name: sentence` lines; day/course headings are ignored.
- `api/week-menu.js`: up to 3 attempts keeping the best parse, ≥18 dishes needed, missing ones stored as `null` (empty « + Ajouter » slots); logs the start of the answer when parsing fails (look for `week-menu:` in Vercel Functions logs).
- App: on failure the status line shows an error message and a « Réessayer » button instead of an endless « Le chef prépare le menu… ».

### v248 — Weekly menu: users' favourites + same recipe for everybody
- The menu mixes the users' favourite recipes (Bayesian average of the stars + bonus per real share; eligible with ≥4★ or shared by ≥2 people, same language) and new dishes from the chef. Up to 12 candidates are sent to the chef, who places up to 7 where they fit (course, season). Marked « ★ 4,8 · Recette de la communauté ».
- Tap on a dish: already in my recipes → opened; a favourite → its shared copy is opened as it is; a dish somebody already generated this week (`w-<lang>-<week>-<slot>`) → opened as it is; otherwise the chef writes it and it is published under that id (first writer wins). 🔄 makes a personal idea (slot no longer shared).
- Server: dedicated short instructions + JSON answer (`MENU_SYS`, `menuPromptJ`, `parseMenuJ`), 45 s budget, key `wm3:`. `api/shared.js` keeps an index `s:ck` and counts real shares (`POST {sid, hit:1}` → `s:pop`); older shares indexed once by SCAN (`s:bf`).
- Fix: the 🔄 button (lost in v247) works again.

### v249 — Weekly menu reset
- New Redis key `wm4:` and client cache `v:4`: the week of 8 Nov 2026 is generated again for everybody.
- The error line shows the code returned by the server (e.g. « 502 upstream », « timeout »), to find the cause from a screenshot.

### v250 — Weekly menu diagnostics
- On failure the server returns `detail` (each attempt: « api <status> <message> » or « parse <n> « start of the answer » »), shown in the menu error line.
- `parseMenuJ` reads any JSON shape (menu array, days object, nested courses, keys n/name/dish and s/sentence/description).

### v251 — Weekly menu: cut answers
- Seen live: the chef answer was cut (1 dish read), then empty, then timeout. Now: 2 chef calls in parallel (+1 if both are short), merged slot by slot; max 6000 tokens, short sentences; a cut JSON keeps every complete dish.

### v252 — « I cooked it » before rating, quick tag, origin of the recipe (step 1 of the community plan)
- **Why.** Only a rating given AFTER cooking says something about a recipe; the later community steps (badge « Cooked by N people », score, re-proposals) need that signal. Part of the community plan (types / ratings / tiers) agreed with the owner on 2026-11-09.
- **Action bar / card.** `rateBox(id,vi)`: until the version is cooked, the pill shows « ✅ J'ai cuisiné » instead of the stars; one tap marks it (`messages[i].cooked` = time) and reveals the stars. After a rating, an optional row of 4 one-word tags appears (`messages[i].tag`: `salty` / `easy` / `kids` / `long`, labels `tg_*` in the 6 languages, tap again to clear). On the card the tag row sits under the heart / rating / share row (`.cact .rtags{order:9}`).
- **Compatibility.** A rating always counts as « cooked »: every recipe rated before v252 shows its stars and the tags straight away, nothing to redo. `cooked` and `tag` travel with the version exactly like `stars` (`msgOut`, `saveCurrent`, `openSaved`).
- **Origin.** `originOf(e)` (see v253 for the final rule) is sent with each rating and logged. (The « visibility » field of the plan — private / circle / public — is NOT stored yet: nothing uses it before the sharing step.)
- **Server (`api/ratings.js`).** One POST carries ONE thing: `{stars}` (rating, also counts as cooked, log line gets `o` = origin), `{cooked:1}` (cooked without rating, kept in `rc:<key>`, NOT added to `r:index`) or `{tag}` (`salty|easy|kids|long`, or `none` to clear; only from someone who rated, kept in `rt:<key>`). `GET` returns, besides `count / avg / mine`: `cooked` (people who rated or marked it), `mineCooked`, `tags` (counts), `mineTag`. Same 30/min limit per IP. Deleting a recipe (`api/comments.js`) also deletes `rc:` and `rt:`.
- **Tests (not in the repo).** Fake-Redis test of the route (13 checks) and Playwright iPhone 13 / 320 px checks of the card and the chat bar.
- **Next steps of the plan.** Profile of tastes + « my library » (step 2), daily menu with re-proposal rules (3), import (4), remix test (5), identity (6), circle sharing + badge (7), moderation (8), public publication + weighted score (9).

### v253 — Origin badge (Chef IA / Importée / Variante / Reçue)
- **What.** A small neutral pill next to the date, on the recipe card and the chat date line (`verLine`) and in every list row (History, Favorites, search results: `rowFor`). Built by `originBadge(e)`; texts `orgC` / `orgI` / `orgV` / `orgS` in the 6 languages. Cooking questions (❓) never get one. Colours stay neutral on purpose: pink is kept for the « Original » version badge.
- **Rule (`originOf`).** `remix` = the recipe has `from` (variant of another one) → « 🔀 Variante »; `import` = `src` is `photo` or `link` → « 📥 Importée »; `shared` = `imp` (received through a share link, `addShared`) → « 📨 Reçue »; otherwise `chef` → « 👨‍🍳 Chef IA ». The first match wins in this order.
- **Fix of v252.** v252 had read `imp` as « imported by the user » (it means « received by link »), so photo / link imports were logged as `chef` and received recipes as `import`. `api/ratings.js` now accepts `chef | import | remix | shared` (`manual` removed, nothing produces it yet).
- **Not done.** Typed / pasted recipes without photo or link have no import flag yet, so they show « Chef IA » (the import step of the plan will set it). The label « Communauté » for public recipes comes with the public step.

## v311 — Adjustments come back as tips on the original recipe (community plan, step 5, second half)

When someone adapts a recipe with the quick filters of the chat (« Adapte la recette Chef ») and then cooks the new version, the filters used become **tips** shown on the recipe it comes from: « 💡 Aussi testée avec : Sans gluten ×2, Version végane ».

- **Which adjustments.** Only the chips of « Sans » (gluten, lactose), « Régime » (vegetarian, vegan) and « Autres » (faster, low fat, high protein). Servings are not a tip. Free text (« avec de la crème ») and « Sans » / « Remplacer » on a struck ingredient give no tip: no model call and no free text on purpose.
- **Stored on the version.** The chosen chips are saved as language-independent codes `<group>.<option>` (`1.0` = without gluten…) in the field `adj` of the chef's reply (max 3). It follows the version like `cooked`, `stars` and `tag`.
- **Counted when cooked.** The tip is sent only when the person marks « J'ai cuisiné » or rates a LATER version (not the first one). One vote per person and code, so the same person cannot inflate a tip.
- **Where it shows.** On its own line UNDER the action row (v312: `order:10`, so « Partager » stays next to « J'ai cuisiné ») of the first version (the original). For a recipe received from the circle or from the community the original has the author's key, so everybody who has the recipe sees the same tips.
- **Server.** `api/ratings.js` (no new route): hash `ra:<parent>`, field `code:owner`; summaries return `tips` {code: people}. Deleting a recipe with « delete all » (`api/comments.js`) removes it.
- **Not done.** The identity test (adjustment vs remix) still runs only at publication (v291). A « vegan » version counts as an adjustment here, but the chef's check can still call it a remix when the author publishes it.

## v254 — Personal taste profile (community plan, step 2)

The chef now knows the user's cookbook and uses it to personalise ideas and suggestions.

- **Computed on the device** (`tasteProfile()` in `index.html`, from the saved recipes only, Q&A entries excluded): `loved` = titles rated 4-5 stars (max 8), `avoid` = titles rated 1-2 stars (max 8), `recent` = recipes created in the last 14 days (max 10, so ideas do not repeat them), `tags` = how many times each quick tag (salty / easy / kids / long) was given.
- **Sent with each chef request** (`chatCall()`, field `taste`), never in the cooking-questions mode, never for imports. The seasonal ideas shared by everybody (`api/season-ideas.js`) are NOT personalised; the per-device fallback ideas go through `chatCall()` and are.
- **Server** (`api/_taste.js`, pure helpers): `cleanTaste()` keeps only strings made of letters, digits and a few punctuation marks (max 60 characters, deduplicated, capped lists, tag whitelist), so a title can never carry instructions; `tasteText()` writes one paragraph. A tag counts only when given at least twice. `systemFor()` places it after the chef persona and BEFORE `FINAL SCOPE CHECK`, so the scope guard stays last; the paragraph says the profile never overrides the user's last message, the scope, the quality standard or the format, and must not be mentioned.
- No rating, no recent recipe → no `taste` field, and the prompt is exactly the v253 one.
- Limits: the profile only knows this device (no account yet); there is no switch to turn it off. PROMPT CHANGED (new paragraph only when a profile exists): rerun the 55-question bench.

## v256 — Personal weekly menu (replaces the v255 daily menu)

The « 🍽️ Menu du jour » card, page and code are gone (never pushed). The existing weekly menu card (`#menuHome`) now sits right under the four home tiles and opens the weekly menu page, which became personal per device (`wkPers()`, `dayClassics()` in `index.html`):

- **Your classics.** Once per shared week (localStorage `chefWkPers`, `{from,lang,slots}`), up to 5 main-course slots (recipe categories 0 / 4 / 5) and 2 dessert slots (categories 1 / 8) are filled with the user's own recipes, starting with today. Rules: a version rated 4-5 stars and cooked 3 weeks ago or more = « ⭐ Ton classique » (opens its card); 3 stars (same delay) = « 🔧 On l'ajuste ? » (opens the thread and asks the chef for an improved version, at most 1 per pool, only when classics are missing); 1-2 stars never; archived recipes and questions ignored; oldest cooked first; nothing shown in the last 14 days, nothing declined (history `chefDailyHist`, 60 days). A recipe the user put in a slot himself always wins; a deleted recipe drops out of the plan.
- **Discoveries.** Every other slot stays the chef's shared dish (about 30 % when the cookbook is rich, everything when it is empty), with 🔄 (a personal idea; `wkRegen` now sends the taste profile).
- **Feedback.** The « ⋯ » menu of a suggested dish has « Garder » (history `keep` → `wish` in the taste profile) and « Pas pour moi » (hides the slot, history `no` → `passed`); a classic slot has « Pas pour moi » (never proposed again for 60 days).
- Taste prompt wording: « declined from the menu ». Server changes: `api/_taste.js` wording and the Monday week anchor in `api/_week.js`. Tested with Playwright (iPhone 13, SE, 320 px) and a mocked `/api/week-menu`.
- **Week Monday → Sunday (v256).** The shared week now starts on Monday at 9:00 Paris time (`WK_ANCHOR` = Monday 9 Nov 2026 in `api/_week.js`); the strip and the day cards run Monday … Sunday (`menuSel` 0 = Monday, `todayIdx`); the device cache `chefMenuSug` is version 5 so an old Sunday-based week is dropped.

## v257 — « Vider le menu » always reachable

The « Vider le menu » button of the weekly menu page (`.mclear`) now appears as soon as something is shown: a recipe the user put in a slot, or the chef's suggestions (before, only his own recipes counted, so it never showed with the suggestions alone). After the confirmation the slots are emptied and the « Le chef propose le menu de la semaine » box is switched off (`auto:false`, `hid` reset); ticking it again brings the suggestions back. Local only until the owner says « pousse ».

## v258 — Weekly menu: options under the dish

The options that were behind the « ⋯ » of each dish are chips under the dish name (`.mopts`, `.mopt`, built in `dayRows()`): « 🔄 Autre idée » (chef's dish), « ✏️ Choisir moi-même », « 👍 Garder » (chef's dish), « 👎 Pas pour moi », « 🗑️ Retirer » (own recipe). Same actions as before; `rowMenu()` is no longer used by this page. Local only until « pousse ».

## v259 — Weekly menu: centred title, options on one line

In each dish row the course label and the dish name are centred (`.mrow2 .mbody`, `.mtit`), and the option chips are one centred line below the photo and name (`.mopts` moved from `.mbody` to the row, `flex:1 0 100%`, nowrap). Up to 480 px wide they wrap onto two lines (four chips are about 360 px wide). Local only until « pousse ».

## v260 — Weekly menu: chips fit the card at every width

The option chips (`.mopts`) no longer overflow the day card: they wrap and are centred under 560 px (2-3 lines), stay on ONE centred line from 560 px with compact chips (12 px, `padding:6px 9px`), and use the larger chips (13 px) from 900 px. Replaces the 480 px rule of v259. Local only until « pousse ».

## v261 — Weekly menu: title left-aligned

The course label and the dish name are left-aligned next to the photo again (the centring of v259 is cancelled); the chips of v259 / v260 stay centred on their own line. Local only until « pousse ».

## v262 — Weekly menu: no « Autre idée »

The « 🔄 Autre idée » chip and `wkRegen()` (a personal idea per slot) are removed so that nobody keeps asking the chef for new dishes (cost). The options of a chef's dish are now « ✏️ Choisir moi-même », « 👍 Garder » and « 👎 Pas pour moi ». Earlier mentions of 🔄 / `wkRegen` in this file (v238-v256) are outdated. Local only until « pousse ».

## v263 — search in the community + Share next to the heart and stars

- **Home search, two columns.** Once 3+ letters are typed in « Trouver mes recettes », the results show: the user's own matches (now matched WORD BY WORD: « mousse choc » finds « Mousse au chocolat noir »), then two columns (`csDraw()`, `.csg`): **👨‍🍳 Recette du chef** (« Demander au chef », opens the chat with `idGen`) and **👥 Recette de la communauté** (up to 4 shared recipes with `★ avg (votes)`, a tap imports it with `importShared(sid)` and opens the card; recipes the user already has, same title, are hidden). No community result: « Pas encore de recette partagée pour ça. ». The columns also show when the user has no own match (no « Aucune recette trouvée »). Hidden while the ❤️ filter or a category filter is on. Keys `csChef`, `csChefD`, `csChefB`, `csCom`, `csNone`, `csMore` (unused) in 6 languages.
- **Server.** `GET /api/shared?q=<words>&lang=<fr>` (in `api/shared.js`, no new function): reads `s:ck`, keeps the recipes of that language whose title contains EVERY word (accents / case ignored, filler words dropped, ≥ 3 letters in total), ranks by Bayesian average of the stars + share bonus (same formula as the weekly menu), returns `{items:[{sid,t,a,n}]}` (max 6). Rate limit 30/min per IP (`rl:cs:`). Client cache per query (`csMem`), 450 ms debounce.
- **Share.** In the chat, « ↗ Partager » of each version is on the same line as the heart and the stars (icon only up to 520 px; on a 320 px phone it still wraps); the quick tags (« Trop salé… ») and « Commencer la recette » come below (`.chact` order).
- Preview: the claude.ai preview has no `/api/shared`, so its community column always says « Pas encore de recette partagée ».

## v264 — the two columns move to « Que voulez-vous cuisiner ? »

- **Top box** (`#hq`): once 3+ letters are typed, two columns appear under it (`#hqcs`, `drawTopCs()`): **Recette du chef** (« Demander au chef », same request as `idGen`) and **Recette de la communauté** (shared recipes, `GET /api/shared?q=`, see v263). « Go » / Enter still sends the text straight to the chef.
- **« Trouver mes recettes »** goes back to searching only the device (history + favorites, word by word). When nothing matches, « Aucune recette trouvée » + ONE « Demander au chef » card (`chefAsk()`); no community there.

## v266

- « Trouver mes recettes » no longer offers « Demander au chef » when nothing matches (only « Aucune recette trouvée »); the chef / community columns stay under « Que voulez-vous cuisiner ? ». `chefAsk()` removed.

## v267 — weekly menu layout

- « Vider le menu » sits on the top line of the menu, right-aligned next to the « Le chef propose le menu » checkbox (`.mtop`), no more at the very bottom.
- Options of each dish: « ✏️ Choisir moi-même » alone, the other options (👍 Garder, 👎 Pas pour moi / 🗑️ Retirer) centred on a second line (`.mopts` column + `.mopts2`).

### v273–v275 — weekly menu page fits the phone screen
Owner: « que cette page fasse la taille de l'écran sans défilement » / « ajuste les 3 vignettes à la page ». Under 560 px wide the compact CSS block before the `.dlg`-less `.mopts` rules (search `v273` in `index.html`) shrinks the week line, day tabs, day header, photos (4:3, height `clamp(44px, --appH × 7%, 80px)`; `--appH` = visible height, not `vh`, because iOS `vh` ignores the retracted toolbars), rows and option chips; from 375 px the option chips sit on ONE line (`.mopts2{display:contents}`, replaces the v267 two-line layout on phones). The menu view is a flex column: `#menuBox`, the day card and `.mslots` stretch and the 3 dish rows share the free height; the scroll area keeps 108 px at the bottom for the nav pill. Measured: iPhone 13 and 15 Pro Max no scroll; iPhone SE ~117 px (chips wrap under 375 px).

### v283 — seasonal ideas restart on 9 Nov 2026

Period 0 now starts on 9 Nov 2026 at 9:00 Paris time (`ANCHOR` in `api/_season.js`; the current series is 9 → 12 Nov, then 12 → 15…). Series are kept under `si2:<lang>:<occasion>:<period>`; the previous `si:` keys are ignored (they expire by themselves after 40 days). The first series of the new numbering is generated on first use, by the cron, or with the v282 admin link. `snAlt` (« Une alternative ») tokens are `p<period start date>`.

### v282 — admin link: generate / reset today's seasonal ideas

`GET /api/season-ideas?run=1&key=<CRON_SECRET>` (needs `CRON_SECRET` in Vercel; open it in a browser): prepares the current series for the French occasion in the 6 languages (nothing is regenerated when it already exists). `&reset=1` deletes the current series of the 6 languages first, so a new one is generated (the 3-month memory `sh:<lang>` still applies: names already published are not proposed again). The JSON answer gives `ok` / `failed` and the error of each failed language. A cron call (Bearer header) never resets.

### v281 — wording

`snFold` / `snPrevT` say « Recettes de la semaine passée » instead of « Recettes précédentes » (en « Last week’s recipes »). The folded list still shows up to the 3 previous series.

### v280 — seasonal ideas: no expired series, health check

- `snServer()` keeps the last known series only while it is still valid (`until` in the future). An expired one is dropped, so a failing server can no longer make the screen show « du 3 nov. au 6 nov. » days later; the app then uses its own on-demand ideas (fallback, no dates).
- `GET /api/season-ideas?status=1` (public, no secret): `{now, period:{id,from,to}, occasion, anthropicKey, cronSecret, redis, seriesFR:{<period>:true|false}, lastCron, lastError}`. `lastError` = why the last on-demand generation failed (`credit`, `badkey`, `model`, `rate`, `upstream`, `timeout`… + HTTP status + 160 characters of the model's message); `lastCron` = last scheduled warm-up (needs `CRON_SECRET`). Both are kept 7 days in Redis (`si:err`, `si:cron`).
- A period nobody asked for (and the cron did not prepare) is never generated afterwards: it stays absent from « Recettes précédentes ».

### v279 — seasonal menu: « Une alternative », once per series

`snMore` reads « 🔄 Une alternative » (en « An alternative », es, de, it, pt). One use per series: the token is the server period id (`p<id>`), or a 3-day window in fallback mode (`d<n>`); stored in `snAlt` = `{<lang>|<occasion>:{tok,items}}`. In server mode the 4 alternative ideas are saved and redisplayed under the series after a reload; the button disappears and comes back with the next series. A failed request does not use up the alternative. In fallback mode the alternative replaces the list as before.

### v278 — option chips on one line

Garder / Pas pour moi (and Retirer) sit side by side on every width (all chips go in `.mopts2`); checked at 320, 375, 390, 430, 620, 810 and 1280 px.

### v277 — weekly menu: « Éditer » button, one course per slot, message after « Vider le menu »

- Every dish row (starter / main / dessert, filled or empty) has a soft-pink « ✏️ Éditer » button on its right (`.medit`, key `mEdit`). It opens the recipe picker (`pickRecipe(askText,course,cname)`); choosing a recipe replaces the one in the slot. The old « Choisir moi-même » chip is gone; Garder / Pas pour moi / Retirer stay under the dish.
- The picker only lists recipes of the slot's course (`courseOf(e)`: 0 starter, 1 main, 2 dessert, -1 not a dish). Dessert = categories 1 and 8; starter = title matches `STARTER_RE` (entrée, salade, soupe, velouté, carpaccio, tartare… in 6 languages); drinks, bakery and sauces are never offered; everything else is a main. An empty list says « Aucune recette « Entrée » enregistrée pour l’instant » (`mNoneC`). Limit: a salad or soup eaten as a main counts as a starter. The personal classics put in the weekly menu (`wkPers`) follow the same rule.
- After « Vider le menu » is confirmed, a 7 s message explains how to refill: tick « Le chef propose le menu de la semaine » (`mClearHint`).

### v276 — « Vider le menu » back to the simple version
Owner: « Annule tout ce que tu as fait pour cette histoire de vider le menu ». The two-option dialog and the selection mode (v268–v272, v275) are removed: « Vider le menu » (top line, v267) asks one confirmation and empties the whole menu again. The phone fit of the weekly menu page (v273–v274, photo size from `--appH`) is kept. Local only until « pousse ».

### v284 — generation failure diagnosis
`generate()` (api/season-ideas.js) and `callClaude` (api/_lib.js) now put a `detail` on the `upstream` error: network cause, or the number of idea lines read / kept and the start of the chef's last answer. It is stored in `si:err` and shown by `?status=1` (`lastError.detail`) and by the admin link (`errors`).

### v285
`generate()` asks the chef with `max_tokens: 3000` (was 700, which left an empty, cut answer).

### v286
Seasonal menu labels `snPrevT` / `snFold`: « Recettes des 3 jours précédents (et idées par catégorie) », 6 languages.

## Identity and circle (v287, community plan steps 6–7)
- **Invite on a computer (v298)**: « 🔗 Copier le lien » (+ « ↗ Partager » where the browser has a share menu); phones keep the single native-share button.
- **Not the owner (v300)**: a received recipe, as its author wrote it, cannot be made « Publique » by the receiver (client `notMine()`, server `notOwner()`: 403 `notowner`); only his own later versions can, through the chef's remix check.
- **Appeal answer (v301)**: the author of an appeal gets « ✅ Appel accepté … » or « ❌ Appel refusé … » in « 🔔 Nouveautés » (own note `appok` / `appno`, `notifyOne()`).
- **Moderator's comment (v302)**: the appeal email links to a review page (`&review=<sid>`) with a comment field; the comment is shown to the author under the answer (« 💬 Message du modérateur »).
- **Home entry (v294)**: a « 👥 Cercle » button between « 🕘 Historique » and « ❤️ Favoris » under « Trouver mes recettes » opens « Mon cercle ».
- **Nickname**: asked at first opening (`askNick()`, localStorage `nick`), editable in « Mon cercle », sent with `POST /api/circle {act:"name"}`. No account: the person is the device owner id (`x-owner`), stored server-side only as a hash `pid`. Changing phone = new identity.
- **One invitation (v329)**: « ➕ Inviter un ami » in « Mon cercle » shares the circle link `/?c=<code>`; it puts the friend in the circle and, if he has no access yet, gives him a personal access code (`act:"redeem"`, 3 new people per member; free for people who already have access). The separate « Donner l’accès » button is gone; old `/?k=` links still work.
- **Friends' access (v323, v324)**: now the first block of « Mon cercle » (v324); the circle invitation `/?c=` is hidden for now.: « 🎟️ Donner l’accès » in « Mon cercle » creates a personal link `/?k=<token>` for a friend (`POST /api/circle {act:"access"}`, Redis `ak` + counter `ai:<pid>`); max 3 per person, the counter shows « Il te reste N accès à donner ». The friend opens the link and gets in; no account.
- **Circle**: one per person. « ➕ Inviter un proche » creates `/?c=<code>` (7 days); the friend opens it → both are in each other's circle (max 50). ✕ on a member removes both sides.
- **Visibility**: on the recipe card, « 🔒 Privée » / « 👥 Cercle » per version (not on received recipes). Cercle = the version's shared copy listed for the circle (`cp:<pid>`); Privée again = removed from the list.
- **« Recettes du cercle »**: the circle's recipes, newest first, with the author's nickname; « Enregistrer » imports the recipe (same comments, like a shared link).
- Redis: `cu:<pid>` nickname, `cf:<pid>` circle set, `ci:<code>` invite, `cp:<pid>` listed recipes. Limit: a « Privée » recipe whose card was opened can still be found by the community search (v263 index of shared copies).
- v288: a recipe saved from « Mon cercle » stays in the saver's cookbook even if its author sets it back to « Privée »; its badge reads « 📨 Reçue de X » and « · plus partagée » once nobody of the circle lists it any more (`GET /api/circle?live=`). « Mon cercle » reloads on return to the app and has « 🔄 Actualiser ».
- v297: once such a recipe is « plus partagée », its comments are read-only for the receiver (`comClosed()`, `.coms.closed`, « 🔒 … commentaires fermés »); the author can still comment.
- v289: a received recipe can be put in « 👥 Cercle » too (re-share to one's own circle, never public). The copy keeps the original author (« par Marie · recette de Pierre ») and the same comments. If the author sets the original back to « Privée », every re-share disappears from the circles (already-saved copies stay, « plus partagée »), and re-sharing it is refused.
- v290: a shared recipe is never public. Shared copies are no longer indexed; the community search and the weekly menu's community recipes read the public index `pub:ck`, empty until recipes can be published (palier 3). The « Recette de la communauté » column is hidden for now.

## Visibility, publication and notifications (v291, community plan steps 8–9)
- **Selector** on every recipe card (own or received): 🔒 Privée (only me) · 👥 Cercle (my circle) · 🌍 Publique (everybody and my circle). Shown as « ⏳ En vérification » while an appeal waits.
- **Publique**: needs « ✅ J'ai cuisiné » on that version. The chef checks the recipe (food, complete, safe). A received recipe can only be published as a real remix (another dish); an adjustment (quantities, seasoning, minor swap) is refused with the reason. A refused recipe can be appealed (manual queue). The published copy is frozen, labelled « Communauté » with the author's nickname (and « recette de X » for a remix).
- **Community**: « Recette de la communauté » (home search) and the weekly menu use published recipes only. « 🚩 Signaler » on a community recipe; 3 different reports hide it until reviewed.
- **Admin** (browser): `/api/publish?key=<CRON_SECRET>` lists the queue (appeals, reports); `&approve=<sid>` publishes, `&remove=<pub sid>` takes down.
- **Notifications in the app**: when someone puts a recipe in « Cercle » (first time) or publishes it, his circle gets a line: counter next to « Mon cercle » in the menu, dot on ☰ and after « 👥 Cercle » on the home (v294), list « 🔔 Nouveautés » at the top of « Mon cercle » (opening it marks them as read). No phone push notification (option B, later).
- v292: moderation emails (same address as the block email): one per appeal (links « Publier » / « Laisser refusée »), one when a public recipe is hidden after 3 reports (links « Remettre en ligne » / « Retirer définitivement »). Admin links `&reject=<sid>` and `&restore=<pub sid>` added.

- v293: `/api/publish` is served by `api/circle.js` (rewrite in `vercel.json`) because the Vercel free plan allows 12 routes; the deployments of v291–v292 had failed.


## Install on the home screen (v295–v296)

- `manifest.webmanifest`, `icons/*`, `sw.js` (no cache, offline page only) make the site installable.
- Android only (v296): when the browser fires `beforeinstallprompt` (installable, not installed), a thin bottom pop-up `#a2pop` « Installe Chef IA sur ton téléphone · Installer · ✕ » and a drawer item `#dA2hs` open the native install prompt. ✕ or a refused install hides it for 3 days (localStorage `a2Hide`). Hidden while typing and on the recipe card.
- iOS: nothing is offered (the installed app would have its own storage, separate from Safari: no history, no circle).


## v313 — Quick-tag row removed

The optional row « Un mot sur la recette » (Too salty / Easy / Kids loved it / Too long) under the stars is gone from the recipe card and the chat. Tags already given stay stored and still feed the taste profile (repeated tags); nothing new can be added from the app. The server route still accepts `tag`.


## v314 — Weighted score (stars + number of votes)

Recipes are ranked with `api/_score.js`: Bayesian average with a prior of 3.5 worth 5 votes, plus a small capped share bonus. A recipe with one 5-star vote does not beat one with many good votes. Used by the community search and the weekly menu's community picks; same-title variants collapse to one card, the best-ranked on top. The card still shows the raw average and vote count.


## v315 — Weighted score made visible

Community search items show the average, the number of votes and « Cuisinée par N personnes » (from 2 people), plus a « ⭐ Recommandée » pill when the recipe has at least 5 votes and a weighted quality of 4.2 or more (`recommended()` in `api/_score.js`). The recipe card and the chat bar show the same « Cuisinée par N personnes » line under the actions. Ordering still uses the weighted score (v314); the displayed average stays the real one.


### v316 — Chef portraits on the home
The four chef cards (Giulia, Marcel, Hiro, Lina) show an original SVG bust drawn in code by `chefSvg(k)` (hat, scarf and colours differ per chef), replacing the emoji. Same behaviour: tapping a card opens the course panel (Starters / Mains / Desserts / Drinks + « Discuter »). Portrait 54 px (46 px under 380 px).


### v317 — Home blocks laid out like the mockup
- **Menu de la semaine** card: 7-day strip of the current week (tap a day), photo of that day's main dish, its 3 courses with thumbnails; « Tout voir → » opens the weekly menu page. Shown as soon as any day has a dish.
- **Dernières recettes**: the 2 latest recipes (or favorites) side by side in one white card; heart kept, no ✕ on the home.
- **Inspirations de saison**: 4 ideas per row, photo + name only.
Current charter kept (soft pink selection, cream background).


### v318 — Less elongated home cards
Square photo in the weekly-menu card, compact course rows; seasonal inspirations: 4:3 photos (tablet / computer), a sideways-scrolling row of small square cards on phones.


### v319 — Home fixes
Menu-card photo locked at 132 px square (no size change when the real photo loads); recent block slightly wider; inspirations 2 by 2 on phones; chef cards horizontal and short (2 by 2 on phones).


## Access and invitation links (v320)

- The app is protected by the shared code `APP_PASSWORD` (asked once per device, stored in localStorage `code`). To let a friend in WITHOUT that code, the owner creates a personal link: `/api/moderation?key=<CRON_SECRET>&invite=<name>` returns `https://<site>/?k=<token>`. Opening it stores the token as the device's code; the address bar is cleaned.
- `&invites=1` lists the invitations with their links; `&revoke=<name or token>` cancels them (effective within about 1 minute, positive checks are cached 60 s per server instance).
- Storage: Redis hash `ak` (token → `{n:name, at:time}`), 100 invitations max. Needs `APP_PASSWORD` to be set, otherwise the app is open.
- Not done: usage counter per link, expiry date, link creation from inside the app.

## Usage analytics (v321)

- PostHog (EU cloud) measures usage on the real site only (`chefia-v3.vercel.app`): pageviews, clicks (autocapture), heatmaps, web vitals and the named events listed in CLAUDE.md section 5 (v321). Anonymous (no link to the invitation name), no cookies (localStorage id), no session recording.
- Code: `track(name,props)` and the loader at the top of the script in `index.html`; add a new event by calling `track('name',{...})` where the action happens. The project key `phc_…` is public; do not store any personal API key in the repo.
- Dashboards are built in PostHog itself (insights by event name, per day; heatmaps from the toolbar).

- v322: `resume_click` event on the resume pill (`to` = chat / qa / card / new).
- v330: `/api/moderation?key=<CRON_SECRET>&stats=1` returns the user counts (nicknames, people in a circle, active invitations, shared and public recipes). No accounts exist, so a user = a device nickname.
