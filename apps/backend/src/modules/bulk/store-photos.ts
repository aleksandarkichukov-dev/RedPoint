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
        filename: `products/${parsed.sku}/${parsed.color}/${parsed.index}${extension(photo.fileName)}`,
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
