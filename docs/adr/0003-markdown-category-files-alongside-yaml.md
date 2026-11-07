---
title: Markdown files per category alongside the YAML configuration
status: Accepted
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

Designing the Markdown format also raised the question of expectation tags. They have been in the sample since the
first version, and `parseConfig()` reads them into the model (`src/config.ts`, `src/model.ts`), but nothing reads them
afterwards: no component shows them, nothing filters by them, and they are unrelated to the person tags of the share
link. Giving them a syntax in the new format would mean designing a format for a feature that does not exist.

The question is whether adopters should be able to write categories as Markdown documents, without losing the
validation guarantees and without breaking existing configuration folders.

## Decision drivers

- **Maintainability (authoring):** the people who write a ladder (managers, HR, staff engineers) write prose. The
  format should read as a document, render on GitHub and produce clean diffs in reviews.
- **Correctness:** "Configuration mistakes are shown, not hidden" (`docs/PRODUCT.md`). A format whose structure is
  implicit (headings) must still report every mistake, with the file and line, and never change meaning silently.
- **Backwards compatibility:** existing `config/categories.yml` files in forks and separate repositories must keep
  working without migration.
- **Maintainability (code):** `parseConfig()` stays the only place that turns raw data into domain types
  (`docs/ARCHITECTURE.md`, "Configuration is validated, not trusted"). `src/` must work with any valid configuration.
  Configuration that the app never uses is a cost, not a feature.
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

For the expectation tags, three options were weighed: a syntax in the Markdown format (a `tags:` paragraph, an HTML
comment or an attribute on the heading), supporting them in YAML only, or removing them.

## Decision outcome

Chosen option: **"One Markdown file per category, alongside YAML"** (option 3). It improves the only file where
YAML hurts, keeps structured data in YAML where it fits, and keeps existing configuration folders valid.

Expectation tags are **removed** from the model, both formats, the sample and the documentation, because nothing
uses them.

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

**Example behaviours:**

* Communicates project status clearly and effectively
* Exposes the blockers in the stand-up

### Details the context in all the collaborative tools and channels

…

## Level 2

…
```

- **Frontmatter** (YAML, parsed with the `yaml` package already used): `key` and `name` are required and
  `description` is optional, as in `categories.yml`. Any other key is a configuration problem, so a typo such as
  `descripton:` is reported instead of ignored. The `key` is always explicit and never derived from the file name, so
  renaming a file to reorder it never changes the keys used in share links
  ([ADR 0001](0001-readable-share-url-format.md)).
- **Body:** the only top-level headings are `## Level N`, written exactly like that, where N is a positive integer.
  Each `### <summary>` under one of them is an expectation of that level.
- **Summary:** the plain text of the `###` heading. The UI shows it as plain text, so inline Markdown in it is not
  kept.
- **Description:** everything up to the next `###` or `##`, as the Markdown source slice, trimmed and kept as written
  (not re-serialised). Headings `####` and deeper are allowed inside a description.
- **Parsing:** the file is parsed with a real Markdown parser (`mdast-util-from-markdown`, already installed through
  `react-markdown`), never by splitting lines on `##`: fenced and indented code, setext headings and headings inside
  quotes or list items would be read wrongly. It runs at build time only, so it is a devDependency.

### Reader rules

Each of these is a configuration problem, reported as `<file>:<line>: <message>` (for example
`config/categories/01-comm.md:14: …`):

- a missing frontmatter, a frontmatter without `key` or `name`, or with an unknown key;
- content before the first `## Level N`;
- content between a `## Level N` and its first `###`;
- a `#` heading, or a `##` heading that is not `Level N`. The message names the expected form, e.g.
  `"## Nivel 1" is not a level heading; use "## Level N"`;
- the same `## Level N` twice in a file;
- a `## Level N` with no expectation;
- an empty `###` heading.

Levels may appear in any order and may skip numbers, as in `categories.yml`. A YAML syntax error in the frontmatter
fails the dev server and the build, as YAML syntax errors in the other files do today.

### Order

Categories are shown in the order of their file names, sorted by the leading number of the name (so `2-` comes
before `10-`, and zero-padding is optional), then by the whole name compared character by character, so the result
is the same on every machine. Files without a leading number come after the numbered ones. Only `.md` files are read;
`README.md` is ignored, and any other file or folder inside `categories/` gets the usual "not a configuration file"
warning.

### Resolution (extends ADR 0002)

- The categories come from **one source per folder**: `categories.yml` **or** `categories/`. A folder that has both
  is a configuration problem.
