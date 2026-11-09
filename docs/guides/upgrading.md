# Upgrading

What to do when a new version of the radar comes out, depending on how you run it: as a dependency of an
[adopter repository](#an-adopter-repository) or as a [fork](#a-fork). Both need
[A categories.yml is no longer read](#a-categoriesyml-is-no-longer-read) if they still have one.

## An adopter repository

Upgrading is changing the version of the dependency. Your `config/` and `snapshots/` are not touched:

```sh
npm install progression-radar@latest    # or: pnpm add progression-radar@latest, yarn up progression-radar
npm run check                           # the configuration and the snapshots against the new version
npm run dev                             # have a look
```

The radar follows semver. Its public contract is the commands and the npm script names, the configuration files, the
[share link](share-link.md) format and the [snapshot](snapshots.md) format: a minor or patch version keeps them
working, and a major version lists what to change in its release notes and in this guide. `src/` is not part of the
contract, because an adopter repository never imports it. Dependabot or Renovate can open the update for you, and the
CI (`npm ci && npm run check && npm run build`, see [Deployment](deployment.md)) tells you whether it builds.

### Reports (1.1.0)

`snapshot:report` is new: it writes an HTML [report](snapshots.md#reports) of your snapshots in `reports/`. An
adopter repository created with an earlier version has neither the script nor the `.gitignore` line. Run
`npx progression-radar init` again (it only adds what is missing and never overwrites), or do it by hand:

- add `"snapshot:report": "progression-radar snapshot report"` to the `scripts` of your `package.json`, and
- add `reports/` to your `.gitignore`, because a report gathers more personal data than a share link.

Some notes below also apply to you when they are about your configuration rather than about merging: a
`categories.yml` that is no longer read, renamed or reserved category keys, the class names of a custom theme or a
build that now fails on configuration problems.

## A categories.yml is no longer read

The categories are written only as [category files](categories.md), one Markdown file per category in `categories/`.
If your config folder (in a fork, a separate repository or an adopter repository) still has a `categories.yml`, the
app, `npm run check` and `npm run build` report it as a configuration problem instead of using the sample categories:

```
config/categories.yml is no longer read; convert it with npm run config:convert-categories
```

Convert it once, check the result and delete the backup the converter leaves:

```sh
npm run config:convert-categories    # writes config/categories/NN-<key>.md and renames the YAML to categories.yml.bak
npm run check && npm run dev
rm config/categories.yml.bak
```

The conversion keeps every category `key`, so existing share links and snapshots keep matching, and it reads the old
`kpis` list as the expectations. If your folder also has a `categories/` folder, the message says so: delete the YAML
when the folder already holds your categories, or remove the folder and convert. See
[Converting an existing categories.yml](categories.md#converting-an-existing-categoriesyml).

## Skills after upgrading

If you copied the snapshots skill for Claude into your repository (see
[Asking Claude](snapshots.md#asking-claude)), copy it again after upgrading so it matches the commands it runs.

## From a fork to an adopter repository

A fork that only customises its config folder can drop the fork and keep just its data. Create the adopter
repository next to the fork, let `init` add the scripts, and then replace the sample copy it made with your own
`config/`:

```sh
mkdir my-ladder && cd my-ladder
git init && npm init -y
npm install progression-radar
npx progression-radar init                  # adds the npm scripts (and a copy of the sample in config/)
rm -rf config && cp -R ../my-fork/config config
cp -R ../my-fork/snapshots snapshots        # only if you keep snapshots
printf 'node_modules\ndist\n' > .gitignore
npm run check && npm run dev
```

Replace `config/` after `init`, not before: `init` adds every sample file your folder lacks, which you do not want
next to your own files. If your fork still has a `categories.yml`, convert it first
([A categories.yml is no longer read](#a-categoriesyml-is-no-longer-read)).

- If your configuration already lives in a separate repository (through `PROGRESSION_RADAR_CONFIG_DIR`), that
  repository can be the adopter repository: run the same commands in it instead of in a new folder, moving its files
  into `config/` after `init`.
- In an adopter repository `config/` and `snapshots/` are not git-ignored: commit what you want to keep, and decide who
  can read the repository, since snapshots hold personal data.
- Copy your `netlify.toml` (or your CI) as described in [Deployment](deployment.md#netlify).
- A fork that changes `src/` stays a fork.

## A fork

What to do after pulling an update, depending on what your fork customised. See also
[Keeping your fork up to date](deployment.md#keeping-your-fork-up-to-date).

### A fork whose build succeeded with configuration problems

`npm run build` now fails when the configuration is invalid, listing every problem with its file and folder, instead of
building a site that only shows the problems. If your build starts failing after pulling, run `npm run dev` to see the
problems on the page, or `npm run check` to list them, fix the files they name and build again.

### A fork that edited `config.example/categories.yml` (the sample moved to category files)

The sample categories are now Markdown category files in `config.example/categories/` and `config.example/categories.yml`
is gone. If your fork edited that file, pulling the update reports a modify/delete conflict. Keep your file, then let
`config:migrate` move it to your config folder and convert it into category files:

```sh
git pull upstream master                 # reports the conflict on config.example/categories.yml
git add config.example/categories.yml    # keep your version, then finish the merge with git commit
npm run config:migrate                   # moves it to config/, converts it to config/categories/ and restores config.example/
```

Until you do, the app reports `config.example/categories.yml is no longer read; move it to your config folder with npm
run config:migrate`. The conversion keeps every category `key` and leaves the YAML as `config/categories.yml.bak`.
If it cannot convert (the YAML has a configuration problem, or `config/categories/` already exists), the file is still
moved to `config/categories.yml` and the command lists what to fix; then run `npm run config:convert-categories`.

### A fork that edited `config/` (the sample moved to `config.example/`)

Upstream's sample configuration moved from `config/` to `config.example/`, and `config/` is now git-ignored and yours
(see [Configuration](configuration.md)). When you pull the update, git sees the rename and moves your edits into
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
cp config.example/roles.yml config/                  # repeat for each file you edited
git checkout upstream/master -- config.example      # restore the sample (it does not delete files only you added)
git add -f config
```

A fork that deploys from its own repository and does not migrate still builds, with its customisations read from
`config.example/`.

### A fork with a category key `name`, `role`, `compare`, `tag` or `state`

The share link now keeps the state in the URL fragment (see [The state in the URL](share-link.md)) and those
five keys are reserved for its fields. After pulling the update, the app lists any category that uses one of them as a
configuration error: rename its `key` in its category file (and in `config/roles.yml`). Links that used the old
key stop matching that category, and the notice says so.

### A fork with a category key `id`

`id` is reserved by the [snapshots](snapshots.md): it is the column that identifies a person. After pulling the update,
the app lists a category with that key as a configuration problem. Rename its `key` (in the category file and in
`roles.yml`). Links that used the old key stop matching that category, and the notice says so.

### KPIs are now called expectations

The items of a category are now called expectations: they describe what is expected at a level, they are not
measured indicators. A `kpis` list exists only in an old `categories.yml`, and converting it reads it as the
expectations ([A categories.yml is no longer read](#a-categoriesyml-is-no-longer-read)). The `.kpi*` class names and
`--kpi-index` are still on the page; to adopt the new names, rename the `.kpi*` selectors in your `theme.css` to
`.expectation*` (e.g. `.kpi-summary` to `.expectation-summary`).

### A fork with a custom theme

The default look changed after 1.0 (new colours, fonts, a paper texture and a dark palette). After pulling the
update, check the dark mode of your theme (see [Styles](styles.md)) and set the new variables if the defaults do not
fit your brand: `--font-display` (title, names and numbers), `--color-on-primary` (text on the accent colour) and
`--texture` (`none` for a flat background).

Later the page became a column of full-width bands: a header and the areas on the sheet colour
(`--color-background`, now almost white), and the person and the radar on a band of paper (`--color-band`, which
also carries the texture). The double rules around the page and most dividers are gone. If your theme set
`--color-background` to a paper tone, the band is derived from it and `--color-surface`; set `--color-band` to choose
it yourself.

### From 0.x

Version 1.0 is a rewrite (Vite, React 19 and TypeScript instead of Create React App, Redux and Bootstrap). Existing
links keep working, but:

- **Configuration location.** Move `src/data/categories.yml` and `src/data/roles.yml` to `config/`, then convert the
  categories with `npm run config:convert-categories` (a `categories.yml` is no longer read). There are no
  `.dist` files any more: `config/` is yours and falls back to the sample in `config.example/`.
- **No component library.** 0.x was an npm library whose components other projects imported. 1.x imports nothing into
  your code: install it as a tool dependency of an adopter repository (see [Getting started](getting-started.md)) or
  fork it, and customise `config/`, including `config/theme.css` for styles. A `^0.2.x` range never resolves to 1.x,
  so install `progression-radar@latest`.
- **Percentages.** A level is now a percentage of the highest level in its category, so the top level is 100%.
- **Tooling.** Use `npm run dev` instead of `yarn start`. The build output is `dist/`.
