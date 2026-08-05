# What we need from the client

Phases 5 and 6 cannot start without these. Everything here is blocked on
someone outside the codebase, so it is tracked separately from the phase plan
in [website-kind-cook.md](../website-kind-cook.md).

Status: **answered on 2026-08-05, except the credentials themselves.**

## Answered

### Product weights — no longer blocking

The client chose **option A, one flat shipping price**, so no weight is needed
to quote a delivery. That settles the question that reached backwards into
Phase 7: the bulk import module does **not** need a weight column to ship.

Weight still has to reach the courier when a waybill is issued in Phase 6. With
flat pricing that can be a single default declared per parcel rather than a
figure the client maintains per product.

### Shipping prices

Flat, and the same for both couriers:

| Delivery | Price |
|---|---|
| To an office | €2.55 |
| To an address | €3.06 |

### Checkout decisions

| Question | Answer | What it means for the build |
|---|---|---|
| Guest or account | **Both** | Guest checkout is the default path; signing in is optional and merges the guest cart |
| Business customers | **No, individuals only** | No company, VAT or MOL fields, and no invoice rules to satisfy |
| Cash-on-delivery fee | **None** | The total does not change with the payment method |

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
- Shop identifier (`id_shop`) for their delivery widget

**These block the whole of Phase 6, not just the waybills.** An earlier note
here claimed office lists were public on both couriers. That was wrong, and
worth correcting because it is the reason Phase 6 looked half-startable:

- Speedy authenticate **every** call, offices included. Their documentation is
  explicit that the API "requires user password authentication for each
  method", with `userName` and `password` in the body of each request. A test
  account is requested by email.
- Econt's delivery widget takes `id_shop` as a mandatory parameter, so the
  iframe the brief tells us to use cannot be embedded without it either.

So nothing courier-shaped can be built or tested first and credentialed later.
Flat shipping prices through Medusa's manual provider carry checkout in the
meantime: an order can be placed and priced, but no office can be chosen from a
real list and no waybill can be issued.

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
