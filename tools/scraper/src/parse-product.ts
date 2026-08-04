import type { Page } from "playwright";
import type { Session } from "./session.js";
import type { ProductLink } from "./parse-category.js";
import type { Color, Product, Size, SizeChartRow } from "@redpoint/catalog";
import { CONFIG } from "./config.js";

export interface ParseResult {
  product: Product | null;
  warnings: string[];
  error: string | null;
}

/** Raw JSON-LD Product fields we care about. Everything is optional because
 *  the old site is ten years old and we verify rather than trust. */
interface JsonLdProduct {
  name?: string;
  sku?: string;
  description?: string;
  image?: string | string[];
  offers?: { price?: string | number; availability?: string };
}

/**
 * Ordered strategies for reading the price actually shown to shoppers.
 *
 * The brief is explicit that the JSON-LD price is unreliable (16.00 observed
 * where the page rendered 62.59) but does not name the element that carries
 * the real one. So this tries the likely containers first and falls back to
 * scanning for a currency-shaped string, and records which strategy won so a
 * bad run is auditable instead of mysterious.
 */
const PRICE_SELECTORS = [
  "#product_price",
  ".product_price",
  ".price_product",
  ".product-price",
  '[itemprop="price"]',
  ".price",
];

/** "62.59 лв." and "62,59 лв." both appear on the old site. */
function parsePriceText(text: string): number | null {
  const match = /(\d{1,6})[.,](\d{2})/.exec(text.replace(/\s/g, ""));
  if (!match?.[1] || !match[2]) return null;
  const value = Number(`${match[1]}.${match[2]}`);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** `..._502x616.jpg` and `..._99x98.jpg` both become `..._2000h.jpg`. */
function toOriginalResolution(src: string): string {
  return src.replace(/_(\d+x\d+|\d+h)\.(jpe?g|png|webp)$/i, `_${CONFIG.imageResolution}.$2`);
}

/**
 * Pulls the fibre composition out of the JSON-LD description.
 *
 * The brief expected the description to BE the composition ("100%памук"). It is
 * not: it is a marketing paragraph with the composition glued onto the end,
 * usually without a space ("...небрежна визия.99%памук, 1%еластан"). Medusa's
 * `product.material` should hold the composition, not the prose.
 */
function extractMaterial(description: string): string | null {
  const parts = description.match(/\d{1,3}\s*%\s*[\p{L}]+/gu);
  if (!parts || parts.length === 0) return null;
  return parts.map((part) => part.replace(/\s+/g, "")).join(", ");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function readJsonLd(page: Page): Promise<JsonLdProduct | null> {
  return page.evaluate(() => {
    const scripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
    );
    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent ?? "");
        const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] ?? [])];
        for (const node of nodes) {
          if (node && node["@type"] === "Product") return node;
        }
      } catch {
        // A malformed block is not fatal; the DOM is the fallback anyway.
      }
    }
    return null;
  });
}

async function readDomPrice(
  page: Page,
): Promise<{ value: number; source: string } | null> {
  const texts = await page.evaluate(
    (selectors) =>
      selectors.map((selector) => ({
        selector,
        text: document.querySelector(selector)?.textContent?.trim() ?? "",
      })),
    PRICE_SELECTORS,
  );

  for (const { selector, text } of texts) {
    const value = parsePriceText(text);
    if (value !== null) return { value, source: `dom:${selector}` };
  }

  // Last resort: the first currency-shaped string that does NOT belong to the
  // related-products carousels. Those use `.list_products_container` and sit on
  // every product page, so an unscoped scan happily returns a different
  // product's price and migrates it silently.
  const fallback = await page.evaluate(() => {
    const texts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const element = node.parentElement;
      if (!element) continue;
      if (element.closest(".list_products_container, .slides, script, style")) continue;
      const text = (node.nodeValue ?? "").trim();
      if (text) texts.push(text);
    }
    return texts.join(" ");
  });
  const match = /(\d{1,6}[.,]\d{2})\s*(?:лв|BGN|лева)/i.exec(fallback);
  if (match?.[1]) {
    const value = parsePriceText(match[1]);
    if (value !== null) return { value, source: "dom:currency-regex" };
  }

  return null;
}

