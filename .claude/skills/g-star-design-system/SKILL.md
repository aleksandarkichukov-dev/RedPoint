---
name: g-star-design-system
description: Design tokens and component specs for the G-Star-inspired industrial/streetwear look used on this project's clothing site (Red Point). Use this skill whenever styling, designing, or building any front-end UI here — pages, sections, components, hero banners, product cards, buttons, forms — even if the user just says "style this", "build the hero", "make a product card", or doesn't explicitly mention "design system" or "G-Star". Also use it when the user asks to check whether existing CSS matches the site's design language, or wants CSS variables/tokens for the project.
---

# G-Star Design System

Extracted directly from g-star.com's live computed styles (colors, fonts, spacing, button/card behavior) and adapted as the visual language for Red Point. The mood: industrial, monochrome, sharp-edged streetwear retail — matte black-and-white surfaces broken only by a single red accent reserved for sale/discount signage. Treat every value below as intentional, not arbitrary — reuse them exactly rather than approximating, so every new page stays visually consistent with the rest of the site.

## Where the tokens actually live

**`packages/design-system/src/theme.css` is the single source of truth.** It is a Tailwind v4 `@theme` block, so every token is available both as a utility (`bg-neutral`, `text-hero`) and as a CSS variable (`var(--color-neutral)`).

That file also resets Tailwind's default namespaces to `initial`. This is deliberate: `rounded-lg`, `shadow-md`, `bg-slate-500` and `font-mono` **fail to compile** rather than silently shipping off-brand. Do not re-add them.

Element-level defaults (headline/body typography, focus ring, hairlines, reduced-motion) live in `packages/design-system/src/base.css`.

Do not copy hex codes into components. Use the token.

## Colors

| Token | Hex | Use for |
|---|---|---|
| `--color-primary` | `#000000` | Headlines, primary text, nav, borders |
| `--color-secondary` | `#303030` | Secondary dark surfaces, footer panels |
| `--color-accent` | `#C2311E` | Sale badges, discount tags, promo callouts — **nowhere else** |
| `--color-neutral` | `#E4E6E7` | Product photography background, card fill |
| `--color-muted-text` | `#68737D` | Strikethrough RRP prices, secondary labels |
| `--color-body-text` | `#212529` | Sale price, running body copy |
| `--color-background` | `#FFFFFF` | Page base |
| `--color-surface` | `#F7F7F7` | Input fields, subtle panel fill |
| `--color-success` | `#0F8000` | Stock/availability confirmation text |
| `--color-border` | `#696969` | Hairlines, muted dividers |

The red accent is load-bearing precisely because it's rare. If a page already has red for sale signage, do not introduce a second accent color for anything else (buttons, links, icons) — that dilutes the one visual cue users learn to associate with a deal.

**Consequence for error states:** this system has no error red to spend, and forbids secondary brand colors. Form errors are therefore **monochrome** — a hard 2px black stroke on a field that normally has no border at all, plus a bold message below and `role="alert"`. That also means errors never depend on color alone. See `Input` in the storefront.

## Typography

- **Headline font**: DIN Pro (licensed original) / **Oswald** (shipping substitute) — condensed, bold, uppercase
- **Body font**: Gotham HCo (licensed original) / **Inter** (shipping substitute)
- No monospace anywhere — it breaks the industrial tone.

> **Both webfonts must carry Cyrillic.** The store sells in Bulgarian and headlines are uppercase Cyrillic. Barlow Condensed was the original pick and ships **no Cyrillic subset**, so every headline would have fallen back to Arial Narrow and lost the identity in the primary market. Oswald is the closest free condensed display face with full Cyrillic. Check the subset list before ever swapping a font here.

| Style | Token | Spec | Used for |
|---|---|---|---|
| Hero | `text-hero` | `clamp(3.25rem, 11vw, 10.5rem)`, 0.88 line-height, 0.01em tracking, uppercase | Full-bleed campaign and home hero only |
| Display / H1–H2 | `text-display` | 32px bold, 0.95 line-height, 0.02em tracking, uppercase | Section and category titles |
| Subhead / H3 | `text-subhead` | 16px bold, 1.3 line-height, normal case, `#696969` | Section labels, filter groups |
| Body | `text-body` | 13px regular, 1.4 line-height, `#000000` | Paragraphs, nav text |
| Nav / Links | `text-nav` | 14px regular, 1.4 line-height, `#000000` | Navigation, inline links, product names |
| Input | `text-input` | 16px weight 300, `#212529` | Form fields (16px also stops iOS zoom-on-focus) |
| Button label | `text-control` | 14px semibold (600), **lowercase** | "виж размерите" — deliberately contrasts with uppercase headlines; never uppercase a button label |
| Price (sale) | `text-price` | 14px bold (700), `#212529` | Current/discounted price |
| Badge | `text-badge` | 12px semibold (600), white on `#C2311E` | "-50%" style tags |

The uppercase-headline / lowercase-button contrast is a deliberate rhythm, not an inconsistency — preserve it when adding new CTAs.

