import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { reviewUpload } from "../../../../modules/bulk/service";
import { WorkbookError } from "../../../../modules/bulk/workbook";
import { ArchiveError } from "../../../../modules/bulk/photos";

/**
 * Checks an upload and reports what importing it would do. Writes nothing.
 *
 * The preview and the import run the same review, so the screen can never
 * promise something the button will not carry out.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const files = (req as unknown as { files?: Record<string, { buffer: Buffer }[]> }).files;

  const sheet = files?.sheet?.[0]?.buffer;
  if (!sheet) {
    res.status(400).json({ message: "Прикачете .xlsx файл с артикулите." });
    return;
  }

  try {
    const review = await reviewUpload(query, { sheet, photos: files?.photos?.[0]?.buffer });

    res.json({
      issues: review.issues,
      /* Rows first, then the archive's own complaints. A shop reads top to
         bottom and the row errors are the ones they can fix in Excel. */
      counts: review.plan?.counts ?? null,
      orphanedVariants: review.plan?.orphanedVariants ?? [],
      productCount: review.products.length,
      photoCount: review.photos?.total ?? 0,
      canImport: review.plan !== null,
    });
  } catch (error) {
    // These two carry messages written for the shop, so they are passed through.
    if (error instanceof WorkbookError || error instanceof ArchiveError) {
      res.status(400).json({ message: error.message });
      return;
    }
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`bulk validate failed: ${error}`);
    res.status(500).json({ message: "Файлът не можа да бъде обработен." });
  }
}
