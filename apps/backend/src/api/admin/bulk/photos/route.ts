import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import { reviewPhotosOnly } from "../../../../modules/bulk/service";
import { readPhotoArchive, ArchiveError } from "../../../../modules/bulk/photos";
import { colorImages, productImages, storePhotos } from "../../../../modules/bulk/store-photos";

/**
 * Photographs on their own, with no spreadsheet.
 *
 * The everyday case: the article is already in the shop and only its pictures
 * have changed. Making someone fill in a price and a category to replace a
 * photograph is the kind of friction that ends with nobody updating anything.
 *
 * `?dry=1` reviews without writing, which is what the screen's Провери button
 * uses.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const files = (req as unknown as { files?: Record<string, { buffer: Buffer }[]> }).files;

  const archive = files?.photos?.[0]?.buffer;
  if (!archive) {
    res.status(400).json({ message: "Прикачете .zip архив със снимките." });
    return;
  }

  let review;
  try {
    review = await reviewPhotosOnly(query, archive);
  } catch (error) {
    if (error instanceof ArchiveError) {
      res.status(400).json({ message: error.message });
      return;
    }
    logger.error(`bulk photos review failed: ${error}`);
    res.status(500).json({ message: "Архивът не можа да бъде обработен." });
    return;
  }

  const dryRun = req.query.dry === "1";
  if (dryRun) {
    res.json({ ...review, canImport: review.articles.length > 0 });
    return;
  }

  if (review.articles.length === 0) {
    res.status(400).json({
      message: "Нито една снимка не съответства на артикул в магазина.",
      issues: review.issues,
    });
    return;
  }

  try {
    /* Stored first, then attached. A photograph that fails to save must not
       leave a product pointing at a URL that serves nothing. */
    const stored = await storePhotos(req.scope, await readPhotoArchive(archive));

    await updateProductsWorkflow(req.scope).run({
      input: {
        products: review.articles.map((article) => ({
          id: article.productId,
          images: productImages(stored, article.sku).map((url) => ({ url })),
          metadata: { color_images: colorImages(stored, article.sku) },
        })),
      },
    });

    logger.info(
      `bulk photos: ${stored.length} photographs attached to ${review.articles.length} articles`,
    );
    res.json({ articles: review.articles, stored: stored.length, issues: review.issues });
  } catch (error) {
    logger.error(`bulk photos import failed: ${error}`);
    res.status(500).json({
      message: "Снимките не бяха качени. Каталогът е непроменен.",
    });
  }
}
