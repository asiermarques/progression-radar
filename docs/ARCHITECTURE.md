# Architecture

Progression Radar is a static, single-page app. There is no backend, no database and no router: the configuration is
compiled into the bundle at build time and the user's data lives in the URL.

## Goals

- **Minimal.** Few dependencies, few files, no abstractions that the app does not need yet.
- **Customisable by forking.** Adopters change files in their own config folder only (`config/`, git-ignored upstream,
  overrides the sample in `config.example/` file by file); `src/` stays untouched so upstream updates merge cleanly.
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
| markdown    | react-markdown                      | renders expectation descriptions and footer safely (no raw HTML)    |
| config      | YAML and Markdown read at build time | readable for non-developers, no runtime fetch                      |
| tests       | Vitest + Testing Library (happy-dom)| shares the Vite config, so YAML imports work in tests too           |

## Layout

```
config.example/          upstream's sample configuration and the defaults (adopters do not edit it)
  categories/              one Markdown category file per category, grouped by level (an adopter may use categories.yml instead)
  roles.yml                roles and the levels they require
  site.yml                 title, optional logo and footer
  theme.css                comment-only CSS overrides, loaded after the base styles
config/                  the adopter's configuration; git-ignored except README.md. Same file names as the sample,
                           and each file replaces the sample one. Another folder: PROGRESSION_RADAR_CONFIG_DIR
public/                  static files copied as-is (favicons, manifest)
docs/                    PRODUCT, ARCHITECTURE, DESIGN, the glossary, the ADRs and guides/ (user guides; the README only lists and links them)
scripts/
  config-sources.ts        decides which folder each configuration file is read from (used by vite.config.ts)
  category-markdown.ts     reads one Markdown category file into the raw shape of a categories.yml entry
  config-migrate.mjs       `npm run config:migrate`: moves a fork's edits out of config.example/
  config-convert-categories.mjs  `npm run config:convert-categories`: runs convert-categories.ts (Vite loads the TS)
  convert-categories.ts    converts categories.yml into Markdown category files, validating it with parseConfig()
  snapshot.mjs             `npm run snapshot:record|link|check`: loads snapshot-commands.ts through Vite with the project's config plugins
  snapshot-commands.ts     arguments, output and exit codes of the three snapshot commands
  snapshots.ts             records a Person in a CSV snapshot, turns a row into a Share link and checks snapshots
  csv.ts                   hand-written CSV reader and writer (quoting, `,` or `;`, line breaks)
snapshots/               the user's snapshots (personal data); git-ignored except README.md. Another folder: PROGRESSION_RADAR_SNAPSHOTS_DIR
.claude/skills/          the project skill that drives the snapshot scripts
src/
  main.tsx                 entry point: loads config and theme, reads the URL, renders App or an error screen
  App.tsx                  owns the state, syncs it to the URL, composes the page
  model.ts                 domain types and pure functions (levels, percentages)
  config.ts                validates the resolved configuration into a typed Config
  urlState.ts              reads/writes the share link (URL fragment, legacy `?state=` read-only) and its notices
  components/
    PersonPanel.tsx        seal, name, role, tags and the "compare to" selector
    ProgressSummary.tsx    overall progress and the gap with the compared role
    RadarChart.tsx         SVG radar chart
    CategoryPanel.tsx      category tabs, level selector and expectations
    ShareButton.tsx        copies the share link of the person on screen
    LinkNotice.tsx         dismissible notice about data a link could not use
  styles.css               base styles and the CSS custom properties used for theming
  *.test.ts(x)             tests, next to the code they cover
vite.config.ts           Vite + Vitest config, with a tiny YAML plugin and the plugin that resolves the configuration
```

## Snapshots outside the browser

Snapshots are plain CSV files that the app never reads ([ADR 0004](adr/0004-local-csv-snapshots-outside-the-app.md)).
Three npm scripts work on them, and they reuse the app's code instead of copying its rules: the Share link is read
with `parseState()` and written with `toUrl()` from `urlState.ts`, and the Configuration is `loadConfig()`, so
Normalisation, the Highest level and the problems of an invalid Configuration are the ones the app has. `snapshot.mjs`
gets that configuration the way the build does: it loads `snapshot-commands.ts` with Vite's `runnerImport` and the
`yaml` and `progression-radar-config` plugins taken from `vite.config.ts` (Vite's `runnerImport` ignores the config
file), so the virtual configuration module resolves from `config/` and `config.example/` with no build step. The
parts that are pure (`csv.ts`, rows to and from a Person) are apart from file access, and `snapshots.ts` takes the
Configuration as a parameter, so tests give it their own.

- A snapshot is history: the only write to an existing file is bytes appended at its end, in the separator, line
  breaks and byte-order mark the file already uses. A new file is created with `wx`, so it never overwrites.
- Columns are found by header name. The separator (`,` or `;`) is the one that finds the `id` column in the header.
- `snapshot:link` writes the link with `toUrl()` and appends the columns the Configuration no longer has, so the app's
  notice lists them. `snapshot:record` and `snapshot:link` refuse a file they cannot read and point to
  `snapshot:check`, which reports every problem with file and line.
- The project skill in `.claude/skills/` only runs these scripts; the rules stay in the code.

## Data flow

