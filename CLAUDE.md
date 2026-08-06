# Red Point

Replacement online store for [red-point.bg](https://red-point.bg/) — men's smart-casual clothing, three physical shops in Varna. Next.js 15 storefront on a Medusa v2 backend, myPOS card payments plus cash on delivery, Speedy and Econt shipping, and a Bulgarian bulk import module the client operates daily.

The full brief, phase plan and acceptance criteria live in [website-kind-cook.md](website-kind-cook.md). Read it before starting a new phase. **Section 2 of that file is locked** — those decisions are not reopened.

## Commands

```bash
pnpm install                 # workspace install
pnpm dev                     # storefront on :3000
pnpm build                   # build every package
pnpm typecheck               # tsc --noEmit across the workspace
```

Backend. Data services first:

```bash
docker compose up -d
```

```bash
pnpm --filter @redpoint/backend exec medusa db:migrate
```

```bash
pnpm --filter @redpoint/backend seed
```

```bash
pnpm --filter @redpoint/backend dev
```

Admin at `http://localhost:9000/app`. It needs a user before you can log in, which is a one-off:

```bash
pnpm --filter @redpoint/backend exec medusa user -e you@example.com -p yourpassword
```

Scraper (Phase 1, one-off). It hits the live old site behind Cloudflare, so read [tools/scraper/README.md](tools/scraper/README.md) before running it:

```bash
pnpm --filter @redpoint/scraper scrape -- --limit 2 --category men-jeans
```

`pnpm` is installed under `%APPDATA%\npm`. If the shell cannot find it, that directory is missing from PATH.

## Layout

```
apps/storefront/         Next.js 15, App Router, RSC, Tailwind v4
apps/backend/            Medusa v2
packages/design-system/  the tokens, as a Tailwind v4 @theme
packages/catalog/        category tree + products.json schema, shared
tools/scraper/           Phase 1, one-off seed from the old site
seed/                    products.json + downloaded photography + reports
```

`packages/catalog` is imported by both the scraper (which writes `products.json`)
and the Medusa seed (which reads it). It compiles to `dist`, so it must be built
before anything type-checks. `pnpm typecheck` does that for you.

## Design system — read this before writing any UI

**Invoke the `g-star-design-system` skill.** It is installed at `.claude/skills/g-star-design-system/` and carries the full spec and rationale.

`packages/design-system/src/theme.css` is the single source of truth for tokens. It resets Tailwind's default namespaces to `initial`, so `rounded-lg`, `shadow-md`, `bg-slate-500` and `font-mono` **fail to compile**. That is the point. Do not re-add them.

The four rules that break the brand fastest:

1. **Zero rounded corners.** `--radius-sharp: 1px` is the ceiling. `rounded-full` still compiles because it is a Tailwind static — it is banned by review, so grep for it.
2. **Zero shadows.** Depth comes from flat colour blocks, never blur.
3. **`#C2311E` only on sale and discount signage.** Not on errors, not on links, not decoratively. Form errors are monochrome by design.

   Three standing exceptions, and no more without the client saying so.

   The logo, in `components/layout/wordmark.tsx`: its ring is red and it is
   round. It is the client's actual mark, and the ring is an SVG circle rather
   than `rounded-full` so the ban still greps clean.

   The nav drawer's hover colour, added at the client's explicit request on
   7 August 2026 after being told what it costs: red now means both "this is
   discounted" and "your pointer is here". If sale signage ever stops standing
   out, this is the first place to look.
4. **Headlines uppercase condensed, buttons lowercase.** Deliberate rhythm.

Working reference for every primitive: `/design-system` in the storefront.

### Fonts

Oswald (headlines) and Inter (body), both loaded via `next/font`. DIN Pro and Gotham HCo are the licensed originals and can be swapped in by editing the token stacks.

**Any headline font must ship a Cyrillic subset.** The store sells in Bulgarian and headlines are uppercase Cyrillic. Barlow Condensed was the original pick and has no Cyrillic, which would have dropped every headline to Arial Narrow. Check the subset list before swapping.

### Prices

EUR is the store currency. BGN is never stored — it is derived at render time from the fixed peg by `apps/storefront/src/lib/price.ts` (1.95583, rounded **up** to the stotinka). Do not add a second price list.

## Conventions

- Server Components by default. Anything with motion, pointer physics or local state is an isolated `"use client"` leaf.
- `cn()` is clsx only, deliberately without tailwind-merge — the theme replaces almost every Tailwind namespace, so tailwind-merge would not recognise our class names and could drop the wrong one.
- Icons from `@phosphor-icons/react`. One family, no hand-rolled SVG paths.
- Copy is Bulgarian. Second locale is EN.
- `min-h-[100dvh]`, never `h-screen`.

## Known constraints

- **Docker Desktop needs WSL2 on this machine.** Docker was installed before WSL was, so the engine hung forever on "Starting the Docker Engine" with an empty VM log. `wsl --install --no-distribution` plus a reboot fixed it. If the engine ever hangs like that again, check `wsl --status` before anything else. The CLI lives under `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin` (per-user install) and is on the user PATH.
- **`scripts/postgres.ps1` is a fallback, not the normal path.** It drives portable Postgres binaries under `%LOCALAPPDATA%\redpoint-postgres`, from when Docker could not run here. `docker compose up -d` is what to use. Both bind port 5432, so never run them at once.
- **Postgres needs `max_connections=300`.** Medusa opens a pool per module and briefly exceeds the default 100 during `db:migrate`, which fails with SQLSTATE 53300. The compose file sets it.
- **The Redis workflow engine wants `redis: { url }`, not `redisUrl`.** It logs a deprecation warning telling you the opposite; following that advice makes the module fail to load in 2.18. The warning is noise.
- **Medusa reads `.env` from `apps/backend/`, not the repo root.** The root `.env` is for docker-compose. Both exist; keep them in step. Write them without a BOM, or `loadEnv` mis-parses the first line.
- **MikroORM must match Medusa exactly.** 2.18 pins all five `@mikro-orm` packages at 6.6.14 through `@medusajs/deps`. Any other version fails at migration time with "Bad @mikro-orm/knex version".
- **`pnpm-workspace.yaml` carries two hoisting rules that Medusa forces.** Do not remove them without reading the comments there. `@types/react` is excluded from the hoist because the storefront is React 19 and the Medusa admin is React 18, and a shared hoist makes one of them compile against two copies of React's types. `@medusajs/*` is public-hoisted because Medusa's generated admin entry imports its first-party plugins by bare specifier and assumes npm's flat tree.
- **Medusa's update workflows report success for fields they ignore.** Three found so far, all silent: `updateShippingOptionsWorkflow` accepts a `type` and never applies it (repair with `fix-shipping-types.ts`); `updateOrderWorkflow` **merges** metadata, so omitting a key leaves the old value and only `null` removes it; and `query.graph` drops `payment_status` and `fulfillment_status` from an order entirely — derive them from `fulfillments` and `payment_collections.status`. Assume nothing applied until it is read back.
- **`window.confirm` does nothing in the admin.** The browser suppresses it, and a blocked confirm reads as "no" — so the button silently did nothing, with no request and no error. Confirmation belongs in the widget as a second state; see `admin/widgets/econt-waybill.tsx`.
- **Reading an order's totals needs `shipping_methods.*`.** They are computed, and computing them resolves the shipping method's adjustments, which needs its `version`. Ask for `shipping_methods.name` and the query either throws "Shipping method version is required to load adjustments" or returns every total as `undefined` depending on what else is selected. `items.total` needs `items.*` for the same reason. Silent when it fails — the confirmation email rendered "0,00 €" and "x undefined".
- **Never pick a sales channel with `[0]`.** A fresh Medusa install keeps a "Default Sales Channel" beside the seeded "Red Point" one, and the storefront's publishable key is bound to the seeded one. Anything that creates products must read `store.default_sales_channel_id`. Getting this wrong is near-invisible: the product is complete and published in the admin, absent from the shop, and nothing errors. `src/scripts/fix-sales-channel.ts` repairs it.
- **`ts-node` is an explicit dependency of the backend.** The Medusa CLI needs it to read `medusa-config.ts`; under npm it is found transitively, under pnpm it is not.
- **Node is 24.x locally.** Medusa 2.18 declares `engines: node >=20`, so this is allowed, but it is ahead of what Medusa tests against. If the backend behaves strangely, try Node 22 before debugging anything else.
- **Never put `noEmit` in `apps/backend/tsconfig.json`.** `medusa build` spreads
  that file's `compilerOptions` straight into its own `ts.createProgram` and
  overrides only `outDir`, so a `noEmit` set there survives into the build: it
  type-checks, writes nothing, and still logs "Backend build completed
  successfully" and exits 0. The failure only shows up at deploy time, as an
  almost-empty `.medusa/server`. The typecheck script passes `--noEmit` on the
  command line, where it cannot leak. A correct build leaves `medusa-config.js`,
  `src/`, `package.json` and `public/` in `apps/backend/.medusa/server`.
- **Production runs from the build output, not from `apps/backend`.** Copy that
  directory to the server and start it there; it needs its own `.env`. Started
  anywhere else, Medusa resolves the admin bundle from `<cwd>/public/admin` and
  dies on "Could not find index.html".
- **The local file provider serves `/static` from the working directory**, so
  running from `.medusa/server` looks for the product photography there and
  every image 404s while the pages themselves render fine. `medusa build` does
  not copy uploads. On the VPS the uploads directory has to be mounted or
  symlinked next to the build — or, better, replaced by object storage, which
  is one of the open questions in `docs/client-requirements.md`.
- **`next dev` and `next build` share `.next` and silently clobber each other.**
  A production server started while dev is running answers 500 on every route,
  with nothing useful in either log. `next.config.ts` reads `NEXT_DIST_DIR` so a
  production build can sit beside a running dev server:
  `NEXT_DIST_DIR=.next-prod next build`, then the same variable on `next start`.
- The old site sits behind Cloudflare and blocks after ~10 rapid requests. The scraper needs Playwright, 1.5–2s throttle and a resumable on-disk cache.
- JSON-LD prices on the old site are unreliable (seen `16.00` where the page rendered `62.59`). Take the rendered DOM price and log every mismatch for the client to review.

## Phase 5 is not finished

Cash on delivery works end to end. Card payment does not, and the gap is bigger
than it looks from the code, which is why it is written down rather than left
to be rediscovered.

**Nothing has ever been paid.** The myPOS checkout page has not been opened
once. Signing is proven against the shop's real keys — 13 checks, run by
`src/scripts/check-mypos-signature.ts` — and the purchase form builds correctly,
but whether myPOS accept it is unknown. Their portal issued a 1024-bit key while
their own docs require 2048; if the first payment is rejected, start there.

**The notification's accepting path has never run.** Only the rejecting path is
tested. myPOS call `URL_Notify` server to server over HTTPS and localhost is not
reachable from their network, so closing this needs a public address — the VPS,
or a tunnel. Until then the capture code is unexercised.

Three gaps found late, all ordinary shop behaviour rather than edge cases:

- A cancelled payment returns to `/checkout?payment=cancelled` and the page
  ignores the parameter, so the shopper lands in an empty checkout with no
  explanation.
- There is no refund path at all. A return means refunding by hand in the myPOS
  portal, and Medusa will not know it happened.
- An abandoned payment leaves an unpaid order forever. Visible in the admin,
  which is better than losing it, but nothing chases or clears it.

## Blocked on the client

Phases 5 and 6 need credentials and decisions that live outside this repo.
They are listed in [docs/client-requirements.md](docs/client-requirements.md).

One of them reaches back into Phase 7: couriers price by weight, the old site
publishes none, so the catalogue has none. If the client chooses per-product
weights, the bulk module needs a weight column before its import format is
settled.

## Phase discipline

Each phase in the brief names the skills to invoke and its own acceptance criteria. Two that are easy to skip and expensive to skip:

- `impeccable` against the real code at the end of every UI phase, not once at the start.
- `security-review` before Phase 9. There are payments, addresses and personal data.