**On the hero tier:** the original extraction captured g-star's PLP category titles (32px) but never their full-bleed campaign banners, so the system had no tier for a viewport-height hero. `text-hero` fills that gap. Same face, same uppercase, same weight — only the scale is new.

## Spacing

- Base unit: 8px. Tailwind's default `--spacing` already lands on it: `p-2`=8, `p-4`=16, `p-6`=24, `p-8`=32, `p-12`=48, `p-16`=64.
- Control padding: 8px 16px · Card padding: 16px
- Section spacing: 32px mobile, 64px desktop

## Border Radius

Everywhere in this system corners are square (0–1px radius) — buttons, cards, inputs, badges, all of it. This is the single most identity-defining trait: if a component you're building has rounded corners, it will read as off-brand immediately. `--radius-sharp: 1px` is the only radius token and the ceiling.

> `rounded-none` and `rounded-full` are Tailwind statics and cannot be removed via theme config. They compile. **`rounded-full` is banned by review, not by the compiler** — grep for it before shipping.

## Elevation

No drop shadows, ever. Depth comes from flat color-block contrast (`#E4E6E7` behind product photography) and from the photography itself, never from blur or shadow layering. Modals and overlays use a flat fill with a hard edge, not a soft shadow.

## Motion

`MOTION_INTENSITY 6`: mask reveals, carousel drag, hover crossfade, nav transition. Nothing else. No parallax soup.

One easing curve for the whole site (`--ease-brand`, `cubic-bezier(0.16, 1, 0.3, 1)`) and three durations (`--duration-fast` 180ms, `--duration-base` 320ms, `--duration-slow` 640ms) so every timing feels like one hand made it. A bare `transition` utility already picks these up.

`prefers-reduced-motion: reduce` collapses everything globally in `base.css`. Do not re-enable motion past it.

## Components

Built and rendered at `/design-system` in the storefront. Read the source in `apps/storefront/src/components/ui/` before building a new one.

### Buttons
- **`solid`** — on white: `#000000` fill, white text, 1px radius, lowercase 14px/600.
- **`onImage`** — over photography or video: transparent fill, 2px solid `#FFFFFF` border, white text. The stroke is what keeps the label legible against an unpredictable background, so it is not optional.
- **`outline`** — secondary on white: transparent fill, 2px solid `#000000` border, black text.
- Height 40px, padding 8px 16px, `active:translate-y-px` for tactile feedback.

### Sale badge
`#C2311E` fill, white text, no border, no radius, 12px/600, rectangular tag pinned to the top-left of a product image. A `dark` variant (black fill) exists for non-price labels like "НОВО" so the red keeps carrying exactly one meaning.

### Product card
`#E4E6E7` background behind the product photo, no border, no radius, no shadow. Photo ratio `502/616`, matching the source images. Second image crossfades in on hover (pure CSS, no JS). Price block: bold EUR price (`#212529`), BGN in brackets (`#68737D`), strikethrough RRP when discounted. Wishlist icon top-right — plain outline glyph, no background chrome.

### Inputs
`#F7F7F7` fill, no visible border, no radius, 16px light-weight (300) text in `#212529`. Label ABOVE, helper and error BELOW. Never placeholder-as-label.

### Filter bar
Plain text triggers ("Категория ▾", "Размер ▾") — 14px black text plus a chevron, no button chrome, separated by `#696969` hairlines. Don't turn filter controls into bordered dropdown buttons; keep them text-first. Scrolls sideways on narrow viewports rather than wrapping to a second row.

## Prices

EUR is the store currency. BGN is **never stored** — it is derived at render time from the fixed peg (1.95583, rounded up to the stotinka) by `apps/storefront/src/lib/price.ts`. Do not add a second price list; it will drift.

## Do's and Don'ts

1. **Do** reserve `#C2311E` red exclusively for sale/discount signage — never decoratively, never for errors.
2. **Don't** round any corner — the identity depends on hard, rectangular edges.
3. **Do** set headlines in bold condensed uppercase to read as stamped workwear labels.
4. **Don't** put body copy in the condensed display face — headlines and short labels only.
5. **Do** pair uppercase headlines with lowercase button labels for deliberate contrast.
6. **Don't** add drop shadows, gradients, or glassmorphism — surfaces stay flat and matte.
7. **Do** use flat neutral grey (`#E4E6E7`) as the only "background treatment" behind product photography.
8. **Don't** introduce secondary brand colors — this system runs on black, white, grey, and one red accent, full stop.
9. **Don't** hardcode a hex where a token exists.

## If asked to extend the system

If a new component isn't covered above (e.g. a modal, a toast, a slider), infer its style from the closest analog already documented — same border-radius rule (square), same elevation rule (no shadow), same restraint on color (black/white/grey + red only where a deal is involved) — rather than reaching for generic web defaults like `border-radius: 8px` or `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`, which would visibly clash with the rest of the site.

If the extension needs a **new token**, add it to `theme.css`, mark it `[EXT]`, and write one sentence saying why the original extraction did not cover it. Two such extensions exist today: the hero type tier and the motion scale.
