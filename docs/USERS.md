# Users: device, nickname, @handle, account

State at v367. Code: `api/_auth.js` (served as `/api/auth` through `api/circle.js`, `?via=auth`), `api/_index.js`, `api/_words.js`, `api/_wordlist.js`, `index.html` (`acc*`, `hd*` functions and keys).

## Three levels of identity
1. **Device (no account)**: every browser gets a random `owner` id (`localStorage owner`, sent as `x-owner`). Everything personal (recipes, favorites, ratings, shopping lists) lives on the device. The server stores only a hash of it: `pid = first 16 hex of sha256("circle|" + owner)`. Owner ids are never returned by the API.
2. **Nickname (pseudo)**: asked at the first opening, editable in « Mon cercle » (`cu:<pid>`). Checked by the offensive-name filter. Needed to be in a circle.
3. **Account** (optional): sign-in by e-mail. It adds a unique **@handle** and lets the same person find his data on another device. Without an account the app works as before.

## Access to the app
The app itself is protected by `APP_PASSWORD` (shared code) OR a personal invitation token (`/?k=<token>`, Redis hash `ak`). Friends get in through an invitation link from a member of the circle (3 new people per member, see `docs/CIRCLE.md`) or from the admin (`/api/moderation?key=<CRON_SECRET>&invite=<name>`). KEEP `APP_PASSWORD` set and private in Vercel.

## Sign-in by e-mail (v354)
- `POST /api/auth {act:'start', email, lang}`: e-mails a 6-digit code AND a magic link `/?login=<token>` through Resend, both valid 15 minutes. Needs app access and `x-owner`.
- `POST {act:'verify', email, code}` or `{act:'verify', token}`: opens a session. The session token (48 hex) is sent as `x-session`, valid 1 year, max 20 per account.
- Limits: 5 wrong codes = the code expires; 5 mails per address per hour; IP limits `rl:au:` 10/min, `rl:av:` 20/min.
- `GET ?me=1` (session) = e-mail + methods; `POST logout` / `logoutAll`; `GET ?providers=1`.
- The account is an internal uid (never the e-mail) and keeps the `owner` of its FIRST device. Signing in on another device returns that owner: the browser stores it and reloads, so pseudo, circle, ratings and publications (all keyed by `pid`) follow the person. If that device already had another pseudo, the app asks first; refusing logs the new session out.
- Google / Apple sign-in are PREPARED but off (`AUTH_GOOGLE`, `AUTH_APPLE` + client ids; `act:'oauth'` answers 501 `disabled`).
- Sender: `AUTH_FROM` → `MOD_FROM` → `onboarding@resend.dev`. LIMIT: without a domain verified in Resend, `onboarding@resend.dev` only delivers to the Resend account owner's address. Next step: verify a domain, then set `AUTH_FROM` in Vercel.

## Unique @handle (v355)
- Chosen right after the first sign-in (dialog « Choisis ton @identifiant », live check 350 ms after typing, « Disponible » / « Déjà pris »), also asked at opening for an account without one.
- Rules: 3–20 characters `a-z 0-9 _ .`, no dot at the ends, no « .. », reserved words refused (admin, support, chef, chefia, claude, moderation…). Reserved with `SET NX ah:<h>` → uid; `hp:<pid>` → handle. `GET /api/auth?handle=<h>` returns `{valid, free, suggest, bad}`.
- Shown in « Mon pseudo », member rows, activity, comments, profile, search.
- **Devices without account** (v359): the admin link `GET /api/moderation?key=<CRON_SECRET>&handles=1` (dry run) and `&handles=1&apply=1` give an @ to every nickname that has none, stored as `ah:<h>` → `p:<pid>` (device marker). Such a device can search and send circle requests. When that person later signs in, the @ moves to the account.

## Offensive-name filter (v356–v357)
`api/_words.js` `isOffensive()`: lower case, accents removed, look-alike signs turned into letters (`0→o 1→i 3→e 4→a 5→s 7→t 8→b @→a $→s`), repeated letters squeezed. Hand lists (`STRONG` anywhere, `WORDS` whole word only, `PHRASES` glued text, `ALLOW` food words never checked) + imported lists in `api/_wordlist.js` (5,781 words, whole words only; sources and licences in its header). Used on the @handle, the sign-in e-mail, the pseudo, the comment author name; `isOffensiveText()` for comment text. To block more words, edit the hand lists.

## People search (v358)
Only accounts / devices WITH an @ are findable. Index `api/_index.js`: sorted set `hx` (members `<key>|<pid>`: the @, the whole pseudo and each word), prefix search from 3 characters, 10 results, 30/min per IP. Searching and sending requests needs a session or a device @ (401 `session` otherwise).

