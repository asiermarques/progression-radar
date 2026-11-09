# Your snapshots

This folder holds the **snapshots** you record with `npm run snapshot:record`: dated CSV files, one row per person.
They hold personal data, so everything here is git-ignored and never ends up in an upstream commit.

- One file per snapshot, named with its date: `2026-11-07.csv`, or `2026-11-07-q4-review.csv` when several share a date.
- Record, open and check them with `npm run snapshot:record`, `snapshot:link` and `snapshot:check`, and turn them into
  an HTML report with `snapshot:report` (written to `reports/`, never here). The columns and the rules are in
  [docs/guides/snapshots.md](../docs/guides/snapshots.md).
- Snapshots are history: the commands only ever add a row at the end of a file.

Another folder: set `PROGRESSION_RADAR_SNAPSHOTS_DIR` (relative to the project root, outside it or absolute), for
example to a separate private repository.
