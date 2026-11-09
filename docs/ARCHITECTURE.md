# Architecture

Progression Radar is a static, single-page app. There is no backend, no database and no router: the configuration is
compiled into the bundle at build time and the user's data lives in the URL.

## Goals

- **Minimal.** Few dependencies, few files, no abstractions that the app does not need yet.
- **Customisable without touching `src/`.** Adopters change files in their own config folder only (`config/`,
  git-ignored upstream, overrides the sample in `config.example/` file by file). The recommended way is an
  **Adopter repository** that holds only that folder, the snapshots and a `package.json`, and depends on the radar
  ([ADR 0005](adr/0005-radar-as-a-dependency-of-an-adopter-repository.md)); a fork is for changing `src/`. One code
  path serves both.
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
package.json            declares the `progression-radar` binary (`scripts/cli.mjs`), `preferUnplugged` for Yarn Plug'n'Play and the published `files`
.github/workflows/       `ci.yml` (tests, build and the Adopter repository fixture) and `release.yml` (publishes to npm on a `vX.Y.Z` tag)
config.example/          upstream's sample configuration and the defaults (adopters do not edit it)
  categories/              one Markdown category file per category, grouped by level
  roles.yml                roles and the levels they require
  site.yml                 title, optional logo and footer
  theme.css                comment-only CSS overrides, loaded after the base styles
config/                  the adopter's configuration; git-ignored except README.md. Same file names as the sample,
                           and each file replaces the sample one. Another folder: PROGRESSION_RADAR_CONFIG_DIR
public/                  static files copied as-is (favicons, manifest)
docs/                    PRODUCT, ARCHITECTURE, DESIGN, the glossary, the ADRs and guides/ (user guides; the README only lists and links them)
scripts/
  config-sources.ts        decides which folder each configuration file is read from (used by vite.config.ts)
  category-markdown.ts     reads one Markdown category file into the raw shape of one category
  cli.mjs                  the `progression-radar` binary: `dev`, `build`, `preview`, `check`, `snapshot …` and `config convert-categories`
  init.ts                  `init`: copies config.example/ to config/, adds the npm scripts and `reports/` to the .gitignore, never overwriting
  check-command.ts         `check` (Configuration, then snapshots) and the validation that `build` runs first
  adopter-fixture.mjs      CI and local proof: packs the radar, installs it in a fixture Adopter repository with npm, pnpm or Yarn
  config-migrate.mjs       `npm run config:migrate`: moves a fork's edits out of config.example/ and converts a moved categories.yml
  convert-categories.ts    converts a categories.yml, no longer read by the app, into Markdown category files, validating it with parseConfig(); the only code that reads one
  load-converter.mjs       loads convert-categories.ts through Vite, for `config convert-categories` and `config:migrate`
  snapshot-commands.ts     arguments, output and exit codes of the snapshot commands, and the writing of the Report
  snapshots.ts             records a Person in a CSV snapshot, turns a row into a Share link, checks snapshots and reads their rows
  report.ts                the data of a Report (pure): what each Person recorded in each Snapshot
  report-html.tsx          renders a Report as one self-contained HTML page with React on the server (no script, CSP `<meta>`)
  personal-folders.ts      tells the dev server which URLs point into the Snapshots folder and `reports/`, which it never serves
  csv.ts                   hand-written CSV reader and writer (quoting, `,` or `;`, line breaks)
snapshots/               the user's snapshots (personal data); git-ignored except README.md. Another folder: PROGRESSION_RADAR_SNAPSHOTS_DIR
reports/                 the Reports `snapshot:report` writes (personal data); git-ignored, never served by the dev server
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

## Two roots: the radar and the directory it runs in

Every command has two roots. The **package root** is the radar itself (`index.html`, `src/`, `public/`,
`config.example/`, `vite.config.ts`): Vite's `root`, in a fork the repository and installed as a dependency
`node_modules/progression-radar`. The **working directory** is where the command runs: it holds the Config folder
(`config/` or `PROGRESSION_RADAR_CONFIG_DIR`), the Snapshots folder (`snapshots/` or `PROGRESSION_RADAR_SNAPSHOTS_DIR`)
and `dist/`. Relative values of both variables resolve from the working directory. In a fork both roots are the same
folder, so nothing changes there.

`scripts/cli.mjs` is the only entry point: Upstream's own npm scripts call it, and an Adopter repository declares the
same script names calling the `progression-radar` binary. It drives Vite through its JavaScript API (`createServer`,
`build`, `preview`) with the radar's `vite.config.ts` loaded by Vite's runner (no temporary file is written next to
it), `build.outDir` in the working directory with `emptyOutDir: true` (it is outside `root`) and `cacheDir` in the
working directory (a package installed by pnpm can sit in a read-only store). Every TypeScript file is loaded through
Vite (`runnerImport`), never through Node's type stripping, which does not work inside `node_modules`. `tsc` is not run
by the `build` subcommand: Upstream's `build` script runs it first.

