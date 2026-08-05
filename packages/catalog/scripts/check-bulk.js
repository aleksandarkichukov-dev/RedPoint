/* Run with: pnpm --filter @redpoint/catalog test
   Plain node on the built package: no runner to install, and the validation it
   covers is pure, so a test framework would add ceremony without adding cover. */
const { parseBulkRows, matchPhotos, BULK_COLUMNS } = require("../dist/index.js");

const blank = Object.fromEntries(BULK_COLUMNS.map((c) => [c, ""]));
const row = (o) => ({ ...blank, ...o });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "  <- " + extra : "")); }
};

// --- a clean sheet ---------------------------------------------------------
let r = parseBulkRows([
  row({ Артикул: "17350", Име: "Дънки", Категория: "Дънки", Цвят: "синьо", Размер: "31", Количество: "5", Цена: "45", Състав: "99% памук" }),
  row({ Артикул: "17350", Цвят: "синьо", Размер: "32", Количество: "3" }),
  row({ Артикул: "17350", Цвят: "черно", Размер: "31", Количество: "0" }),
]);
check("clean sheet has no issues", r.issues.length === 0, JSON.stringify(r.issues));
check("one product", r.products.length === 1);
check("two colours", r.products[0]?.colors.length === 2);
check("first colour has two sizes", r.products[0]?.colors[0].sizes.length === 2);
check("category resolved to key", r.products[0]?.categoryKey === "men-jeans", r.products[0]?.categoryKey);
check("zero stock is kept, not dropped", r.products[0]?.colors[1].sizes[0].quantity === 0);

// --- missing fields, the brief's own example -------------------------------
r = parseBulkRows([
  row({ Артикул: "1", Име: "X", Категория: "Дънки", Цвят: "", Размер: "M", Количество: "1", Цена: "10" }),
]);
check("missing colour reads like the brief", r.issues[0]?.message === "Ред 2: липсва цвят", r.issues[0]?.message);

// --- Bulgarian decimal comma ----------------------------------------------
r = parseBulkRows([
  row({ Артикул: "2", Име: "Y", Категория: "Ризи", Цвят: "бяло", Размер: "L", Количество: "2", Цена: "45,50" }),
]);
check("comma decimals accepted", r.issues.length === 0 && r.products[0]?.price === 45.5, JSON.stringify(r.issues));

// --- bad category names the shop might type -------------------------------
r = parseBulkRows([
  row({ Артикул: "3", Име: "Z", Категория: "Якета и грейки", Цвят: "черно", Размер: "L", Количество: "1", Цена: "10" }),
]);
check("unknown category names the allowed ones", /няма категория/.test(r.issues[0]?.message || "") && /Дънки/.test(r.issues[0]?.message || ""));

// --- a grouping level must not be accepted --------------------------------
r = parseBulkRows([
  row({ Артикул: "4", Име: "Z", Категория: "Панталони", Цвят: "черно", Размер: "L", Количество: "1", Цена: "10" }),
]);
check("leaf 'Панталони' resolves to men-trousers, not the group", r.products[0]?.categoryKey === "men-trousers", r.products[0]?.categoryKey);

// --- quantities -----------------------------------------------------------
r = parseBulkRows([row({ Артикул: "5", Име: "A", Категория: "Дънки", Цвят: "с", Размер: "M", Количество: "2.5", Цена: "10" })]);
check("fractional quantity rejected", /цяло число/.test(r.issues[0]?.message || ""));
r = parseBulkRows([row({ Артикул: "6", Име: "A", Категория: "Дънки", Цвят: "с", Размер: "M", Количество: "-1", Цена: "10" })]);
check("negative quantity rejected", /отрицателно/.test(r.issues[0]?.message || ""));

// --- discount sanity ------------------------------------------------------
r = parseBulkRows([row({ Артикул: "7", Име: "A", Категория: "Дънки", Цвят: "с", Размер: "M", Количество: "1", Цена: "50", "Стара цена": "40" })]);
check("old price below new is rejected", /по-голяма от новата/.test(r.issues[0]?.message || ""));

// --- duplicate row --------------------------------------------------------
r = parseBulkRows([
  row({ Артикул: "8", Име: "A", Категория: "Дънки", Цвят: "с", Размер: "M", Количество: "1", Цена: "10" }),
  row({ Артикул: "8", Цвят: "с", Размер: "M", Количество: "2" }),
]);
check("duplicate article/colour/size caught", /се повтаря/.test(r.issues[0]?.message || ""));

// --- conflicting product-level value --------------------------------------
r = parseBulkRows([
  row({ Артикул: "9", Име: "A", Категория: "Дънки", Цвят: "с", Размер: "M", Количество: "1", Цена: "10" }),
  row({ Артикул: "9", Име: "Б", Цвят: "с", Размер: "L", Количество: "1" }),
]);
check("conflicting name reported with both values", /вече е с име "A", а тук пише "Б"/.test(r.issues[0]?.message || ""), r.issues[0]?.message);

// --- blank rows are ignored ----------------------------------------------
r = parseBulkRows([row({}), row({ Артикул: "10", Име: "A", Категория: "Дънки", Цвят: "с", Размер: "M", Количество: "1", Цена: "10" }), row({})]);
check("blank rows ignored", r.issues.length === 0 && r.products.length === 1, JSON.stringify(r.issues));

// --- row numbers match Excel ---------------------------------------------
r = parseBulkRows([
  row({ Артикул: "11", Име: "A", Категория: "Дънки", Цвят: "с", Размер: "M", Количество: "1", Цена: "10" }),
  row({ Артикул: "12", Име: "B", Категория: "Дънки", Цвят: "", Размер: "M", Количество: "1", Цена: "10" }),
]);
check("second data row is called row 3", r.issues[0]?.row === 3, String(r.issues[0]?.row));

// --- photo matching -------------------------------------------------------
const products = parseBulkRows([
  row({ Артикул: "17350", Име: "Дънки", Категория: "Дънки", Цвят: "синьо", Размер: "31", Количество: "1", Цена: "45" }),
]).products;
let m = matchPhotos(products, ["17350_синьо_2.jpg", "17350_синьо_1.jpg"]);
check("photos matched and ordered", m.byColor.get("17350|синьо")?.[0] === "17350_синьо_1.jpg", JSON.stringify([...m.byColor]));
check("matched photos raise no issue", m.issues.length === 0, JSON.stringify(m.issues));

m = matchPhotos(products, ["ръчно преименувана.jpg"]);
check("bad filename reported", /не следва формата/.test(m.issues[0]?.message || ""));
check("colour with no photo reported", m.issues.some((i) => /няма нито една снимка/.test(i.message)));

m = matchPhotos(products, ["17350_синьо_1.jpg", "99999_червено_1.jpg"]);
check("photo for an unknown article reported", m.issues.some((i) => /не е в таблицата/.test(i.message)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
