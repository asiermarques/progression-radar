# Progression Radar

[![CI](https://github.com/asiermarques/progression-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/asiermarques/progression-radar/actions/workflows/ci.yml)
[![Netlify Status](https://api.netlify.com/api/v1/badges/940ce5bc-5c80-41e0-8756-96b9e9dfc3e7/deploy-status)](https://app.netlify.com/sites/progression-radar/deploys)

Progression Radar is a simple visualisation tool for career and learning paths.

Live demo: [https://progression-radar.netlify.app](https://progression-radar.netlify.app/)

![Progression Radar comparing a person with the Staff Frontend Software Engineer role](docs/screenshot.jpg)

## Motivation

Progression Radar helps you visualise progress across the areas of a career growth plan, career path or learning path.

Inspired by Medium's deprecated Snowflake tool, it shows the level you have reached in each area you configure,
and lets you compare it with the levels required by other roles.

There is no backend and no database: the whole state lives in the URL, so a link is a shareable snapshot.

## Features

- A radar chart with the level reached in every category of your path. Click a category name on the chart to open it.
- Comparison with any configured role: its levels are drawn on the same radar, the level each category requires
  is marked in the level selector, and a summary shows how many categories are on target and how many levels are
  still to go.
- For each category, the KPIs expected at every level, with Markdown descriptions.
- An editable name, the person's current role and their tags.
- Shareable URLs: every change is saved in the address bar, and nothing is stored anywhere else. The "Copy link"
  button copies it for you.
- Light and dark themes (following the system setting), a responsive layout and a print-friendly page.
- Your own content, title, logo, footer and styles, all in the `config/` folder.

## Getting started

You need [Node.js](https://nodejs.org) 22.12 or newer. Node 24 LTS is recommended (see `.nvmrc`); its bundled npm 11
is needed for a clean install, as npm 10 can fail while resolving the test dependencies.

```sh
git clone git@github.com:asiermarques/progression-radar.git
cd progression-radar
npm install
npm run dev
```

Open the URL printed in the terminal (http://localhost:5173 by default).

To use it for your own organisation, fork the repository, edit the files in [`config/`](config) and deploy it
(see [Deployment](#deployment)).

## Configuration

Everything that is specific to your deployment lives in the `config/` folder:

| file             | purpose                                                    |
|------------------|------------------------------------------------------------|
| `categories.yml` | the areas of your path and the KPIs for each level         |
| `roles.yml`      | the roles of your ladder and the levels each one requires  |
| `site.yml`       | title, logo and footer                                     |
| `theme.css`      | CSS overrides: colours, fonts or any other style           |

The configuration is validated when the app loads. If something is wrong, the app lists every problem it found
instead of rendering, and `npm test` fails too, so mistakes are caught before deploying.

### Categories

The categories are the areas of your path, e.g. communication or software engineering.
Each entry of `config/categories.yml` has these fields:

| field       | description                                     |
|-------------|-------------------------------------------------|
| key         | a unique and short identifier for the category  |
| name        | the name of the category                        |
| description | optional: a brief description of the category   |
| kpis        | a list of KPIs or skills for the category       |

**KPIs**

A KPI is a skill, behaviour or concept that you need to master to reach a level in a category.
Each KPI has these fields:

| field       | description                                                     |
|-------------|-----------------------------------------------------------------|
| summary     | a title or brief description of the KPI                         |
| description | optional: an extended description. Markdown is supported        |
| level       | the level (a positive integer) this KPI belongs to              |
| tags        | optional: a list of tags for this KPI (not shown in the UI yet) |

The levels of a category are the levels used by its KPIs, plus level 0. The radar shows each level as a percentage
of the highest level in its category.

```yaml
# config/categories.yml
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

A role is a step in your ladder. Each entry of `config/roles.yml` has these fields:

| field  | description                                                                                         |
|--------|-----------------------------------------------------------------------------------------------------|
| key    | a unique and short identifier for the role                                                          |
| name   | the name of the role, e.g. Senior Backend Engineer                                                  |
| levels | the level the role requires in each category, by category key, e.g. `{ comm: 3, back: 2 }`. Missing categories count as level 0 |

```yaml
# config/roles.yml
- key: aswe
  name: Associate Software Engineer
  levels: { comm: 1, pm: 1, des: 1, ops: 1, front: 1, back: 1 }
```

### Site, logo and footer

```yaml
# config/site.yml
title: Acme Engineering Ladder
logo: logo.svg          # optional, an image file placed in config/
footer: Made by the **Acme** platform team.   # optional, Markdown
```

### Styles

`config/theme.css` is loaded after the base styles, so anything you write there wins. The easiest way to re-brand
the app is to override the CSS custom properties:

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

See the top of [`src/styles.css`](src/styles.css) for every available variable.

The base styles also define a dark palette inside `@media (prefers-color-scheme: dark)`. Variables you set in `:root`
in `theme.css` apply to both palettes, so:

- to keep dark mode, set your dark colours inside the same media query;
- to have a single palette, set every `--color-*` variable in `:root` and add `color-scheme: light;` so form controls
  match it.

The default fonts (Shippori Mincho and Zen Kaku Gothic New) are bundled with the app, Latin characters only; other
scripts use the fonts installed on the system. To use other fonts, load them in `theme.css` with `@font-face` or
`@import` and set `--font-family` and `--font-display`.

You can also target the stable class names of the UI: `.app-header`, `.app-title`, `.app-logo`, `.share-button`,
`.person-panel`, `.person-seal`, `.progress-summary`, `.radar`, `.radar-series--person`, `.radar-series--compare`,
`.category-panel`, `.category-nav`, `.level-nav`, `.kpi` and `.app-footer`.

## The state in the URL

The progress of a person is stored as JSON in the `state` query parameter. The app keeps it up to date while you
change levels, the name or the compared role, so you can bookmark or share the URL at any time.

| field     | description                                                                                       |
|-----------|---------------------------------------------------------------------------------------------------|
| name      | the person's name                                                                                 |
| levels    | the level the person has reached in each category, by category key, e.g. `{ "comm": 2, "back": 1 }` |
| roleKey   | optional: the person's current role                                                               |
| tags      | optional: a list of tags the person is interested in                                              |
| compareTo | optional: a role key to compare with                                                              |

```
/?state={"name":"John Connor","levels":{"comm":2,"pm":1,"des":1,"ops":1,"front":1,"back":1},"roleKey":"aswe","tags":["tech"],"compareTo":"front"}
```

Unknown categories and roles are ignored and levels are clamped to the configured range, so old links keep working
when the configuration changes. Without a `state` parameter the app starts with an example based on a random role.

## Scripts

| command             | description                                          |
|---------------------|------------------------------------------------------|
| `npm run dev`       | starts the development server with hot reload        |
| `npm test`          | runs the tests in watch mode (`npm test -- --run` once) |
| `npm run typecheck` | type-checks the project                              |
| `npm run build`     | type-checks and builds the static site into `dist/`  |
| `npm run preview`   | serves the production build locally                  |

## Deployment

`npm run build` produces a static site in `dist/` that uses relative paths, so it can be served from any static
host, at the root of a domain or in a sub-folder (Netlify, GitHub Pages, S3, nginx...).
The repository includes a `netlify.toml`, so Netlify works without extra settings.

### Keeping your fork up to date

Because your changes live in `config/` and the app lives in `src/`, upstream updates merge without conflicts as long
as you leave `src/` untouched:

```sh
git remote add upstream https://github.com/asiermarques/progression-radar.git
git pull upstream master
npm install
```

## Upgrading a fork with a custom theme

The default look changed after 1.0: new colours, fonts, a paper texture and a dark palette that follows the system
setting. Your `config/theme.css` still wins over the base styles, but check two things after pulling the update:

- **Dark mode.** If you override only some colours in `:root`, they also apply in dark mode, mixed with the dark
  defaults, and can make text hard to read. Either add your dark colours inside
  `@media (prefers-color-scheme: dark)`, or set every `--color-*` variable plus `color-scheme: light;` to keep a
  single palette (see [Styles](#styles)).
- **New variables.** `--font-display` (title, names and numbers), `--color-on-primary` (text on the accent colour)
  and `--texture` (set it to `none` for a flat background) did not exist before, so set them if the defaults do not
  fit your brand.

## Upgrading from 0.x

Version 1.0 is a rewrite (Vite, React 19 and TypeScript instead of Create React App, Redux and Bootstrap). Existing
links keep working, but a few things changed:

- **Configuration location.** Move your `src/data/categories.yml` and `src/data/roles.yml` to `config/`. There are no
  `.dist` files to copy any more; the sample configuration is committed and you edit it directly.
- **No npm package.** The app is no longer published as a library to install and override. Fork it and customise
  `config/` instead, including `config/theme.css` for styles.
- **Percentages.** The radar now shows a level as a percentage of the highest level in its category, so the top level
  is 100%. Before, it was divided by the number of levels including level 0, so the top level never reached 100%.
- **Tooling.** Use `npm` instead of `yarn`, and `npm run dev` instead of `yarn start`. The build output is `dist/`
  instead of `build/`.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md).
