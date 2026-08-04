# What we need from the client

Phases 5 and 6 cannot start without these. Everything here is blocked on
someone outside the codebase, so it is tracked separately from the phase plan
in [website-kind-cook.md](../website-kind-cook.md).

Status: **sent to the client, awaiting answers.**

## Blocking, and the one to chase first

### Product weights

Couriers price a parcel by weight. The old site publishes no weight anywhere,
so the scrape brought back none: all 97 products are in the catalogue without
one. Speedy and Econt can neither quote a price nor issue a waybill without it.

Three options were put to the client:

| Option | Effort for the client | Consequence |
|---|---|---|
| A. One flat shipping price | none | Ships today, loses money on heavy items and overcharges light ones |
| B. Average weight per category | ~20 numbers, once | Accurate enough for most orders |
| C. Real weight per product | a number on every upload, forever | Exact, and the only one that scales |

**If the answer is C, the bulk module in Phase 7 needs a weight column from the
start.** Adding it after the import format is settled means reworking the
importer and re-issuing the template the client has already learned. This is
why it is the question to chase, not the credentials.

## Credentials

Never accept these by email. The myPOS private key is equivalent to a password
on the account.

### myPOS, Phase 5

Sandbox **and** production. Without sandbox, every test is a real transaction.

- Store ID (SID)
- Wallet number
- Private key, for signing our requests
- myPOS certificate, for verifying the signature on their IPN callbacks
- Key index

### Speedy, Phase 6

- Web API username and password
- Client number from the contract

### Econt, Phase 6

- B2B username and password
- Shop identifier for their delivery widget

Office lists are public on both; waybills are not.

## Decisions

Each of these changes what gets built, not just what gets configured.

1. Does cash on delivery carry a fee? How much?
2. Will there be business customers? If so, checkout needs company number and
   VAT number fields, and the invoice has legal requirements.
3. Guest checkout, or is an account required?
4. Free-shipping threshold, if any.
5. Which address ships the orders: one of the three shops, or a separate
   warehouse. It goes on every waybill.
6. Fixed shipping prices, or calculated from the courier tariff.
7. Both couriers offered to the customer, or only one.
8. Sender for order and dispatch emails, and the wording in Bulgarian and
   English.

## Already answered by the brief

Locked in section 2 and not reopened: EUR as store currency with BGN shown
alongside at the fixed peg, card payment through myPOS plus cash on delivery,
Speedy and Econt, Bulgarian first with English second.
