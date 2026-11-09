# Categories

Write the categories as **one Markdown file per category** in a `categories/` folder of your config folder. Your
folder replaces all the sample categories. If you still have a `categories.yml`, see
[Converting an existing categories.yml](#converting-an-existing-categoriesyml): it is no longer read.

## Category files

```md
<!-- config/categories/01-comm.md -->
---
key: comm
name: Communication
description: Shares the right amount of information with the right people, at the right time
---

## Level 1

### Provides regular status updates to their team

**Example behaviours:**

* Communicates project status clearly and effectively
* Exposes the blockers in the stand-up

### Details the context in all the collaborative tools and channels

## Level 2

### Communicates effectively to close stakeholders when called upon
```

- The file starts on its first line with a frontmatter holding `key` and `name`, and optionally `description`. Any
  other key is reported, so a typo such as `descripton:` is not silently ignored. The `key` is never taken from the
  file name, so renaming a file to reorder it does not break existing share links.
- Each `## Level N` heading (N a positive integer, always written in English, whatever the language of your ladder)
  opens a level, and each `### Summary` under it is an expectation of that level. Levels may come in any order and
  skip numbers.
- The summary is the plain text of the `###` heading. The description is the Markdown that follows it, up to the next
  `###` or `##`, kept as written: lists, code blocks and `####` headings are fine in it.
- Nothing else is allowed outside an expectation: no `#` headings, no text between a `## Level N` and its first
  `###`, no repeated level and no level without expectations. Every mistake is listed on the error screen with the file
  and line, for example `config/categories/01-comm.md:14: "## Nivel 2" is not a level heading; use "## Level N"`.
- **Order.** Categories are shown in the order of the file names: by leading number (`2-` comes before `10-`), then by
  name character by character. Files without a number come last.
- Only `.md` files are read. `README.md` is ignored and any other file or folder in `categories/` is reported by the
  build log. A `categories/` folder with no category file is a configuration problem, never a reason to use the sample.

The levels of a category are the levels used by its expectations, plus level 0.

## Converting an existing categories.yml

Earlier versions also read the categories from a single `categories.yml`. It is no longer read: a `categories.yml` in
your config folder is a configuration problem (on the error screen, in `npm run check` and in a failing
`npm run build`), and the app never uses the sample categories instead. Convert it once:

```sh
npm run config:convert-categories
```

The command turns the `categories.yml` of your config folder (`config/`, or `PROGRESSION_RADAR_CONFIG_DIR`) into a
`categories/` folder with one file per category, keeping every `key`, so existing share links and snapshots keep
matching:

- Files are named `01-<key>.md`, `02-<key>.md`… in the order of the YAML, and the expectations are grouped under
  `## Level N` in ascending order. `tags` are dropped, and the old `kpis` list is read as the expectations.
- Headings written as `#`, `##` or `###` inside an expectation description become `####`, because those levels are
  structure in a category file. The command lists each one it changed, and also any summary it had to join into one
  line.
- `categories.yml` is renamed to `categories.yml.bak`; the build warns about it until you delete it.
- If `categories.yml` has any configuration problem (each one named by its entry, `config/categories.yml entry #3 …`),
  or `categories/` already exists, nothing is written and the reasons are listed. It never stages or commits anything.
- If your config folder has both a `categories.yml` and a `categories/` folder, delete the YAML when the folder already
  holds your categories, or remove the folder and convert.

In a fork that still has the old sample `config.example/categories.yml`, run `npm run config:migrate` instead: it moves
the file to your config folder and converts it (see [Upgrading](upgrading.md)).

## Reserved keys

The keys `name`, `role`, `compare`, `tag` and `state` are reserved by the [share link](share-link.md), and `id`
by the [snapshots](snapshots.md): a category using one of them is reported as a configuration problem. If your ladder already uses one, see [Upgrading](upgrading.md).

## See also

- [Roles](roles.md): the levels each role requires, by category key.
- [Configuration](configuration.md): where the files go and how they are validated.
- [The glossary](../UBIQUITOUS_LANGUAGE.md), [ADR 0003](../adr/0003-markdown-category-files-alongside-yaml.md) and
  [ADR 0006](../adr/0006-markdown-category-files-only.md): the words used here, the format of a category file and why
  it is the only one.
