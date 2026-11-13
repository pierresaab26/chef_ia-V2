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
- **Entities** (field `<kind>:<id>` of the Redis hash `sy:<uid>`, counter `sy:<uid>:c`): `r` recipe (favorites and stars live in its messages), `l` shopping list, `m` weekly menu, `c` circle map (`chefCirc`), `p` publication map (`chefPub`). Value JSON `{u, t, d | x:1}` (`u` = client time of the change, `t` = server counter, `x` = deletion tombstone).
- **Rule**: last write wins per entity (the server keeps the newest `u`; an older edit can never bring back a deleted recipe). `POST {since, items}` stores the pushed items, then returns the items changed by other pushes after `since` (40 per page, `more`, new `since`). Limits: 120 items per push, 400 KB per item, 3000 fields per account (413 `full`), 60 calls/min per IP.
- **Client** (`index.html`, block « v368: SYNC »): each entity is hashed; a hash different from the last synced one = changed, pushed with `u` = now; a key known as synced and gone locally = deletion. State in `localStorage chefSync` (`since`, `h`, `mail`; reset when another account signs in). Own pictures over 150 KB are not sent and the local one is kept. A new, empty singleton (menu, maps) is never pushed over the remote one. More than 10 deletions that are over half the known keys are refused (storage read error guard). The entry open in the chat is not overwritten.
- **Triggers**: 3.5 s after start, return to the app, 4 s after any local save (`syncSoon()` called by `saveH`, `saveLists`, `saveMenu`, `circSave`, `pubSave`), after sign-in, and the drawer row « Synchroniser maintenant » (last sync time shown).
- **Known limits**: the automatic 50-recipe trimming of `saveH` counts as a deletion for the other devices; two devices editing the same recipe at once keep the later one; ratings are server-side by version key already (shared); iOS install still off.

## Redis keys
`ae:<h(email)>` → uid, `au:<uid>` JSON `{e,o,at,m,h}`, `al:` link, `ac:` code, `as:` session → uid, `aS:<uid>` sessions, `am:` mail counter, `sy:<uid>` / `sy:<uid>:c` synced data (v368), `ah:<handle>` → uid or `p:<pid>`, `hp:<pid>` → handle, `cu:<pid>` pseudo, `hx` / `hxn:<pid>` search index, `ak` invitation tokens, `ai:<pid>` access given. Reserved: `ap:<provider>:<sub>`.

## Admin links (`CRON_SECRET`)
`GET /api/moderation?key=<CRON_SECRET>` with `&stats=1` (counts), `&invite=<name>`, `&invites=1`, `&revoke=`, `&handles=1[&apply=1]`, `&creports=1`, `&cok=`, `&cdel=`, `&cunban=`, `&unblock=`.

## Not done
- A « famille » status to share the shopping list.
- Changing the @ from the interface (the server supports it).
- Account deletion from the interface.
