import fs from "node:fs/promises";
import path from "node:path";
import { BASE_URL, CONFIG, PATHS } from "./config.js";
import {
  crawlableCategories,
  validateProductsFile,
  type Product,
  type ProductsFile,
} from "@redpoint/catalog";
import {
  ensureDirs,
  loadState,
  readParsedProduct,
  saveState,
  writeParsedProduct,
} from "./cache.js";
import { downloadColorImages, type DownloadReport } from "./images.js";
import { collectProductLinks, discoverCategoryUrls, type ProductLink } from "./parse-category.js";
import { parseProduct } from "./parse-product.js";
import { Session } from "./session.js";

interface Args {
  validateOnly: boolean;
  limit: number;
  onlyCategory: string | null;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const limitArg = get("--limit");
  return {
    validateOnly: argv.includes("--validate-only"),
    limit: limitArg ? Number(limitArg) : CONFIG.productsPerCategory,
    onlyCategory: get("--category"),
  };
}

interface PriceMismatch {
  sku: string;
  name: string;
  url: string;
  jsonLdPrice: number;
  domPrice: number;
  domSource: string;
  deltaPercent: number;
}

async function writeReport(name: string, data: unknown): Promise<void> {
  await fs.writeFile(
    path.join(PATHS.reports, `${name}.json`),
    JSON.stringify(data, null, 2),
    "utf8",
  );
}

