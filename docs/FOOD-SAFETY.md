# FOOD-SAFETY — reference grid for the chef's publication check (DRAFT, not yet in the code)

Status: **draft written on 2026-11-17 from public sources; must be reviewed by a competent person (food-safety professional) before it drives refusals.** The assistant that wrote it is not a food-safety expert. Where sources disagree the table says so and picks the most protective reasonable value; the owner decides.

Purpose: replace the single vague sentence of `SYS` in `api/_publish.js` (« safe: no dangerous practice… ») by explicit rules, three outcomes instead of two, and a category on every decision (needed for alerts).

## Outcomes
- **OK**: nothing to say.
- **WARN**: accepted; the app adds a standard health notice to the recipe (and tags the decision `warn`).
- **REFUSE**: really dangerous as written; the author can appeal (existing flow). Tagged `block`.

Sensitive groups (ANSES / ministry wording): pregnant women, children under 5 (under 1 for honey), older people, immunocompromised people.

## Grid

| Cat. | Rule | Value / source | Outcome proposal |
|---|---|---|---|
| `poultry` | Chicken, turkey, duck cooked to the core | ANSES: cook animal foods to the core at 70 °C ([ANSES salmonellose](https://www.anses.fr/fr/content/quest-ce-que-la-salmonellose-et-comment-sen-premunir)); Québec/Canada: 74 °C pieces, 82 °C whole bird ([Québec](https://www.quebec.ca/sante/alimentation/salubrite-aliments-prevention-risques/salubrite-aliments-domicile/preparation-aliments-cuisson-securitaires/cuisson-temperatures-internes)) | stated < 65 °C or « pink » → REFUSE; 65–< 70 °C → WARN; ≥ 70 °C OK (74 °C recommended in the notice) |
| `ground_meat` | Burgers, meatballs, sausages, minced meat | Cook to the core: 71 °C (Geneva, Québec), « bien cuite à cœur » for young children, pregnant women, immunocompromised ([sante.fr](https://www.sante.fr/conseils-dhygiene-dans-la-cuisine), [Geneva](https://www.ge.ch/document/41888/telecharger)) | rare / « saignant » / < 65 °C → REFUSE; 65–< 70 °C → WARN |
| `pork` | Whole cuts of pork / wild boar | Sources differ: 60 °C not pink and 65 °C (Geneva), 70 °C (ANSES), 71 °C (Québec) | < 60 °C or pink → REFUSE; 60–< 65 °C → WARN; ≥ 65 °C OK |
| `red_meat` | Whole beef / veal / lamb cuts (not minced) | 63 °C medium-rare, 71 °C medium (Québec/Canada); surface is the risk, not the centre | rare/medium-rare OK with a short notice for sensitive groups (WARN); never REFUSE for temperature alone |
| `fish_cooked` | Fish cooked to the core | ANSES: cook fresh fish to the core; EFSA: Anisakis killed by heating above 60 °C for at least 1 minute ([EFSA](https://www.efsa.europa.eu/es/node/873646)); Luxembourg sheet says > 50 °C for > 10 s ([sheet](https://securite-alimentaire.public.lu/dam-assets/fr/publications/fiches/nematodes-poisson.pdf)); ANSES low-temperature sheet: some bacteria/parasites die around 54 °C but spores survive ([ANSES](https://www.anses.fr/fr/system/files/Anses%20-%20fiche%20cuisson%20basse%20temp%C3%A9rature.pdf)) | core ≥ 60 °C OK. Core < 60 °C (e.g. cod at 55 °C): **owner's decision** — recommended: OK + WARN if the recipe has a freezing step or says farmed fish; REFUSE if wild sea fish, no freezing step and no notice |
| `fish_raw` | Tartare, carpaccio, ceviche, sushi, gravlax | ANSES/Geneva: freeze raw fish 7 days (home freezer) unless the fishmonger states it was already treated; professional rule −20 °C for 24 h, −35 °C for 15 h or −15 °C for 96 h ([ANSES opinion](https://www.anses.fr/fr/system/files/MIC2007sa0379.pdf), [Geneva](https://www.ge.ch/document/43819/telecharger)); lemon or vinegar does not replace freezing (marinade needs weeks) | no freezing step and no « already frozen / farmed » note → REFUSE; with it → WARN (not for sensitive groups) |
| `shellfish_raw` | Raw shellfish | Only from authorised areas; eat soon after leaving the fridge; avoid for sensitive groups ([ANSES fish sheet](https://www.anses.fr/fr/system/files/ANSES-Ft-RecosPoissons.pdf?download=1)) | WARN |
| `eggs_raw` | Mayonnaise, mousse, tiramisu, raw dough with raw egg | Raw-egg foods cause about half of Salmonella outbreaks (ANSES); at-risk people should avoid raw or undercooked eggs; keep cold, prepare at the last moment ([ANSES](https://www.anses.fr/fr/content/quest-ce-que-la-salmonellose-et-comment-sen-premunir), [sante.fr](https://www.sante.fr/node/8593749)) | WARN (auto notice); REFUSE only if the recipe is meant for babies/young children |
| `milk_raw` | Raw milk and raw-milk cheese | Not for children under 5, pregnant women, immunocompromised; cooked pressed cheeses (gruyère, comté) are the exception ([La Revue du Praticien](https://www.larevuedupraticien.fr/article/pas-de-fromages-au-lait-cru-avant-5-ans)) | WARN; REFUSE if aimed at young children |
| `honey_baby` | Honey for infants | ANSES: never for children under 1 year, whatever the origin ([ANSES](https://www.anses.fr/fr/content/pas-de-miel-les-enfants-de-moins-dun-an)) | recipe for babies < 1 year with honey → REFUSE; otherwise short notice (INFO) |
| `canning_lowacid` | Home canning of vegetables, meat, fish, sauces with meat | Only a treatment strictly above 100 °C (pressure canner, 116–121 °C) destroys botulism spores ([ministry of agriculture](https://agriculture.gouv.fr/telecharger/152158), [Québec](https://www.quebec.ca/sante/alimentation/salubrite-aliments-prevention-risques/salubrite-aliments-domicile/preparation-aliments-cuisson-securitaires/conserves-maison)) | low-acid food « sterilised » at 100 °C / water bath, or stored at room temperature without proper sterilisation → REFUSE |
| `canning_acid` | Jams, pickles, fruit, tomatoes with added acid | Water bath at 100 °C is enough because acidity blocks the bacterium ([Québec](https://www.quebec.ca/sante/alimentation/salubrite-aliments-prevention-risques/salubrite-aliments-domicile/preparation-aliments-cuisson-securitaires/conserves-maison)) | OK; tomatoes without added acid → WARN |
| `oil_storage` | Raw garlic / herbs / vegetables stored in oil | Do not keep raw herbs or vegetables in oil without sterilisation, even in the fridge, unless eaten quickly ([Reporterre](https://reporterre.net/Botulisme-pourquoi-les-conserves-peuvent-etre-mortelles)) | long storage at room temperature → REFUSE; short fridge storage → WARN |
| `red_beans` | Dry red kidney beans | Soak 6–12 h and boil at 100 °C for at least 30 minutes; steaming, microwave, oven and low-temperature cooking are not enough ([Que Choisir](https://www.quechoisir.org/actualite-legumineuses-une-preparation-longue-mais-indispensable-n174746/), [Luxembourg](https://securite-alimentaire.public.lu/dam-assets/fr/publications/fiches/lectines.pdf)); a French outbreak came from beans slow-cooked at low temperature ([case](https://www.mesvaccins.net/web/news/21156)) | raw / slow cooker / oven without a prior boil → REFUSE; boil time missing → WARN |
| `rice_starch` | Cooked rice, pasta, potatoes cooked ahead | Bacillus cereus spores survive cooking; cool quickly (within about 2 h), fridge, reheat once, short storage (sources say 24–48 h); never leave at room temperature for hours | « leave out for hours » → REFUSE; make-ahead dishes → WARN |
| `mushrooms_wild` | Wild mushrooms | ANSES: never eat wild mushrooms raw | raw → REFUSE |
| `allergens` | The 14 EU allergens (gluten, crustaceans, eggs, fish, peanuts, soy, milk, nuts, celery, mustard, sesame, sulphites, lupin, molluscs) | EU rule | present and not mentioned → WARN (add the list automatically) |
| `storage` | Fridge 0–4 °C; fish eaten the day or within 48 h; do not leave food out for long | [ANSES fish sheet](https://www.anses.fr/fr/system/files/ANSES-Ft-RecosPoissons.pdf?download=1), [sante.fr](https://www.sante.fr/conseils-dhygiene-dans-la-cuisine) | INFO |

## Decision record fields (for alerts and stats)
`ok` (bool) · `risk` (category code above or `none`) · `level` (`ok` | `warn` | `block`) · `reason` (short, kind, in the author's language) · `notice` (standard health notice text added to the recipe when `warn`).

## Open points for the owner
1. Fish below 60 °C at the core (cod at 55 °C): warn, or refuse unless frozen/farmed? (default above: refuse only wild sea fish with no freezing step and no notice).
2. Thresholds for pork and poultry: the grid takes the ANSES France values and the Québec/Canada ones as fallback; confirm.
3. Who reviews the grid professionally before it goes live.
4. Whether `warn` notices are added to the recipe text or shown only at publication.
