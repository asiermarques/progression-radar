# Configuration

How to tell the app about *your* ladder and branding. Everything that is specific to your deployment lives in **your config folder**, which upstream never touches:

| file             | purpose                                                      |
|------------------|--------------------------------------------------------------|
| `categories/` or `categories.yml` | the categories of your ladder and the expectations per level (see [Categories](categories.md)) |
| `roles.yml`      | the roles of your ladder and the levels each one requires    |
| `site.yml`       | title, logo and footer                                       |
| `theme.css`      | CSS overrides: colours, fonts or any other style             |

The project ships a sample of each in [`config.example/`](../../config.example), and that is what you get on a fresh clone,
with no setup. To customise a file, put a file with the same name in `config/` (copy the sample to start from it).
At build time every file is read from `config/` if it is there, and from `config.example/` otherwise. Do not edit
`config.example/`: it is upstream's, and leaving it alone is what lets updates merge without conflicts.

- **A file replaces its counterpart completely.** Nothing is merged: your `site.yml` does not inherit the sample
  footer, a `categories/` folder (or `categories.yml`) replaces all the sample categories, and your `theme.css` replaces the sample one (the base theme is in `src/styles.css`, so you lose no styles).
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
- In `npm run dev`, editing a file in your folder reloads the page, and so does adding or removing one, also inside
  `categories/`.

The configuration is validated when the app loads: if something is wrong, the app lists every problem instead of
rendering, each one prefixed with the file and folder it comes from (`config/roles.yml: role "r" …` or
`config.example/categories/02-ai.md:14: …`), and `npm test` fails too. The tests check your resolved configuration and,
separately, `config.example/` on its own.

## Site, logo and footer

```yaml
# config/site.yml
title: Acme Engineering Ladder
logo: logo.svg          # optional, an image file placed in config/ (or config.example/)
footer: Made by the **Acme** platform team.   # optional, Markdown
```

## See also

- [Categories](categories.md), [Roles](roles.md) and [Styles](styles.md): the contents of each file.
- [Deployment](deployment.md): building with your configuration, and Netlify.
- [Snapshots](snapshots.md): the commands that record people read this same configuration.
- [ADR 0002](../adr/0002-config-example-with-local-config-override.md): why the sample and your files are separate.
