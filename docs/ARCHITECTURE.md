# Architecture

Progression Radar is a static, single-page app. There is no backend, no database and no router: the configuration is
compiled into the bundle at build time and the user's data lives in the URL.

## Goals

- **Minimal.** Few dependencies, few files, no abstractions that the app does not need yet.
- **Customisable by forking.** Adopters change files in `config/` only; `src/` stays untouched so upstream updates
  merge cleanly.
- **Deployable anywhere.** `npm run build` produces plain static files with relative paths.

## Stack

| concern     | choice                              | why                                                                 |
|-------------|-------------------------------------|---------------------------------------------------------------------|
| build       | Vite                                | fast dev server, zero-config production build                       |
| UI          | React + TypeScript                  | small component tree, typed domain model                            |
| state       | React `useState` in `App`           | one object (`Person`) is the whole state; no store library needed   |
| styles      | plain CSS with custom properties    | easy theming without a preprocessor or a CSS framework              |
| fonts       | Fontsource packages (Latin subsets) | self-hosted, no third-party requests, small CSS                     |
| chart       | hand-written SVG (`RadarChart.tsx`) | ~100 lines, no chart library, fully styleable from CSS              |
| markdown    | react-markdown                      | renders KPI descriptions and footer safely (raw HTML is not allowed) |
| config      | YAML parsed at build time           | readable for non-developers, no runtime fetch                       |
| tests       | Vitest + Testing Library (happy-dom)| shares the Vite config, so YAML imports work in tests too           |

## Layout

```
config/                  everything a deployment customises
  categories.yml           areas and their KPIs per level
  roles.yml                roles and the levels they require
  site.yml                 title, optional logo and footer
  theme.css                CSS overrides, loaded after the base styles
public/                  static files copied as-is (favicons, manifest)
src/
  main.tsx                 entry point: loads config, reads the URL, renders App or an error screen
  App.tsx                  owns the state, syncs it to the URL, composes the page
  model.ts                 domain types and pure functions (levels, percentages)
  config.ts                imports config/*.yml and validates it into a typed Config
  urlState.ts              reads/writes the share link (URL fragment, legacy `?state=` read-only) and its notices
  components/
    PersonPanel.tsx        seal, name, role, tags and the "compare to" selector
    ProgressSummary.tsx    overall progress and the gap with the compared role
    RadarChart.tsx         SVG radar chart
    CategoryPanel.tsx      category tabs, level selector and KPIs
    ShareButton.tsx        copies the share link of the person on screen
    LinkNotice.tsx         dismissible notice about data a link could not use
  styles.css               base styles and the CSS custom properties used for theming
  *.test.ts(x)             tests, next to the code they cover
vite.config.ts           Vite + Vitest config, including a tiny YAML plugin
```

## Data flow

```
config/*.yml ──(build: YAML plugin)──▶ config.ts: parseConfig() ──▶ Config
                                                                       │
URL #name=…&comm=2 ──▶ urlState.ts: parseState() ──▶ Person ──▶ App (useState)
(or legacy ?state=…)     └─▶ issues ──▶ notice                  │      │
                                                                │      └──▶ components
        URL ◀── saveUrl() (debounced replaceState) ◀────────────┘
        URL ──(hashchange)──▶ parseState() ──▶ App
```

1. **Build time.** `vite.config.ts` contains a small plugin that turns any `.yml` import into the parsed object.
   YAML syntax errors fail the dev server and the build. Images in `config/` are collected with `import.meta.glob`
   so `site.yml` can reference a logo by file name.
2. **Start-up.** `main.tsx` calls `loadConfig()`, which validates the raw data and either returns a typed `Config`
   or throws a `ConfigError` with *all* the problems found; those are rendered as a list.
3. **URL state.** `parseState()` reads the share link: the legacy `state` query if present, otherwise the fragment.
   It returns `empty` (start with an example), `invalid` with a reason (nothing usable: start with an example) or `ok`
   with a normalised `Person` and the list of `issues` (fields that were ignored or corrected). `noticeFor()` turns
   `invalid` and non-empty `issues` into the message of a non-blocking `LinkNotice`; only configuration errors are
   blocking.
