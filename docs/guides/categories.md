# Categories

Write the categories either as **one Markdown file per category** in a `categories/` folder (below) or as a single
`categories.yml` ([further down](#categoriesyml)). Use one form per folder: a folder with both is reported as a
configuration problem, and the form you use replaces all the sample categories.

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

## Converting an existing categories.yml

`npm run config:convert-categories` turns the `categories.yml` of your config folder (`config/`, or
`PROGRESSION_RADAR_CONFIG_DIR`) into a `categories/` folder with one file per category:

- Files are named `01-<key>.md`, `02-<key>.md`… in the order of the YAML, and the expectations are grouped under
  `## Level N` in ascending order. `tags` are dropped.
- Headings written as `#`, `##` or `###` inside an expectation description become `####`, because those levels are
  structure in a category file. The command lists each one it changed, and also any summary it had to join into one
  line.
- `categories.yml` is renamed to `categories.yml.bak`; the build warns about it until you delete it.
- If `categories.yml` has any configuration problem, or `categories/` already exists, nothing is written and the
  reasons are listed. It never stages or commits anything.

## categories.yml

Each entry of `categories.yml` has these fields:

| field        | description                                    |
|--------------|------------------------------------------------|
| key          | a unique and short identifier for the category |
| name         | the name of the category                       |
| description  | optional: a brief description of the category  |
| expectations | what is expected at each level of the category |

An expectation is a skill, behaviour or concept expected of a person at one level of the category. Each one has
these fields:

| field       | description                                                     |
|-------------|-----------------------------------------------------------------|
| summary     | a title or brief description of the expectation                 |
| description | optional: an extended description. Markdown is supported        |
| level       | the level (a positive integer) this expectation belongs to      |

The levels of a category are the levels used by its expectations, plus level 0. Earlier versions called the list
`kpis`; that name is still read, but a category cannot have both.

Write multi-line descriptions as a literal block (`description: |`), which keeps every line break, so Markdown lists
and paragraphs work as written. A folded block (`description: >`) joins consecutive lines into one, so a list without
blank lines between its items becomes a single paragraph.

```yaml
# config/categories.yml
- key: comm
  name: Communication
  description: Shares the right amount of information with the right people, at the right time, and listens effectively
  expectations:
    - summary: Communicates effectively to close stakeholders when called upon
      description: |
        **Example behaviours:**

        * Communicates project status clearly and effectively
        * Asks for help at the appropriate juncture
      level: 1
```

## Reserved keys

The keys `name`, `role`, `compare`, `tag` and `state` are reserved by the [share link](share-link.md), and `id`
by the [snapshots](snapshots.md): a category using one of them is reported as a configuration problem, whichever form
you write the categories in. If your ladder already uses one, see [Upgrading](upgrading.md).

## See also

- [Roles](roles.md): the levels each role requires, by category key.
- [Configuration](configuration.md): where the files go and how they are validated.
- [The glossary](../UBIQUITOUS_LANGUAGE.md) and [ADR 0003](../adr/0003-markdown-category-files-alongside-yaml.md): the
  words used here and why the categories can be Markdown files.
