import ExcelJS from "exceljs";
import {
  BULK_COLUMNS,
  type BulkColumn,
  type BulkProduct,
  type BulkRow,
} from "@redpoint/catalog";

/**
 * Reading and writing the shop's spreadsheet.
 *
 * The only place in the import that knows what a file looks like. Validation
 * lives in @redpoint/catalog and deals in rows of strings, so nothing about
 * Excel leaks into it — and nothing about the business rules leaks into here.
 */

/** Header row wording that shops actually produce, mapped to our columns. */
const HEADER_ALIASES: Record<string, BulkColumn> = {
  "артикул": "Артикул",
  "артикулен номер": "Артикул",
  "sku": "Артикул",
  "име": "Име",
  "наименование": "Име",
  "категория": "Категория",
  "цвят": "Цвят",
  "размер": "Размер",
  "количество": "Количество",
  "наличност": "Количество",
  "бройки": "Количество",
  "цена": "Цена",
  "стара цена": "Стара цена",
  "цена преди": "Стара цена",
  "състав": "Състав",
  "описание": "Описание",
};

export class WorkbookError extends Error {}

/** Cells come back as numbers, dates, formulas or rich text; rows are strings. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === "object") {
    // A formula cell carries its computed result, which is what the shop sees.
    if ("result" in value && value.result !== undefined) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
  }

  return String(value).trim();
}

export async function readWorkbook(buffer: Buffer): Promise<BulkRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new WorkbookError(
      "Файлът не може да бъде прочетен. Уверете се, че е .xlsx, а не .xls или .csv.",
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new WorkbookError("Файлът няма нито един лист.");

  const headerRow = sheet.getRow(1);
  const columnAt = new Map<number, BulkColumn>();

  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const heading = cellText(cell.value).toLowerCase().replace(/\s+/g, " ");
    const column = HEADER_ALIASES[heading];
    if (column) columnAt.set(columnNumber, column);
  });

  const found = new Set(columnAt.values());
  /* Only these four make a row meaningful. Name, category and price are needed
     for a NEW article but not for one that already exists, so the row-level
     validation decides — a sheet that only updates stock is legitimate. */
  const required: BulkColumn[] = ["Артикул", "Цвят", "Размер", "Количество"];
  const missing = required.filter((column) => !found.has(column));
  if (missing.length > 0) {
    throw new WorkbookError(
      `В таблицата липсват колони: ${missing.join(", ")}. ` +
        "Свалете шаблона и попълнете него, ако не сте сигурни.",
    );
  }

  const rows: BulkRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const entry = Object.fromEntries(BULK_COLUMNS.map((column) => [column, ""])) as BulkRow;
    for (const [columnNumber, column] of columnAt) {
      entry[column] = cellText(row.getCell(columnNumber).value);
    }
    rows.push(entry);
  });

  return rows;
}

/**
 * Writes the same shape back out, for bulk price and stock edits.
 *
 * Exported and re-imported without touching anything, this must be a no-op.
 * That round trip is the promise the export makes.
 */
export async function writeWorkbook(products: BulkProduct[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Red Point";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Артикули");
  sheet.columns = BULK_COLUMNS.map((column) => ({
    header: column,
    key: column,
    width:
      column === "Описание" ? 60 : column === "Име" ? 42 : column === "Състав" ? 24 : 14,
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const product of products) {
    for (const color of product.colors) {
      for (const size of color.sizes) {
        sheet.addRow({
          "Артикул": product.sku,
          "Име": product.name,
          "Категория": product.categoryName,
          "Цвят": color.name,
          "Размер": size.label,
          "Количество": size.quantity,
          "Цена": product.price,
          "Стара цена": product.compareAtPrice ?? "",
          "Състав": product.material ?? "",
          "Описание": product.description ?? "",
        });
      }
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** The empty file with one filled-in example row to copy. */
export async function writeTemplate(): Promise<Buffer> {
  return writeWorkbook([
    {
      sku: "17350",
      name: "Дънки в по-светъл деним",
      categoryKey: "men-jeans",
      categoryName: "Дънки",
      price: 45,
      compareAtPrice: 90,
      material: "99% памук, 1% еластан",
      description: "Мъжки дънки с права кройка.",
      colors: [
        { name: "синьо", sizes: [{ label: "31", quantity: 5 }, { label: "32", quantity: 3 }] },
      ],
    },
  ]);
}