4. **Interaction.** Components receive data and callbacks as props. `App` updates the `Person` and an effect writes it
   back with `saveUrl()` (`history.replaceState`, no history entry per click) 250 ms after the last change, and on
   `pagehide`. It does not write on load when a link was opened, so that link is left as it was; with no link, the example `Person` is
   written on load so a reload or a copy of the address bar keeps it, and a failing history API is caught.
   "Copy link" builds the link from the `Person` (`toUrl()`), so it is right even while a write is pending. `App` also
   listens to `hashchange` to apply links edited by hand (`replaceState` does not fire it). `App` owns the selected
   category, which is UI state and is not stored in the URL, so both the radar labels and the category nav can
   change it.

## Key decisions

### The URL is the database
The `Person` object (`name`, `levels`, `roleKey`, `tags`, `compareTo`) is serialised in the URL fragment as flat
key-value parameters (`#name=John+Connor&role=aswe&compare=front&tag=tech&comm=2&pm=1&…`, one parameter per category,
written last), as decided in [ADR 0001](adr/0001-readable-share-url-format.md). This keeps the app backend-free, makes
every view shareable and keeps the data out of server logs. Links created by previous versions (`?state=<JSON>`) are
read forever and rewritten in the new format on the first change. `name`, `role`, `compare`, `tag` and `state` are
reserved: `parseConfig()` rejects categories with those keys (`RESERVED_KEYS` in `model.ts`). Normalisation is lenient on purpose: unknown categories/roles are dropped and levels are clamped,
so old links survive configuration changes instead of breaking.

### Configuration is validated, not trusted
The YAML imports are typed as `unknown`. `parseConfig()` is the only place that turns them into domain types, and it
checks required fields, positive integer levels, duplicated keys, roles referencing unknown categories and missing
logo files. A test loads the shipped configuration, so CI catches configuration mistakes as well.

### Customisation without being a library
Earlier versions were published as an npm package with a Babel `lib/` build so other projects could depend on it and
override pieces. That has been removed. Customisation is now limited to what adopters actually need:

- **Content**: `config/*.yml`.
- **Branding**: `config/site.yml` (title, logo, footer) and `config/theme.css`.

`theme.css` is imported after `src/styles.css`, so it can override the CSS custom properties or any rule. Components
use stable, documented class names to make those overrides safe. If deeper changes are needed, the fork can change
`src/` directly; the code base is small enough for that.

### No chart library
The radar is rendered as SVG by `RadarChart.tsx`. Colours come from CSS variables (`--color-person`,
`--color-compare`, `--color-grid`), so the chart follows the theme without any JavaScript configuration. It also
removes the biggest dependency the app used to have. Shapes are set both as the `d` attribute and as the `d` CSS
property, so browsers that support it animate between states and the others simply redraw. The compared role is
dashed and hatched, so the two series can be told apart without relying on colour.

### Look and feel
The default theme is inspired by Japanese print, after the 成長 ("growth") in the demo title: paper and ink colours,
a vermilion seal (hanko) with the person's initials and indigo for the compared role. It is only the default: every
colour, font and the paper texture are CSS variables, and there is a dark palette for `prefers-color-scheme: dark`.
Animations are CSS-only and disabled for `prefers-reduced-motion`. See [DESIGN.md](DESIGN.md) for the design system.

### Percentages
A level is shown on the radar as `level / highest level of the category`. Categories can therefore have different
numbers of levels and still be comparable on the same chart.

## Testing

- `model.test.ts`: level and percentage calculations.
- `config.test.ts`: validation rules and the shipped configuration.
- `urlState.test.ts`: fragment format and round-trip, legacy URLs, normalisation, ignored/corrected fields and invalid
  input.
- `App.test.tsx`: rendering and the main interactions (level selection, compare role, debounced URL sync that survives
  a failing history API, summary, selecting a category from the radar, copying the link, editing the link by hand and
  the link notice).

CI (GitHub Actions) runs the tests and the production build on every push and pull request.

## Extending

- **New field in the URL state**: add it to `Person` in `model.ts`, write and read it in `urlState.ts` (a new fragment parameter must not clash with a category key), use it in `App`.
- **New config option**: add it to the type in `model.ts`, validate it in `config.ts`, document it in the README.
- **New UI section**: add a component in `src/components/`, give its root a stable class name, style it in
  `styles.css` using the existing custom properties.
