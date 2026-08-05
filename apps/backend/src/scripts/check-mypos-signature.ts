import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ExecArgs } from "@medusajs/framework/types";
import { sign, signingPayload, verify } from "../modules/mypos/signature";
import { buildPurchase } from "../modules/mypos/purchase";

/**
 * Proves the myPOS signing and verification logic against the real key files.
 *
 *   pnpm --filter @redpoint/backend exec medusa exec ./src/scripts/check-mypos-signature.ts
 *
 * Signature bugs are silent: myPOS answers with a generic rejection and no clue
 * which of the concatenation, the encoding or the padding is wrong. This runs
 * the whole thing end to end before a single payment is attempted, including
 * the cases that must FAIL — a tampered amount, a missing signature, the wrong
 * key. A verifier that accepts those is worse than no verifier at all.
 */
export default async function checkMyposSignature({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const secrets = path.join(process.cwd(), "secrets");

  const privateKey = fs.readFileSync(path.join(secrets, "mypos-private-key.pem"), "utf8");
  const certificate = fs.readFileSync(path.join(secrets, "mypos-certificate.pem"), "utf8");

  // Shaped like a real Checkout request, in the order it goes on the wire.
  const params = {
    IPCmethod: "IPCPurchase",
    IPCVersion: "1.4",
    IPCLanguage: "bg",
    KeyIndex: process.env.MYPOS_KEY_INDEX ?? "1",
    Source: "SDK_PHP",
    SID: process.env.MYPOS_SID ?? "000000000000010",
    walletnumber: process.env.MYPOS_WALLET ?? "61938166610",
    Amount: "76.55",
    Currency: "EUR",
    OrderID: "1042",
  };

  const results: [string, boolean][] = [];

  /* Length only. The payload contains the wallet number, and a log line is a
     place account identifiers end up in transcripts and bug reports. */
  logger.info(`payload signed: ${signingPayload(params).length} base64 chars`);

  const signature = sign(params, privateKey);
  logger.info(`signature produced: ${signature.length} chars`);

  /* myPOS verify with THEIR certificate against OUR signature only in the
     other direction. To prove our own round trip, check against the public
     half of our own key. */
  const ownPublic = crypto.createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  const ownCheck = crypto.createVerify("RSA-SHA256");
  ownCheck.update(signingPayload(params), "utf8");
  ownCheck.end();
  results.push(["our signature verifies with our own public key", ownCheck.verify(ownPublic, signature, "base64")]);

  // A signature we made is not from myPOS, so their certificate must reject it.
  results.push([
    "our signature does NOT verify as myPOS's",
    verify(params, signature, certificate) === false,
  ]);

  results.push(["missing signature is rejected", verify(params, undefined, certificate) === false]);
  results.push(["empty signature is rejected", verify(params, "", certificate) === false]);
  results.push(["garbage signature is rejected", verify(params, "not-base64!!", certificate) === false]);

  // The whole point: changing the amount must invalidate the signature.
  const tampered = { ...params, Amount: "1.00" };
  const tamperedCheck = crypto.createVerify("RSA-SHA256");
  tamperedCheck.update(signingPayload(tampered), "utf8");
  tamperedCheck.end();
  results.push([
    "tampered amount breaks the signature",
    tamperedCheck.verify(ownPublic, signature, "base64") === false,
  ]);

  // Field order is part of the signature, so a reordered payload must differ.
  const { OrderID, ...rest } = params;
  const reordered = { OrderID, ...rest };
  results.push([
    "reordering fields changes the signed payload",
    signingPayload(reordered) !== signingPayload(params),
  ]);

  /* And the real thing: a purchase built the way checkout will build it. */
  const purchase = buildPurchase({
    orderId: "1042",
    itemsTotal: 74,
    deliveryTotal: 2.55,
    currency: "EUR",
    lines: [
      { name: "Тъмносиньо спортно-техническо яке", quantity: 1, unitPrice: 37 },
      { name: "Дънки в по-светъл деним", quantity: 1, unitPrice: 37 },
    ],
    customer: {
      email: "ivan@example.bg",
      firstName: "Иван",
      lastName: "Петров",
      phone: "0888123456",
      city: "Варна",
      postalCode: "9000",
      address: "ул. Дунав 5",
    },
  });

  const keys = Object.keys(purchase.fields);
  results.push(["purchase is signed", typeof purchase.fields.Signature === "string"]);
  results.push(["Signature is the last field", keys[keys.length - 1] === "Signature"]);
  results.push(["amount is items plus delivery", purchase.fields.Amount === "76.55"]);
  results.push(["cart rows match CartItems", purchase.fields.CartItems === "2"]);
  results.push(["notify URL is ours", String(purchase.fields.URL_Notify).endsWith("/hooks/mypos/notify")]);
  results.push([
    "purchase signature verifies with our own key",
    (() => {
      const { Signature, ...unsigned } = purchase.fields;
      const check = crypto.createVerify("RSA-SHA256");
      check.update(signingPayload(unsigned), "utf8");
      check.end();
      return check.verify(ownPublic, String(Signature), "base64");
    })(),
  ]);
  logger.info(`checkout URL: ${purchase.url}`);

  logger.info("");
  let failed = 0;
  for (const [name, passed] of results) {
    logger.info(`${passed ? "PASS" : "FAIL"}  ${name}`);
    if (!passed) failed += 1;
  }

  logger.info("");
  if (failed > 0) throw new Error(`${failed} signature check(s) failed`);
  logger.info(`all ${results.length} signature checks passed`);
}
