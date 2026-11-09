# Configuration

How to tell the app about *your* ladder and branding. Everything that is specific to your deployment lives in **your config folder**, which upstream never touches:

| file             | purpose                                                      |
|------------------|--------------------------------------------------------------|
| `categories/`    | one Markdown file per category of your ladder, with the expectations per level (see [Categories](categories.md)) |
| `roles.yml`      | the roles of your ladder and the levels each one requires    |
| `site.yml`       | title, logo and footer                                       |
| `theme.css`      | CSS overrides: colours, fonts or any other style             |

The radar ships a sample of each in [`config.example/`](../../config.example): it is what you get for every file
your folder does not have, so the radar runs with no setup. To customise a file, put a file with the same name in
`config/`. At build time every file is read from `config/` if it is there, and from `config.example/` otherwise.

- **In an adopter repository** (the [recommended setup](getting-started.md#install-it-as-a-dependency-recommended)),
  `config/` is a folder of your repository and `npx progression-radar init` fills it with a copy of the whole sample
  to edit. `config.example/` is the one inside the installed radar. Commit `config/`: it is yours.
- **In a fork**, `config/` sits next to `config.example/` in the same repository. Do not edit `config.example/`: it is
  upstream's, and leaving it alone is what lets updates merge without conflicts. Copy a sample file to `config/` to
  start from it.

The rules are the same in both:

- **A file replaces its counterpart completely.** Nothing is merged: your `site.yml` does not inherit the sample
  footer, a `categories/` folder replaces all the sample categories, and your `theme.css` replaces
  the sample one (the base theme is part of the radar, so you lose no styles). A file (or the `categories/` folder)
  that you remove from `config/` falls back to the sample again.
- **Images** referenced from `site.yml` are looked up in `config/` first, then in `config.example/`.
- **Another folder.** Set `PROGRESSION_RADAR_CONFIG_DIR` to use any other folder: relative to the folder the commands
  run in, which is the root of your repository (`my-ladder`), outside it (`../my-ladder`, e.g. a separate private
  repository) or absolute. The folder must exist, otherwise the dev server and the build fail with an error naming it.
  In Netlify, set it under *Site configuration → Environment variables*.

  ```sh
  PROGRESSION_RADAR_CONFIG_DIR=../my-ladder npm run dev
  ```

- **The build log tells you what was used.** It shows the folder each file was read from, and warns about files in
  your folder that the app does not use (for example a misspelt `category.yml`). Images and `README.md` are not
  reported.
- In `npm run dev`, editing a file in your folder reloads the page, and so does adding or removing one, also inside
  `categories/`.
- **In a fork, `config/` is git-ignored** upstream (except its `README.md`), so a local experiment never ends up in a
  commit. To keep your configuration in your fork, force-add the files (`git add -f config/roles.yml`) or use a tracked
  folder with another name and `PROGRESSION_RADAR_CONFIG_DIR`.

The configuration is validated when the app loads: if something is wrong, the app lists every problem instead of
rendering, each one prefixed with the file and folder it comes from (`config/roles.yml: role "r" …` or
`config.example/categories/02-ai.md:14: …`). `npm run build` fails as well, listing every problem and writing no
`dist/`, and `npm run check` prints them without building (it then also checks your [snapshots](snapshots.md), unless
the configuration is invalid). In a fork, `npm test` fails too: the tests check your resolved configuration and,
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
