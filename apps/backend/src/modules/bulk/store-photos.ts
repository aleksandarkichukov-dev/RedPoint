import { Modules } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";
import { parsePhotoName } from "@redpoint/catalog";
import type { ArchivePhoto } from "./photos";

/**
 * Puts uploaded photographs where the storefront can serve them.
 *
 * Goes through Medusa's file module rather than writing to disk, so the day the
 * VPS moves to object storage this keeps working — the provider changes in
 * medusa-config and nothing here does.
 *
 * Colour is part of the stored name because the storefront groups a product's
 * gallery by colour: `color_images` in product metadata maps a colour to its
 * photographs, and that mapping is built here.
 */

export interface StoredPhoto {
  sku: string;
  color: string;
  index: number;
  url: string;
}

/**
 * One path segment, guaranteed to stay one path segment.
 *
 * The article and colour come out of a file name inside an uploaded zip, and
 * `parsePhotoName` reads them as `(.+)_(.+)_(\d+)` — which happily matches
 * `.._.._1.jpg`. Interpolated into `products/{sku}/{colour}/{n}` that walks out
 * of the upload directory and writes beside the running application.
 *
 * Whoever uploads has to be signed into the admin already, so this is not the
 * front door. It is still the difference between a bad archive corrupting its
 * own folder and a bad archive writing wherever it likes, and one function
 * closes it. Everything a real colour name contains, Cyrillic included, stays.
 */
function safeSegment(value: string): string {
  const cleaned = Array.from(value)
    /* Compared by code point, not against character literals. A control
       character written into a literal is invisible in a diff, and this is
       the line holding the directory shut: it has to be readable to be
       reviewable. */
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join("")
    .replace(/[\\/]/g, "-")
    .trim();

  /* A segment of nothing but dots is the whole trick, so it is refused as a
     unit rather than having its dots stripped — `.` and `..` both name a
     directory, while a colour called `1.2` is fine and has to survive. */
  if (cleaned.length === 0 || /^\.+$/.test(cleaned)) return "неозначено";
  return cleaned.slice(0, 100);
}

/**
 * Where one photograph is stored.
 *
 * Split out from the upload so it can be checked on its own, without a
 * database or a zip file. `check-photo-paths.ts` is what proves the guard
 * above still holds after somebody edits it.
 */
export function photoPath(
  parsed: { sku: string; color: string; index: number },
  fileName: string,
): string {
  return `products/${safeSegment(parsed.sku)}/${safeSegment(parsed.color)}/${parsed.index}${extension(fileName)}`;
}

export async function storePhotos(
  container: MedusaContainer,
  photos: ArchivePhoto[],
): Promise<StoredPhoto[]> {
  const fileModule = container.resolve(Modules.FILE);
  const stored: StoredPhoto[] = [];

  for (const photo of photos) {
    const parsed = parsePhotoName(photo.fileName);
    if (!parsed) continue;

    const content = await photo.read();
    const [file] = await fileModule.createFiles([
      {
        filename: photoPath(parsed, photo.fileName),
        mimeType: mimeType(photo.fileName),
        content: content.toString("binary"),
      },
    ]);

    if (file?.url) {
      stored.push({ sku: parsed.sku, color: parsed.color, index: parsed.index, url: file.url });
    }
  }

  return stored;
}

function extension(fileName: string): string {
  const match = fileName.match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : ".jpg";
}

function mimeType(fileName: string): string {
  const ext = extension(fileName);
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

/** `{ "синьо": ["url", ...] }`, ordered, as the storefront reads it. */
export function colorImages(stored: StoredPhoto[], sku: string): Record<string, string[]> {
  const byColor: Record<string, string[]> = {};

  for (const photo of stored.filter((entry) => entry.sku === sku).sort((a, b) => a.index - b.index)) {
    (byColor[photo.color] ??= []).push(photo.url);
  }

  return byColor;
}

/** Every photograph for one article, gallery order, for `product.images`. */
export function productImages(stored: StoredPhoto[], sku: string): string[] {
  return stored
    .filter((entry) => entry.sku === sku)
    .sort((a, b) => a.color.localeCompare(b.color, "bg") || a.index - b.index)
    .map((entry) => entry.url);
}