## Sync across devices (v368)
Accounts only (header `x-session`); without an account nothing is sent and data stays on the device. Route `POST /api/sync` (`api/_sync.js`, served by `api/circle.js` with `?via=sync`, rewrite in `vercel.json`; still 12 functions).
- **Entities** (field `<kind>:<id>` of the Redis hash `sy:<uid>`, counter `sy:<uid>:c`): `r` recipe (favorites and stars live in its messages), `l` shopping list, `m` weekly menu, `c` circle map (`chefCirc`), `p` publication map, `f` preferences (v401: equipment, default servings, without gluten / lactose, diet, others) (`chefPub`). Value JSON `{u, t, d | x:1}` (`u` = client time of the change, `t` = server counter, `x` = deletion tombstone).
- **Rule**: last write wins per entity (the server keeps the newest `u`; an older edit can never bring back a deleted recipe). `POST {since, items}` stores the pushed items, then returns the items changed by other pushes after `since` (40 per page, `more`, new `since`). Limits: 120 items per push, 400 KB per item, 3000 fields per account (413 `full`), 60 calls/min per IP.
- **Client** (`index.html`, block « v368: SYNC »): each entity is hashed; a hash different from the last synced one = changed, pushed with `u` = now; a key known as synced and gone locally = deletion. State in `localStorage chefSync` (`since`, `h`, `mail`; reset when another account signs in). Own pictures over 150 KB are not sent and the local one is kept. A new, empty singleton (menu, maps) is never pushed over the remote one. More than 10 deletions that are over half the known keys are refused (storage read error guard). The entry open in the chat is not overwritten.
- **Triggers**: 3.5 s after start, return to the app, 4 s after any local save (`syncSoon()` called by `saveH`, `saveLists`, `saveMenu`, `circSave`, `pubSave`), after sign-in, and the drawer row « Synchroniser maintenant » (last sync time shown).
- **Known limits**: the automatic 50-recipe trimming of `saveH` counts as a deletion for the other devices; two devices editing the same recipe at once keep the later one; ratings are server-side by version key already (shared); iOS install still off.

## Deletion of inactive accounts (v511)
Promised in `legal.html` (2 years without activity, warning e-mail first). Code: `api/_inactive.js` (not a route), served by `api/moderation.js` with `&inactive=1`.

- **Activity** = any request carrying a valid session (`sessUid` in `api/_lib.js`, one write per account, instance and day) or any sign-in (`openSession`). Redis: zset `ax:act` (uid → last activity), hash `ax:rem` (uid → date of the warning e-mail), hash `ax:lang` (uid → language of the e-mails), flag `ax:bf`. Any activity removes the warning (`ax:rem`) and restarts the clock.
- **Backfill (once)**: accounts created before v511 get their creation date as starting point. Only a real run (`&run=1` or the cron) writes it and sets `ax:bf`; a dry run counts them and writes nothing, so it keeps showing the same `backfilled` until the first real run.
- **Rules**: at 700 days without activity ONE warning e-mail (Resend, `AUTH_FROM` / `MOD_FROM`, 6 languages, deletion date = +30 days). At 730 days the account is erased, only if the warning was sent at least 29 days earlier and nothing happened since. No warning sent (no `RESEND_API_KEY`, send error, no e-mail on the account) = no deletion. Limits per run: 50 warnings, 20 erasures. A run stopped halfway is simply redone the next day (the account record is deleted last).
- **Modes**: `GET /api/moderation?key=<ADMIN_KEY>&inactive=1` = dry run (answer: `dry`, `backfilled`, `orphans`, `toWarn`, `warned`, `mailFailed`, `toErase`, `erased`, `anonymised`, `comments`, `ratings`, `details`; no e-mail address in it); `&inactive=1&run=1` does it. The daily cron (`30 3 * * *` UTC in `vercel.json`) calls the real run with `Authorization: Bearer <CRON_SECRET>`.
- **Erased**: account, e-mail, @handle, pseudo, sessions, synced data (`sy:`), quota, circle / family / follows (the other side forgets the person), shopping lists (own ones deleted, shared ones just lose the member), search index, notifications, comments and ratings (found by SCAN of `c:*`, `r:*`, `rc:*`, `rt:*`, `ra:*`), circle / link copies `s:<sid>` listed in `cp:<pid>`.
- **Kept, anonymised**: published recipes `s:pub-…` (`by`, `bp`, `o` blanked; `og` = original author is untouched). A person can ask for their removal at contact@cheffeevalie.com (`legal.html`); removal is manual (`/api/publish?key=<ADMIN_KEY>&remove=<pub sid>`).
- **Known limit**: a copy shared by link but never put in the circle nor published is listed nowhere and stays (it holds the old device key, not the e-mail). Nothing can be erased before about the end of 2028 (the accounts are recent).
- **Not covered**: a button « Supprimer mon compte » in the app (today: write to contact@cheffeevalie.com, answered within one month); an account with no e-mail is never warned, so never erased.

## Redis keys
`ae:<h(email)>` → uid, `au:<uid>` JSON `{e,o,at,m,h}`, `al:` link, `ac:` code, `as:` session → uid, `aS:<uid>` sessions, `am:` mail counter, `sy:<uid>` / `sy:<uid>:c` synced data (v368), `ah:<handle>` → uid or `p:<pid>`, `hp:<pid>` → handle, `cu:<pid>` pseudo, `hx` / `hxn:<pid>` search index, `ak` invitation tokens, `ai:<pid>` access given. Reserved: `ap:<provider>:<sub>`. Inactive accounts (v511): `ax:act`, `ax:rem`, `ax:lang`, `ax:bf`.

## Admin links (`ADMIN_KEY` since v502, falls back to `CRON_SECRET` when unset)
`GET /api/moderation?key=<ADMIN_KEY>` with `&stats=1` (counts), `&invite=<name>`, `&invites=1`, `&revoke=`, `&handles=1[&apply=1]`, `&creports=1`, `&cok=`, `&cdel=`, `&cunban=`, `&unblock=`, `&grant=<uid>&n=`, `&inactive=1[&run=1]`. Crons use `Authorization: Bearer <CRON_SECRET>`.

## Not done
- A « famille » status to share the shopping list.
- Changing the @ from the interface (the server supports it).
- Account deletion from the interface (« Supprimer mon compte » button). Automatic deletion of inactive accounts exists since v511.
