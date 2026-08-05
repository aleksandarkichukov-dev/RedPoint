import fs from "node:fs";
import path from "node:path";

/**
 * Everything the myPOS integration needs, read once and checked.
 *
 * Reads the key material from PEM files rather than environment variables. A
 * multi-line key squeezed into a variable has to have every newline escaped,
 * and getting one character wrong produces a rejected signature with no clue
 * as to why — see apps/backend/secrets/README.md.
 */

export interface MyposConfig {
  sid: string;
  wallet: string;
  keyIndex: string;
  privateKey: string;
  certificate: string;
  /** Where the shopper's browser POSTs the signed form. */
  checkoutUrl: string;
  sandbox: boolean;
  storefrontUrl: string;
  backendUrl: string;
}

const PRODUCTION_CHECKOUT = "https://www.mypos.com/vmp/checkout";
const SANDBOX_CHECKOUT = "https://www.mypos.com/vmp/checkout-test";

/** myPOS's published sandbox account. Public, and charges nobody. */
const SANDBOX = {
  sid: "000000000000010",
  wallet: "61938166610",
  keyIndex: "1",
};

let cached: MyposConfig | null = null;

export class MyposConfigError extends Error {
  constructor(message: string) {
    super(`myPOS is not configured: ${message}`);
    this.name = "MyposConfigError";
  }
}

function readPem(file: string): string {
  const full = path.join(process.cwd(), "secrets", file);
  if (!fs.existsSync(full)) {
    throw new MyposConfigError(`${file} is missing from apps/backend/secrets/`);
  }
  const contents = fs.readFileSync(full, "utf8").trim();
  if (!contents.startsWith("-----BEGIN")) {
    throw new MyposConfigError(`${file} does not look like a PEM file`);
  }
  return contents;
}

export function getMyposConfig(): MyposConfig {
  if (cached) return cached;

  const sandbox = process.env.MYPOS_SANDBOX !== "false";

  /* In sandbox the account values are myPOS's own published ones unless the
     shop's are set, so the integration can be exercised end to end before the
     merchant account exists. The keys are always the shop's: myPOS register a
     certificate per store, and the sandbox test keys would not match it. */
  const sid = process.env.MYPOS_SID || (sandbox ? SANDBOX.sid : "");
  const wallet = process.env.MYPOS_WALLET || (sandbox ? SANDBOX.wallet : "");
  const keyIndex = process.env.MYPOS_KEY_INDEX || (sandbox ? SANDBOX.keyIndex : "");

  if (!sid) throw new MyposConfigError("MYPOS_SID is not set");
  if (!wallet) throw new MyposConfigError("MYPOS_WALLET is not set");
  if (!keyIndex) throw new MyposConfigError("MYPOS_KEY_INDEX is not set");

  cached = {
    sid,
    wallet,
    keyIndex,
    privateKey: readPem("mypos-private-key.pem"),
    certificate: readPem("mypos-certificate.pem"),
    checkoutUrl: sandbox ? SANDBOX_CHECKOUT : PRODUCTION_CHECKOUT,
    sandbox,
    storefrontUrl: process.env.STOREFRONT_URL || "http://localhost:3000",
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  };

  return cached;
}

/** Tests and scripts change the environment between runs. */
export function resetMyposConfig(): void {
  cached = null;
}
