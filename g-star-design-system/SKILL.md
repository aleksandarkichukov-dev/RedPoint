---
name: g-star-design-system
description: Design tokens and component specs for the G-Star-inspired industrial/streetwear look used on this project's clothing site (Red Point redesign). Use this skill whenever styling, designing, or building any front-end UI here — pages, sections, components, hero banners, product cards, buttons, forms — even if the user just says "style this", "build the hero", "make a product card", or doesn't explicitly mention "design system" or "G-Star". Also use it when the user asks to check whether existing CSS matches the site's design language, or wants CSS variables/tokens for the project.
---

# G-Star Design System

Extracted directly from g-star.com's live computed styles (colors, fonts, spacing, button/card behavior) and adapted as the visual language for this project's clothing site. The mood: industrial, monochrome, sharp-edged streetwear retail — matte black-and-white surfaces broken only by a single red accent reserved for sale/discount signage. Treat every value below as intentional, not arbitrary — reuse them exactly rather than approximating, so every new page stays visually consistent with the rest of the site.

Ready-to-use CSS custom properties are bundled at `assets/tokens.css` — import or copy that file into any new stylesheet instead of retyping hex codes by hand.

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

## Typography

- **Headline font**: DIN Pro / Barlow Condensed (fallback: HelveticaNeue-CondensedBold, "Arial Narrow", Arial, sans-serif) — condensed, bold, uppercase
- **Body font**: Gotham HCo (fallback: Arial, Helvetica, sans-serif)
- No monospace anywhere — it breaks the industrial tone.

| Style | Spec | Used for |
|---|---|---|
| Display / H1–H2 | 32px bold, 0.95 line-height, 0.02em tracking, uppercase | Hero banners, category titles ("JEANS", "ALL 50% OFF") |
| Subhead / H3 | 16px bold, 1.3 line-height, normal case, `#696969` | Section labels, filter groups |
| Body | 13px regular, 1.4 line-height, `#000000` | Paragraphs, nav text |
| Nav / Links | 14px regular, 1.4 line-height, `#000000` | Navigation, inline links |
| Button label | 14px semibold (600), **lowercase** | "shop men" — deliberately contrasts with uppercase headlines; never uppercase a button label in this system |
| Price (sale) | 14px bold (700), `#212529` | Current/discounted price |
| Price (strikethrough) | 14px semibold (600), `#68737D`, line-through | Original RRP next to a sale price |
| Badge | 12px semibold (600), white on `#C2311E` | "-50% RRP" style tags |

The uppercase-headline / lowercase-button contrast is a deliberate rhythm, not an inconsistency — preserve it when adding new CTAs.

## Spacing

- Base unit: 8px
- Scale: 4 / 8 / 16 / 24 / 32 / 48 / 64
- Button padding: 8px 16px
- Card padding: 16px
- Section spacing: 32px mobile, 64px desktop

## Border Radius

Everywhere in this system corners are square (0–1px radius) — buttons, cards, inputs, badges, all of it. This is the single most identity-defining trait: if a component you're building has rounded corners, it will read as off-brand immediately. Default to 0 unless a token explicitly says otherwise.

## Elevation

No drop shadows, ever. Depth comes from flat color-block contrast (e.g. `#E4E6E7` behind product photography) and from the photography itself, never from blur or shadow layering. Modals and overlays use a flat fill with a hard edge, not a soft shadow.

## Components

### Buttons
- **Primary, over imagery**: transparent fill, 2px solid `#FFFFFF` border, white text, 1px corner radius, lowercase 14px/600. Use over hero photos.
- **Primary, on white**: `#000000` fill, white text, no border, 1px corner radius, lowercase 14px/600.
- **Secondary/outline**: transparent fill, 2px solid `#000000` border, black text, 1px corner radius.
- Height 40px, padding 8px 16px.

### Sale badge
`#C2311E` fill, white text, no border, no radius, 12px/600, rectangular tag pinned to the top-left of a product image.

### Product card
`#E4E6E7` background behind the product photo, no border, no radius, no shadow. Price block: bold sale price (`#212529`) beside a strikethrough RRP (`#68737D`). Wishlist icon top-right — plain outline glyph, no background chrome.

### Inputs
`#F7F7F7` fill, no visible border, no radius, 16px light-weight (300) text in `#212529`. Used for search and form fields alike.

### Filter bar
Plain text triggers ("Gender ▾", "Category ▾") — 14px black text plus a chevron, no button chrome, separated by `#696969` hairlines. Don't turn filter controls into bordered dropdown buttons; keep them text-first.

## Do's and Don'ts

1. **Do** reserve `#C2311E` red exclusively for sale/discount signage — never decoratively.
2. **Don't** round any corner — the identity depends on hard, rectangular edges.
3. **Do** set headlines in bold condensed uppercase to read as stamped workwear labels.
4. **Don't** put body copy in the condensed display face — headlines and short labels only.
5. **Do** pair uppercase headlines with lowercase button labels for deliberate contrast.
6. **Don't** add drop shadows, gradients, or glassmorphism — surfaces stay flat and matte.
7. **Do** use flat neutral grey (`#E4E6E7`) as the only "background treatment" behind product photography.
8. **Don't** introduce secondary brand colors — this system runs on black, white, grey, and one red accent, full stop.

## If asked to extend the system

If a new component isn't covered above (e.g. a modal, a toast, a slider), infer its style from the closest analog already documented — same border-radius rule (square), same elevation rule (no shadow), same restraint on color (black/white/grey + red only where a deal is involved) — rather than reaching for generic web defaults like `border-radius: 8px` or `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`, which would visibly clash with the rest of the site.
