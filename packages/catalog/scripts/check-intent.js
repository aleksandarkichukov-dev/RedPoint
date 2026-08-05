/* Run with: pnpm --filter @redpoint/catalog test
   Every case is a sentence somebody would actually send. When a keyword is
   added or moved, this is what says whether it stole a question from another
   intent. */
const { detectIntent } = require("../dist/index.js");

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "  <- " + extra : "")); }
};

const kindOf = (m) => detectIntent(m).kind;
const is = (message, kind) =>
  check(`"${message}" → ${kind}`, kindOf(message) === kind, kindOf(message));

// --- article numbers beat everything ---------------------------------------
is("17350", "article");
is("имате ли 17350", "article");
check("article is captured", detectIntent("кажете за 17350").article === "17350");

let i = detectIntent("имате ли 17350 в размер 32");
check("article plus size is a stock question", i.kind === "stock", i.kind);
check("stock keeps the article", i.article === "17350", i.article);
check("stock keeps the size", i.size === "32", i.size);

i = detectIntent("17350 XL");
check("bare letter size is read", i.size === "XL", i.size);

// --- the keyword intents ---------------------------------------------------
is("здравейте", "greeting");
is("здрасти", "greeting");
is("докъде е поръчката ми", "order");
is("искам да проследя пратката", "order");
is("колко струва доставката", "delivery");
is("работите ли с еконт", "delivery");
is("може ли да върна дреха", "returns");
is("не ми стана размерът", "returns");
is("може ли с наложен платеж", "payment");
is("къде се намира магазина", "stores");
is("какво е работното време", "stores");
is("искам таблица с мерки", "sizes");
is("свържете ме с човек", "human");
is("дайте ми телефон", "human");

// --- Latin spellings reach the same intents --------------------------------
is("dostavka", "delivery");
is("vrashtane", "returns");
is("magazin", "stores");
is("zdravejte", "greeting");

// --- everything else is a catalogue search ---------------------------------
i = detectIntent("имате ли черна тениска");
check("search intent", i.kind === "search", i.kind);
check("filler is stripped", i.query === "черна тениска", i.query);

i = detectIntent("търся мъжки панталони");
check("search strips търся and мъжки", i.query === "панталони", i.query);

i = detectIntent("teniska");
check("latin search is converted", i.query === "тениска", i.query);

// --- ordering: the specific rule wins --------------------------------------
/* `размер` appears in both the stock question and the size-chart one. With an
   article present the message is about that article, not about how to measure. */
is("имате ли 15452 размер L", "stock");
is("как да си измеря размера", "sizes");

// --- nothing useful --------------------------------------------------------
is("аб", "unknown");
is("?", "unknown");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
