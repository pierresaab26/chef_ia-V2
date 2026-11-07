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

**Import (v-early, shared with the chat 📎).** Entry points: the « Importer une recette » card on the home screen and the 📎 button of the chat (the left-menu entry was removed in v108: it duplicated the home card). Photo (camera or gallery) → `api/import-photo.js` (vision model); web link → `api/import-link.js` (structured data first, then the model; `api/_page.js` blocks private addresses, limits redirects, size and time). Limits per IP: photos 6/min (`rl:ip:`), links 10/min (`rl:il:`). No fake import: if extraction fails the user sees an error.

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
Every Sunday at 9:00 (Paris) the chef proposes the SAME weekly menu to everybody: 21 dish names (Monday…Sunday × starter, main, dessert), generated once per week on the first request (`GET /api/week-menu?lang=…`, `api/week-menu.js` + helpers in `api/_week.js`, Redis key `wm:<lang>:<week>`, no cron; the previous week's dishes are excluded). Only names are generated: tapping a dish opens the chat with « Give me the full recipe of … » and the new recipe fills that slot (`menuPend`/`menuAssign`). ✎ on a suggested slot opens the usual « pick one of my recipes / ask the chef » dialog; a slot filled by the user is never replaced. The toggle « The chef suggests the weekly menu » (`chefMenu.auto`, default on) hides the suggestions. The app keeps the menu in `chefMenuSug` until the next Sunday 9:00. Without Redis the route answers 501 and the menu works as before (manual).
(v239) The chef's requests for the weekly menu and the seasonal ideas now say explicitly in which language to write (`langRule` in api/_season.js); the weekly menu keys moved to `wm2:` and the app cache to v2 so English menus are regenerated.
(v240) Each suggested slot shows two visible round buttons: 🔄 « Another idea » (asks the chef for one other dish for that course, kept on this device in `chefMenuSug`) and ✏️ « Pick my own ».
(v241) Weekly menu redesigned as plain rows (label · dish · ⋯ menu): tap the dish to generate the recipe; ⋯ = another idea / pick my own / remove (a removed suggestion is remembered in `chefMenu.hid` for that week). Filled slots show a green ✓.
(v242) The « Others » card of the weekly menu was removed (only the 7 days remain).
