---
title: Markdown files per category alongside the YAML configuration
status: Proposed
date: 2026-11-07
tags: [config, maintainability, data-model]
---

# 0003. Markdown files per category alongside the YAML configuration

## Context and problem statement

Every configuration file is YAML (`docs/ARCHITECTURE.md`, "Stack": "readable for non-developers"). Three of them hold
structured data and YAML suits them well: `roles.yml` is a matrix of role × category → level, and `site.yml` has
three keys. `categories.yml` is different. It is 457 of the sample's 521 configuration lines, and most of it is prose:
34 expectation descriptions written in Markdown inside YAML block scalars.

Writing Markdown inside YAML is where adopters struggle. The sample used folded blocks (`>`), which join consecutive
lines, so lists needed artificial blank lines between items and silently became one paragraph without them. That
trap was removed by switching the sample and the README to literal blocks (`|`). The remaining friction is
structural: prose has to sit at the right indentation level, `level: N` is repeated on every expectation instead of
grouping expectations by level, and the file is a poor document to read or review. GitHub shows it as code, not as the
ladder it describes.

The question is whether adopters should be able to write categories as Markdown documents, without losing the
validation guarantees and without breaking existing configuration folders.

## Decision drivers

- **Maintainability (authoring):** the people who write a ladder (managers, HR, staff engineers) write prose. The
  format should read as a document, render on GitHub and produce clean diffs in reviews.
- **Correctness:** "Configuration mistakes are shown, not hidden" (`docs/PRODUCT.md`). A format whose structure is
  implicit (headings) must still report every mistake, with the file and position, and never change meaning
  silently.
- **Backwards compatibility:** existing `config/categories.yml` files in forks and separate repositories must keep
  working without migration.
- **Maintainability (code):** `parseConfig()` stays the only place that turns raw data into domain types
  (`docs/ARCHITECTURE.md`, "Configuration is validated, not trusted"). `src/` must work with any valid configuration.
- **Cost / simplicity:** keep the one-rule override model of [ADR 0002](0002-config-example-with-local-config-override.md)
  ("the file in your folder wins, whole"). No new runtime dependency; a build-time one only after asking.

## Considered options

1. **Keep YAML only.** Literal blocks (`|`) already remove the worst trap, and nothing else changes. Prose authoring
   stays awkward.
2. **Everything in Markdown** (`roles`, `site` and categories). `roles.yml` would become a fragile table or an
   invented syntax, and `site.yml` gains nothing.
3. **One Markdown file per category, with YAML frontmatter, in a `categories/` folder; `roles.yml` and `site.yml`
   stay YAML.** Both `categories.yml` and `categories/` are accepted.
4. **A single `categories.md`** with `#` headings per category. One file to override, but it is long, and a
   category's metadata (key, name) would need an invented syntax under each heading.

## Decision outcome

Proposed option: **"One Markdown file per category, alongside YAML"** (option 3). It improves the only file where
YAML hurts, keeps structured data in YAML where it fits, and keeps existing configuration folders valid.

### Format

`config/categories/01-comm.md` (the frontmatter must start on the first line):

```md
---
key: comm
name: Communication
description: Shares the right amount of information with the right people, at the right time
---

## Level 1

### Provides regular status updates to their team

tags: tech

**Example behaviours:**

* Communicates project status clearly and effectively
* Exposes the blockers in the stand-up

### Details the context in all the collaborative tools and channels

…

## Level 2

…
```

- **Frontmatter** (YAML, parsed with the `yaml` package already used): `key` and `name` are required and
  `description` is optional, as in `categories.yml`. The `key` is always explicit and never derived from the file
  name, so renaming a file to reorder it never changes the keys used in share links
  ([ADR 0001](0001-readable-share-url-format.md)).
- **Body:** the only top-level headings are `## Level N`, where N is a positive integer. Each `### <summary>` under
  one of them is an expectation of that level. Everything up to the next `###` or `##` is the expectation
  description: the Markdown source slice, kept as written and not re-serialised. Headings `####` and deeper are
  allowed inside a description.
