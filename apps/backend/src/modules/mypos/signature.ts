import crypto from "node:crypto";

/**
 * Request signing and callback verification for myPOS Checkout.
 *
 * Kept as a pure module with no Medusa imports so the one security-critical
 * piece of the integration can be read and tested on its own. Everything else
 * in this provider is plumbing; this is the part that decides whether a
 * "payment received" message is real.
 *
 * myPOS's rule, from their authentication docs: concatenate every POST value
 * except `Signature` with dashes, base64 the result, sign THAT string with
 * RSA-SHA256, and base64 the signature. Note the order — the bytes that get
 * signed are the base64 text, not the raw concatenation.
 *
 * Field order is part of the signature. Objects preserve insertion order for
 * string keys in JavaScript, so the caller's order is what gets signed, and
 * the same order has to go on the wire.
 */

export type MyposParams = Record<string, string | number>;

/** The exact bytes myPOS signs: values joined by `-`, then base64. */
export function signingPayload(params: MyposParams): string {
  const joined = Object.entries(params)
    .filter(([key]) => key !== "Signature")
    .map(([, value]) => String(value))
    .join("-");

  return Buffer.from(joined, "utf8").toString("base64");
}

export function sign(params: MyposParams, privateKeyPem: string): string {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingPayload(params), "utf8");
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}

/**
 * True when `signature` really came from myPOS.
 *
 * Everything about this function is deliberately fail-closed. A missing
 * signature, a malformed one, a certificate that will not parse — all of them
 * return false rather than throwing, because a caller that wraps this in a
 * try/catch and treats an exception as "carry on" is exactly how a forged
 * "paid" callback gets accepted. There is no path through here that returns
 * true without a verified RSA signature.
 */
export function verify(
  params: MyposParams,
  signature: string | undefined | null,
  certificatePem: string,
): boolean {
  if (!signature) return false;

  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(signingPayload(params), "utf8");
    verifier.end();

    // A certificate, not a bare public key: myPOS hand over an X.509 PEM.
    const publicKey = new crypto.X509Certificate(certificatePem).publicKey;
    return verifier.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}
