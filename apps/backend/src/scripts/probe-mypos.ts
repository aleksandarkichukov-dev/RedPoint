import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { getMyposConfig } from "../modules/mypos/config";
import { sign, type MyposParams } from "../modules/mypos/signature";

/**
 * Asks myPOS one question at a time.
 *
 * Their checkout only ever explains itself in the rendered page, so this posts
 * a signed purchase and reads the answer — minutes instead of an evening of
 * walking a shopper through checkout for every guess.
 *
 * The fields are built here rather than by `buildPurchase`, because a variant
 * has to change a value BEFORE it is signed. Editing the body afterwards only
 * ever proves that a broken signature is rejected, which we already know: it
 * comes back as error 2, while ours comes back as 5.
 *
 *   medusa exec ./src/scripts/probe-mypos.ts            всичко както е сега
 *   medusa exec ./src/scripts/probe-mypos.ts ascii      без кирилица
 *   medusa exec ./src/scripts/probe-mypos.ts minimal    без клиентски данни
 *   medusa exec ./src/scripts/probe-mypos.ts nocart     без артикули
 *   medusa exec ./src/scripts/probe-mypos.ts nodelivery без доставка
 *
 * Nothing is paid. A rejected form is a page; an accepted one is the card entry
 * screen, which stays untouched.
 */
export default async function probeMypos({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const variant = args?.[0] ? String(args[0]) : "as-is";
  const config = getMyposConfig();

  const cyrillic = variant !== "ascii";
  const site = process.env.STOREFRONT_URL || "http://localhost:3000";

  const fields: MyposParams = {
    IPCmethod: "IPCPurchase",
    IPCVersion: variant === "v1.3" ? "1.3" : "1.4",
    IPCLanguage: variant === "lang-en" ? "EN" : "BG",
    SID: config.sid,
    WalletNumber: variant === "wallet-wrong" ? "61938166610" : config.wallet,
    KeyIndex: config.keyIndex,
    Amount: variant === "amount-goods" ? "19.00" : "22.06",
    Currency: "EUR",
    OrderID: "1042",
    URL_OK: `${site}/ok`,
    URL_Cancel: `${site}/cancel`,
    URL_Notify: `${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/hooks/mypos/notify`,
  };

  if (variant !== "minimal") {
    fields.PaymentParametersRequired = "1";
    fields.CustomerEmail = "test@example.com";
    fields.CustomerFirstNames = cyrillic ? "Тест" : "Test";
    fields.CustomerFamilyName = cyrillic ? "Тестов" : "Testov";
    fields.CustomerPhone = "0888000000";
    fields.CustomerCountry = "BGR";
    fields.CustomerCity = cyrillic ? "Варна" : "Varna";
    fields.CustomerZIPCode = "9000";
    fields.CustomerAddress = cyrillic ? "ул. Тестова 1" : "ul. Testova 1";
  } else {
    fields.PaymentParametersRequired = "0";
  }

  if (variant !== "nocart") {
    fields.CartItems = "1";
    fields.Article_1 = cyrillic ? "Тениска" : "Teniska";
    fields.Quantity_1 = "1";
    fields.Price_1 = "19.00";
    fields.Amount_1 = "19.00";
    fields.Currency_1 = "EUR";
  }

  if (variant !== "nodelivery") fields.Delivery = "3.06";

  fields.Signature = sign(fields, config.privateKey);

  /* Printed every run. A probe that does not say what it sent cannot tell an
     unchanged result from an unchanged request — an environment override that
     silently failed to apply looks exactly like a value that made no
     difference. */
  logger.info(
    `   SID ${fields.SID} · Wallet ${fields.WalletNumber} · KeyIndex ${fields.KeyIndex} · ` +
      `IPCVersion ${fields.IPCVersion} · ${fields.Currency} ${fields.Amount}`,
  );

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) body.append(key, String(value));

  const response = await fetch(config.checkoutUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
    body,
  });

  const html = await response.text();
  const error =
    html.match(/Error Code:\s*([^<|\n]+)/i)?.[1] ??
    html.match(/Код на грешката:\s*([^<|\n]+)/i)?.[1];
  const requestId = html.match(/Request ID:\s*(\d+)/i)?.[1];

  /* The page itself, stripped of markup, when a variant needs reading rather
     than classifying. `PROBE_DUMP=1` in front of the command. */
  if (process.env.PROBE_DUMP) {
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    logger.info(`ОТГОВОР: ${text.slice(0, 600)}`);
  }

  /* Classified by what the page IS, not by a word in it. The first version
     looked for "карт" and found it in the title — "Сигурни плащания с дебитна
     или кредитна карта" is on the error page too — and cheerfully reported a
     rejection as an acceptance. A card form has an input for the number; an
     error page has an apology. */
  const cardForm = /<input[^>]+name=["']?(PAN|CardNumber|cardnumber)/i.test(html);
  const interrupted = /прекъснат|не могат да бъдат обработени|cannot be processed/i.test(html);

  logger.info(
    `${variant.padEnd(11)} → ` +
      (error
        ? `ГРЕШКА ${error.trim()}${requestId ? ` · ${requestId}` : ""}`
        : cardForm
          ? "ПРИЕТО — форма за карта"
          : interrupted
            ? "ОТКАЗ — процесът беше прекъснат, без код"
            : `неясно, HTTP ${response.status}, ${html.length} знака`),
  );
}
