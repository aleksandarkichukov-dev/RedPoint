import fs from "node:fs/promises";
import path from "node:path";
import type { ExecArgs, RemoteQueryFunction } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import { colorNameFromRgb, colorNameFromTitle, rgbToHex } from "@redpoint/catalog";
import sharp from "sharp";

/**
 * Gives every colour variant a real name, read off its own photograph.
 *
 *   pnpm --filter @redpoint/backend exec medusa exec ./src/scripts/name-colors.ts
 *
 * The old site publishes no colour value, only a numeric id, so the catalogue
 * arrived with variants called "Цвят 25". The photographs are the only record
 * of what colour a garment actually is, so this samples them.
 *
 * The ids are not a global palette — measured across all 476 photographs, id 32
 * lands on colours 83 RGB units apart on different garments — so each product's
 * colour is named from that product's own image and never from the id.
 *
 * Writes `color_names` and `color_swatches` into product metadata rather than
 * renaming the option values, because the values are part of every variant SKU.
 * The client can correct any of them in the admin, and Phase 7's bulk module
 * should own them properly.
 *
 * Safe to re-run. Products whose photography is missing keep the raw id.
 */

type MedusaQuery = Omit<RemoteQueryFunction, symbol>;

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const IMAGES = path.join(REPO_ROOT, "seed", "images");

/* Small enough that sampling 476 photographs is instant, large enough that a
   garment occupying a third of the frame still contributes hundreds of pixels. */
const W = 90;
const H = 110;

/** The dominant garment colour, or null when the photograph is unusable. */
async function dominantColor(file: string): Promise<[number, number, number] | null> {
  const data = await sharp(file).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * W + x) * 3;
    return [data[i]!, data[i + 1]!, data[i + 2]!];
  };

  /* Learn the backdrop from the frame's border instead of assuming white. The
     shop's photography is shot on near-white, but "near" varies per shoot, and
     a fixed threshold either keeps the backdrop or eats pale garments. */
  const border: [number, number, number][] = [];
  for (let x = 0; x < W; x += 2) {
    border.push(at(x, 0), at(x, H - 1));
  }
  for (let y = 0; y < H; y += 2) {
    border.push(at(0, y), at(W - 1, y));
  }
  const median = (channel: number) =>
    border.map((p) => p[channel]!).sort((a, b) => a - b)[Math.floor(border.length / 2)]!;
  const bg: [number, number, number] = [median(0), median(1), median(2)];

  /* Centre crop, and only what stands clear of the backdrop. Many products are
     shot on a model, so the crop also trims most of the head and the shoes. */
  const kept: [number, number, number][] = [];
  for (let y = Math.floor(H * 0.18); y < Math.floor(H * 0.88); y += 1) {
    for (let x = Math.floor(W * 0.18); x < Math.floor(W * 0.82); x += 1) {
      const p = at(x, y);
      if (Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) > 38) kept.push(p);
    }
  }
  if (kept.length < 150) return null;

  /* Coarse histogram, then average the winning bucket. A plain median across
     the garment turns a two-tone jacket into the mud between its two colours. */
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (const [r, g, b] of kept) {
    const key = `${r >> 5}|${g >> 5}|${b >> 5}`;
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = { n: 0, r: 0, g: 0, b: 0 }));
    bucket.n += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
  }
  const best = [...buckets.values()].sort((a, b) => b.n - a.n)[0]!;
  return [
    Math.round(best.r / best.n),
    Math.round(best.g / best.n),
    Math.round(best.b / best.n),
  ];
}

export default async function nameColors({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<MedusaQuery>(ContainerRegistrationKeys.QUERY);

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "metadata",
      "variants.options.value",
      "variants.options.option.title",
    ],
  });

  const updates: { id: string; metadata: Record<string, unknown> }[] = [];
  let named = 0;
  let fromTitle = 0;
  let missing = 0;

  for (const product of products) {
    const article = (product.metadata as { article_no?: string } | null)?.article_no;
    if (!article) continue;

    const colorValues = new Set<string>();
    for (const variant of product.variants ?? []) {
      for (const option of variant.options ?? []) {
        if (option.option?.title === "Цвят" && option.value) colorValues.add(option.value);
      }
    }
    if (colorValues.size === 0) continue;

    const names: Record<string, string> = {};
    const swatches: Record<string, string> = {};

    /* The shop's own word beats anything read off a photograph — but only when
       the garment has one colour, because a title names one colour and cannot
       say which of several it belongs to. */
    const titleColor = colorValues.size === 1 ? colorNameFromTitle(product.title) : null;

    for (const value of colorValues) {
      // "Цвят 25" on the variant, "Цвят-25" on disk.
      const dir = path.join(IMAGES, article, value.replace(/\s+/g, "-"));
      let files: string[];
      try {
        files = (await fs.readdir(dir)).filter((f) => /\.jpe?g$/i.test(f)).sort();
      } catch {
        missing += 1;
        continue;
      }
      if (files.length === 0) {
        missing += 1;
        continue;
      }

      const rgb = await dominantColor(path.join(dir, files[0]!));
      if (!rgb) {
        missing += 1;
        continue;
      }

      // The swatch always comes from the photograph; only the word can differ.
      swatches[value] = rgbToHex(...rgb);
      if (titleColor) {
        names[value] = titleColor;
        fromTitle += 1;
      } else {
        names[value] = colorNameFromRgb(...rgb);
      }
      named += 1;
    }

    if (Object.keys(names).length === 0) continue;
    updates.push({
      id: product.id,
      metadata: {
        ...((product.metadata as Record<string, unknown> | null) ?? {}),
        color_names: names,
        color_swatches: swatches,
      },
    });
  }

  if (updates.length === 0) {
    logger.info("No product photography found to sample. Nothing renamed.");
    return;
  }

  await updateProductsWorkflow(container).run({ input: { products: updates } });
  logger.info(
    `Named ${named} colours across ${updates.length} products ` +
      `(${fromTitle} taken from the product title, ${named - fromTitle} sampled from photography)` +
      (missing > 0 ? `; ${missing} had no usable photograph and keep their id.` : "."),
  );
}
