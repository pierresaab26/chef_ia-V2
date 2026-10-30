# Chef IA

A personal AI cooking assistant: chat with virtual chefs, import a recipe from a photo or a link, adapt it, save it, favorite it, rate it and share it.
Front end: a single `index.html` (vanilla JS, 6 interface languages: fr, en, es, de, it, pt). Back end: Vercel serverless functions in `api/`.

## Files

| File | Role |
|---|---|
| `index.html` | The whole app (interface, recipe cards, history, favorites, ratings, import) |
| `api/chat.js` | Chat with the chef. Holds the chef instructions (scope, recipe format, language rule) |
| `api/import-photo.js` | Extracts a recipe from a photo (vision model) |
| `api/import-link.js` | Extracts a recipe from a web page (structured data first, then the model) |
| `api/comments.js` | Recipe comments (Upstash Redis) |
| `api/ratings.js` | 1 to 5 star ratings (Upstash Redis) + a log for later analysis |
| `api/_lib.js`, `api/_page.js` | Shared helpers (files starting with `_` are not routes) |
| `vercel.json` | Function settings (60 s max duration) |

## Setup on Vercel

1. Push this repository to GitHub and import it in Vercel. Every commit on `main` redeploys automatically.
2. Add these environment variables (Settings → Environment Variables), then redeploy:
   - `ANTHROPIC_API_KEY` (required): your Anthropic API key. It stays on the server and is never sent to the browser.
   - `APP_PASSWORD` (recommended): an access code. Without the right code, the API does not answer, which protects your credit.
   - `MODEL` (optional): chat model. Default `claude-haiku-5-5`.
   - `VISION_MODEL` (optional): photo import model. Default `claude-haiku-5-5`.
   - `EXTRACT_MODEL` (optional): link import model. Default `MODEL`, then `claude-haiku-5-5`.
3. Comments and ratings need an Upstash Redis database (Vercel → Storage → Upstash). The `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables are added automatically. Without it, the app still works; comments are disabled and ratings stay on the device.
4. Set a monthly spend limit at https://platform.claude.com/settings/billing.

## Cost

With Claude Haiku 5.5 ($0.10 / $0.50 per million input / output tokens), one recipe costs about $0.001, so $1 pays for roughly a thousand recipes.

## Features

- Chat with the chef (food and drink only), plus three chef personas.
- Import from a photo or a public web page. Only what is actually written in the source is extracted; nothing is invented.
- Replace a missing ingredient: tap the circle to cross it out, then start a new recipe without it. The original recipe and its favorite stay untouched.
- Recipe card, history, favorites, sharing, comments, 1–5 star ratings.
- Dish illustrations are drawn in code (they are not photos); tap one to set your own photo or an image link.
- Cut-off answers are detected and completed automatically.

## Security notes

- Link import blocks private and internal addresses (SSRF protection), limits redirects, size and time.
- API keys are read only on the server. The access code is checked on every API call when `APP_PASSWORD` is set.

## Ratings and learning

Every rating is appended to a log in Redis (`r:log`: title, stars, language, date; up to 5,000 entries). The app does not learn by itself: the log is the raw material to analyse later what people like and to adjust the chef instructions in `api/chat.js`.