```
config/ + config.example/ ──(build: resolve per file, YAML / category-file plugins)──▶ config.ts: parseConfig() ──▶ Config
                                                                       │
URL #name=…&comm=2 ──▶ urlState.ts: parseState() ──▶ Person ──▶ App (useState)
(or legacy ?state=…)     └─▶ issues ──▶ notice                  │      │
                                                                │      └──▶ components
        URL ◀── saveUrl() (debounced replaceState) ◀────────────┘
        URL ──(hashchange)──▶ parseState() ──▶ App
```

1. **Build time.** `vite.config.ts` contains a small plugin that turns any `.yml` import into the parsed object (YAML
   syntax errors fail the dev server and the build) and another one that resolves the configuration: each of
   the categories (as `categories.yml` or a `categories/` folder, never both), `roles.yml`, `site.yml` and `theme.css`
   is taken from the config folder if it is there and from `config.example/` otherwise, and images are looked up in the same order so `site.yml` can reference a logo by file
   name. The result reaches the app through two virtual modules (`virtual:progression-radar-config` and
   `virtual:progression-radar-theme`), so no path is written in `src/` and the build stays static. The config folder
   is `config/` or the path in `PROGRESSION_RADAR_CONFIG_DIR`, which must exist when it is set; the variable is not
   `VITE_`-prefixed and absolute paths never reach the bundle (messages call the folder `PROGRESSION_RADAR_CONFIG_DIR`).
   The build log lists where each file came from (and whether the categories are a file or a folder) and warns about
   files the app does not use. In dev, editing a file reloads the page, and so does adding or removing one in either
   folder or in their `categories/` folder.
   Each Markdown category file is imported through `?category`: a transform (`scripts/category-markdown.ts`) parses
   it with `mdast-util-from-markdown`, a build-time dev dependency that never reaches the bundle, into the same raw
   shape as one entry of `categories.yml` plus the mistakes it found (`file:line: message`). The virtual module hands
   both to the app, so `src/` does not know which form the categories came from. See
   [ADR 0003](adr/0003-markdown-category-files-alongside-yaml.md).
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
reserved: `parseConfig()` rejects categories with those keys (`RESERVED_KEYS` in `model.ts`), and also `id`, the
column that identifies a Person in a snapshot (`SNAPSHOT_RESERVED_KEYS`, which is not a Share link field). Normalisation is lenient on purpose: unknown categories/roles are dropped and levels are clamped,
so old links survive configuration changes instead of breaking.

### Configuration is validated, not trusted
The raw configuration is typed as `unknown`. `parseConfig()` is the only place that turns it into domain types, and it
checks required fields, positive integer levels, duplicated keys, roles referencing unknown categories and missing
logo files, and lists the mistakes found while reading the category files with its own. Every problem names the file and folder it comes from (`config/roles.yml: role "r" …`,
`config.example/categories.yml entry #2 …` or `config/categories/03-pm.md: …`), because the same file can come from either place. A test loads the
resolved configuration and, separately, `config.example/` on its own, so CI catches mistakes in an adopter's
configuration and in the sample, even when the sample is overridden.

### Customisation without being a library
Earlier versions were published as an npm package with a Babel `lib/` build so other projects could depend on it and
override pieces. That has been removed. Customisation is now limited to what adopters actually need:

- **Content**: the categories (`categories/` or `categories.yml`) and `roles.yml`.
- **Branding**: `site.yml` (title, logo, footer) and `theme.css`.

These live in the adopter's config folder, which upstream git-ignores and never edits, and fall back file by file to
`config.example/`. A file replaces its counterpart whole (no merging of YAML keys or CSS rules), which keeps the rule
easy to explain and stops upstream's sample content from leaking into an adopter's ladder; see
[ADR 0002](adr/0002-config-example-with-local-config-override.md). Forks that predate the split move their edits with
`npm run config:migrate`.

The resolved `theme.css` is imported after `src/styles.css`, so it can override the CSS custom properties or any rule.
The base theme stays in `src/styles.css`, so replacing `theme.css` loses no styles. Components
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
- `config.test.ts`: validation rules, the resolved configuration and `config.example/` on its own.
- `scripts/config-sources.test.ts` and `scripts/config-migrate.test.ts`: which folder each file comes from, the
  build log, and the migration command on temporary git repositories.
- `urlState.test.ts`: fragment format and round-trip, legacy URLs, normalisation, ignored/corrected fields and invalid
  input.
- `scripts/csv.test.ts`: quoting, separators, line numbers and unreadable files.
- `scripts/snapshots.test.ts`: recording (new and existing snapshots, refused ids and names, spreadsheet files), the
  Share link of a row and every error and warning of the check, on temporary folders.
- `scripts/snapshot-commands.test.ts`: the output and exit codes of the three commands against the resolved
  configuration.
- `App.test.tsx`: rendering and the main interactions (level selection, compare role, debounced URL sync that survives
  a failing history API, summary, selecting a category from the radar, copying the link, editing the link by hand and
  the link notice).

CI (GitHub Actions) runs the tests and the production build on every push and pull request.

## Extending

- **New field in the URL state**: add it to `Person` in `model.ts`, write and read it in `urlState.ts` (a new fragment parameter must not clash with a category key), use it in `App`.
- **New config option**: add it to the type in `model.ts`, validate it in `config.ts`, document it in the matching guide in `docs/guides/`.
- **New UI section**: add a component in `src/components/`, give its root a stable class name, style it in
  `styles.css` using the existing custom properties.