The dev server serves the radar, the Config folder and `config.example/` only (`server.fs.allow`), so the Snapshots
folder, `reports/` and the rest of an Adopter repository are never served (ADR 0004, ADR 0007). In a fork the working
directory is Vite's root, which `fs.allow` does not cover, so a middleware in `vite.config.ts` also answers 404 to any
URL (including `/@fs/`) into the Snapshots folder or `reports/` (`scripts/personal-folders.ts`).

## Snapshots outside the browser

Snapshots are plain CSV files that the app never reads ([ADR 0004](adr/0004-local-csv-snapshots-outside-the-app.md)).
Four commands (`snapshot record|link|check|report`) work on them, and they reuse the app's code instead of copying its rules: the Share link is read
with `parseState()` and written with `toUrl()` from `urlState.ts`, and the Configuration is `loadConfig()`, so
Normalisation, the Highest level and the problems of an invalid Configuration are the ones the app has. `cli.mjs`
gets that configuration the way the build does: it loads `snapshot-commands.ts` (and `check-command.ts`) with Vite's
`runnerImport` and the `yaml` and `progression-radar-config` plugins taken from `vite.config.ts` (Vite's
`runnerImport` ignores the config file), so the virtual configuration module resolves from `config/` and
`config.example/` with no build step. The
parts that are pure (`csv.ts`, rows to and from a Person) are apart from file access, and `snapshots.ts` takes the
Configuration as a parameter, so tests give it their own.

- A snapshot is history: the only write to an existing file is bytes appended at its end, in the separator, line
  breaks and byte-order mark the file already uses. A new file is created with `wx`, so it never overwrites.
- Columns are found by header name. The separator (`,` or `;`) is the one that finds the `id` column in the header.
- `snapshot:link` writes the link with `toUrl()` and appends the columns the Configuration no longer has, so the app's
  notice lists them. `snapshot:record` and `snapshot:link` refuse a file they cannot read and point to
  `snapshot:check`, which reports every problem with file and line.
- `snapshot:report` ([ADR 0007](adr/0007-static-html-reports-from-snapshots.md)) reads the rows with the check's own
  code (`readSnapshotRows()`: any error means no rows), builds the data of the Report in `report.ts` and renders it in
  `report-html.tsx` with `renderToStaticMarkup`, so every value from a CSV is escaped by construction. Snapshots are
  ordered by file name without `.csv`, so `2027-02-10-q1.csv` comes after `2027-02-10.csv`. "Not recorded" is not level
  0: `recordedOverallPercentage()` in `src/model.ts` averages over the Categories a row has a level for, and the app's
  `overallPercentage()` is unchanged. The CSS is the custom properties at the top of `src/styles.css` (up to its
  `/* Base */` comment) and its `/* Radar chart */` section, followed by the resolved `theme.css`. The radar is
  `RadarChart.tsx` rendered on the server (`renderToStaticMarkup`): it must not use browser APIs, and its optional
  `recorded` flags leave a Category that was not recorded out of the outline instead of drawing it at 0. The Report
  goes to `reports/` (or `--out`), never to the Snapshots folder or `dist/`, which the dev server does not serve (see
  above).
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
   the categories (the `categories/` folder, as one unit), `roles.yml`, `site.yml` and `theme.css`
   is taken from the config folder (of the directory the command runs in) if it is there and from `config.example/`
   (of the radar) otherwise, and images are looked up in the same order so `site.yml` can reference a logo by file
   name. The result reaches the app through two virtual modules (`virtual:progression-radar-config` and
   `virtual:progression-radar-theme`), so no path is written in `src/` and the build stays static. The config folder
   is `config/` or the path in `PROGRESSION_RADAR_CONFIG_DIR`, which must exist when it is set; the variable is not
   `VITE_`-prefixed and absolute paths never reach the bundle (messages call the folder `PROGRESSION_RADAR_CONFIG_DIR`).
   A `categories.yml` is no longer read ([ADR 0006](adr/0006-markdown-category-files-only.md)): in the config folder it
   is a configuration problem that points to `config:convert-categories`, in `config.example/` one that points to
   `config:migrate`, and it never makes the categories fall back to the sample. The build log lists where each file
   came from (and how many category files) and warns about files the app does not use. In dev, editing a file reloads the page, and so does adding or removing one in either
   folder or in their `categories/` folder. Before it builds, `progression-radar build` loads the Configuration with
   `loadConfig()` and, when it is invalid, prints every problem and exits with an error without writing `dist/`; the
   dev server keeps showing the problems on the page.
   Each Markdown category file is imported through `?category`: a transform (`scripts/category-markdown.ts`) parses
   it with `mdast-util-from-markdown`, a build-time dependency that never reaches the bundle, into the same raw
   shape `parseConfig()` validates (`{ key, name, description, expectations }`) plus the mistakes it found
   (`file:line: message`). The virtual module hands both to the app, with the file of each category so its problems
   can name it. See [ADR 0003](adr/0003-markdown-category-files-alongside-yaml.md) and
   [ADR 0006](adr/0006-markdown-category-files-only.md).
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
`config.example/roles.yml entry #2 …` or `config/categories/03-data.md: …`), because the same file can come from either place.
When no category could be read, the roles' references to categories are not reported one by one: the categories'
own problem says what is wrong. A test loads the
resolved configuration and, separately, `config.example/` on its own, so CI catches mistakes in the sample, even when
it is overridden. For an adopter, `progression-radar build` fails on an invalid Configuration and
`progression-radar check` reports it (and then checks the snapshots), so a CI that runs `npm run check && npm run build`
never deploys a site that only shows the error screen.

