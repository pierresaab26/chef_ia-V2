# SEO (v512): being found on Google and by AI assistants

**Goal**: someone who types « recette » finds the app and sees that the recipe can be personalised (gluten-free, vegan, faster, for 2 or 8…).

## What exists
| Address | What it is | Code |
|---|---|---|
| `/` | The app. Head now has title, description, canonical, Open Graph, JSON-LD (`WebSite`, `WebApplication`) and a visually hidden intro (`.seo`: h1, paragraph, links to `/recettes` and `/legal`, NOT `display:none`). | `index.html` |
| `/recettes` | Hub: list of the PUBLISHED recipes (JSON-LD `CollectionPage` + `ItemList`), with the « personalise it » message. | `api/_seo.js` `hub()` |
| `/recette/<slug>--<id>` | One public recipe, server-rendered: photo + credit, ingredients, utensils, steps, chef's tip, rating, button « Personnaliser cette recette » → `/?s=<id>`; JSON-LD `Recipe` (ingredients, steps, times, yield, rating, image). 6 languages (page language = recipe language). | `api/_seo.js` `recipe()` |
| `/sitemap.xml` | Home, hub, legal, every public recipe (with `lastmod`). | `api/_seo.js` `sitemap()` |
| `/robots.txt`, `/llms.txt` | Everything allowed except `/api/` and `/l/`; sitemap address; plain description for AI assistants. | repo root |

Routes: no new function (still 12). `vercel.json` rewrites `/recettes`, `/recette/:slug`, `/sitemap.xml` to `/api/shared?seo=…`, handled by `seoHandler()` (`api/_seo.js`, a helper). 120 requests / minute / IP (`rl:seo:`), answers cached 1 h at the CDN (`s-maxage=3600`).

## Rules
- ONLY public copies (`s:pub-…` with `pub:1`, still listed in the index `pub:ck`) get a page. A copy shared by link or in a circle, a hidden or removed recipe, or a text that is not a complete recipe (≥ 2 ingredients and ≥ 1 step) → 404 with `noindex`. The wrong slug is redirected (301) to the right one. Removing a recipe (`/api/publish?…&remove=`) or hiding it after 3 reports removes its page after the cache expires.
- The author's name / @ is NOT shown; structured data says « Communauté CheffeEvalie ». After an account is deleted (v511) the page stays, anonymous; the person can ask for its removal (contact@).
- Everything coming from a recipe is HTML-escaped; JSON-LD is escaped (`<` → `<`); only `images.unsplash.com` pictures and `unsplash.com` credit links are used.
- Private previews `/r/<sid>` and `/q/<id>` are `noindex`; `/l/<code>` was already. `chefia-v3.vercel.app` answers `X-Robots-Tag: noindex` (the canonical site is `https://www.cheffeevalie.com`, constant in `api/_seo.js`, override with the env var `SEO_BASE`).
- Recipe text is read by `parseRecipe()` (format of `api/chat.js`: `## Title`, `Servings` / `Prep` / `Rest` / `Cook` lines, `## Ingredients`, `## Utensils`, `## Preparation`, `## Chef's tip`; 6 languages). If the chef's format changes, update this parser.

`legal.html` (Contenus publiés, Données collectées) says that a public recipe has a public web page, may be indexed by search engines and read by AI assistants, without name or @.

## Not done / to do by the owner
- Google Search Console: add the property `https://www.cheffeevalie.com`, submit `https://www.cheffeevalie.com/sitemap.xml`, then « inspect URL » on `/recettes` and one recipe page; check « Rich results » for `Recipe`. Bing Webmaster Tools: import from Search Console.
- Domain: make `cheffeevalie.com` (without www) redirect to `https://www.cheffeevalie.com` in Vercel → Domains (otherwise duplicate pages).
- A real 1200×630 share image (today the 512 px icon is used for Open Graph).
- The app itself is JavaScript with one address: the public recipe pages are what can rank for « recette … ». More public recipes = more pages; nothing is invented. Pages for categories (« recette sans gluten ») would need more published recipes first.
- Titles and descriptions of the home page are in French only.
