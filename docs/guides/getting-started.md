# Getting started

There are two ways to run the radar with your own ladder:

| | **Adopter repository** (recommended) | **Fork** |
|---|---|---|
| what you keep | only your `config/`, your `snapshots/` and a `package.json` | the whole radar, with your `config/` in it |
| the radar | an npm dependency | the code in your repository |
| upgrading | change a version (`npm install progression-radar@latest`) | merge upstream (`git pull upstream master`) |
| changing `src/` | not possible | yes |

Choose the **adopter repository** unless you need to change the code of the app: it holds only your data, you never
merge upstream, and every guide applies to it unchanged. Both run the same commands with the same npm script names.

You need [Node.js](https://nodejs.org) 22.12 or newer (Node 24 LTS is recommended).

## Install it as a dependency (recommended)

```sh
mkdir my-ladder && cd my-ladder
git init
npm init -y
npm install progression-radar
npx progression-radar init
npm run dev
```

`npx progression-radar init` copies the whole sample configuration to `config/` for you to edit, adds the npm
scripts to your `package.json` and puts `reports/` in your `.gitignore` (it creates the file, or appends the line and
leaves the others as they are; the [reports](snapshots.md#reports) hold personal data). It never overwrites a file or a
script that already exists, so it is safe to run again. Run it after `npm install`: it uses the installed radar, and it stops if there is no `package.json`.

`npm run dev` opens the radar with the sample ladder. Edit the files in `config/` and the page reloads (see
[Configuration](configuration.md), [Categories](categories.md), [Roles](roles.md) and [Styles](styles.md)).

Then ignore what the commands generate and commit the rest:

```sh
printf 'node_modules\ndist\n' > .gitignore
git add . && git commit -m "My ladder"
```

Snapshots hold personal data: if you record them but do not want them in the repository, add `snapshots` to
`.gitignore` as well, and keep the repository private if you do commit them (see [Snapshots](snapshots.md#where-snapshots-live)).

The repository ends up like this:

```
my-ladder/
  .gitignore
  package.json        depends on progression-radar and declares the scripts below
  package-lock.json
  config/             your configuration: categories, roles.yml, site.yml, theme.css
  snapshots/          your snapshots, once you record one (optional, see Snapshots)
  reports/            the reports `npm run snapshot:report` writes (git-ignored)
```

And the scripts that `init` adds:

```json
{
  "scripts": {
    "dev": "progression-radar dev",
    "build": "progression-radar build",
    "preview": "progression-radar preview",
    "check": "progression-radar check",
    "snapshot:record": "progression-radar snapshot record",
    "snapshot:link": "progression-radar snapshot link",
    "snapshot:check": "progression-radar snapshot check",
    "snapshot:report": "progression-radar snapshot report",
    "config:convert-categories": "progression-radar config convert-categories"
  }
}
```

### What the commands read and write

- They read `config/` and `snapshots/` from the folder they run in (a relative `PROGRESSION_RADAR_CONFIG_DIR` or
  `PROGRESSION_RADAR_SNAPSHOTS_DIR` resolves from there too). A file your `config/` does not have comes from the
  sample shipped with the radar, so you can delete the copies you do not change.
- `npm run build` writes `dist/` and `npm run snapshot:report` writes `reports/` in that folder. Nothing is ever
  written inside `node_modules`.
- The dev server reloads the page when you edit, add or remove a file in `config/` or `config/categories/`, and serves
  only the radar and your config folder, never `snapshots/`, `reports/` or the rest of the repository.

### Package managers

npm, pnpm and Yarn (current major) work, Yarn with Plug'n'Play (its default) or with `nodeLinker: node-modules`. You
configure nothing: the radar asks Yarn to unplug it, and with pnpm its own dependencies resolve from the radar, so you
do not declare them. Yarn and Vite warn that Plug'n'Play is discouraged; that message is theirs.

```sh
pnpm add progression-radar && pnpm exec progression-radar init
yarn add progression-radar && yarn progression-radar init
```

### Next

- Put it online with a CI that checks before it builds: [Deployment](deployment.md).
- Upgrade by changing the version: [Upgrading](upgrading.md#an-adopter-repository).
- Keep a record of people over time: [Snapshots](snapshots.md).

## Try it, or fork it to change the code

To look at the radar or work on it, clone it. A fresh clone runs with the sample ladder, with no setup:

```sh
git clone git@github.com:asiermarques/progression-radar.git
cd progression-radar
npm install
npm run dev
```

Fork it instead of using a dependency only if you need to change `src/`. In a fork, put your files in
[`config/`](../../config) (it is git-ignored upstream, see [Configuration](configuration.md)), leave `src/` and
`config.example/` alone so upstream merges cleanly ([Keeping your fork up to date](deployment.md#keeping-your-fork-up-to-date)),
and deploy it ([Deployment](deployment.md)). For a fork Node 24 is recommended (see `.nvmrc`): the npm 10 that comes
with older Node versions can fail while resolving the test dependencies.

A fork already in use can move to an adopter repository at any time: see
[From a fork to an adopter repository](upgrading.md#from-a-fork-to-an-adopter-repository).

## Scripts

The same script names work in an adopter repository and in a fork. All of them run the `progression-radar` command
(`npx progression-radar --help` lists its subcommands); in a fork it is `node scripts/cli.mjs`.

| command             | description                                             |
|---------------------|---------------------------------------------------------|
| `npm run dev`       | starts the development server with hot reload (`-- --port 4000 --host` as with Vite) |
| `npm run check`     | checks the configuration and the snapshots, and fails if either has an error |
| `npm run build`     | builds the static site into `dist/`; fails, listing every problem, if the configuration is invalid |
| `npm run preview`   | serves the production build locally                     |
| `npm run config:convert-categories` | converts an old `categories.yml` into [category files](categories.md#converting-an-existing-categoriesyml) |
| `npm run snapshot:record` | saves a share link in a dated [snapshot](snapshots.md) |
| `npm run snapshot:link` | prints the share link of a recorded person |
| `npm run snapshot:check` | checks the snapshots against the current configuration |
| `npm run snapshot:report` | writes an HTML [report](snapshots.md#reports) of how each person evolved, in `reports/` |

Only in a fork:

| command             | description                                             |
|---------------------|---------------------------------------------------------|
| `npm test`          | runs the tests in watch mode (`npm test -- --run` once) |
| `npm run typecheck` | type-checks the project (`npm run build` runs it first in a fork) |
| `npm run config:migrate` | moves a fork's edits out of `config.example/`, converting an old `categories.yml` (see [Upgrading](upgrading.md)) |
