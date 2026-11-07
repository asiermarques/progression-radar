# Upgrading

What to do after pulling an update, depending on what your fork customised. See also
[Keeping your fork up to date](deployment.md#keeping-your-fork-up-to-date).

## A fork that edited `config.example/categories.yml` (the sample moved to category files)

The sample categories are now Markdown category files in `config.example/categories/` and `config.example/categories.yml`
is gone. If your fork edited that file, pulling the update reports a modify/delete conflict. Keep your file, then move
it to your config folder, where it keeps working (`categories.yml` is still supported):

```sh
git pull upstream master                 # reports the conflict on config.example/categories.yml
git add config.example/categories.yml    # keep your version, then finish the merge with git commit
npm run config:migrate                   # moves it to config/categories.yml and restores config.example/
```

Until you do, `config.example/` holds both forms and the app reports it as a configuration problem. Afterwards you can
keep the YAML, or convert it with `npm run config:convert-categories` (see [Categories](categories.md)).

## A fork that edited `config/` (the sample moved to `config.example/`)

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

## A fork with a category key `name`, `role`, `compare`, `tag` or `state`

The share link now keeps the state in the URL fragment (see [The state in the URL](share-link.md)) and those
five keys are reserved for its fields. After pulling the update, the app lists any category that uses one of them as a
configuration error: rename its `key` in `config/categories.yml` (and in `config/roles.yml`). Links that used the old
key stop matching that category, and the notice says so.

## A fork with a category key `id`

`id` is reserved by the [snapshots](snapshots.md): it is the column that identifies a person. After pulling the update,
the app lists a category with that key as a configuration problem. Rename its `key` (in the category file or
`categories.yml`, and in `roles.yml`). Links that used the old key stop matching that category, and the notice says so.

## KPIs are now called expectations

The items of a category are now called expectations: they describe what is expected at a level, they are not
measured indicators. Nothing breaks: the `kpis` list in `categories.yml` is still read, and the `.kpi*` class names
and `--kpi-index` are still on the page. To adopt the new names, rename `kpis:` to `expectations:` in your
`categories.yml` and the `.kpi*` selectors in your `theme.css` to `.expectation*` (e.g. `.kpi-summary` to
`.expectation-summary`).

## A fork with a custom theme

The default look changed after 1.0 (new colours, fonts, a paper texture and a dark palette). After pulling the
update, check the dark mode of your theme (see [Styles](styles.md)) and set the new variables if the defaults do not
fit your brand: `--font-display` (title, names and numbers), `--color-on-primary` (text on the accent colour) and
`--texture` (`none` for a flat background).

## From 0.x

Version 1.0 is a rewrite (Vite, React 19 and TypeScript instead of Create React App, Redux and Bootstrap). Existing
links keep working, but:

- **Configuration location.** Move `src/data/categories.yml` and `src/data/roles.yml` to `config/`. There are no
  `.dist` files any more: `config/` is yours and falls back to the sample in `config.example/`.
- **No npm package.** Fork the repository and customise `config/` instead, including `config/theme.css` for styles.
- **Percentages.** A level is now a percentage of the highest level in its category, so the top level is 100%.
- **Tooling.** Use `npm` instead of `yarn` and `npm run dev` instead of `yarn start`. The build output is `dist/`.