- **Expectation tags:** an optional first paragraph of the expectation body that starts with `tags:` and holds a
  comma-separated list. *Open point:* confirm this syntax before implementing, since expectation tags are in the model
  but not shown in the UI.
- **Errors:** content before the first `## Level`, content between a `## Level` and its first `###`, a `#`
  heading, a `##` heading that is not `Level N`, and a missing or invalid frontmatter are all configuration problems.
  They name the file and line (`config/categories/01-comm.md:14: …`).
- **Order:** categories are shown in the alphabetical order of their file names, so a numeric prefix (`01-`,
  `02-`) sets the order on the radar. Only `.md` files are read; `README.md` in that folder is ignored.

### Resolution (extends ADR 0002)

- The categories come from **one source per folder**: `categories.yml` **or** `categories/`. A folder that has both
  is a configuration problem.
- The per-file fallback of ADR 0002 applies to that unit as a whole: if the config folder has either form, it
  replaces the example's categories completely. Individual `.md` files are never merged with the example ones.
- A build-time reader turns `categories/*.md` into the **same raw shape** as `categories.yml` (a list of
  `{ key, name, description, expectations: [{ summary, description, level, tags }] }`). Structural problems travel
  with the raw data, and `parseConfig()` reports them together with the rest, so they show up in the error screen and
  fail the tests like any other problem. Syntax errors in the frontmatter fail the dev server and the build, as YAML syntax
  errors do today.

### Consequences

- **Good:** a category reads as a document and renders on GitHub, ladders can be reviewed in PRs as text,
  expectations are grouped by level instead of repeating `level:`, and diffs are smaller. Existing `categories.yml`
  files keep working. `parseConfig()` and `src/` stay unaware of the source format.
- **Trade-offs:**
  - Two category formats to document, test and support.
  - The structure becomes implicit, so the reader must be strict and its error messages good; a lenient reader would
    break the "shown, not hidden" decision.
  - A Markdown parser becomes a direct build-time dependency. `mdast-util-from-markdown` already comes in through
    `react-markdown`, but adding it to `package.json` needs approval (`CLAUDE.md`). Splitting on `##` lines by hand
    is rejected because it breaks on fenced code blocks.
  - The expectation tags syntax is the least natural part of the format.
  - The order now depends on file names, which is a convention adopters must learn.
- **Follow-ups (when accepted):**
  - `scripts/config-sources.ts`: treat `categories/` as a known entry (today `listFiles()` lists it and it would be
    reported as unrecognised), report the both-present conflict, list the `.md` files in order, and say in the build
    log which form was used.
  - A build-time reader (e.g. `scripts/category-markdown.ts`) with the rules above and its own tests (headings,
    tags, positions in errors, code blocks inside descriptions).
  - `vite.config.ts`: watch `categories/` in both folders, so adding or removing a file reloads in dev (today only
    direct children of the folders are watched).
  - `src/config.ts`: origins per category file so problems name `…/categories/01-comm.md`; include the reader's
    structural problems in the list.
  - Decide whether `config.example/` moves to `categories/` (the sample is the documentation) or keeps
    `categories.yml`. If it moves, `npm run config:migrate` and the README must explain both forms.
  - Update `docs/PRODUCT.md` (the non-goal "edited in the YAML files", the "Customisation by forking" decision),
    `docs/ARCHITECTURE.md` ("Stack", "Layout", "Data flow", "Configuration is validated, not trusted"),
    `config/README.md` and the README "Categories" section.

## Links

- [ADR 0001](0001-readable-share-url-format.md): category keys are part of the share link.
- [ADR 0002](0002-config-example-with-local-config-override.md): per-file override, extended here to the
  categories unit.
- `docs/PRODUCT.md`: "Configuration mistakes are shown, not hidden", "Customisation by forking", "Non-goals".
