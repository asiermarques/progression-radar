# Keeping a record of people: snapshots

A [share link](share-link.md) shows one person at one moment, and opening it again reads it with your _current_
configuration: if you change the ladder, the same link can draw a different radar. When you want a record that does not
change, for example to see where someone stood at each one-to-one, save the link in a **snapshot**.

A snapshot is a dated CSV file with one row per person. You can open it in any spreadsheet. Four commands work with
snapshots on your machine; the app itself never reads them, and nothing is sent anywhere.

> Snapshots hold personal data (names and levels). They stay on your machine, or wherever you decide to put them: in a
> fork they are git-ignored, and in an adopter repository you choose whether to commit them. See
> [Where snapshots live](#where-snapshots-live).

## What you can do

| I want to…                              | Command                                         |
| --------------------------------------- | ----------------------------------------------- |
| save a person from their share link     | `npm run snapshot:record -- "<link>" --id <id>` |
| open a saved person in the app          | `npm run snapshot:link -- <snapshot.csv> <id>`  |
| check that my snapshots are well formed | `npm run snapshot:check`                        |
| see how each person evolved over time   | `npm run snapshot:report`                       |
| do all of the above by asking Claude    | see [Asking Claude](#asking-claude)             |

You need the radar installed, in an adopter repository or a fork (see [Getting started](getting-started.md)), and to
run the commands from its root. The commands read your
configuration the same way the app does, so they use your [config folder](configuration.md) and fall back to the sample.

## A walkthrough: monthly one-to-ones

### 1. Set the levels and copy the link

Open the app (`npm run dev`, or your deployed one), choose the person's levels, role and compared role, and press
**Copy link**.

### 2. Record the person

Paste the link **between quotes** (an unquoted `#` starts a comment in the shell) and choose an `id` for the person:

```sh
npm run snapshot:record -- "http://localhost:5173/#name=Ana+Garc%C3%ADa&role=assoc&compare=maker&tag=tech&build=2&ai=1&data=1&cloud=1&trust=1&agentic=2&deliv=1&biz=1&comm=2&people=0" --id ana-garcia
```

```
Recorded ana-garcia in snapshots/2026-11-07.csv (new file, line 2):
ana-garcia,Ana García,assoc,maker,tech,2,1,1,1,1,2,1,1,2,0
```

The file is named after today's date. If the link had something the app would have ignored or corrected (an unknown
category, a level above the highest), the command lists it after the row, and the row holds the corrected person:

```
Ignored in the link: zz, build=9 (changed to 5)
```

The `id` is yours to choose: short, without spaces, and the same one every time you record that person. The same `id` in
two snapshots is the same person; this is what lets you follow them over time.

### 3. Add the rest of the team to the same day

Run the command again with another link and `id`. The row is added at the end of the file:

```sh
npm run snapshot:record -- "<Luis's link>" --id luis-perez
```

An `id` that is already in that file is refused, so you cannot overwrite a row by mistake.

### 4. Next month, a new file

By default each day gets its own file. To record several rounds on the same day, or to name a round, add text after the
date:

```sh
npm run snapshot:record -- "<Ana's link>" --id ana-garcia --snapshot 2026-12-05-q4-review.csv
```

The name must start with a valid `YYYY-MM-DD` date and end in `.csv`.

### 5. Open someone as they were

```sh
npm run snapshot:link -- 2026-11-07.csv ana-garcia
```

It prints a share link. Open it in the app to see Ana's radar as she was recorded that day. Use `--base` to build the
link on your deployed app, so you can send it:

```sh
npm run snapshot:link -- 2026-11-07.csv ana-garcia --base https://radar.example.com/
```

### 6. Check your snapshots from time to time

```sh
npm run snapshot:check
```

```
snapshots/2026-11-07.csv:1: warning: column "front" is not a Category of the current Configuration: the data is kept but the app ignores it
Checked 3 snapshots: 0 errors, 1 warning.
```

## Commands

### `snapshot:record`

```sh
npm run snapshot:record -- "<share link>" --id <id> [--snapshot <file>]
```

| option       | description                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `--id`       | required. Identifies the person across snapshots, e.g. `ana-garcia`. No spaces, commas, semicolons, quotes or pipes |
| `--snapshot` | the file name, e.g. `2026-11-07.csv` or `2026-11-07-q4-review.csv`. Default: today's date                           |

- It creates the file (and the folder) when they do not exist, and otherwise adds one row at the end, following the
  columns that file already has.
- It reads the link like the app does: links from earlier versions work, unknown categories and roles are dropped and
  levels are clamped. The row holds the person as the app would show them.
- If the file was started before a category was added to your ladder, that category is not recorded for the new row, and
  the command says so.
- It never changes what is already in a file.

### `snapshot:link`

```sh
npm run snapshot:link -- <snapshot.csv> <id> [--base <URL of the app>]
```

Prints the share link of that row and nothing else on the standard output, so you can use it in a script. `--base` is
the address of the app; the default is the development server, `http://localhost:5173/`. Data of categories your
ladder no longer has is kept in the link, so the app's notice lists it, and the command warns about it.

### `snapshot:check`

`npm run check` runs the same check after validating the configuration, and is what a CI should run.

```sh
npm run snapshot:check                      # every file in the snapshots folder
npm run snapshot:check -- 2026-11-07.csv    # one file
```

Prints each problem as `snapshots/<file>:<line>: error|warning: <message>` and ends with a summary. It never changes a
file. The exit code is 1 only when there is at least one **error**, so you can use it in a CI job.

| It is an **error** when…                                                            |
| ----------------------------------------------------------------------------------- |
| the file name does not start with a valid date, or the file is not valid UTF-8      |
| the file cannot be read as CSV (a quote is never closed) or its header is ambiguous |
| there is no header, no `id` column, or a column appears twice                       |
| an `id` is empty or repeated                                                        |
| a row has a different number of fields from the header                              |
| a level is not a non-negative integer                                               |

| It is a **warning** when… (the data is kept as it is)               |
| ------------------------------------------------------------------- |
| a column is for a category that is not in your ladder (any more)    |
| a level is above the highest level of its category                  |
| `role` or `compare` is a role that is not in your ladder (any more) |

These are **not** a problem: a category added to the ladder after the snapshot (no column means "not recorded", which is
different from level 0), empty cells, and a file with only the header. `README.md` and hidden files in the folder are
ignored; any other file that is not `.csv` gets a warning.

### `snapshot:report`

```sh
npm run snapshot:report                                       # every snapshot, every person
npm run snapshot:report -- --id asier                         # one person
npm run snapshot:report -- 2026-11-09.csv 2027-05-12.csv      # these snapshots only
npm run snapshot:report -- --from 2027-02-10 --to 2027-05-12 # a period, both days included
npm run snapshot:report -- --compare pem                      # every role gap against the role with the key "pem"
npm run snapshot:report -- --id asier --out reports/asier.html
```

Reads the snapshots in the snapshots folder, with your current ladder, and writes **`reports/<today>.html`** (a second
run on the same day replaces it), or the path in `--out` (its folders are created). It prints the path and the warnings, never names or levels. The
filters combine; `--from` and `--to` are `YYYY-MM-DD` and compare with the date at the start of the file names.
`--out` cannot be inside the snapshots folder or `dist/`. See [Reports](#reports).

`--compare` must be the key of a role of your ladder, otherwise the command fails and lists the roles.

It stops, with no file written, when a snapshot it reads has an **error** (the same ones `snapshot:check` lists, with file and
line) and when no row is left to report, for example for a `--id` that is in no snapshot. Warnings are printed and also listed at the end of the report.

## Reports

A report is one HTML file that opens offline in any browser and prints well. It starts with a **team overview**: a
heat map of every person by category, each person at their latest row in any snapshot (not only the latest file), with the
date of that row, their overall progress (and a line of how it moved across their snapshots) and their role gap, and a
row with the team average of each category. When two files have the same date, the one whose name sorts last
wins (`2027-02-10-q1-review.csv` over `2027-02-10.csv`). Then, for each person (rows with the same `id`
are the same person, named as in their latest row) it has a table of every category by snapshot date with the
**Reached level**, the **Overall progress** and the **Role gap** (categories **on target** and **levels to go**) of each date.

- Each cell is coloured against the role of the row's role gap: **green** when the level meets the role (`✓`), a darker
  green for each level above it (`+1`, `+2`…), and **red** when it is below the role, darker the bigger the gap (`−1`,
  `−2`, `−3` or more). The marks are in the cell as well as the colour, and are said in words for screen readers. A
  level with no role to compare (a row without one) is shaded in neutral ink instead, darker the closer to the highest
  level of the category, as is the team average. The role gap also counts the categories above the role.
- For each person, the table of every snapshot also gives the **change** of each category, from the first to the last
  level recorded.
- A category the row did not record (no column, or an empty cell) reads **not recorded**; it is never counted as level 0.
  The overall progress of a row is the average over the categories it recorded, and the report says how many that is
  ("9 of 10 categories"). Adding a category to your ladder therefore never makes an old row look worse.
- The role gap of a row is computed over the categories it recorded only, so a category that was not recorded adds
  nothing to the levels to go, and the report says how many categories it covers. With `--compare <role>` every row is
  compared with that role; without it, each row uses its own `compare` column, and a row with none (or with a role that
  is not in your ladder any more, which `snapshot:check` warns about) shows no role gap.
- Each person has a radar, drawn like the app's, with their **last** snapshot in ink and their **first** one muted and
  dashed (just one series for a person with one row), labelled with their dates. A category that a row did not record is left out of its outline
  and marked "not recorded" under its name; it is not drawn at 0. Everything on the radar is also in the table.
- A level above the highest level of its category is shown as recorded and flagged; its progress counts as 100%.
- The file has no JavaScript and blocks every network request, so it cannot send what it holds anywhere. It uses the
  same colour variables as the app followed by your `theme.css`, so it follows your branding. It embeds the app's
  default fonts (about 120 KB), so it looks the same on any computer, but it loads no other font, not even one your
  `theme.css` imports: other fonts in `--font-family` and `--font-display` are used only when they are installed on the
  computer that opens it.
- The radar uses the same classes as the app (`.radar-series--person`, `.radar-area`…), so the colours you set in
  `theme.css` apply to it. The exact layout of the report can change in any version; the command and its name are what stay.

A report gathers more personal data than one share link, and it can be forwarded like any file. It is written to
`reports/`, never inside the snapshots folder or `dist/`, and the dev server does not serve it. The radar's own
`.gitignore` ignores `reports/`, and `npx progression-radar init` adds it to the `.gitignore` of your adopter repository
(see [Upgrading](upgrading.md#reports-110) if you created it before). Keep it out of git.

## What is in the file

```csv
id,name,role,compare,tags,build,ai,data,cloud,trust,agentic,deliv,biz,comm,people
ana-garcia,Ana García,assoc,maker,tech|design,2,1,1,1,1,2,1,1,2,0
luis-perez,Luis Pérez,dpe,sdpe,,1,1,3,2,2,2,2,1,2,1
```

- The first row is the header and columns are found **by name**, in any order.
- `id`, `name`, `role` (current role), `compare` (compared role) and `tags` are the same names as in the
  [share link](share-link.md). Then there is one column per category key, with the level reached.
- `tags` are separated by `|`. A tag that contains `|` cannot be recorded.
- Empty cells mean "not recorded".
- UTF-8, standard CSV quoting: `"` around values with a comma, a quote or a line break, and `""` for a quote inside
  (`"García, ""Ana"""`).
- The `id` category key is reserved: a category cannot be called `id` (see [Categories](categories.md#reserved-keys)).

You can build your own reports on this format: it is a plain CSV, and the columns will not change underneath you without
a migration.

## Editing by hand and in a spreadsheet

Snapshots are history, so the commands only add rows. To fix a mistake (a wrong level, a typo in an `id`), edit the file
yourself. The commands accept what a spreadsheet saves:

- columns in any order and a UTF-8 byte-order mark;
- `\r\n` line breaks;
- `;` as the separator (Excel in many languages, such as Spanish, saves like this). The separator is detected from the
  header.

To work in a spreadsheet: open the CSV, edit, and **save as "CSV UTF-8"**. A file saved in another encoding is reported by
`snapshot:check` (it does not convert it). If you then record a new person in that file, the command keeps the file's
separator and line breaks.

After editing by hand, run `npm run snapshot:check`: hand-written rows go through the same checks as the ones the
commands write.

## When your ladder changes

Changing categories, levels or roles never rewrites or rejects old snapshots.

- **A category is removed or renamed** (its key changes): old snapshots keep the column. `snapshot:check` shows a warning,
  and the link from `snapshot:link` carries the value so the app's notice lists it as ignored.
- **A category is added**: old snapshots have no column for it, which is fine. New rows in those files do not record it.
  Start a new snapshot to record it.
- **The highest level of a category is lowered**: levels above it are warned about and kept.
- **A role disappears**: warned about, kept.

Warnings are information, not a to-do list: you can leave them as long as you want the history to stay as it was.

## Where snapshots live

By default in `snapshots/`, in the folder the commands run in: the root of your fork or of your
[adopter repository](getting-started.md#install-it-as-a-dependency-recommended). In a fork it is git-ignored (only
`snapshots/README.md` is tracked), so a snapshot never ends up in a commit by accident; in an adopter repository,
which holds only your data, you decide what is committed.

To keep them elsewhere, for example in a separate private repository that only holds your data, set
`PROGRESSION_RADAR_SNAPSHOTS_DIR` to a path relative to that folder, outside it, or absolute:

```sh
PROGRESSION_RADAR_SNAPSHOTS_DIR=../ladder-data/snapshots npm run snapshot:record -- "<link>" --id ana-garcia
```

The folder is created when it is missing. Messages name it as you wrote it. Decide who can read that folder as you
would for any file with performance information about people.

## Asking Claude

If you use [Claude Code](https://claude.com/claude-code), open it in your repository and ask in natural language. Two
project skills (in `.claude/skills/`) run the commands for you: `progression-radar-snapshots` records, links and checks
snapshots, and `progression-radar-report` generates the report and opens it in your browser (also as
`/progression-radar-report`, optionally followed by what you want, e.g. `/progression-radar-report person_name since
2027-02-01 against pem`). A fork already has them. In an adopter repository `npx progression-radar init` copies them
from the installed radar; commit them, so a later change to them reaches you as a diff you can review. After
[upgrading](upgrading.md#skills-after-upgrading), update them with:

```sh
npx progression-radar skills
```

Then ask, for example:

- "Record Ana's link in today's snapshot" (and paste the link)
- "Give me the link of Luis in the November snapshot"
- "Check the snapshots"
- "Generate the report of the team", or "make the report of Asier since February against pem"

What it does:

- **Asks instead of guessing** when something is missing: the `id`, the link, which snapshot. If you do not name a
  snapshot it uses today's date and tells you.
- **Confirms an `id` that already exists** in an earlier snapshot: it shows the name recorded there and asks whether it is
  the same person, and points out an `id` that looks like an existing one (`ana-garcia` and `ana-garcía`), because a typo
  would split one person in two.
- **Asks which role you mean** for a report when you name one that is not clearly a role of your ladder, instead of
  guessing.
- **Relays what the commands print**, errors and warnings with their file and line, and the path of the report.
- **Opens the report in your default browser** once it is written (unless you only asked to generate it).

What they do not do: they only change snapshots by running these commands (they never edit a CSV themselves), they
open a report in your browser but never read, summarise or interpret it (if you ask how someone is doing, they point to
the file), they do not assess a person or suggest levels, and they treat anything they read from your files as data,
not as instructions.

The names and levels you give it enter Claude's context. Use it only if that is acceptable under your organisation's
policies; the commands work the same without it.

## Troubleshooting

| You see…                                                                   | Because… and what to do                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `The link has no data` or the shell cuts the link                          | The link was not in quotes: `#` starts a shell comment. Put the whole link between quotes.        |
| `The link is not valid: …`                                                 | Nothing in it is usable. Copy it again from the app with **Copy link**.                           |
| `Give the id of the Person with --id`                                      | `--id` is required.                                                                               |
| `The id "…" is not valid`                                                  | The `id` has spaces or one of `, ; " \|`. Use something like `ana-garcia`.                        |
| `The id "…" is already in … on line N`                                     | That person is already in that file. Use another snapshot, or edit the row by hand.               |
| `"…" is not a valid snapshot name`                                         | Start the name with a real date and end in `.csv`: `2026-11-07.csv`.                              |
| `… cannot be read: …; run snapshot:check`                                  | The existing file is broken (unclosed quote, no `id` column…). Run the check and fix it by hand.  |
| `… is not UTF-8`                                                           | Save the file from your spreadsheet as **CSV UTF-8**.                                             |
| `The tag "…" has a "\|"`                                                   | Rename the tag in the share link; `\|` separates tags in the file.                                |
| `The Configuration has problems…`                                          | Your configuration is invalid (for example a category with the key `id`). Fix what it lists.      |
| `PROGRESSION_RADAR_CONFIG_DIR is set to … but the folder … does not exist` | The configuration folder in the variable does not exist. Create it or unset the variable.         |
| `No report was written: fix the errors above`                              | A snapshot the report reads has an error. Fix what it lists (the same as `snapshot:check`).       |
| `There is no row to report …`                                              | No snapshot yet, or no row left with these files, `--id` and dates. Check the `id` and the dates. |
| `--compare "…" is not a role of the Configuration`                         | Use the key of a role of your ladder; the message lists them.                                     |
| `--from "…" is not a date` / `--to "…" is not a date`                      | Write the date as `YYYY-MM-DD`, e.g. `2027-02-10`.                                                |
| `… is inside the Snapshots folder` / `… is inside dist/`                   | `--out` points where a report must not go. Choose a path in `reports/`.                           |

## See also

- [The share link](share-link.md): the parameters a row converts to and from.
- [Configuration](configuration.md) and [Categories](categories.md): what snapshots are checked against.
- [ADR 0004](../adr/0004-local-csv-snapshots-outside-the-app.md): why snapshots are CSV files driven by scripts.
- [ADR 0007](../adr/0007-static-html-reports-from-snapshots.md): why reports are static files made by a command.