/**
 * Sizes, read off `li.productSizeBtn`.
 *
 * The brief specified `ul#sizes_list li` with `data-size-id`; neither exists on
 * the live site. What is actually there is:
 *
 *   <li class="productSizeBtn ui-buttonset"
 *       data-shopname=" Red Point Grand Mall" data-shop="9"
 *       data-product="16785" data-color="25" data-size="159">
 *     <input type="radio" id="check1" ...>
 *     <label title="Ширина: 36 Дължина: 98 "><span>30</span></label>
 *   </li>
 *
 * Two things follow. The measurements are on each size button, not only in
 * `table.sizes_table_with_pic`. And the buttons are scoped to a physical shop,
 * which the brief's data model does not account for.
 *
 * UNRESOLVED: the sold-out marker. Every button on the product inspected was
 * available, so there was nothing to compare against and `inStock` is
 * optimistic. Find a product that is out of stock in one size and add the
 * class check here before trusting a full run.
 */
async function readSizes(page: Page): Promise<Size[]> {
  // NOTE: nothing inside a page.evaluate callback may declare a named function
  // or assign an arrow to a const. tsx compiles this file with esbuild's
  // keepNames on, which rewrites those into `__name(...)` - a helper that does
  // not exist in the browser context, so the whole evaluate throws
  // "__name is not defined". Keep helpers inline.
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLElement>("li.productSizeBtn"))
      .map((item) => {
        const labelEl = item.querySelector("label");
        const title = labelEl?.getAttribute("title") ?? "";
        const className = item.className ?? "";
        const soldOut =
          className.includes("no_size_quantity") ||
          className.includes("ui-state-disabled") ||
          item.querySelector(".cross, .no_size_quantity") !== null;

        const width = /Ширина\s*:\s*(\d+(?:[.,]\d+)?)/.exec(title)?.[1];
        const length = /Дължина\s*:\s*(\d+(?:[.,]\d+)?)/.exec(title)?.[1];
        const widthCm = width ? Number(width.replace(",", ".")) : NaN;
        const lengthCm = length ? Number(length.replace(",", ".")) : NaN;

        return {
          id: item.getAttribute("data-size") ?? "",
          label: (labelEl?.textContent ?? item.textContent ?? "").trim(),
          inStock: !soldOut,
          shopId: item.getAttribute("data-shop"),
          shopName: item.getAttribute("data-shopname")?.trim() || null,
          widthCm: Number.isFinite(widthCm) && widthCm > 0 ? widthCm : null,
          lengthCm: Number.isFinite(lengthCm) && lengthCm > 0 ? lengthCm : null,
        };
      })
      .filter((size) => size.id !== "" && size.label !== "")
      // The old site renders a desktop AND a mobile size block, both matching
      // `li.productSizeBtn`, so every size appears twice. Only the desktop one
      // carries the measurements in its label title, so that is the copy kept.
      .reduce<
        {
          id: string;
          label: string;
          inStock: boolean;
          shopId: string | null;
          shopName: string | null;
          widthCm: number | null;
          lengthCm: number | null;
        }[]
      >((unique, size) => {
        const existing = unique.find(
          (candidate) => candidate.id === size.id && candidate.shopId === size.shopId,
        );
        if (!existing) {
          unique.push(size);
        } else if (existing.widthCm === null && size.widthCm !== null) {
          Object.assign(existing, size);
        }
        return unique;
      }, []);
  });
}

/**
 * Every photo belonging to one colour, at original resolution.
 *
 * The gallery wraps each shot in `<a data-lightbox href=".../_2000h.jpg">`, so
 * the originals are sitting right there and no URL rewriting is needed. The
 * `<img>` inside only carries the 502x616 preview.
 *
 * `pictureDir` is the numeric segment in `/images/color_pictures/{dir}/`, which
 * is NOT the same number as the colour id: on the product inspected the colour
 * was `data-color="25"` while its photography lived under `22868`.
 */
async function readColorImages(page: Page, pictureDir: string | null): Promise<string[]> {
  const raw = await page.evaluate((dir) => {
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'a[data-lightbox][href*="/color_pictures/"]',
      ),
    )
      .map((anchor) => anchor.getAttribute("href") ?? "")
      // Related-product sliders also contain colour_pictures urls; anything
      // inside a product-list container belongs to a different product.
      .filter((href) => href !== "")
      .filter((href) => !dir || href.includes(`/color_pictures/${dir}/`));

    return Array.from(new Set(anchors));
  }, pictureDir);

  return Array.from(
    new Set(raw.map((src) => toOriginalResolution(new URL(src, "https://red-point.bg").toString()))),
  );
}

