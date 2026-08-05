import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { ExecArgs } from "@medusajs/framework/types";
import { parseBulkRows, matchPhotos, type BulkProduct } from "@redpoint/catalog";
import { readWorkbook, writeTemplate, writeWorkbook, WorkbookError } from "../modules/bulk/workbook";
import { readPhotoArchive, photoNames } from "../modules/bulk/photos";

/**
 * Proves the file layer: the round trip, the header aliases, and the archive.
 *
 *   pnpm --filter @redpoint/backend exec medusa exec ./src/scripts/check-bulk-files.ts
 *
 * The round trip is the promise the export makes. A shop exports the
 * catalogue, changes two prices in Excel and imports it back; if anything else
 * moves in that journey, the export is a trap rather than a tool.
 */
export default async function checkBulkFiles({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);

  // --- the template is itself importable ----------------------------------
  const template = await writeTemplate();
  const templateRows = await readWorkbook(template);
  const templateParsed = parseBulkRows(templateRows);
  check("template reads back with no errors", templateParsed.issues.length === 0,
    JSON.stringify(templateParsed.issues));
  check("template holds one example article", templateParsed.products.length === 1);

  // --- the round trip ------------------------------------------------------
  const original: BulkProduct[] = [
    {
      sku: "17350",
      name: "Дънки в по-светъл деним",
      categoryKey: "men-jeans",
      categoryName: "Дънки",
      price: 45.5,
      compareAtPrice: 91,
      material: "99% памук",
      description: "Права кройка, изсветлен ефект.",
      colors: [
        { name: "синьо", sizes: [{ label: "31", quantity: 5 }, { label: "32", quantity: 0 }] },
        { name: "черно", sizes: [{ label: "31", quantity: 2 }] },
      ],
    },
    {
      sku: "16876",
      name: "Тъмносиньо яке",
      categoryKey: "men-jackets",
      categoryName: "Якета",
      price: 37,
      compareAtPrice: null,
      material: null,
      description: null,
      colors: [{ name: "синьо", sizes: [{ label: "S", quantity: 1 }] }],
    },
  ];

  const exported = await writeWorkbook(original);
  const round = parseBulkRows(await readWorkbook(exported));

  check("round trip has no errors", round.issues.length === 0, JSON.stringify(round.issues));
  check("round trip keeps both articles", round.products.length === 2);
  check(
    "round trip is identical",
    JSON.stringify(round.products) === JSON.stringify(original),
    JSON.stringify(round.products),
  );

  // Zero stock and a null old price are the two that quietly go missing.
  const jeans = round.products.find((p) => p.sku === "17350");
  check("zero stock survives the round trip", jeans?.colors[0]?.sizes[1]?.quantity === 0);
  check("decimal price survives", jeans?.price === 45.5, String(jeans?.price));
  const jacket = round.products.find((p) => p.sku === "16876");
  check("absent old price stays absent", jacket?.compareAtPrice === null, String(jacket?.compareAtPrice));

  // --- header wording a shop might actually use ----------------------------
  const alt = new ExcelJS.Workbook();
  const altSheet = alt.addWorksheet("Лист1");
  altSheet.addRow(["SKU", "Наименование", "Категория", "Цвят", "Размер", "Наличност", "Цена"]);
  altSheet.addRow(["900", "Тест", "Ризи", "бяло", "L", 4, "19,90"]);
  const altRows = await readWorkbook(Buffer.from(await alt.xlsx.writeBuffer()));
  const altParsed = parseBulkRows(altRows);
  check("alternative headers accepted", altParsed.issues.length === 0, JSON.stringify(altParsed.issues));
  check("comma price read from a real cell", altParsed.products[0]?.price === 19.9,
    String(altParsed.products[0]?.price));

  // --- a sheet missing a required column ------------------------------------
  const bad = new ExcelJS.Workbook();
  bad.addWorksheet("Лист1").addRow(["Артикул", "Име", "Цена"]);
  let refused = false;
  let refusalMessage = "";
  try {
    await readWorkbook(Buffer.from(await bad.xlsx.writeBuffer()));
  } catch (error) {
    refused = error instanceof WorkbookError;
    refusalMessage = error instanceof Error ? error.message : "";
  }
  check("missing columns are refused by name", refused && /Цвят/.test(refusalMessage), refusalMessage);

  // --- a file that is not a spreadsheet at all ------------------------------
  let notASheet = false;
  try {
    await readWorkbook(Buffer.from("това не е excel", "utf8"));
  } catch (error) {
    notASheet = error instanceof WorkbookError;
  }
  check("a non-xlsx file is refused in Bulgarian", notASheet);

  // --- the photo archive ----------------------------------------------------
  const zip = new JSZip();
  zip.file("снимки/17350_синьо_1.jpg", "x");
  zip.file("снимки/17350_синьо_2.jpg", "x");
  zip.file("__MACOSX/._17350_синьо_1.jpg", "x");
  zip.file("снимки/Thumbs.db", "x");
  zip.file("бележки.txt", "x");
  const archive = await readPhotoArchive(Buffer.from(await zip.generateAsync({ type: "nodebuffer" })));

  check("folders are stripped from photo names", archive.some((p) => p.fileName === "17350_синьо_1.jpg"));
  check("macOS and Windows junk is ignored", archive.length === 2, String(archive.length));

  const matched = matchPhotos(
    [original[0]!],
    photoNames(archive),
  );
  check(
    "photos match the sheet, and the missing colour is reported",
    matched.byColor.get("17350|синьо")?.length === 2 &&
      matched.issues.some((issue) => /черно.*няма нито една снимка/.test(issue.message)),
    JSON.stringify(matched.issues),
  );

  let emptyArchive = false;
  try {
    const none = new JSZip();
    none.file("readme.txt", "x");
    await readPhotoArchive(Buffer.from(await none.generateAsync({ type: "nodebuffer" })));
  } catch {
    emptyArchive = true;
  }
  check("an archive with no photos is refused", emptyArchive);

  let failed = 0;
  for (const [name, ok, detail] of results) {
    logger.info(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  <- ${detail}`}`);
    if (!ok) failed += 1;
  }
  if (failed > 0) throw new Error(`${failed} of ${results.length} file checks failed`);
  logger.info(`all ${results.length} file checks passed`);
}
