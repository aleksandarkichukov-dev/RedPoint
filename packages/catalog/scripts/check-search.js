/* Run with: pnpm --filter @redpoint/catalog test
   The cases are the point: each one is a way somebody actually types, and the
   file is here so a change to the transliteration table has to answer for all
   of them at once. */
const {
  normalize,
  toCyrillic,
  similarity,
  rank,
  articleNumber,
  isLatin,
} = require("../dist/index.js");

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "  <- " + extra : "")); }
};

// --- normalising -----------------------------------------------------------
check("lowercases", normalize("ДЪНКИ") === "дънки", normalize("ДЪНКИ"));
check("collapses whitespace", normalize("  бяла   риза ") === "бяла риза");
check("drops punctuation", normalize("дънки?!") === "дънки", normalize("дънки?!"));
check("keeps hyphens", normalize("по-светъл") === "по-светъл", normalize("по-светъл"));
check("keeps digits", normalize("артикул 17350") === "артикул 17350");

// --- Latin to Cyrillic -----------------------------------------------------
check("teniska", toCyrillic("teniska") === "тениска", toCyrillic("teniska"));
check("riza", toCyrillic("riza") === "риза", toCyrillic("riza"));
check("shorti keeps sh together", toCyrillic("shorti") === "шорти", toCyrillic("shorti"));
check("chorapi keeps ch together", toCyrillic("chorapi") === "чорапи", toCyrillic("chorapi"));
check("yake", toCyrillic("yake") === "яке", toCyrillic("yake"));
check("zhiletka", toCyrillic("zhiletka") === "жилетка", toCyrillic("zhiletka"));
check("pantaloni", toCyrillic("pantaloni") === "панталони", toCyrillic("pantaloni"));
check("digraph beats single letter", toCyrillic("shte") === "ще", toCyrillic("shte"));
check("leaves Cyrillic alone", toCyrillic("дънки") === "дънки", toCyrillic("дънки"));
check("mixed query keeps each word", toCyrillic("сини dzhinsi").split(" ").length === 2);

check("isLatin true for latin", isLatin("denki") === true);
check("isLatin false for cyrillic", isLatin("дънки") === false);
check("isLatin false for mixed", isLatin("nike дънки") === false);

// --- the вЪ problem: no Latin letter stands for ъ --------------------------
/* This is the case the whole design turns on. Nobody agrees how to type `ъ`,
   so transliteration lands near the word and trigram overlap has to close the
   gap. All three spellings must beat an unrelated garment comfortably. */
const jeans = "дънки в по-светъл деним с модерна визия";
for (const typed of ["denki", "danki", "dunki", "дънки"]) {
  const score = Math.max(similarity(typed, jeans), similarity(toCyrillic(typed), jeans));
  const wrong = Math.max(similarity(typed, "мъжки сандали"), similarity(toCyrillic(typed), "мъжки сандали"));
  check(`"${typed}" finds the jeans`, score >= 0.3, score.toFixed(2));
  check(`"${typed}" beats an unrelated item`, score > wrong, `${score.toFixed(2)} vs ${wrong.toFixed(2)}`);
}

// --- ranking ---------------------------------------------------------------
const catalogue = [
  { title: "Дънки в по-светъл деним с модерна визия" },
  { title: "Черна тениска с ефектен графичен принт" },
  { title: "Мъжка лятна ленена риза" },
  { title: "Летни мъжки сандали и чехли в едно" },
];
const byTitle = (item) => item.title;

let top = rank("teniska", catalogue, byTitle)[0];
check("teniska ranks the t-shirt first", top?.item.title.startsWith("Черна тениска"), top?.item.title);

top = rank("ЛЕНЕНА РИЗА", catalogue, byTitle)[0];
check("shouting still ranks the shirt", top?.item.title.includes("ленена риза"), top?.item.title);

top = rank("sandali", catalogue, byTitle)[0];
check("sandali ranks the sandals", top?.item.title.includes("сандали"), top?.item.title);

check("nonsense returns nothing", rank("xyzzy qwerty", catalogue, byTitle).length === 0);
check("empty query returns nothing", rank("   ", catalogue, byTitle).length === 0);
check("limit is respected", rank("мъжки", catalogue, byTitle, { threshold: 0, limit: 2 }).length === 2);
/* The floor exists because the overlap coefficient scores a two-trigram query
   as a perfect hit against any sentence that happens to contain it. */
check("too-short query returns nothing", rank("ри", catalogue, byTitle, { threshold: 0 }).length === 0);

// --- article numbers -------------------------------------------------------
check("finds a bare article", articleNumber("17350") === "17350");
check("finds it in a sentence", articleNumber("имате ли 17350 в размер 32") === "17350", articleNumber("имате ли 17350 в размер 32"));
check("ignores a size", articleNumber("размер 32") === null, articleNumber("размер 32"));
check("ignores a price", articleNumber("струва 45,00 лв") === null, articleNumber("струва 45,00 лв"));
check("no digits gives null", articleNumber("здравейте") === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
