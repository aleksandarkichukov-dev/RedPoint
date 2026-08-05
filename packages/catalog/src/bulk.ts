import { flattenCategories } from "./categories";

/**
 * The spreadsheet the shop lives in.
 *
 * One row per article-colour-size, which is how someone counting stock thinks:
 * a rail of jeans in one wash, sizes 30 to 36, so many of each. The
 * product-level columns repeat down those rows. That is redundant in a
 * database sense and right in a spreadsheet one — it survives sorting and
 * filtering in Excel, which a normalised layout does not.
 *
 * Parsing and validation live here, in the shared package, with no Medusa and
 * no file format. What arrives is rows of strings; what leaves is either
 * products ready to import or a list of errors a shopkeeper can act on. That
 * separation is what makes this testable without a spreadsheet or a database.
 */

/** Column headers, exactly as they appear in the file. Order is the file's order. */
export const BULK_COLUMNS = [
  "Артикул",
  "Име",
  "Категория",
  "Цвят",
  "Размер",
  "Количество",
  "Цена",
  "Стара цена",
  "Състав",
  "Описание",
] as const;

export type BulkColumn = (typeof BULK_COLUMNS)[number];

/** A row as read from the file: every cell a string, blanks as "". */
export type BulkRow = Record<BulkColumn, string>;

export interface BulkIssue {
  /** 1-based row number as shown in Excel, header included. */
  row: number;
  column?: BulkColumn;
  message: string;
}

export interface BulkSize {
  label: string;
  quantity: number;
}

export interface BulkColor {
  name: string;
  sizes: BulkSize[];
}

export interface BulkProduct {
  sku: string;
  name: string;
  categoryKey: string;
  categoryName: string;
  price: number;
  compareAtPrice: number | null;
  material: string | null;
  description: string | null;
  colors: BulkColor[];
}

export interface BulkParseResult {
  products: BulkProduct[];
  issues: BulkIssue[];
}

/**
 * Leaf categories only — a product never sits on a grouping level.
 *
 * Exported so the template can print the list the validation checks against.
 * Two hand-kept copies would agree until the day the tree changes, and then the
 * file would name a category the import rejects.
 */
export function leafCategories() {
  const flat = flattenCategories();
  return flat.filter((category) => !flat.some((other) => other.parentKey === category.key));
}

/**
 * Excel hands numbers back as text with whatever separator the machine uses.
 * A Bulgarian keyboard produces "45,00" and a formula produces "45.00"; both
 * mean the same money and rejecting either would be a support call.
 */
function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseInteger(raw: string): number | null {
  const value = parseNumber(raw);
  if (value === null) return null;
  return Number.isInteger(value) ? value : null;
}

