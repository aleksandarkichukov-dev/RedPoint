import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { writeTemplate } from "../../../../modules/bulk/workbook";

/**
 * The empty sheet, with one filled-in row to copy.
 *
 * Generated from the same writer the export uses, so the template can never
 * drift from the format the import expects — which is the usual way a
 * downloadable template becomes a lie.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const file = await writeTemplate();

  res.setHeader(
    "content-type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("content-disposition", 'attachment; filename="red-point-shablon.xlsx"');
  res.send(file);
}