async function validateOnly(): Promise<number> {
  const raw = await fs.readFile(PATHS.products, "utf8");
  const result = validateProductsFile(JSON.parse(raw));
  if (result.success) {
    console.log(`products.json is valid: ${result.data.count} products`);
    return 0;
  }
  console.error("products.json failed validation:");
  for (const issue of result.error.issues.slice(0, 40)) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error(`  ...${result.error.issues.length} issues total`);
  return 1;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  await ensureDirs();

  if (args.validateOnly) return validateOnly();

  const state = await loadState();
  const session = new Session();
  await session.start();

  const errors: { url: string; error: string }[] = [];
  const warnings: { url: string; warnings: string[] }[] = [];
  const priceMismatches: PriceMismatch[] = [];
  const imageReport: DownloadReport = { downloaded: 0, skipped: 0, failed: [] };

  try {
    console.log("discovering category urls from the live navigation");
    const categoryUrls = await discoverCategoryUrls(session);
    console.log(`  found ${categoryUrls.size} category urls`);

    const categories = crawlableCategories().filter(
      (category) => !args.onlyCategory || category.key === args.onlyCategory,
    );

    // One product can sit in several categories. Collect the union first so
    // each page is only ever visited once.
    const linksByUrl = new Map<string, ProductLink>();
    const categoryKeysByUrl = new Map<string, Set<string>>();

    for (const category of categories) {
      const categoryUrl = categoryUrls.get(category.id);
      if (!categoryUrl) {
        console.warn(`  category ${category.id} (${category.name}) not found in navigation`);
        continue;
      }

      const cached = state.categoryProducts[`${category.key}:${category.id}`];
      const links = cached
        ? cached.map((url) => ({ url, externalId: /\/product\/(\d+)\//.exec(url)?.[1] ?? "" }))
        : await collectProductLinks(session, categoryUrl, args.limit);

      state.categoryProducts[`${category.key}:${category.id}`] = links.map((l) => l.url);
      await saveState(state);

      for (const link of links) {
        linksByUrl.set(link.url, link);
        const keys = categoryKeysByUrl.get(link.url) ?? new Set<string>();
        keys.add(category.key);
        categoryKeysByUrl.set(link.url, keys);
      }

      console.log(`  ${category.name} (${category.id}): ${links.length} products`);
    }

    console.log(`\nparsing ${linksByUrl.size} unique products`);
    const products: Product[] = [];
    let index = 0;

    for (const link of linksByUrl.values()) {
      index += 1;
      const categoryKeys = [...(categoryKeysByUrl.get(link.url) ?? new Set<string>())];
      const prefix = `[${index}/${linksByUrl.size}]`;

      const cachedProduct = await readParsedProduct<Product>(link.url);
      if (cachedProduct) {
        products.push({ ...cachedProduct, categoryKeys });
        console.log(`${prefix} cached  ${cachedProduct.sku} ${cachedProduct.name}`);
        continue;
      }

      const result = await parseProduct(session, link, categoryKeys);
      if (result.warnings.length > 0) {
        warnings.push({ url: link.url, warnings: result.warnings });
      }
      if (!result.product) {
        errors.push({ url: link.url, error: result.error ?? "unknown" });
        console.warn(`${prefix} FAILED  ${link.url}: ${result.error}`);
        continue;
      }

      const product = result.product;

      // Swap remote image urls for downloaded local paths. A colour that ends
      // up with nothing on disk is dropped rather than shipped broken.
      const colorsWithLocalImages = [];
      for (const color of product.colors) {
        const localPaths = await downloadColorImages(
          product.sku,
          color.name,
          color.images,
          imageReport,
        );
        if (localPaths.length > 0) {
          colorsWithLocalImages.push({ ...color, images: localPaths });
        } else {
          warnings.push({
            url: link.url,
            warnings: [`colour ${color.id} (${color.name}) lost every image, dropped`],
          });
        }
      }

      if (colorsWithLocalImages.length === 0) {
        errors.push({ url: link.url, error: "no colour retained any image" });
        console.warn(`${prefix} FAILED  ${product.sku}: no images downloaded`);
        continue;
      }

      product.colors = colorsWithLocalImages;

      if (product.jsonLdPrice !== null && Math.abs(product.jsonLdPrice - product.price.bgn) > 0.01) {
        priceMismatches.push({
          sku: product.sku,
          name: product.name,
          url: product.url,
          jsonLdPrice: product.jsonLdPrice,
          domPrice: product.price.bgn,
          domSource: product.price.source,
          deltaPercent:
            Math.round(((product.price.bgn - product.jsonLdPrice) / product.jsonLdPrice) * 1000) / 10,
        });
      }

      await writeParsedProduct(link.url, product);
      state.doneProducts.push(link.url);
      await saveState(state);

      products.push(product);
      console.log(
        `${prefix} ok      ${product.sku} ${product.name} ` +
          `(${product.colors.length} colours, ${product.price.bgn} BGN via ${product.price.source})`,
      );
    }

    // Same product from two categories collapses to one entry.
    const bySku = new Map<string, Product>();
    for (const product of products) {
      const existing = bySku.get(product.sku);
      if (existing) {
        existing.categoryKeys = [...new Set([...existing.categoryKeys, ...product.categoryKeys])];
      } else {
        bySku.set(product.sku, product);
      }
    }

    const output: ProductsFile = {
      scrapedAt: new Date().toISOString(),
      source: BASE_URL,
      count: bySku.size,
      products: [...bySku.values()],
    };

    await fs.writeFile(PATHS.products, JSON.stringify(output, null, 2), "utf8");

    await writeReport("price-mismatches", {
      note:
        "JSON-LD prices on the old site are unreliable. The DOM price is what was migrated. " +
        "The client must review this list before the catalogue goes live.",
      count: priceMismatches.length,
      mismatches: priceMismatches.sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent)),
    });
    await writeReport("errors", { count: errors.length, errors });
    await writeReport("warnings", { count: warnings.length, warnings });
    await writeReport("images", imageReport);

    console.log("\n--- summary ---------------------------------------------");
    console.log(`products written   ${output.count}`);
    console.log(`page requests      ${session.requestCount} (cache hits ${session.cacheHits})`);
    console.log(`images downloaded  ${imageReport.downloaded} (skipped ${imageReport.skipped}, failed ${imageReport.failed.length})`);
    console.log(`price mismatches   ${priceMismatches.length}`);
    console.log(`failed products    ${errors.length}`);
    console.log(`warnings           ${warnings.length}`);

    const validation = validateProductsFile(output);
    if (!validation.success) {
      console.error("\nproducts.json FAILED schema validation:");
      for (const issue of validation.error.issues.slice(0, 40)) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
      return 1;
    }
    console.log("\nproducts.json passes schema validation");
    return 0;
  } finally {
    await session.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
