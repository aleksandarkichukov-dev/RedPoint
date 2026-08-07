import { CATEGORY_REDIRECTS, PRODUCT_REDIRECTS } from "../src/lib/old-urls.generated.ts";

/**
 * Every old URL, followed, against a running server.
 *
 *   pnpm --filter @redpoint/storefront check:redirects
 *
 * The redirect table can be complete and still be wrong: a rule that fires and
 * lands on a 404 spends the old page's standing instead of inheriting it, and
 * nothing about the config file would look amiss. So this asks the server
 * rather than reading the map — it sends the old address and follows where it
 * is told to go.
 *
 * Checks the real shape of an old URL, colour segment and Cyrillic and all,
 * because that is what a crawler will send.
 */

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";

/* A real one, percent-encoded exactly as the old site wrote them. The category
   segments are noise as far as the rules go — they are here because a rule
   that only works on a tidied-up URL is a rule that does not work. */
const TAIL = "/27/%D0%9C%D1%8A%D0%B6%D0%B5/%D0%AF%D0%BA%D0%B5%D1%82%D0%B0/%D0%9F%D1%83%D1%84%D0%B5%D1%80-16891";

interface Result {
  from: string;
  status: number;
  to: string | null;
  landed: number | null;
}

async function follow(path: string): Promise<Result> {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const to = response.headers.get("location");

  let landed: number | null = null;
  if (to) {
    /* The destination is what actually matters. A 301 to a 404 is worse than
       no redirect: it looks handled in every report and loses the link. */
    const target = new URL(to, BASE);
    const final = await fetch(target, { redirect: "follow" });
    landed = final.status;
  }

  return { from: path, status: response.status, to, landed };
}

async function main() {
  console.log(`Проверка срещу ${BASE}\n`);

  try {
    await fetch(BASE);
  } catch {
    console.error(`Няма сървър на ${BASE}. Пуснете 'pnpm dev' и опитайте пак.`);
    process.exit(1);
  }

  const checks = [
    ...PRODUCT_REDIRECTS.map((rule) => ({ path: `/product/${rule.id}${TAIL}`, expect: rule.to })),
    ...CATEGORY_REDIRECTS.map((rule) => ({ path: `/category/${rule.id}/x`, expect: rule.to })),
  ];

  const notRedirected: Result[] = [];
  const wrongTarget: { result: Result; expected: string }[] = [];
  const brokenTarget: Result[] = [];

  for (const check of checks) {
    const result = await follow(check.path);

    if (result.status !== 301) {
      notRedirected.push(result);
      continue;
    }
    /* Compared decoded. Next percent-encodes the Cyrillic in a Location
       header, which is correct and is what a browser wants; comparing the raw
       strings makes every product handle look like a mismatch. */
    if (decodeURIComponent(result.to ?? "") !== check.expect) {
      wrongTarget.push({ result, expected: check.expect });
      continue;
    }
    if (result.landed !== 200) {
      brokenTarget.push(result);
    }
  }

  const failed = notRedirected.length + wrongTarget.length + brokenTarget.length;

  console.log(`${checks.length} стари адреса проверени`);
  console.log(`  ${checks.length - failed} водят до жива страница с 301`);

  for (const result of notRedirected) {
    console.error(`  НЕ пренасочва (${result.status}): ${result.from}`);
  }
  for (const { result, expected } of wrongTarget) {
    console.error(`  греши посоката: ${result.from} -> ${result.to}, а трябва ${expected}`);
  }
  for (const result of brokenTarget) {
    console.error(`  води до ${result.landed}: ${result.from} -> ${result.to}`);
  }

  if (failed > 0) {
    console.error(`\n${failed} проблема.`);
    process.exit(1);
  }
  console.log("\nВсички стари адреси водят някъде живо.");
}

await main();