export function parseBulkRows(rows: BulkRow[]): BulkParseResult {
  const issues: BulkIssue[] = [];
  const categories = leafCategories();
  const categoryByName = new Map(categories.map((category) => [category.name, category]));

  /* Row 1 is the header, so the first data row is 2 — the number the shop sees
     in Excel's gutter. Every message below counts the same way. */
  const rowNumber = (index: number) => index + 2;

  const byArticle = new Map<string, BulkProduct>();
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const line = rowNumber(index);
    const value = (column: BulkColumn) => (row[column] ?? "").trim();

    const sku = value("Артикул");
    const color = value("Цвят");
    const size = value("Размер");

    // A wholly blank row is a scroll artefact, not a mistake worth reporting.
    if (!sku && !color && !size && BULK_COLUMNS.every((column) => !value(column))) return;

    if (!sku) {
      issues.push({ row: line, column: "Артикул", message: `Ред ${line}: липсва артикулен номер` });
      return;
    }
    if (!color) {
      issues.push({ row: line, column: "Цвят", message: `Ред ${line}: липсва цвят` });
      return;
    }
    if (!size) {
      issues.push({ row: line, column: "Размер", message: `Ред ${line}: липсва размер` });
      return;
    }

    const key = `${sku}|${color}|${size}`;
    if (seen.has(key)) {
      issues.push({
        row: line,
        message: `Ред ${line}: артикул ${sku}, цвят "${color}", размер ${size} се повтаря`,
      });
      return;
    }
    seen.add(key);

    const quantity = parseInteger(value("Количество"));
    if (quantity === null) {
      issues.push({
        row: line,
        column: "Количество",
        message: `Ред ${line}: количеството трябва да е цяло число`,
      });
      return;
    }
    if (quantity < 0) {
      issues.push({
        row: line,
        column: "Количество",
        message: `Ред ${line}: количеството не може да е отрицателно`,
      });
      return;
    }

    let product = byArticle.get(sku);

    if (!product) {
      const name = value("Име");
      const categoryName = value("Категория");
      const price = parseNumber(value("Цена"));
      const compareRaw = value("Стара цена");
      const compareAt = compareRaw === "" ? null : parseNumber(compareRaw);

      if (!name) {
        issues.push({ row: line, column: "Име", message: `Ред ${line}: липсва име на артикула` });
        return;
      }
      if (!categoryName) {
        issues.push({ row: line, column: "Категория", message: `Ред ${line}: липсва категория` });
        return;
      }

      const category = categoryByName.get(categoryName);
      if (!category) {
        issues.push({
          row: line,
          column: "Категория",
          message:
            `Ред ${line}: няма категория "${categoryName}". ` +
            `Допустимите са: ${categories.map((entry) => entry.name).join(", ")}`,
        });
        return;
      }

      if (price === null) {
        issues.push({ row: line, column: "Цена", message: `Ред ${line}: липсва или сгрешена цена` });
        return;
      }
      if (price <= 0) {
        issues.push({
          row: line,
          column: "Цена",
          message: `Ред ${line}: цената трябва да е по-голяма от нула`,
        });
        return;
      }
      if (compareRaw !== "" && compareAt === null) {
        issues.push({
          row: line,
          column: "Стара цена",
          message: `Ред ${line}: старата цена не е число`,
        });
        return;
      }
      if (compareAt !== null && compareAt <= price) {
        issues.push({
          row: line,
          column: "Стара цена",
          message:
            `Ред ${line}: старата цена (${compareAt}) трябва да е по-голяма от новата (${price}), ` +
            "иначе няма намаление",
        });
        return;
      }

      product = {
        sku,
        name,
        categoryKey: category.key,
        categoryName: category.name,
        price,
        compareAtPrice: compareAt,
        material: value("Състав") || null,
        description: value("Описание") || null,
        colors: [],
      };
      byArticle.set(sku, product);
    } else {
      /* Later rows for the same article repeat its product-level columns. A
         disagreement is almost always a typo in one of them, and importing
         whichever came first would silently pick a winner. */
      const conflicts: [BulkColumn, string, string][] = [];
      const name = value("Име");
      const categoryName = value("Категория");
      const price = parseNumber(value("Цена"));

      if (name && name !== product.name) conflicts.push(["Име", product.name, name]);
      if (categoryName && categoryName !== product.categoryName) {
        conflicts.push(["Категория", product.categoryName, categoryName]);
      }
      if (price !== null && price !== product.price) {
        conflicts.push(["Цена", String(product.price), String(price)]);
      }

      for (const [column, first, now] of conflicts) {
        issues.push({
          row: line,
          column,
          message: `Ред ${line}: артикул ${sku} вече е с ${column.toLowerCase()} "${first}", а тук пише "${now}"`,
        });
      }
      if (conflicts.length > 0) return;
    }

    let colorEntry = product.colors.find((entry) => entry.name === color);
    if (!colorEntry) {
      colorEntry = { name: color, sizes: [] };
      product.colors.push(colorEntry);
    }
    colorEntry.sizes.push({ label: size, quantity });
  });

  return { products: [...byArticle.values()], issues };
}

/** `{артикул}_{цвят}_{номер}.jpg`, the convention the brief fixes. */
export interface PhotoName {
  sku: string;
  color: string;
  index: number;
}

export function parsePhotoName(fileName: string): PhotoName | null {
  const base = fileName.replace(/^.*[\\/]/, "");
  const match = base.match(/^(.+)_(.+)_(\d+)\.(jpe?g|png|webp)$/i);
  if (!match) return null;

  return { sku: match[1]!, color: match[2]!, index: Number(match[3]) };
}

/**
 * Checks the photos in the archive against the rows.
 *
 * Both directions matter. A photo for an article that is not in the sheet is
 * usually a leftover from last week; a colour in the sheet with no photo ships
 * a product with an empty frame.
 */
export function matchPhotos(
  products: BulkProduct[],
  fileNames: string[],
): { issues: BulkIssue[]; byColor: Map<string, string[]> } {
  const issues: BulkIssue[] = [];
  const byColor = new Map<string, string[]>();

  const wanted = new Set<string>();
  for (const product of products) {
    for (const color of product.colors) wanted.add(`${product.sku}|${color.name}`);
  }

  for (const fileName of fileNames) {
    const parsed = parsePhotoName(fileName);
    if (!parsed) {
      issues.push({
        row: 0,
        message: `Снимка "${fileName}" не следва формата {артикул}_{цвят}_{номер}.jpg и се пропуска`,
      });
      continue;
    }

    const key = `${parsed.sku}|${parsed.color}`;
    if (!wanted.has(key)) {
      issues.push({
        row: 0,
        message: `Снимка "${fileName}" е за артикул ${parsed.sku}, цвят "${parsed.color}", който не е в таблицата`,
      });
      continue;
    }

    const list = byColor.get(key) ?? [];
    list.push(fileName);
    byColor.set(key, list);
  }

  for (const key of wanted) {
    if (!byColor.has(key)) {
      const [sku, color] = key.split("|");
      issues.push({ row: 0, message: `Артикул ${sku}, цвят "${color}" няма нито една снимка` });
    }
  }

  // "_2" must follow "_1", so the gallery order is the shop's order.
  for (const [key, files] of byColor) {
    byColor.set(
      key,
      files.sort((a, b) => (parsePhotoName(a)?.index ?? 0) - (parsePhotoName(b)?.index ?? 0)),
    );
  }

  return { issues, byColor };
}
