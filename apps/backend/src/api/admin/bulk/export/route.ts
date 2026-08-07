import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { exportCatalogue } from "../../../../modules/bulk/service";
import { stockByVariant } from "../../../../modules/bulk/stock";
import { writeWorkbook } from "../../../../modules/bulk/workbook";

/**
 * The whole catalogue as the same .xlsx the import reads.
 *
 * This is the other half of the daily tool. Without it, changing the price of
 * thirty articles means typing thirty articles; with it, the shop downloads,
 * edits one column and uploads the same file back.
 *
 * The round trip is the promise: downloaded and re-uploaded untouched, nothing
 * changes. That is what makes it safe to reach for, and it is why the export
 * uses the same writer as the template rather than a second one that would
 * drift a column.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  try {
    /* Stock first, because the catalogue rows need it. Reading it per row
       would be a query per size — a hundred articles is several hundred
       round trips for a button somebody presses while waiting. */
    const stock = await stockByVariant(req.scope);
    const products = await exportCatalogue(query, stock);
    const workbook = await writeWorkbook(products);

    const today = new Date().toISOString().slice(0, 10);

    res.setHeader(
      "content-type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    /* Dated, because the shop will end up with several of these in Downloads
       and the useful question is always "which one did I export before I
       changed the prices". */
    res.setHeader("content-disposition", `attachment; filename="red-point-${today}.xlsx"`);

    logger.info(`catalogue exported: ${products.length} articles`);
    res.send(workbook);
  } catch (error) {
    logger.error(`catalogue export failed: ${error}`);
    res.status(500).json({ message: "Каталогът не можа да бъде свален." });
  }
}
