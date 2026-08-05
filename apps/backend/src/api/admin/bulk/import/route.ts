import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { reviewUpload } from "../../../../modules/bulk/service";
import { WorkbookError } from "../../../../modules/bulk/workbook";
import { ArchiveError } from "../../../../modules/bulk/photos";
import { importBulkWorkflow } from "../../../../workflows/import-bulk";

/**
 * Applies an upload, all of it or none of it.
 *
 * Re-reads and re-validates the files rather than trusting a plan the browser
 * sends back. The preview happened seconds ago, but between then and now the
 * catalogue can move — and a plan computed by a client is a plan an attacker
 * can write.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const files = (req as unknown as { files?: Record<string, { buffer: Buffer }[]> }).files;

  const sheet = files?.sheet?.[0]?.buffer;
  if (!sheet) {
    res.status(400).json({ message: "Прикачете .xlsx файл с артикулите." });
    return;
  }

  let review;
  try {
    review = await reviewUpload(query, { sheet, photos: files?.photos?.[0]?.buffer });
  } catch (error) {
    if (error instanceof WorkbookError || error instanceof ArchiveError) {
      res.status(400).json({ message: error.message });
      return;
    }
    logger.error(`bulk import could not read the upload: ${error}`);
    res.status(500).json({ message: "Файлът не можа да бъде обработен." });
    return;
  }

  if (!review.plan) {
    res.status(400).json({
      message: "Таблицата има грешки и не е импортирана. Поправете ги и опитайте отново.",
      issues: review.issues,
    });
    return;
  }

  const [categories, channels, profiles, locations, store] = await Promise.all([
    query.graph({ entity: "product_category", fields: ["id", "handle"] }),
    query.graph({ entity: "sales_channel", fields: ["id"] }),
    query.graph({ entity: "shipping_profile", fields: ["id"] }),
    query.graph({ entity: "stock_location", fields: ["id"] }),
    query.graph({ entity: "store", fields: ["default_currency_code", "default_sales_channel_id"] }),
  ]);

  /* The store's own channel, never simply the first one in the list.
     A fresh Medusa install carries a "Default Sales Channel" alongside the
     seeded one, and the storefront's publishable key is bound to the seeded
     one. Picking [0] put imported products in the channel nobody reads: they
     appeared in the admin, complete and published, and were invisible in the
     shop — the hardest kind of failure to diagnose, because nothing errors. */
  const salesChannelId =
    (store.data[0]?.default_sales_channel_id as string | undefined) ??
    (channels.data.length === 1 ? channels.data[0]?.id : undefined);
  const shippingProfileId = profiles.data[0]?.id;
  const stockLocationId = locations.data[0]?.id;

  if (!salesChannelId || !shippingProfileId || !stockLocationId) {
    logger.error("bulk import: the store is missing a sales channel, shipping profile or location");
    res.status(500).json({ message: "Магазинът не е конфигуриран напълно. Свържете се с разработчика." });
    return;
  }

  try {
    await importBulkWorkflow(req.scope).run({
      input: {
        plan: review.plan,
        categoryIds: Object.fromEntries(
          categories.data.map((category: { handle: string; id: string }) => [
            category.handle,
            category.id,
          ]),
        ),
        salesChannelId,
        shippingProfileId,
        stockLocationId,
        currencyCode: store.data[0]?.default_currency_code ?? "eur",
      },
    });
  } catch (error) {
    /* The workflow compensates on the way out, so the catalogue is as it was.
       Saying so matters: the shop's next question is whether it has to undo
       something by hand. */
    logger.error(`bulk import failed and was rolled back: ${error}`);
    res.status(500).json({
      message:
        "Импортът не успя и беше отменен изцяло. Каталогът е непроменен. " +
        "Ако се повтори, изпратете файла на разработчика.",
    });
    return;
  }

  logger.info(
    `bulk import applied: ${review.plan.counts.productsCreated} created, ` +
      `${review.plan.counts.productsUpdated} updated`,
  );

  res.json({ counts: review.plan.counts, orphanedVariants: review.plan.orphanedVariants });
}
