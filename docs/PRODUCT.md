# Product

Progression Radar is a simple visualisation tool for career and learning paths. It shows the level a person has
reached in each area of a path, and compares it with the levels a role requires. It is inspired by Medium's
deprecated Snowflake tool.

Live demo: https://progression-radar.netlify.app

## Who it is for

- **People on a path**: an individual contributor who wants to see where they stand and what is missing for a
  role.
- **Managers and mentors**: someone who discusses progression with a person and shares a link to it, e.g. for a
  one-to-one or a growth plan, and who keeps dated records of the people they mentor to see how they grow.
- **Adopters**: an organisation or team that forks the repository, puts its own ladder in its own `config/` folder and
  deploys it.

## Core concepts

| concept     | meaning                                                                                         |
|-------------|-------------------------------------------------------------------------------------------------|
| Category    | an area of the path, e.g. Communication or AI Systems. Configured as category files or `categories.yml` |
| Expectation | a skill, behaviour or concept expected at a given level of a category                           |
| Level       | how far a person is in a category. Level 0 plus every level used by the category's expectations |
| Role        | a step of the ladder, with the level it requires in each category. Configured in `roles.yml`    |
| Person      | the person being shown: name, reached levels, current role, tags and the role compared to       |
| Compare to  | the role whose required levels are drawn next to the person's on the radar                      |
| Share link  | the URL that holds the whole state of the person, so it can be bookmarked or sent               |
| Snapshot    | a dated CSV file, outside the app, with one row per person recorded from their share link       |

## What it does

- Draws a radar chart with the level reached in every category, as a percentage of the highest level of that
  category. Clicking a category on the chart opens it.
- Compares the person with any configured role: the role's levels on the same radar, the required level marked in
  the level selector, and a summary of the categories on target and the levels still to go.
- Lists, for each category, the expectations of every level, with Markdown descriptions.
- Lets the person edit their name, their levels and the compared role. The current role and the tags are read
  from the share link but cannot be edited in the UI.
- Keeps the share link up to date with every change, and copies it with a button. The link can be edited by hand
  in the address bar and the page follows.
- Opens broken or partly outdated links anyway: it shows the valid data (or an example) and a dismissible notice
  that names what was ignored or corrected.
- Offers light and dark themes (following the system setting), a responsive layout and a print-friendly page.
- Lets adopters change the content, title, logo, footer and styles from their own config folder (`config/` by
  default, or the path in `PROGRESSION_RADAR_CONFIG_DIR`). Each file in it replaces the sample file of the same name in
  `config.example/`, and the files it does not have come from the sample, so a fresh clone runs with no setup.
- Tells adopters, in the build log, which folder each configuration file was read from and which files it does not
  recognise, and names the file and folder of every configuration problem.
- Moves the customisations of an existing fork to the new layout with `npm run config:migrate`.
- Converts an existing `categories.yml` into Markdown category files with `npm run config:convert-categories`.
- Records people in dated CSV snapshots on the user's machine (`npm run snapshot:record`), turns a recorded row back
  into a share link (`npm run snapshot:link`) and checks the snapshots against the current configuration
  (`npm run snapshot:check`), including files edited in a spreadsheet. A project skill lets Claude Code drive these
  commands from a request in natural language. The app itself does not read snapshots.

## Product decisions

- **No backend, no accounts.** The app stores nothing: the person lives in the share link, and sharing a person
  means sending the link. The only records are the snapshot files that the user chooses to create on their own
  machine (or in a folder they point to), which hold personal data, are git-ignored upstream and are never sent
  anywhere. See [ADR 0004](adr/0004-local-csv-snapshots-outside-the-app.md).
- **Snapshots are history.** A snapshot is a dated CSV with one row per person and a mandatory `id`. The tools never
  rewrite one: they only add a row, and refuse a repeated `id`. Changing the ladder never rewrites or rejects old
  snapshots: checking them reports warnings for what no longer fits, and errors only for what is wrong whatever the
  ladder is. A missing category column means "not recorded", which is not level 0. `id` is reserved and cannot be a
  category key. The Claude skill only drives the scripts: it does not assess people or propose levels.
- **Old links keep working.** Links created by earlier versions (`?state=<JSON>`) must keep opening, forever. When
  the configuration changes, unknown categories and roles in a link are ignored and levels are clamped, instead of
  rejecting the link, and the person is told what was ignored. A link that is not valid at all opens the example
  with a notice; there is no blocking error screen for links.
- **Readable share links.** The share link should be short, readable and safe to paste in chat, e-mail or
  documents, and the person's data should not reach the server, so it lives in the URL fragment as flat key-value
  parameters. `name`, `role`, `compare`, `tag` and `state` are reserved and cannot be category keys. See
  [ADR 0001](adr/0001-readable-share-url-format.md).
- **Customisation by forking.** Upstream owns `config.example/` (the sample and the defaults) and adopters own their
  config folder, which is git-ignored upstream, so the two never edit the same file and updates merge cleanly. A file
  in the adopter's folder replaces the sample file whole: nothing is merged. The configuration can stay local,
  be committed in a fork, or live in a separate repository. Deeper changes are done by changing `src/` in the fork. See
  [ADR 0002](adr/0002-config-example-with-local-config-override.md).
- **Configuration mistakes are shown, not hidden.** An invalid configuration lists every problem instead of
  rendering, and fails the tests.
- **The default theme is only a default.** It is inspired by Japanese print, but every colour, font and texture can
  be overridden from the adopter's `theme.css`.

## Non-goals

- Storing people, history or progress on a server, or any login. Local snapshot files are the user's own.
- An in-app editor for categories, expectations or roles: they are edited in the configuration files (Markdown category files and YAML).
- Being an npm package or library that other projects depend on and override (removed in 1.0).
- Comparing several people at once in the app: a link holds one person, and the app does not open snapshots. Reports
  over snapshots, such as how a category evolves, are outside the app.
