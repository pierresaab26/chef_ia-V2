# TOOLS — every tool and service used by CheffeEvalie

**Standing rule (owner's request, 2026-11-17):** whenever a NEW tool, service, library or tool-like process is introduced in this project, add it here in the same session (name, what for, since when, where it lives, secret NAMES only). When the owner asks « quels outils on utilise », answer from this file, in French, as a short list. Never put secret values here (the repo may be public).

Columns: **Tool** · what it is used for · since · where / how.

## Hosting, code, deployment
| Tool | Used for | Since | Where / how |
|---|---|---|---|
| GitHub (`pierresaab26/chef_ia-V2`) | source code, history | start | `main` branch; push ONLY on the owner's explicit « pousse » |
| Vercel (project `chef_ia-v3`, site chefia-v3.vercel.app) | hosting + serverless functions + cron | start | auto-deploys `main`; `vercel.json` (rewrites, crons); env variables set in the Vercel dashboard |
| Custom domain `chefia.vestoria.fr` | future production domain | 2026-11-16 | to be attached in Vercel + Resend sender (not done yet) |

## Front end
| Tool | Used for | Since | Where / how |
|---|---|---|---|
| Vanilla JS, single `index.html` (no build, no framework) | the whole app UI, 6-language i18n dictionary | start | `index.html` |
| PWA: `manifest.webmanifest` + service worker `sw.js` | install on home screen, offline page | v33x | `docs/PWA.md` |
| `localStorage` | recipes, preferences, device code | start | keys `chefStore`, `chefPrefs`, `lang`, `code`… |
| `qrcode.js` | QR codes (share / invite) | | repo root |

## Back end and data
| Tool | Used for | Since | Where / how |
|---|---|---|---|
| Node.js serverless functions | the API | start | `api/*.js` (files starting with `_` are shared helpers) |
| Upstash Redis | comments, ratings, circles, accounts, shared recipes | start | env `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) |
| Vercel cron | seasonal ideas refresh, daily jobs | v76+ | `vercel.json`, protected by `CRON_SECRET` |

## AI
| Tool | Used for | Since | Where / how |
|---|---|---|---|
| Anthropic API (Claude Haiku) | chef chat, recipe generation, import, vision, moderation check | start | env `ANTHROPIC_API_KEY`, `MODEL`, `EXTRACT_MODEL`, `VISION_MODEL`; `api/chat.js`, `api/import-*.js` |
| Claude (assistant) in claude.ai / Claude Code | developing the app, reviewing, running tests | start | `CLAUDE.md` has the working rules |

## E-mail, accounts, anti-abuse
| Tool | Used for | Since | Where / how |
|---|---|---|---|
| Resend | magic-link sign-in e-mails, moderation and support alerts | v354 (2026-11-13) | env `RESEND_API_KEY`, `AUTH_FROM`, `MOD_FROM`, `MOD_EMAIL`, `SUPPORT_EMAIL` |
| Cloudflare Turnstile | bot check before each photo / link import | v343 | env `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` |
| Bad-words word lists | block offensive pseudos, @handles, sign-in e-mails | v35x | `api/_wordlist.js`, `api/_words.js` |

## Images
| Tool | Used for | Since | Where / how |
|---|---|---|---|
| Unsplash API | one real photo per recipe (photographer credited) | 2026-11-03 | env `UNSPLASH_ACCESS_KEY`; replaced the abandoned Pexels attempt (v109) |

## Monitoring, analytics, consent
| Tool | Used for | Since | Where / how |
|---|---|---|---|
| Sentry (EU, project `cheffeevalie`) | JS error monitoring on Android + iOS, e-mail alerts | v439/v440 (2026-11-17) | self-hosted bundle `/sentry.js` (@sentry/browser 11.13, built with esbuild); DSN is public in `index.html`; loads ONLY after cookie consent; GitHub tickets are manual (automatic creation needs a Business plan) |
| tarteaucitron.js 1.37.0 | cookie / consent banner, panel reopened from the drawer | v441 (2026-11-17) | self-hosted in `/tarteaucitron/` (services file is an empty stub on purpose) |
| PostHog (EU) | product analytics events (`track()`) | before v400 | `index.html` loader, EU hosts, localStorage persistence |

## Build, test, preview
| Tool | Used for | Since | Where / how |
|---|---|---|---|
| Playwright (Chromium, Python) | visual and behaviour tests at iPhone SE 375 / iPhone 13 390 / iPad 820, fr-FR locale | start | test scripts live outside the repo (`/tmp`), they are re-created per version |
| `node --check` / `new Function` | syntax check of `api/*.js` and the inline script | start | before each commit |
| `python3 -m http.server` | local static server for tests | start | |
| npm + esbuild | build the Sentry bundle (not part of the app build) | v439 | rebuild instructions in `CLAUDE.md` v439 |
| Selftests + « 55 questions cuisine » bench | quality / scope check of the chef in 6 languages | 2026-11-05 | `api/selftest.js`, `api/_selftest-*.js`; one language per day |
| claude.ai preview artifact | hand-over preview after every version | v101 | artifact `bf41de95-964c-4f84-b883-7200cc54b03e` |

## Process and reminders
| Tool | Used for | Since | Where / how |
|---|---|---|---|
| `CLAUDE.md` + `docs/FEATURES.md` | project memory, one entry per version | start | repo |
| Scheduled tasks (Claude) | reminders: Tue/Fri 18:43 (Sentry, privacy text, Android bug), one-off reminders in the chat | 2026-11-17 | managed from the Claude app |
| Owner's devices | iPhone 13 (iOS) with Brave, a tablet, a computer | | real-device checks and screenshots |

## Planned / decided but not built
- Capacitor (store apps): only later, after the business model is decided.
- Google / Apple sign-in: prepared in code, not active.
- Privacy policy, terms (CGU) and legal notices pages: to be written (reminder set for 2026-11-18).
- Android comment bug: waiting for the exact symptom and browser.

## Google Tag Manager (v462)
- Purpose: one container for the Meta (Instagram) and TikTok pixels, managed at tagmanager.google.com.
- Where: `GTM_ID` and `gtmStart()` in `index.html`; consent service `gtm` in `ckInit()` (tarteaucitron).
- Status: inert while `GTM_ID` is empty. Loads only after consent (cookie banner). Tags can use the normal « Initialization – All Pages » trigger. Container: GTM-PSJRZ6F8 (v468).
- Data: IP, device/browser, page, referrer (sent by the tags). No names, e-mails or recipe content.
- Legal: `legal.html` sections 3 and 4 (consent basis, recipients Google/Meta/TikTok).

- v469: consent by category with Google Consent Mode v2 (`gtmEnsure`, `gtmConsent`, services `gtmaud` / `gtmads`). For Meta/TikTok tags in GTM: Advanced settings → Consent settings → « Require additional consent » → `ad_storage`.


## Meta Pixel (v489)
Hard-coded in `index.html` (`META_PIXEL_ID`, `metaPixelLoad()`), loaded only after consent to the « Publicité » category (service `gtmads`). Events: `PageView` only. No `<noscript>` image (no tracking without consent). Do not duplicate it in GTM.

## TikTok Pixel (v490)
Hard-coded in `index.html` (`TT_PIXEL_ID`, `ttPixelLoad()`), loaded only after consent to the « Publicité » category (service `gtmads`, right after Meta). Event: `page` only. Do NOT also add a TikTok tag in GTM.
