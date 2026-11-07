# Progression Radar

[![CI](https://github.com/asiermarques/progression-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/asiermarques/progression-radar/actions/workflows/ci.yml)
[![Netlify Status](https://api.netlify.com/api/v1/badges/940ce5bc-5c80-41e0-8756-96b9e9dfc3e7/deploy-status)](https://app.netlify.com/sites/progression-radar/deploys)

Progression Radar is a simple visualisation tool for career and learning paths. Inspired by Medium's deprecated
Snowflake tool, it shows the level a person has reached in each area of a path and compares it with the levels a
role requires. There is no backend: the whole state lives in the URL, so a link is a shareable snapshot.

Live demo: [https://progression-radar.netlify.app](https://progression-radar.netlify.app/)

![Progression Radar comparing a person with the Staff Frontend Software Engineer role](docs/screenshot.jpg)

## Documentation

- [docs/PRODUCT.md](docs/PRODUCT.md): what it does, who it is for and the product decisions.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, layout of the code, data flow and key decisions.
- [docs/DESIGN.md](docs/DESIGN.md): the design system and UI guidelines.
- [docs/adr/](docs/adr): architecture decision records.

## Getting started

You need [Node.js](https://nodejs.org) 22.12 or newer. Node 24 LTS is recommended (see `.nvmrc`): npm 10 can fail
while resolving the test dependencies.

```sh
git clone git@github.com:asiermarques/progression-radar.git
cd progression-radar
npm install
npm run dev
```

To use it for your own organisation, fork the repository, put your files in [`config/`](config) and deploy it
(see [Configuration](#configuration) and [Deployment](#deployment)).

## Configuration

Everything that is specific to your deployment lives in **your config folder**, which upstream never touches:

| file             | purpose                                                    |
|------------------|------------------------------------------------------------|
| `categories.yml` | the areas of your path and the KPIs for each level         |
| `roles.yml`      | the roles of your ladder and the levels each one requires  |
| `site.yml`       | title, logo and footer                                     |
| `theme.css`      | CSS overrides: colours, fonts or any other style           |

The project ships a sample of each in [`config.example/`](config.example), and that is what you get on a fresh clone,
with no setup. To customise a file, put a file with the same name in `config/` (copy the sample to start from it).
At build time every file is read from `config/` if it is there, and from `config.example/` otherwise. Do not edit
`config.example/`: it is upstream's, and leaving it alone is what lets updates merge without conflicts.

- **A file replaces its counterpart completely.** Nothing is merged: your `site.yml` does not inherit the sample
  footer, and your `theme.css` replaces the sample one (the base theme is in `src/styles.css`, so you lose no styles).
- **Images** referenced from `site.yml` are looked up in `config/` first, then in `config.example/`.
- **`config/` is git-ignored** (except its `README.md`), so a local experiment never ends up in a commit. To keep your
  configuration in your fork, force-add the files (`git add -f config/roles.yml`) or use a tracked folder with
  another name.
- **Another folder.** Set `PROGRESSION_RADAR_CONFIG_DIR` to use any other folder: relative to the project root
  (`my-ladder`), outside it (`../my-ladder`, e.g. a separate private repository) or absolute. The folder must exist,
  otherwise the dev server and the build fail with an error naming it. In Netlify, set it under *Site configuration →
  Environment variables*.

  ```sh
  PROGRESSION_RADAR_CONFIG_DIR=../my-ladder npm run dev
  ```

- **The build log tells you what was used.** It shows the folder each file was read from, and warns about files in
  your folder that the app does not use (for example a misspelt `category.yml`). Images and `README.md` are not
  reported.
- In `npm run dev`, editing a file in your folder reloads the page, and so does adding or removing one.

The configuration is validated when the app loads: if something is wrong, the app lists every problem instead of
rendering, each one prefixed with the file and folder it comes from (`config/roles.yml: role "r" …` or
`config.example/categories.yml entry #2 …`), and `npm test` fails too. The tests check your resolved configuration and,
separately, `config.example/` on its own.

### Categories

Each entry of `categories.yml` has these fields:

| field       | description                                     |
|-------------|-------------------------------------------------|
| key         | a unique and short identifier for the category  |
| name        | the name of the category                        |
| description | optional: a brief description of the category   |
| kpis        | a list of KPIs or skills for the category       |

The keys `name`, `role`, `compare`, `tag` and `state` are reserved by the [share link](#the-state-in-the-url): a
category using one of them is reported as a configuration problem.

Each KPI has these fields:

| field       | description                                                     |
|-------------|-----------------------------------------------------------------|
| summary     | a title or brief description of the KPI                         |
| description | optional: an extended description. Markdown is supported        |
| level       | the level (a positive integer) this KPI belongs to              |
| tags        | optional: a list of tags for this KPI (not shown in the UI yet) |

The levels of a category are the levels used by its KPIs, plus level 0.

```yaml
# config/categories.yml (or config.example/categories.yml)
- key: comm
  name: Communication
  description: Shares the right amount of information with the right people, at the right time, and listens effectively
  kpis:
    - summary: Communicates effectively to close stakeholders when called upon
      description: >
        **Example behaviours:**

        * Communicates project status clearly and effectively

        * Asks for help at the appropriate juncture
      tags: ["tech", "management"]
      level: 1
```

### Roles

Each entry of `roles.yml` has these fields:

| field  | description                                                                                         |
|--------|-----------------------------------------------------------------------------------------------------|
| key    | a unique and short identifier for the role                                                          |
| name   | the name of the role, e.g. Senior Backend Engineer                                                  |
| levels | the level the role requires in each category, by category key, e.g. `{ comm: 3, back: 2 }`. Missing categories count as level 0 |

```yaml
# config/roles.yml (or config.example/roles.yml)
- key: aswe
  name: Associate Software Engineer
  levels: { comm: 1, pm: 1, des: 1, ops: 1, front: 1, back: 1 }
```

### Site, logo and footer

```yaml
# config/site.yml
title: Acme Engineering Ladder
logo: logo.svg          # optional, an image file placed in config/ (or config.example/)
footer: Made by the **Acme** platform team.   # optional, Markdown
```

### Styles

`config/theme.css` replaces `config.example/theme.css` (which only holds commented-out examples to copy) and is loaded
after the base styles, so anything you write there wins. The easiest way to re-brand
the app is to override the CSS custom properties (see [docs/DESIGN.md](docs/DESIGN.md#colour) for all of them):

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

You can also target these stable class names: `.app-header`, `.app-title`, `.app-logo`, `.share-button`,
`.person-panel`, `.person-seal`, `.progress-summary`, `.radar`, `.radar-series--person`, `.radar-series--compare`,
`.link-notice`, `.category-panel`, `.category-nav`, `.level-nav`, `.kpi` and `.app-footer`.

## The state in the URL

The person is stored in the URL fragment (the part after `#`) as readable parameters, which the app keeps up to date
while you make changes. The fragment is never sent to the server, so the person's data does not reach access logs.

| parameter        | description                                                                              |
|------------------|------------------------------------------------------------------------------------------|
| `name`           | the person's name; omitted when empty                                                    |
| `role`           | optional: the key of the person's current role                                           |
| `compare`        | optional: the key of the role to compare with                                            |
| `tag`            | optional: a tag the person is interested in; repeated once per tag                       |
| `<category key>` | the level reached in that category, e.g. `comm=2`; one per category, always written last |

```
/#name=John+Connor&role=aswe&compare=front&tag=tech&comm=2&pm=1&des=1&ops=1&front=1&back=1
```

You can edit the link by hand: changing the fragment in the address bar updates the page without reloading.

Unknown categories and roles are ignored and levels are clamped, so old links keep working when the configuration
changes. When a link had data that could not be used, or is not valid at all, the app still opens, with the valid data
or with an example, and a dismissible notice names what was ignored. Without a fragment the app starts with an example
based on a random role.

Links created by earlier versions (`/?state={"name":"John Connor","levels":{…},"roleKey":"aswe",…}`) keep opening;
the app rewrites them in the new format after the first change.

## Scripts

| command             | description                                             |
|---------------------|---------------------------------------------------------|
| `npm run dev`       | starts the development server with hot reload           |
| `npm test`          | runs the tests in watch mode (`npm test -- --run` once) |
| `npm run typecheck` | type-checks the project                                 |
| `npm run build`     | type-checks and builds the static site into `dist/`     |
| `npm run preview`   | serves the production build locally                     |
| `npm run config:migrate` | moves a fork's edits out of `config.example/` (see [Upgrading](#upgrading)) |

## Deployment

`npm run build` produces a static site in `dist/` with relative paths, so it can be served from any static host, at
the root of a domain or in a sub-folder. The repository includes a `netlify.toml` for Netlify.

### Keeping your fork up to date

Upstream updates merge without conflicts as long as your changes stay in your config folder (`config/`, or the one in
`PROGRESSION_RADAR_CONFIG_DIR`) and `src/` and `config.example/` are untouched:

```sh
git remote add upstream https://github.com/asiermarques/progression-radar.git
git pull upstream master
npm install
```

## Upgrading

### A fork that edited `config/` (the sample moved to `config.example/`)

Upstream's sample configuration moved from `config/` to `config.example/`, and `config/` is now git-ignored and yours
(see [Configuration](#configuration)). When you pull the update, git sees the rename and moves your edits into
`config.example/`. The app still works, but your customisations now sit in upstream's folder and the next upstream
change to the sample conflicts again. Move them out once:

```sh
git remote add upstream https://github.com/asiermarques/progression-radar.git   # once
git fetch upstream
git pull upstream master
npm run config:migrate -- --dry-run   # lists the files you changed
npm run config:migrate                # asks, moves them to config/ and restores config.example/
```

The command compares `config.example/` with `upstream/master` (pass another ref as an argument:
`npm run config:migrate -- some/ref`), moves the files that differ, or that upstream does not have, to your config
folder (it follows `PROGRESSION_RADAR_CONFIG_DIR`) and restores `config.example/` from the ref. It never overwrites
a file already in your folder: it reports it, skips it and leaves your copy in `config.example/` for you to merge
by hand. It does not stage or commit anything, stops without changing files if the ref is missing, a merge is in
progress or `config.example/` has conflicts, and prints the next steps. Add `--yes` to skip the confirmation.
`npm run config:migrate -- --dry-run` and `npm run config:migrate --dry-run` both work.

If the pull reports conflicts under `config/` or `config.example/` (git's directory rename detection can leave
files you had added there), resolve them first, keeping your versions, and run the command afterwards.

Then keep your configuration in the fork, either by force-adding it (`config/` is git-ignored) or by committing it in
a folder you track and setting `PROGRESSION_RADAR_CONFIG_DIR` where you build:

```sh
git add -f config            # or: git add my-ladder, with PROGRESSION_RADAR_CONFIG_DIR=my-ladder
git add config.example       # the restored sample
git commit -m "Move my configuration out of config.example"
```

To do it by hand instead:

```sh
mkdir -p config
cp config.example/categories.yml config/             # repeat for each file you edited
git checkout upstream/master -- config.example      # restore the sample (it does not delete files only you added)
git add -f config
```

A fork that deploys from its own repository and does not migrate still builds, with its customisations read from
`config.example/`.

### A fork with a category key `name`, `role`, `compare`, `tag` or `state`

The share link now keeps the state in the URL fragment (see [The state in the URL](#the-state-in-the-url)) and those
five keys are reserved for its fields. After pulling the update, the app lists any category that uses one of them as a
configuration error: rename its `key` in `config/categories.yml` (and in `config/roles.yml`). Links that used the old
key stop matching that category, and the notice says so.

### A fork with a custom theme

The default look changed after 1.0 (new colours, fonts, a paper texture and a dark palette). After pulling the
update, check the dark mode of your theme (see [Styles](#styles)) and set the new variables if the defaults do not
fit your brand: `--font-display` (title, names and numbers), `--color-on-primary` (text on the accent colour) and
`--texture` (`none` for a flat background).

### From 0.x

Version 1.0 is a rewrite (Vite, React 19 and TypeScript instead of Create React App, Redux and Bootstrap). Existing
links keep working, but:

- **Configuration location.** Move `src/data/categories.yml` and `src/data/roles.yml` to `config/`. There are no
  `.dist` files any more: `config/` is yours and falls back to the sample in `config.example/`.
- **No npm package.** Fork the repository and customise `config/` instead, including `config/theme.css` for styles.
- **Percentages.** A level is now a percentage of the highest level in its category, so the top level is 100%.
- **Tooling.** Use `npm` instead of `yarn` and `npm run dev` instead of `yarn start`. The build output is `dist/`.
