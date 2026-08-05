import JSZip from "jszip";
import { parsePhotoName } from "@redpoint/catalog";

/**
 * Reading the photo archive that comes with the spreadsheet.
 *
 * Only lists and extracts. Matching photos to rows is in @redpoint/catalog,
 * where it can be tested without a zip file.
 */

export class ArchiveError extends Error {}

/** Anything else in the archive is a thumbnail cache or a stray document. */
const IMAGE = /\.(jpe?g|png|webp)$/i;

/** Windows and macOS both litter archives with their own bookkeeping. */
const JUNK = /(^|\/)(__MACOSX\/|\._|Thumbs\.db$|\.DS_Store$)/i;

export interface ArchivePhoto {
  /** Name only, no folder — the convention is about the file, not its path. */
  fileName: string;
  read: () => Promise<Buffer>;
}

export async function readPhotoArchive(buffer: Buffer): Promise<ArchivePhoto[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ArchiveError("Архивът не може да бъде отворен. Уверете се, че е .zip.");
  }

  const photos: ArchivePhoto[] = [];

  zip.forEach((path, entry) => {
    if (entry.dir || JUNK.test(path) || !IMAGE.test(path)) return;

    /* Shops zip the folder, not the files in it, so half the archives arrive
       as photos/17350_синьо_1.jpg. The convention is about the file name, so
       the folders are simply dropped. */
    const fileName = path.replace(/^.*[\\/]/, "");
    photos.push({ fileName, read: () => entry.async("nodebuffer") });
  });

  if (photos.length === 0) {
    throw new ArchiveError(
      "В архива няма нито една снимка. Очакват се .jpg файлове с имена {артикул}_{цвят}_{номер}.jpg",
    );
  }

  return photos;
}

/** Names only, for the validation pass that runs before anything is written. */
export function photoNames(photos: ArchivePhoto[]): string[] {
  return photos.map((photo) => photo.fileName);
}

/** Photos whose name does not follow the convention, for reporting. */
export function unparseable(photos: ArchivePhoto[]): string[] {
  return photos.filter((photo) => !parsePhotoName(photo.fileName)).map((photo) => photo.fileName);
}
