import type { MedusaRequest } from "@medusajs/framework/http";
import { readFile, unlink } from "node:fs/promises";

/**
 * Reading what the bulk screen uploaded, without keeping it all on the heap.
 *
 * The uploads used to be held in memory: multer with `memoryStorage` and a
 * 200 MB cap, and then JSZip decompressing the same archive again. Two full
 * copies of a large zip, transiently, on top of the ~970 MB the stack already
 * uses. On a 4 GB box nobody would ever have noticed. The VPS is 2 GB, so a
 * shop uploading a season's photography would have killed the backend
 * mid-upload — while customers were on the site.
 *
 * Now multer writes to disk and only what is being read is in memory. The zip
 * still has to be handed to JSZip whole, because JSZip cannot stream from a
 * file; a streaming reader would remove even that, and is the right change if
 * the archives ever grow past the cap rather than a change worth a new
 * dependency today.
 *
 * Every caller must clean up. A validation run that leaves files behind fills
 * the disk with archives nobody will ever look at, which is the failure the
 * original memory storage was avoiding.
 */

interface UploadedFile {
  path: string;
  originalname: string;
  size: number;
}

type WithFiles = { files?: Record<string, UploadedFile[]> };

/** The temporary path multer wrote, or undefined when the field is absent. */
export function uploadPath(req: MedusaRequest, field: "sheet" | "photos"): string | undefined {
  return (req as unknown as WithFiles).files?.[field]?.[0]?.path;
}

/** Contents of an uploaded field, read once. */
export async function readUpload(
  req: MedusaRequest,
  field: "sheet" | "photos",
): Promise<Buffer | undefined> {
  const path = uploadPath(req, field);
  return path ? readFile(path) : undefined;
}

/**
 * Deletes whatever this request uploaded.
 *
 * Never throws. It runs in a `finally` after the real work, and a failed
 * cleanup must not turn a completed import into an error the shop sees —
 * a leftover temporary file is a smaller problem than a shop that re-runs an
 * import it believes failed.
 */
export async function cleanUploads(req: MedusaRequest): Promise<void> {
  const files = (req as unknown as WithFiles).files ?? {};
  const paths = Object.values(files).flatMap((entries) => entries.map((entry) => entry.path));

  await Promise.all(
    paths.map((path) => unlink(path).catch(() => undefined)),
  );
}
