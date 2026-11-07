# Your configuration

This folder holds **your** configuration. Upstream never changes it, so pulling updates never conflicts with it.
The sample that ships with the project is in [`config.example/`](../config.example): copy a file from there to start
from it, and do not edit it.

## How it works

At build time each of these files is read from this folder if it is here, and from `config.example/` otherwise:

| file             | purpose                                                      |
|------------------|--------------------------------------------------------------|
| `categories/` or `categories.yml` | the categories of your ladder and the expectations per level |
| `roles.yml`      | the roles of your ladder and the levels each one requires    |
| `site.yml`       | title, logo and footer                                       |
| `theme.css`      | CSS overrides: colours, fonts or any other style             |

The categories can be one Markdown file per category in a `categories/` folder (`01-comm.md`, `02-back.md`…, shown
in the order of their names) or a single `categories.yml`, but not both. Either form replaces all the sample
categories. The format is in [docs/guides/categories.md](../docs/guides/categories.md).

- **A file replaces its counterpart completely.** Nothing is merged: a `site.yml` here does not inherit the footer of
  the example, and a `theme.css` here replaces the example one (the base theme is in `src/styles.css`).
- **Images** referenced from `site.yml` (e.g. `logo: logo.svg`) are looked up here first, then in `config.example/`.
- An empty folder, like this one on a fresh clone, means "use the example for everything".
- Other files are ignored, and the build log warns about them (a misspelt `category.yml`, for example).
  `README.md` and images are not reported. Inside `categories/` only `.md` files are read.
- The build log shows which folder each file was read from.

Everything you put here is git-ignored, so local experiments never end up in a commit.

## Another folder

Set `PROGRESSION_RADAR_CONFIG_DIR` to use a different folder: a path relative to the project root (`my-ladder`),
outside it (`../my-ladder`, for example a separate repository) or absolute. The folder must exist: the dev server and
the build fail if it does not. Then `config/` is not read.

```sh
PROGRESSION_RADAR_CONFIG_DIR=../my-ladder npm run dev
```

On Netlify, set it under *Site configuration → Environment variables*.

## Keeping it in your fork

This folder is git-ignored, so choose one of these:

- **Force-add the files** to your fork: `git add -f config/categories config/roles.yml` (and the others you
  have). Once a file is tracked, git keeps tracking it.
- **Use a tracked folder**: commit your files in a folder with another name, for example `my-ladder/`, and set
  `PROGRESSION_RADAR_CONFIG_DIR=my-ladder` where you build.

## While `npm run dev` is running

Editing a file here reloads the page. Adding or removing a file here, or in `categories/`, reloads it too.
