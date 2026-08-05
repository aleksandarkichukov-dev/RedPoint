import { defineMiddlewares } from "@medusajs/framework/http";
import multer from "multer";

/**
 * File uploads for the bulk import screen.
 *
 * Held in memory rather than written to a temporary directory: the spreadsheet
 * is read once and thrown away, and a validation run that leaves files behind
 * would slowly fill the VPS with abandoned uploads nobody ever looks at.
 *
 * The limit is generous because a zip of product photography legitimately runs
 * to tens of megabytes, and refusing a real day's upload with a size error is
 * a worse failure than holding it briefly.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 2 },
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
