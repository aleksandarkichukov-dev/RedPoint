# Red Point

Replacement online store for [red-point.bg](https://red-point.bg/) — men's smart-casual clothing, three physical shops in Varna. Next.js 15 storefront on a Medusa v2 backend, myPOS card payments plus cash on delivery, Speedy and Econt shipping, and a Bulgarian bulk import module the client operates daily.

The full brief, phase plan and acceptance criteria live in [website-kind-cook.md](website-kind-cook.md). Read it before starting a new phase. **Section 2 of that file is locked** — those decisions are not reopened.

## Commands

```bash
pnpm install                 # workspace install
pnpm dev                     # storefront on :3000
pnpm build                   # build every package
pnpm typecheck               # tsc --noEmit across the workspace
docker compose up -d         # postgres + redis
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

- **Docker Desktop is not installed locally, and neither is WSL.** `docker-compose.yml` and `apps/backend/Dockerfile` are written but have never been executed. Everything in Phase 2 is type-checked, not run: no database has ever seen this schema, and `pnpm seed` has never completed.
- **Node is 24.x locally.** Medusa 2.18 declares `engines: node >=20`, so this is allowed, but it is ahead of what Medusa tests against. If the backend behaves strangely, try Node 22 before debugging anything else.
- The old site sits behind Cloudflare and blocks after ~10 rapid requests. The scraper needs Playwright, 1.5–2s throttle and a resumable on-disk cache.
- JSON-LD prices on the old site are unreliable (seen `16.00` where the page rendered `62.59`). Take the rendered DOM price and log every mismatch for the client to review.

## Phase discipline

Each phase in the brief names the skills to invoke and its own acceptance criteria. Two that are easy to skip and expensive to skip:

- `impeccable` against the real code at the end of every UI phase, not once at the start.
- `security-review` before Phase 9. There are payments, addresses and personal data.
