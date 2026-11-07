# Keeping a record of people: snapshots

A [share link](share-link.md) shows one person at one moment, and opening it again reads it with your *current*
configuration: if you change the ladder, the same link can draw a different radar. When you want a record that does not
change, for example to see where someone stood at each one-to-one, save the link in a **snapshot**.

A snapshot is a dated CSV file with one row per person. You can open it in any spreadsheet. Three commands work with
snapshots on your machine; the app itself never reads them, and nothing is sent anywhere.

> Snapshots hold personal data (names and levels). They are git-ignored upstream and stay on your machine, or wherever
> you decide to put them. See [Where snapshots live](#where-snapshots-live).

## What you can do

| I want to…                                  | Command                                                         |
|---------------------------------------------|-----------------------------------------------------------------|
| save a person from their share link         | `npm run snapshot:record -- "<link>" --id <id>`                 |
| open a saved person in the app              | `npm run snapshot:link -- <snapshot.csv> <id>`                  |
| check that my snapshots are well formed     | `npm run snapshot:check`                                        |
| do all of the above by asking Claude        | see [Asking Claude](#asking-claude)                             |

You need the project installed (`npm install`, see [Getting started](getting-started.md)). The commands read your
configuration the same way the app does, so they use your [config folder](configuration.md) and fall back to the sample.

## A walkthrough: monthly one-to-ones

### 1. Set the levels and copy the link

Open the app (`npm run dev`, or your deployed one), choose the person's levels, role and compared role, and press
**Copy link**.

### 2. Record the person

Paste the link **between quotes** (an unquoted `#` starts a comment in the shell) and choose an `id` for the person:

```sh
npm run snapshot:record -- "http://localhost:5173/#name=Ana+Garc%C3%ADa&role=aswe&compare=front&tag=tech&comm=2&pm=1&des=1&ops=1&front=1&back=1" --id ana-garcia
```

```
Recorded ana-garcia in snapshots/2026-11-07.csv (new file, line 2):
ana-garcia,Ana García,aswe,front,tech,2,1,1,1,1,1
```

The file is named after today's date. If the link had something the app would have ignored or corrected (an unknown
category, a level above the highest), the command lists it after the row, and the row holds the corrected person:

```
Ignored in the link: zz, back=9 (changed to 5)
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
snapshots/2026-11-07.csv:1: warning: column "pm" is not a Category of the current Configuration: the data is kept but the app ignores it
Checked 3 snapshots: 0 errors, 1 warning.
```

## Commands

### `snapshot:record`

```sh
npm run snapshot:record -- "<share link>" --id <id> [--snapshot <file>]
```

| option       | description                                                                                                     |
|--------------|-----------------------------------------------------------------------------------------------------------------|
| `--id`       | required. Identifies the person across snapshots, e.g. `ana-garcia`. No spaces, commas, semicolons, quotes or pipes |
| `--snapshot` | the file name, e.g. `2026-11-07.csv` or `2026-11-07-q4-review.csv`. Default: today's date                       |

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

```sh
npm run snapshot:check                      # every file in the snapshots folder
npm run snapshot:check -- 2026-11-07.csv    # one file
```

Prints each problem as `snapshots/<file>:<line>: error|warning: <message>` and ends with a summary. It never changes a
file. The exit code is 1 only when there is at least one **error**, so you can use it in a CI job.

| It is an **error** when…                                                              |
|----------------------------------------------------------------------------------------|
| the file name does not start with a valid date, or the file is not valid UTF-8         |
| the file cannot be read as CSV (a quote is never closed) or its header is ambiguous    |
| there is no header, no `id` column, or a column appears twice                          |
| an `id` is empty or repeated                                                           |
| a row has a different number of fields from the header                                 |
| a level is not a non-negative integer                                                  |

| It is a **warning** when… (the data is kept as it is)                                  |
|----------------------------------------------------------------------------------------|
| a column is for a category that is not in your ladder (any more)                       |
| a level is above the highest level of its category                                     |
| `role` or `compare` is a role that is not in your ladder (any more)                    |

These are **not** a problem: a category added to the ladder after the snapshot (no column means "not recorded", which is
different from level 0), empty cells, and a file with only the header. `README.md` and hidden files in the folder are
ignored; any other file that is not `.csv` gets a warning.

## What is in the file

```csv
id,name,role,compare,tags,comm,pm,des,ops,front,back
ana-garcia,Ana García,aswe,front,tech|design,2,1,1,1,1,1
luis-perez,Luis Pérez,back,,,3,2,2,1,0,1
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

By default in `snapshots/` at the project root, which is git-ignored (only `snapshots/README.md` is tracked), so a
snapshot never ends up in a commit by accident.

To keep them elsewhere, for example in a separate private repository that only holds your data, set
`PROGRESSION_RADAR_SNAPSHOTS_DIR` to a path relative to the project root, outside it, or absolute:

```sh
PROGRESSION_RADAR_SNAPSHOTS_DIR=../ladder-data/snapshots npm run snapshot:record -- "<link>" --id ana-garcia
```

The folder is created when it is missing. Messages name it as you wrote it. Decide who can read that folder as you
would for any file with performance information about people.

## Asking Claude

If you use [Claude Code](https://claude.com/claude-code), open it in this repository and ask in natural language. The
project skill `progression-radar-snapshots` (in `.claude/skills/`) runs the commands for you:

- "Record Ana's link in today's snapshot" (and paste the link)
- "Give me the link of Luis in the November snapshot"
- "Check the snapshots"

What it does:

- **Asks instead of guessing** when something is missing: the `id`, the link, which snapshot. If you do not name a
  snapshot it uses today's date and tells you.
- **Confirms an `id` that already exists** in an earlier snapshot: it shows the name recorded there and asks whether it is
  the same person, and points out an `id` that looks like an existing one (`ana-garcia` and `ana-garcía`), because a typo
  would split one person in two.
- **Relays what the commands print**, errors and warnings with their file and line.

What it does not do: it only changes snapshots by running these commands (it never edits a CSV itself), it does not assess
a person or suggest levels, and it treats anything it reads from your files as data, not as instructions.

The names and levels you give it enter Claude's context. Use it only if that is acceptable under your organisation's
policies; the commands work the same without it.

## Troubleshooting

| You see…                                                                 | Because… and what to do                                                                            |
|--------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `The link has no data` or the shell cuts the link                        | The link was not in quotes: `#` starts a shell comment. Put the whole link between quotes.          |
| `The link is not valid: …`                                               | Nothing in it is usable. Copy it again from the app with **Copy link**.                             |
| `Give the id of the Person with --id`                                    | `--id` is required.                                                                                 |
| `The id "…" is not valid`                                                | The `id` has spaces or one of `, ; " \|`. Use something like `ana-garcia`.                          |
| `The id "…" is already in … on line N`                                   | That person is already in that file. Use another snapshot, or edit the row by hand.                 |
| `"…" is not a valid snapshot name`                                       | Start the name with a real date and end in `.csv`: `2026-11-07.csv`.                                |
| `… cannot be read: …; run snapshot:check`                                | The existing file is broken (unclosed quote, no `id` column…). Run the check and fix it by hand.    |
| `… is not UTF-8`                                                         | Save the file from your spreadsheet as **CSV UTF-8**.                                               |
| `The tag "…" has a "\|"`                                                 | Rename the tag in the share link; `\|` separates tags in the file.                                  |
| `The Configuration has problems…`                                        | Your configuration is invalid (for example a category with the key `id`). Fix what it lists.        |
| `PROGRESSION_RADAR_CONFIG_DIR is set to … but the folder … does not exist` | The configuration folder in the variable does not exist. Create it or unset the variable.          |

## See also

- [The share link](share-link.md): the parameters a row converts to and from.
- [Configuration](configuration.md) and [Categories](categories.md): what snapshots are checked against.
- [ADR 0004](../adr/0004-local-csv-snapshots-outside-the-app.md): why snapshots are CSV files driven by scripts.
