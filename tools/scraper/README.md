# Scraper

One-off seed of the old [red-point.bg](https://red-point.bg/) catalogue into `seed/products.json` plus downloaded photography.

**Before running this, ask the client whether they can export from the old admin or database.** If they can, this whole tool is unnecessary and the export is more trustworthy than anything scraped through Cloudflare.

## Run

```bash
pnpm --filter @redpoint/scraper scrape
```

First run also needs the browser binary:

```bash
pnpm --filter @redpoint/scraper exec playwright install chromium
```

Useful flags:

| Flag | Effect |
|---|---|
| `--limit 5` | Products per category. Default 30. Use a small number for a smoke test. |
| `--category men-jeans` | Crawl a single category key from `src/categories.ts`. |
| `--validate-only` | Re-validate an existing `seed/products.json` without touching the network. |

## Output

```
seed/products.json                  the catalogue
seed/images/{sku}/{colour}/{n}.jpg  original-resolution photography
seed/reports/price-mismatches.json  JSON-LD price vs rendered price
seed/reports/errors.json            products that could not be parsed
seed/reports/warnings.json          products parsed with caveats
seed/reports/images.json            download counts and failures
```

`seed/reports/price-mismatches.json` is not optional reading. The old site's JSON-LD advertises prices that do not match what it renders (16.00 seen where the page showed 62.59). The rendered DOM price is what gets migrated; the client has to review the differences before the catalogue goes live.

## Rate limiting

Cloudflare fronts the old site and starts blocking after roughly ten rapid requests. So:

- Navigations are strictly serial with 1.5 to 2s of jittered spacing.
- Images, fonts and stylesheets are aborted during page loads. Product photography is downloaded separately at a lighter interval, because static assets are served from cache rather than challenged.
- 403, 429 and 503 are treated as rate limiting: three attempts with a 30s cool-off, not an immediate retry.

A full run takes a while by design. Do not raise the throttle to make it faster.

## Resuming

Everything is resumable. `.cache/` holds fetched category HTML, the parsed product objects, and the crawl state; `seed/images/` is skipped file by file. An interrupted run picks up where it stopped.

To force a clean re-crawl:

```bash
rm -rf tools/scraper/.cache
```

## Data model

`product -> colour -> (images, sizes with availability)`.

Photography and stock are both per colour on the old site, which is why colours are clicked through one by one within a single page load rather than read in one pass. This maps directly onto Medusa: colour x size becomes a `ProductVariant` with its own `InventoryItem`, and the image sets become `product.metadata.color_images`.

## The brief's selectors were wrong

Section 5 of the handoff brief says the old-site research is done and should not be repeated. It does not hold up. Verified against two live product pages:

| Brief says | Reality |
|---|---|
| `ul#sizes_list li`, `data-size-id` | Does not exist. Sizes are `li.productSizeBtn` with `data-size`. |
| Colours carry `data-color-id` | `data-color-id` is on the "compare" and "notify me" buttons only. The colour id is `data-color` on the size buttons. |
| `.small_product_color_pictures` | Does not exist anywhere on the page. |
| Sold-out marked `cross no_size_quantity` | Not observed. Unverified, see below. |
| `description` is the composition ("100%памук") | It is marketing prose with the composition glued to the end. `extractMaterial()` separates them. |
| `table.sizes_table_with_pic` | Correct. |
| JSON-LD `Product` block | Correct, and on the two products checked its price agreed with the DOM. |

Two things the brief missed entirely:

- **Gallery originals are already linked.** `a[data-lightbox][href*="/color_pictures/"]` points straight at the `_2000h` file. No URL rewriting needed.
- **Per-size measurements are on the size button.** Each `<label>` carries `title="Ширина: 36 Дължина: 98"`, independent of the size table. These are per product and genuinely differ between products.

One trap: the page renders **both** a desktop and a mobile size block, so every size matches `li.productSizeBtn` twice. `readSizes` de-duplicates by `data-size`, keeping the copy that has measurements.

## Still unresolved

Three things could not be settled from the two single-colour products inspected. Each is recorded in `seed/reports/warnings.json` rather than guessed:

- **Sold-out marker.** Every size on both products was in stock, so there was nothing to compare against. `inStock` is currently optimistic for everything. Find a product that is out of stock in one size before trusting a full run.
- **Colour swatches.** Both products had one colour, so there was no swatch row to locate. A multi-colour product is read as its displayed colour only, which under-migrates rather than corrupts. Colour names fall back to `Цвят {id}`.
- **Price element.** No named selector matched; the currency regex fallback is what wins, which means `price.source` reads `dom:currency-regex` for everything. It agreed with JSON-LD on both products, but the price element has no class or id of its own, so this is the least robust part of the parse. Watch `price.source` on any larger run.

Also note the colour id and the photography directory are different numbers: colour `25` on product 16785, photography under `/color_pictures/22868/`.

## Category slugs

Only category ids are hardcoded, in `src/categories.ts`. The URLs are discovered from the live navigation, so a renamed slug does not produce a silently empty run. An id missing from the navigation is reported, not skipped quietly.
