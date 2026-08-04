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
| Sold-out marked `cross no_size_quantity` | No such marker exists. A sold-out size is not rendered at all. |
| Second URL segment is the category id | It is the **colour** id. |
| `description` is the composition ("100%памук") | It is marketing prose with the composition glued to the end. `extractMaterial()` separates them. |
| `table.sizes_table_with_pic` | Correct. |
| JSON-LD `Product` block | Correct, and on the two products checked its price agreed with the DOM. |

Two things the brief missed entirely:

- **Gallery originals are already linked.** `a[data-lightbox][href*="/color_pictures/"]` points straight at the `_2000h` file. No URL rewriting needed.
- **Per-size measurements are on the size button.** Each `<label>` carries `title="Ширина: 36 Дължина: 98"`, independent of the size table. These are per product and genuinely differ between products.

One trap: the page renders **both** a desktop and a mobile size block, so every size matches `li.productSizeBtn` twice. `readSizes` de-duplicates by `data-size`, keeping the copy that has measurements.

## Still unresolved

- **Price element.** No named selector matched; the currency regex fallback is what wins, which means `price.source` reads `dom:currency-regex` for everything. It has agreed with JSON-LD on every product checked, but the price element carries no class or id of its own, so this is the least robust part of the parse. Watch `price.source` on any larger run.
- **Per-shop stock.** Size buttons carry `data-shop` and `data-shopname`, and the shop shown varies by product. Whether online orders draw from one warehouse or from shop stock is a question for the client. The field is carried through to Medusa metadata unresolved.
- **Colour names.** The site exposes no human-readable colour name anywhere, so they stay `Цвят {id}`. The client renames them through the Phase 7 bulk module.

Note the colour id and the photography directory are different numbers: colour `25` on product 16785, photography under `/color_pictures/22868/`.

## Colours are URLs, not swatches

The brief documents the product route as `/product/{product_id}/{cat_id}/…`. That second segment is not a category, it is the **colour**. A three-colour product is three separate URLs sharing one product id and one sku, each rendering only that colour's photography and only that colour's sizes. That is why there is no swatch row to find on the page.

Each page links to its siblings, so `readSiblingColorLinks` queues the other colours from links already on the page, costing no extra request. Results are merged by sku, unioning the colour sets.

## Availability is absence

There is no sold-out marker, because a sold-out size is simply never rendered. The size table lists the full run the garment is made in; only the sizes in stock get a button. On `Преходно яке 16741`:

```
table       S  M  L  XL  2XL  3XL  4XL    the run
colour 33   S         XL  2XL  3XL        in stock
colour 26         L       2XL  3XL
colour 25             XL  2XL  3XL
```

So the table is the catalogue, the buttons are the stock, and the difference is what is out of stock. Sizes present only in the table are emitted with `inStock: false` and an id prefixed `chart:`, because they have no button to borrow a `data-size` from. They are kept rather than dropped so the variant already exists in Medusa when the client restocks it.

One trap: the page ships **two** `table.sizes_table_with_pic`, a `big_table` for desktop and a `small_table` for mobile, and they do not agree. On that jacket the desktop one stopped at `S M L` while the mobile one carried the full run. `readSizeChart` takes whichever has the most sizes, never the first.

## Category slugs

Only category ids are hardcoded, in `src/categories.ts`. The URLs are discovered from the live navigation, so a renamed slug does not produce a silently empty run. An id missing from the navigation is reported, not skipped quietly.
