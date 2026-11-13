# Circle, publishing, follow, notifications

State at v367. Code: `api/circle.js` (circle, follow, notifications, invitations), `api/_publish.js` (served as `/api/publish` through `api/circle.js`, `?via=pub`), `api/_notify.js`, `api/shared.js`, `api/comments.js`, `index.html` (`drawCircle()`, `visBtn()`, `profOpen()`…). Hobby plan: 12 routes maximum, so no new route: merge into an existing one.

## Concepts
- **Circle**: ONE circle per person. Joining is mutual (you are in the other's circle and he in yours), max 50 people. Members see the recipes each other put in « Cercle ».
- **Visibility of each recipe version**: 🔒 Privée (default) / 👥 Cercle / 🌍 Publique (chip on the recipe card, dialog of 3 choices; state in `localStorage chefCirc` and `chefPub`, refreshed from the server).
- **Public**: published recipes are searchable by everybody (home box, panel « Recette de la communauté »). A shared link (`/?s=`) or a circle post is NEVER public.
- **Follow**: you can follow an author without being in his circle. Following gives access ONLY to what he published, never to his circle recipes.

## « Mon cercle » screen
One white card with a header (« Inviter ») and 4 tabs:
- **Recettes**: the circle feed (photo, title, « Par X », « Nouveau », « Enregistrer » / « ✓ Enregistrée », rating count). 🔄 Actualiser.
- **Activité**: notifications. A row that points to a recipe is clickable with « Voir la recette → » or « Voir le commentaire → » (mentions: the page scrolls to the comment and rings it in pink for ~3 s). Pink dot on the tab and the ☰ for unread ones.
- **Suivis**: authors I follow + their latest published recipes.
- **Membres**: « Mon pseudo » (✏️ Modifier, ▦ QR), « Demandes reçues » (Accepter / Refuser), « Rechercher un ami », members (✕ to remove, mutual, with confirmation).
Tapping a name, an @ or a result opens the **profile page** (avatar, name, @, followers, « Suivre » / « ✓ Abonné », published recipes).

## Ways to join a circle
1. **Invitation link** `/?c=<code>` (« Inviter un ami »; code in Redis `ci:<code>` → pid, 7 days). Opening it asks the nickname if missing and joins at once (own link refused, circle full 409).
2. **QR code** of the same link (`qrcode.js`, qrcode-generator 2.0.4, MIT, loaded on demand), « Partager » where the browser has a share menu.
3. **Search + request** (v358): find a person by pseudo or @ (accounts / devices with an @ only), send a request (20 a day, `crq:`), the other accepts or declines (silent). If both asked each other, they join at once.
On a computer the invite block offers « Copier le lien » and « Partager ».

## Letting a friend into the app
The same invitation link lets a person WITHOUT access in: `POST /api/circle {act:'redeem', code}` is the only call accepted without access. Someone who already has the app costs nothing and is unlimited. A new person gets a personal token (table `ak`) counted on the inviter's quota `ai:<pid>`: 3 new people per member (409 `limit` above, toast). The admin can also create / list / revoke links.

## Putting a recipe in the circle
`act:post` lists the shared copy `s:<sid>` in `cp:<pid>` (zset, 100 max; only its author can list it); `act:unpost` removes it. Members read `GET ?feed=1` (60 newest; a copy deleted by its author drops out). The first time a recipe goes « Cercle » the members get a notification.
- **Received recipes**: a friend who saved a circle recipe keeps it in his cookbook with the badge « 📨 Reçue de Marie » (« plus partagée » once nobody lists it any more). He can put it in HIS circle (root copy `rs`, original author `by`): feed rows read « par Marie · recette de Pierre ». A re-share is only shown while its root copy is still listed by its author. Comments are the same discussion (same comment key); when the author stops sharing, comments become read-only for receivers.

## Publishing (« 🌍 Publique », v291+)
- Only the author of the shared copy. Needs « J'ai cuisiné » or a rating on that version (409 `cook`). A recipe received from someone cannot be published by the receiver (403 `notowner`): he can share it with his circle; his own later versions go through the « remix » check.
- The chef (model) checks food / complete / safe and, with a parent, remix vs simple adjustment. Accepted: a FROZEN public copy `s:pub-<sid>` (with `pub:1`, `by`, `og`, `src`, `bp` = publisher pid), listed in the index `pub:ck`, state `pb:<sid>`. Refused: the reason is shown with « Faire appel » → queue `pub:queue`.
- Moderator e-mail for every appeal (`&review=<sid>` page with a comment field, « Publier » / « Laisser refusée »; the note goes to the author's notification). A public recipe hidden after 3 reports gets one e-mail with « Remettre en ligne » / « Retirer ». Admin links: `GET /api/publish?key=<CRON_SECRET>` (+ `&approve=`, `&reject=`, `&restore=`, `&remove=`, `&review=`).
- Reports: « 🚩 Signaler » on a recipe saved from the community (once per person, not the author); 3 reports hide it until reviewed.
- Followers get a `fpub` notification when an author publishes (circle members already get `pub`).

## Community search
`GET /api/shared?q=&lang=`: public index only, ranked by the weighted score (`api/_score.js`: Bayesian average `(n·avg + 5·3.5)/(n+5)` + a share bonus capped at 0.5; one card per dish; « Recommandée » = 5+ votes and quality ≥ 4.2). Each result carries author `by`, `bh` (@), `mine`. The home panel shows up to 4.

## Comments
- Shared comments per recipe version (`c:<key>`), editable by their author. Offensive text is refused (`badword`).
- **@mentions** (v360): up to 5 handles per new comment, notification `men` (30 a day per author), with the recipe `sid` and the comment id `cid` (v366).
- **Reports** (v361): « 🚩 Signaler » on others' comments, 4 reasons, one report per person and comment. At 3 reports the comment is hidden for everybody but its author (« En cours de vérification ») and the moderator gets an e-mail; the AUTHOR gets a warning notification at 3 reports in total and cannot comment any more at 10 (`cbk:<pid>`, 403 `cbanned`).

## Notifications
`cn:<pid>` (50 kept, 30 days), `cnr:<pid>` = last opened. Kinds: `circle`, `pub`, `fpub`, `appok`, `appno`, `req`, `reqok`, `men`, `cwarn`, `cban`. `GET /api/circle?notes=1`, `POST {act:'seen'}`. The drawer shows the unread count next to « Mon cercle ».

## Redis keys
`cu:` pseudo, `cf:<pid>` circle members, `ci:<code>` invitation, `cp:<pid>` circle posts, `cn:` / `cnr:` notifications, `cr:<pid>` pending requests (30 days), `crq:` request counter, `fo:` / `fw:` following / followers, `pp:<pid>` + `ppb:` published recipes of an author, `ak` / `ai:` access tokens / quota, `s:<sid>` shared copies, `pub:ck`, `pb:`, `pub:queue`, `pub:rep:`, `crp:` / `cra:` / `cbk:` / `cmq` comment reports. Rate limits: `rl:ci:` 40/min, `rl:cs:` 30/min, `rl:cp:` 40/min, `rl:rd:` 10/min.

## Family and shared shopping lists (v369)
- **Family status** (accounts / devices with an @ only): in « Mon cercle → Membres » each circle member has « 👨‍👩‍👧 Ajouter à ma famille » (`fam_ask`). The target must already be in my circle and have an @. The recipient sees « Demandes famille » (Accepter / Refuser = `fam_accept` / `fam_decline`) and a notification (`famreq`; `famok` when accepted; if both asked, linked at once). The link is mutual, shown as « · 👨‍👩‍👧 Famille » and removed with « Retirer de ma famille » (`fam_remove`, which also closes list sharing between the two). Redis: `fm:<pid>` (family set), `fq:<pid>` (pending requests, 30 days). `GET /api/circle` (whoami) returns `fam` and `famreqs`. Limits 30 family members, 20 requests/min per IP.
- **Shared list**: in a list detail « 👨‍👩‍👧 Partager avec ma famille » opens a dialog with the family members (all ticked); only family members can be chosen (403 `family`). All members edit. Server `api/_family.js` (served by `api/circle.js`, no new route): `sl:<id>` JSON `{id,o,name,nts,items:[{k,i,ts}],gone:{k:ts},v,m:[pids]}`, `sm:<pid>` = lists I am in. Items are merged ONE BY ONE (key = lower-case text, newest `ts` wins, `gone` tombstones stop an old copy from bringing a deleted item back), every change bumps `v`. Acts: `sl_share`, `sl_sync` (send changed items + deleted keys + rename, get the full state back), `sl_leave` (a member leaves; the owner ends the list for everybody); `GET ?sls=1` (my lists) and `GET ?sl=<id>&v=<n>` (`{same:true}` if unchanged). Limits: 300 items, 8 members, 30 lists. These routes have their own per-IP limit (600/min, `rl:sh:`) because family phones share a home IP and poll every 2.5 s.
- **Client** (`index.html`, block « v369: SHARED SHOPPING LISTS »): a shared list carries `l.sh={v,o,m}` (version, I am the owner, member names) and `shBase` (localStorage `chefShBase`: hash per item at the last sync, used to find what changed). A change is sent 250 ms after `saveLists()`; while the shop view is open the list is checked every 2.5 s (all shared lists every 10 s elsewhere); new lists shared with me are discovered every 10 s (`shDiscover`) and created locally; the screen is redrawn only when something changed and the text typed in the add field is kept. Shared lists are EXCLUDED from the account sync (v368). Notifications `slsh` (« X a partagé la liste … avec toi »). Deleting a shared list calls `sl_leave`; when the owner stops, the others keep a copy that is no longer synced (« Le partage de … est terminé »).
- Not done: partial sharing of one list per person, history of who ticked what, push notification when a list changes.

## Not done
- Chef proposes published recipes when asked for a dish in the chat (option 2).
- Ratings / comment counts on the circle feed rows.
- Read-only comments are enforced in the browser only.
- Not tested on the real Redis for v355–v363.

**v370:** the server, not the clients' clocks, orders the changes of a shared list: every item / deletion received is stamped with the server time and the last one received wins (a phone with a wrong clock no longer loses its edits).
