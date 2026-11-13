# PWA (installable app, offline copy)

State at v367. Code: `manifest.webmanifest`, `sw.js`, `icons/`, the head of `index.html`, the install code at the end of the script (`a2*` functions).

## What it is
Chef IA is a web app that can be added to the home screen and opened like an app (full screen, own icon). It is **step 1** of the PWA plan: installable + an offline copy of the app itself. Data is still device-only (see `docs/USERS.md` for accounts); there is no sync yet.

## Files
| File | Role |
|---|---|
| `manifest.webmanifest` | name « Chef IA », `display: standalone`, `start_url` and `scope` `/`, cream colours (`#fffaf2`), icons 192 / 512 (+ maskable), `id`, `lang`, `categories` |
| `icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | the mascot on its lavender square (rendered from the SVG symbol) |
| `sw.js` | service worker (v353), see below |
| `index.html` head | manifest link, `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-*` metas |

## Service worker (`sw.js`)
- **Pages** (navigations to `/` and any query such as `/?c=`, `/?s=`, `/?q=`, `/?k=`, `/?login=`): NETWORK FIRST with a 6 s timeout. Every good answer refreshes the copy kept in cache `chef-ia-shell` under `/`. Offline or too slow: that copy is served. Other pages (not the app) show a short « Pas de connexion » page.
- **Icons and manifest**: stale-while-revalidate.
- **`/api/*`, non-GET and cross-origin requests**: never touched, never cached. Data is always live.
- No version coupling: the cache is refreshed on every successful page load; old caches are deleted on `activate`; `skipWaiting` + `clients.claim`.
- Not registered in the claude.ai preview.

## Install offer
- **Android** (Chrome / Edge / Samsung Internet, when the browser says the app is installable and not installed: `beforeinstallprompt`): a thin pop-up at the bottom (`#a2pop`: mascot, « Installe Chef IA sur ton téléphone », « Installer », ✕), shown 2.5 s after the event, above the bottom bar, hidden while typing and on the recipe card. ✕ or a refused install: asked again after 3 days (`localStorage a2Hide`, `A2_WAIT`). Accepted: toast, pop-up and drawer row gone. The drawer row « 📲 Ajouter à l’écran d’accueil » (`#dA2hs`) stays while installable.
- **iOS / iPadOS**: NO offer and no instruction dialog (decided in v296), because the home-screen app has its own storage: recipes saved in Safari would not appear in it (data is device-only). Revisit once accounts sync the data.
- Firefox never offers installation.

## Updates
- Opening the app always loads the newest version when online (network first).
- The app checks for a newer `APP_VERSION` at local midnight and when reopened on a new day (v328): it reloads only if nobody is typing, no dialog is open and the chef is not answering.
- A user on an old version just closes the tab / app completely and reopens it.

## Limits
- Unsplash photos and other remote images are NOT cached (offline they do not show).
- Chat, imports, the circle, sign-in need the network.
- Not tested on a real iPhone (Chromium emulation only).

## Next steps (not done)
- Sync of cookbook / favorites / ratings / shopping lists through the account, then the iOS install offer.
- Web push notifications (not started).
