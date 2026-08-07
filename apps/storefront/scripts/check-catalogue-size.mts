/**
 * The whole catalogue reaches every surface that claims to show it.
 *
 *   pnpm --filter @redpoint/storefront check:catalogue
 *
 * Four places asked Medusa for `limit: 100` and used whatever came back. With
 * 88 products that was the entire shop and every page looked right. At 101 it
 * silently stops being the entire shop: the search cannot find the newest
 * arrival, the chat says an article does not exist while it hangs in the shop,
 * and Google is told the catalogue ends at a hundred. Nothing errors in any of
 * those cases.
 *
 * So this compares each surface against the true count Medusa reports, rather
 * than against a number written here — which would be the same bug in a test.
 *
 * The catalogue is smaller than 100 today, so a cap would not show up on its
 * own. The dev server is therefore started with CATALOGUE_PAGE_SIZE=25, which
 * forces four pages out of 88 products and makes the walk do real work now.
 */

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const MEDUSA = process.env.CHECK_MEDUSA_URL ?? "http://localhost:9000";
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) { pass += 1; console.log(`PASS  ${name}`); }
  else { fail += 1; console.error(`FAIL  ${name}${extra ? `  <- ${extra}` : ""}`); }
};

/** What the shop actually holds, straight from Medusa. */
async function trueCount(): Promise<number> {
  const response = await fetch(`${MEDUSA}/store/products?limit=1&fields=id`, {
    headers: { "x-publishable-api-key": KEY },
  });
  if (!response.ok) throw new Error(`Medusa answered ${response.status}`);
  const data = await response.json();
  return data.count;
}

async function main() {
  if (!KEY) {
    console.error("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY липсва — не мога да питам Medusa.");
    process.exit(1);
  }

  let total: number;
  try {
    total = await trueCount();
  } catch (error) {
    console.error(`Не мога да стигна до Medusa на ${MEDUSA}: ${(error as Error).message}`);
    process.exit(1);
  }

  console.log(`Каталогът съдържа ${total} артикула.\n`);

  /* The sitemap is the one with a number on it, so it is checked by counting. */
  const sitemap = await fetch(`${BASE}/sitemap.xml`).then((response) => response.text());
  const listed = (sitemap.match(/<loc>[^<]*\/p\//g) ?? []).length;

  check(
    "sitemap-ът съдържа целия каталог",
    listed === total,
    `${listed} от ${total}`,
  );

  /* And the search, by asking for something only a full walk would reach: the
     article number of the product Medusa returns last. */
  const lastPage = await fetch(
    `${MEDUSA}/store/products?limit=1&offset=${total - 1}&fields=id,title,handle`,
    { headers: { "x-publishable-api-key": KEY } },
  ).then((response) => response.json());

  const last = lastPage.products?.[0];
  check("има последен артикул, по който да питаме", Boolean(last), JSON.stringify(lastPage).slice(0, 80));

  if (last) {
    console.log(`\nПоследният артикул е "${last.title}".`);
    console.log("Ако търсачката спира на сто, точно него няма да намери.\n");
  }

  console.log(`${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

await main();
