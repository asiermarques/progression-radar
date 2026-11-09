# Styles

Change how the app looks from your own `theme.css`, without touching `src/`.

`config/theme.css` replaces `config.example/theme.css` (which only holds commented-out examples to copy) and is loaded
after the base styles, so anything you write there wins. The easiest way to re-brand
the app is to override the CSS custom properties (see [docs/DESIGN.md](../DESIGN.md#colour) for all of them):

```css
/* config/theme.css */
:root {
  --color-primary: #0b7285;
  --color-person: #0b7285;
  --color-compare: #f08c00;
  --font-family: system-ui, sans-serif;
  --font-display: Georgia, serif;
  --texture: none;
  --radius: 4px;
}
```

The base styles also define a dark palette inside `@media (prefers-color-scheme: dark)`. Variables you set in `:root`
apply to both palettes, so:

- to keep dark mode, set your dark colours inside the same media query;
- to have a single palette, set every `--color-*` variable in `:root` and add `color-scheme: light;` so form controls
  match it.

The default fonts are bundled with the app (Latin characters only). To use other fonts, load them in `theme.css`
with `@font-face` or `@import` and set `--font-family` and `--font-display`.

The [report](snapshots.md#reports) of the snapshots uses the same variables and your `theme.css`, so it follows your
colours and the radar classes below. It loads no font file (it blocks every request), so its text uses the fonts
named in `--font-family` and `--font-display` only when they are installed on the computer that opens it; list a
system fallback after yours.

You can also target these stable class names: `.app-header`, `.app-title`, `.app-logo`, `.share-button`,
`.person-panel`, `.person-seal`, `.progress-summary`, `.radar`, `.radar-series--person`, `.radar-series--compare`,
`.link-notice`, `.category-panel`, `.category-nav`, `.level-nav`, `.expectation`, `.app-footer`, `.app-footer-title`
and `.app-footer-text`. The expectation elements also keep their former `.kpi*` class names and the `--kpi-index`
property, so existing themes keep working.

See also: [the design system](../DESIGN.md) for the meaning of every variable, and [Configuration](configuration.md) for
where `theme.css` goes.
