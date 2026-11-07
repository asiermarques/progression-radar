---
paths:
  - "src/**/*.css"
  - "config/theme.css"
---

# Frontend: styles

Read `docs/DESIGN.md` before changing or adding UI: tokens, colour semantics, typography, components, states and
motion are described there.

## Where styles go

- `src/styles.css` holds every base style. An adopter's `theme.css` (in their config folder, else `config.example/theme.css`) replaces the
  example file and is loaded after the base styles. `config.example/theme.css` ships with commented-out examples only.
  Never put default styles in it.
- Plain CSS with custom properties only: no preprocessor, CSS framework, CSS modules or CSS-in-JS.

## Theming

- Colours, fonts, radius and texture always come from the custom properties in `:root` (`--color-*`,
  `--font-family`, `--font-display`, `--radius`, `--texture`, `--ease`). Do not hard-code colours in rules.
- Derive tints with `color-mix(in oklab, var(--color-…) N%, transparent)`, as the existing rules do, instead of new
  hex values.
- A new themable value is a new custom property in `:root` **and** in the `@media (prefers-color-scheme: dark)`
  palette, listed in `config.example/theme.css` (commented) and in `docs/guides/styles.md`.
- The radar series use `--color-person` and `--color-compare` through `--series-color`. Keep the compared role
  distinguishable without colour (dashed outline and hatching).

## Naming and selectors

- Kebab-case classes scoped by the component's root class: `category-nav`, `category-nav-meter-fill`; modifiers with
  `--` (`radar-series--person`, `radar-label--interactive`).
- Style states through the attributes the components set (`[aria-pressed="true"]`, `[aria-current]`,
  `[data-status="met"]`) rather than new state classes.
- Keep specificity low so an adopter's `theme.css` can override any rule without `!important`.

## Layout, motion and print

- Reuse the existing breakpoints: `max-width: 600px`, `max-width: 899px` / `min-width: 900px`. Do not add new ones
  without a reason.
- Animations and transitions are CSS-only, use `var(--ease)`, and are neutralised by the global
  `@media (prefers-reduced-motion: reduce)` block; do not bypass it with `!important` durations.
- Check the `@media print` block when adding UI: interactive-only controls (like `.share-button`) are hidden and
  content blocks avoid page breaks.
- Check both light and dark palettes, a narrow screen and print before finishing.