### Customisation without being a library
Earlier versions were published as an npm package with a Babel `lib/` build so other projects could import its
components and override pieces. That has been removed. What is supported instead is a **tool dependency**: an Adopter
repository imports nothing from `src/`, overrides no code and runs the radar's commands against its own folders.
`src/` is not a public API. Customisation is limited to what adopters actually need:

- **Content**: the categories (`categories/`) and `roles.yml`.
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

- `model.test.ts`: level and percentage calculations, and the ones over the recorded Categories only.
- `components/RadarChart.test.tsx`: the radar rendered on the server, as the Report does, and axes that are not
  recorded.
- `config.test.ts`: validation rules, the resolved configuration and `config.example/` on its own.
- `scripts/config-sources.test.ts` and `scripts/config-migrate.test.ts`: which folder each file comes from, a
  `categories.yml` reported instead of read, the build log, and the migration command (with the conversion of a moved
  `categories.yml`) on temporary git repositories.
- `scripts/convert-categories.test.ts`: the conversion of a `categories.yml` (legacy `kpis`, headings, refusals).
- `urlState.test.ts`: fragment format and round-trip, legacy URLs, normalisation, ignored/corrected fields and invalid
  input.
- `scripts/csv.test.ts`: quoting, separators, line numbers and unreadable files.
- `scripts/snapshots.test.ts`: recording (new and existing snapshots, refused ids and names, spreadsheet files), the
  Share link of a row, every error and warning of the check and the rows read for a Report (order, filters), on
  temporary folders.
- `scripts/init.test.ts`: `init` on temporary folders (copy, no overwrite, scripts, the `.gitignore`, errors).
- `scripts/check-command.test.ts` and `scripts/cli.test.ts`: `init`, `check`, the failing `build` (every problem listed, no
  `dist/` written, a `categories.yml` in the config folder), `--help`, unknown commands and the folder each command reads and writes, running the real binary from
  an empty folder.
- `scripts/snapshot-commands.test.ts`: the output and exit codes of the snapshot commands against the resolved
  configuration, including the Report file written.
- `scripts/report.test.ts` and `scripts/report-html.test.tsx`: the data and the HTML of a Report (escaping, no script,
  Content-Security-Policy, "not recorded"). `scripts/personal-folders.test.ts`: the URLs the dev server refuses.
- `App.test.tsx`: rendering and the main interactions (level selection, compare role, debounced URL sync that survives
  a failing history API, summary, selecting a category from the radar, copying the link, editing the link by hand and
  the link notice).

CI (GitHub Actions) runs the tests and the production build on every push and pull request. A second job
(`adopter-repository`) runs `scripts/adopter-fixture.mjs` with npm, pnpm and Yarn (Plug'n'Play and `node-modules`):
it packs the radar, installs the tarball in a fixture Adopter repository with a minimal `config/` and a snapshot, runs
`check`, `build`, `snapshot:link` and `snapshot:report` (whose Report must land in the fixture's `reports/`), starts
the dev server to see that it reloads on a change in `config/` and does not serve `snapshots/` or `reports/`, and fails
if anything was written inside the installed radar. Because it installs the packed
tarball, it also proves that `files` in `package.json` ships everything the commands need.

## Releases

The radar is published to npm as `progression-radar`
([ADR 0005](adr/0005-radar-as-a-dependency-of-an-adopter-repository.md)). The package ships sources, not a bundle,
because the Configuration is compiled in at build time: `files` lists `index.html`, `vite.config.ts`, `src/`,
`scripts/`, `config.example/`, `public/` and `.claude/skills/`, without the tests, the CI fixture and
`config-migrate.mjs`, which is for forks only. There are no install scripts.

To release, set `version` in `package.json` (see the versioning rule in `CLAUDE.md`), merge it to `master`, then push
a tag with the same version:

```sh
git tag v1.0.0 && git push origin v1.0.0
```

`.github/workflows/release.yml` runs the CI jobs, checks that the tag matches `version` and runs `npm publish` with
npm trusted publishing: npmjs.com trusts that workflow file through OIDC (configured once in the package settings),
so no token is stored and the provenance is generated automatically. After the first 1.x release the 0.x versions,
the old component library, are deprecated by hand with `npm deprecate progression-radar@"<1.0.0" "<message>"`.

## Extending

- **New field in the URL state**: add it to `Person` in `model.ts`, write and read it in `urlState.ts` (a new fragment parameter must not clash with a category key), use it in `App`.
- **New config option**: add it to the type in `model.ts`, validate it in `config.ts`, document it in the matching guide in `docs/guides/`.
- **New UI section**: add a component in `src/components/`, give its root a stable class name, style it in
  `styles.css` using the existing custom properties.
