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
  coverage,
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

// --- whole sentences, which is what people actually send -------------------
/* `дай да видя черни тениски` once returned cargo trousers and sandals. Two
   causes, both fixed and both guarded here: the query was scored as one bag of
   trigrams, so filler words drowned the meaning; and it was scored against the
   description too, and these descriptions suggest what to wear a garment WITH,
   so half of them mention дънки or тениска while being neither. */
const sentence = [
  { title: "Черна тениска с ефектен графичен принт" },
  { title: "Спортен карго панталон с декоративни каишки" },
  { title: "Летни мъжки сандали и чехли в едно" },
  { title: "Класически черен суитшърт с цип" },
];

top = rank("черни тениски", sentence, byTitle)[0];
check("two-word query ranks the t-shirt", top?.item.title.startsWith("Черна тениска"), top?.item.title);

check(
  "a garment named only in a description does not win",
  coverage("дънки", "Класически черен суитшърт с цип") <
    coverage("дънки", "Тъмносини дънки с изсветлен ефект"),
);

// --- the consonant skeleton ------------------------------------------------
/* Trigram overlap alone puts денки/данки/дунки at 0.50 against дънки, which is
   where noise sits. The skeleton is what separates them. */
for (const typed of ["denki", "danki", "dunki"]) {
  const hit = rank(typed, [{ title: "Тъмносини дънки с изсветлен ефект" }, { title: "Oversize анорак с качулка" }], byTitle)[0];
  check(`"${typed}" reaches the jeans, not the anorak`, hit?.item.title.includes("дънки"), hit?.item.title);
}

check("skeleton is off below three consonants", coverage("риза", "роза") < 0.6, String(coverage("риза", "роза")));

// --- article numbers -------------------------------------------------------
check("finds a bare article", articleNumber("17350") === "17350");
check("finds it in a sentence", articleNumber("имате ли 17350 в размер 32") === "17350", articleNumber("имате ли 17350 в размер 32"));
check("ignores a size", articleNumber("размер 32") === null, articleNumber("размер 32"));
check("ignores a price", articleNumber("струва 45,00 лв") === null, articleNumber("струва 45,00 лв"));
check("no digits gives null", articleNumber("здравейте") === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