/**
 * The in-store measured size table.
 *
 * It is laid out with sizes as COLUMNS, not rows: the first cell of each row is
 * a label and the rest are that label's values across every size.
 *
 *   Размер            | 30 | 31 | 32 | ...
 *   A Ширина (см.)    | 36 | 38 | 40 | ...
 *   B Дължина (см.)   | 96 | 96 | 97 | ...
 *
 * Reading it row-wise, as an earlier version did, produces one bogus entry per
 * label ("A Ширина (см.)" as a size, with the first two numbers as its
 * measurements) and silently loses the real data. It has to be transposed.
 */
async function readSizeChart(page: Page): Promise<SizeChartRow[]> {
  return page.evaluate(() => {
    /* The page ships TWO of these: `big_table` for desktop and `small_table`
       for mobile. They are not the same data. On the jacket inspected the
       desktop one stopped at S M L while the mobile one carried the real run,
       S M L XL 2XL 3XL 4XL. Taking the first match silently truncated the size
       run on some products and not others, so pick whichever has the most
       sizes rather than whichever comes first. */
    let rows: string[][] = [];
    for (const candidate of Array.from(
      document.querySelectorAll("table.sizes_table_with_pic"),
    )) {
      const candidateRows = Array.from(candidate.querySelectorAll("tr"))
        .map((row) =>
          Array.from(row.querySelectorAll("th, td")).map((c) => (c.textContent ?? "").trim()),
        )
        .filter((cells) => cells.length >= 2);
      const widest = Math.max(0, ...candidateRows.map((cells) => cells.length));
      const currentWidest = Math.max(0, ...rows.map((cells) => cells.length));
      if (widest > currentWidest) rows = candidateRows;
    }
    if (rows.length === 0) return [];

    // Helpers stay inline: see the note on readSizes. Assigning an arrow to a
    // const inside page.evaluate makes esbuild emit __name(), which does not
    // exist in the browser and throws before a single row is read.
    const sizeRow = rows.find((cells) => /Размер/i.test((cells[0] ?? "").replace(/\s+/g, " ")));
    const widthRow = rows.find((cells) => /Ширина/i.test((cells[0] ?? "").replace(/\s+/g, " ")));
    const lengthRow = rows.find((cells) => /Дължина/i.test((cells[0] ?? "").replace(/\s+/g, " ")));
    if (!sizeRow) return [];

    // Column 0 is the label, so sizes start at index 1.
    return sizeRow
      .slice(1)
      .map((label, index) => {
        const rawWidth = /(\d+(?:[.,]\d+)?)/.exec((widthRow?.[index + 1] ?? "").replace(/\s/g, ""))?.[1];
        const rawLength = /(\d+(?:[.,]\d+)?)/.exec((lengthRow?.[index + 1] ?? "").replace(/\s/g, ""))?.[1];
        const widthCm = rawWidth ? Number(rawWidth.replace(",", ".")) : NaN;
        const lengthCm = rawLength ? Number(rawLength.replace(",", ".")) : NaN;
        return {
          size: label,
          widthCm: Number.isFinite(widthCm) && widthCm > 0 ? widthCm : null,
          lengthCm: Number.isFinite(lengthCm) && lengthCm > 0 ? lengthCm : null,
        };
      })
      .filter((row) => row.size !== "");
  });
}

/**
 * Parses one product page.
 *
 * Colours have to be clicked through rather than read in one pass: photography
 * and stock are both per colour on the old site, and the size list only shows
 * the selected colour's availability. All of that happens inside a single page
 * load, so it costs nothing extra against the rate limit.
 */
