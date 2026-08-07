import { defineMiddlewares } from "@medusajs/framework/http";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * File uploads for the bulk import screen.
 *
 * Written to disk rather than held in memory. Memory was the original choice —
 * a spreadsheet is read once and thrown away, and files on disk are files
 * somebody has to delete. Then the VPS turned out to be 2 GB: a 200 MB archive
 * held by multer, plus the same archive again inside JSZip, on top of the
 * ~970 MB the stack already uses, is a backend killed mid-upload while
 * customers are on the site. The routes delete what they read in a `finally`.
 *
 * The cap is 150 MB, and it is measured rather than guessed. `check-upload-
 * memory.ts` zips the shop's own 476 photographs — 88.6 MB — and reads them
 * back the way these routes do. It costs roughly one copy of the archive
 * rather than two, which is what moving to disk bought. The exact figure moves
 * between runs depending on when the collector last ran, so the check asserts
 * the shape (one copy, not two) rather than a number. At the cap that is about
 * 150 MB on top of the ~970 MB the stack uses: comfortable inside 2 GB.
 *
 * 80 MB was the first attempt and the check refused the shop's own catalogue
 * by 8.6 MB. JPEGs do not compress, so a zip of photographs is the size of the
 * photographs — an obvious thing that was wrong in a comment for an hour.
 */
const UPLOAD_DIR = join(tmpdir(), "redpoint-uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR }),
  limits: { fileSize: 150 * 1024 * 1024, files: 2 },
});

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/bulk/validate",
      method: "POST",
      middlewares: [
        upload.fields([
          { name: "sheet", maxCount: 1 },
          { name: "photos", maxCount: 1 },
        ]),
      ],
    },
    {
      matcher: "/admin/bulk/import",
      method: "POST",
      middlewares: [
        upload.fields([
          { name: "sheet", maxCount: 1 },
          { name: "photos", maxCount: 1 },
        ]),
      ],
    },
    {
      matcher: "/admin/bulk/photos",
      method: "POST",
      middlewares: [upload.fields([{ name: "photos", maxCount: 1 }])],
    },
  ],
});
