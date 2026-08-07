/**
 * No page says "Red Point" twice in its title.
 *
 *   pnpm --filter @redpoint/storefront check:titles
 *
 * The root layout appends " · Red Point" to every page title through Next's
 * metadata template. Ten pages appended it themselves as well, so the browser
 * tab, the bookmark and the Google result all read "Количка · Red Point ·
 * Red Point". Nothing errors, and it is invisible from inside the page — it
 * only shows up in the one place nobody screenshots.
 *
 * Checked against the served HTML rather than the source, because the
 * duplication is produced by the template and not visible in either half on
 * its own.
 */

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";

/* /checkout redirects to /cart when the cart is empty, so running this against
   an empty shop checks the cart's title twice and the checkout's not at all.
   Left in because it costs nothing and does cover it once there is a cart. */
const PAGES = [
  "/",
  "/cart",
  "/checkout",
  "/wishlist",
  "/help/delivery",
  "/help/returns",
  "/help/sizes",
  "/help/contact",
  "/legal/terms",
  "/legal/privacy",
  "/legal/cookies",
  "/men-jackets",
];

let pass = 0;
let fail = 0;

async function main() {
  try {
    await fetch(BASE);
  } catch {
    console.error(`Няма сървър на ${BASE}. Пуснете 'pnpm dev' и опитайте пак.`);
    process.exit(1);
  }

  console.log(`Проверка срещу ${BASE}\n`);

  for (const page of PAGES) {
    const html = await fetch(`${BASE}${page}`).then((r) => r.text());
    const title = /<title[^>]*>([^<]*)<\/title>/.exec(html)?.[1] ?? "";

    /* Twice is the bug. Once is correct — the shop's name belongs in the tab,
       which is the whole reason the template exists. */
    const times = (title.match(/Red Point/g) ?? []).length;

    if (!title) {
      fail += 1;
      console.error(`FAIL  ${page} — няма заглавие изобщо`);
    } else if (times > 1) {
      fail += 1;
      console.error(`FAIL  ${page} — "${title}"`);
    } else {
      pass += 1;
      console.log(`PASS  ${title}`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

await main();