export async function parseProduct(
  session: Session,
  link: ProductLink,
  categoryKeys: string[],
): Promise<ParseResult> {
  const warnings: string[] = [];

  try {
    await session.openLive(link.url);
    const page = session.livePage;

    const jsonLd = await readJsonLd(page);
    const name = jsonLd?.name?.trim() ?? (await page.title()).trim();
    if (!name) return { product: null, warnings, error: "no product name" };

    const sku =
      jsonLd?.sku?.toString().trim() ||
      /-(\d+)(?:\/)?$/.exec(link.url)?.[1] ||
      "";
    if (!sku) return { product: null, warnings, error: "no sku" };

    const description = jsonLd?.description?.trim() ?? "";
    const jsonLdPrice =
      jsonLd?.offers?.price !== undefined ? Number(jsonLd.offers.price) : null;

    const domPrice = await readDomPrice(page);
    if (!domPrice) {
      return { product: null, warnings, error: "no price found in DOM" };
    }

    /*
     * One colour per page.
     *
     * The colour is the second segment of the URL, not a swatch on the page.
     * The caller walks the sibling colour links and calls this once per colour,
     * then merges the results by sku.
     *
     * Photography lives under a different number than the colour id (colour 25
     * publishes under /color_pictures/22868/), carried on the compare button
     * and in the gallery urls.
     */
    const pictureDir = await page.evaluate(() => {
      const compare = document.querySelector(".compareProduct");
      const fromCompare = compare?.getAttribute("data-product-id") ?? null;
      const fromImage = /\/color_pictures\/(\d+)\//.exec(
        document.querySelector<HTMLAnchorElement>('a[data-lightbox][href*="/color_pictures/"]')
          ?.getAttribute("href") ?? "",
      )?.[1];
      return fromCompare ?? fromImage ?? null;
    });

    const sizeChart = await readSizeChart(page);
    const rendered = await readSizes(page);
    const images = await readColorImages(page, pictureDir);

    if (rendered.length === 0) warnings.push("no size buttons found");
    if (images.length === 0) warnings.push("no gallery images found");

    /*
     * Availability.
     *
     * The old site has no sold-out marker, because it never renders a sold-out
     * size at all. The size table lists the full run the product is made in
     * (S M L XL 2XL 3XL 4XL on the jacket inspected) while only the sizes in
     * stock get a button (S XL 2XL 3XL). So the table is the catalogue and the
     * buttons are the stock, and the difference between them is what is out of
     * stock.
     *
     * Creating the missing sizes as out-of-stock variants rather than dropping
     * them matters: when the client restocks through the Phase 7 bulk module,
     * the variant is already there to receive a quantity.
     */
    const renderedByLabel = new Map(rendered.map((size) => [size.label, size]));
    const sizes: Size[] = sizeChart.map((row) => {
      const inStockSize = renderedByLabel.get(row.size);
      if (inStockSize) return inStockSize;
      return {
        // No button exists, so there is no data-size to borrow. Prefixed so it
        // is obvious this id came from the table, not the site's own ids.
        id: `chart:${row.size}`,
        label: row.size,
        inStock: false,
        shopId: null,
        shopName: null,
        widthCm: row.widthCm,
        lengthCm: row.lengthCm,
      };
    });

    // A size on sale that the table never listed still has to be sellable.
    for (const size of rendered) {
      if (!sizes.some((known) => known.label === size.label)) sizes.push(size);
    }

    const colors: Color[] =
      sizes.length > 0 && images.length > 0
        ? [
            {
              id: link.colorId,
              // The site exposes no human name for a colour anywhere. Left as
              // the id so it is obviously a placeholder; the client renames
              // colours through the bulk module.
              name: `Цвят ${link.colorId}`,
              images,
              sizes,
            },
          ]
        : [];

    if (colors.length > 0) {
      const outOfStock = sizes.filter((size) => !size.inStock).map((size) => size.label);
      if (outOfStock.length > 0) {
        warnings.push(`colour ${link.colorId} out of stock in: ${outOfStock.join(", ")}`);
      }
    }

    if (colors.length === 0) {
      return { product: null, warnings, error: "no colour with both sizes and images" };
    }

    const available =
      jsonLd?.offers?.availability?.includes("InStock") ??
      colors.some((color) => color.sizes.some((size) => size.inStock));

    const product: Product = {
      sku,
      externalId: link.externalId,
      /* Product names on the old site already end in the article number
         ("Дънки с декоративни кръпки и бели пръски 17487"), so appending it
         unconditionally yields handles like `...-17487-17487`. It is still
         appended when the name does not carry it, because the handle has to
         stay unique. */
      handle: slugify(name).endsWith(`-${sku}`)
        ? slugify(name)
        : `${slugify(name)}-${sku}`,
      name,
      url: link.url,
      categoryKeys,
      price: { bgn: domPrice.value, source: domPrice.source },
      jsonLdPrice: jsonLdPrice !== null && Number.isFinite(jsonLdPrice) ? jsonLdPrice : null,
      description: description || null,
      material: extractMaterial(description),
      available,
      colors,
      sizeChart,
      scrapedAt: new Date().toISOString(),
    };

    return { product, warnings, error: null };
  } catch (error) {
    return { product: null, warnings, error: String(error) };
  }
}