- The per-file fallback of ADR 0002 applies to that unit as a whole: if the config folder has either form, it
  replaces the example's categories completely. Individual `.md` files are never merged with the example ones.
- A `categories/` folder with no category file (empty, or only a `README.md`) is a configuration problem, not a
  reason to fall back to the example.

### How it reaches the app

- Each category file is imported by the configuration module (`virtual:progression-radar-config`) through a
  dedicated query (`…/01-comm.md?category`), and a transform plugin, like the existing `yaml()` one, turns it into
  the **same raw shape** as one entry of `categories.yml` (`{ key, name, description, expectations: [{ summary,
  description, level }] }`) plus the reader's problems. Because the file is imported, editing it reloads the dev
  server; the folder watcher covers adding and removing files.
- The reader checks everything specific to the format, with file and line. `parseConfig()` keeps the checks that
  span files (duplicated or reserved category keys, roles that reference an unknown category) and reports the
  reader's problems together with its own, so they show up in the error screen and fail the tests like any other
  problem.
- `Origins` holds one origin per category instead of one per file, so problems found by `parseConfig()` name
  `config/categories/03-pm.md` instead of `entry #3`.

### Expectation tags

- `Expectation.tags` is removed from the model and from `parseConfig()`, and `tags` is removed from the sample and
  the README.
- An existing `categories.yml` that still has `tags:` keeps working: like any other key that `parseConfig()` does not
  know, it is ignored.
- In a category file a `tags:` line is ordinary description text.
- Person tags (`tag=` in the share link) are not affected, and `tag` stays a reserved key.
- If expectations are ever filtered or grouped by a label, a new ADR will define it for both formats.

### Sample

`config.example/categories/` (one Markdown file per category) replaces `config.example/categories.yml`. The sample is
the documentation, so it shows the recommended format. The YAML format stays supported for adopters, covered by tests
and documented in the README.

### Consequences

- **Good:** a category reads as a document and renders on GitHub, ladders can be reviewed in PRs as text,
  expectations are grouped by level instead of repeating `level:`, and diffs are smaller. Existing `categories.yml`
  files keep working, tags included. `parseConfig()` and `src/` stay unaware of the source format. The model loses a
  field that nothing used.
- **Trade-offs:**
  - Two category formats to document, test and support.
  - The structure becomes implicit, so the reader must be strict and its error messages good; a lenient reader would
    break the "shown, not hidden" decision.
  - A Markdown parser becomes a direct build-time dependency.
  - The order depends on file names, a convention adopters must learn.
  - `## Level N` is an English keyword even in a ladder written in another language, like the YAML keys.
  - Adopters who kept expectation tags lose them silently in YAML and cannot write them in Markdown.
- **Follow-ups:**
  - Confirm adding `mdast-util-from-markdown` to `devDependencies` before implementing (`CLAUDE.md`).
  - `scripts/config-sources.ts`: treat `categories/` as a known entry (today `listFiles()` lists it and it would be
    reported as unrecognised), report the both-present and empty-folder problems, list the `.md` files in order, and
    say in the build log which form was used.
  - A build-time reader (e.g. `scripts/category-markdown.ts`) with the rules above and its own tests (each error with
    its line, code blocks and `####` inside descriptions, setext headings, ordering).
  - `vite.config.ts`: the `?category` transform plugin, and a watcher that also covers `categories/` in both folders
    (today only direct children of the folders reload).
  - `src/config.ts` and `src/model.ts`: one origin per category, the reader's problems in the list, and no
    expectation tags.
  - `config.example/`: convert `categories.yml` to `categories/*.md` without tags. Check that `npm run config:migrate`
    handles a fork that edited the removed `config.example/categories.yml` (it should move it to the fork's config
    folder, which stays valid).
  - Update `docs/PRODUCT.md` ("Core concepts", the non-goal "edited in the YAML files", "Not shown yet"),
    `docs/ARCHITECTURE.md` ("Stack", "Layout", "Data flow", "Configuration is validated, not trusted"),
    `docs/UBIQUITOUS_LANGUAGE.md` (remove **Expectation tag** and the note that "tag" means two things; **Category
    file** is no longer proposed), `config/README.md` and the README "Categories" section.

## Links

- [ADR 0001](0001-readable-share-url-format.md): category keys are part of the share link.
- [ADR 0002](0002-config-example-with-local-config-override.md): per-file override, extended here to the
  categories unit.
- `docs/PRODUCT.md`: "Configuration mistakes are shown, not hidden", "Customisation by forking", "Non-goals",
  "Not shown yet".
