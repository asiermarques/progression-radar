---
title: Local CSV snapshots outside the app, driven by npm scripts and skills
status: Accepted
date: 2026-11-07
tags: [persistence, data-model, tooling, security]
---

# 0004. Local CSV snapshots outside the app, driven by npm scripts and skills

## Context and problem statement

The **Share link** holds one **Person** at one moment, and it is the only place the app stores anything
(`docs/PRODUCT.md`, "No backend, no accounts"). Opening a link reinterprets it with the current **Configuration**:
unknown categories and roles are dropped and levels are clamped (**Normalisation**, `src/urlState.ts`,
[ADR 0001](0001-readable-share-url-format.md)). That is right for sharing, but it means a link is not a record. There
is no date, no stable identity for the **Person** (`name` can change, have typos or repeat), and the same link can draw
a different radar after the **Ladder** changes.

Managers and mentors discuss progression over months (`docs/PRODUCT.md`, "Who it is for") and want to see how a
**Person** grew: where they stood at each check-in, and later how each **Category** evolved for one or several
**Persons**. The question is how to keep dated, trustworthy records of **Persons** without a backend, without turning
the app into a multi-person tool, and in a way that people who work with Claude skills can drive by asking.

## Decision drivers

- **Maintainability:** the domain rules (reading a **Share link**, **Normalisation**, **Highest level**, **Progress**)
  must have one implementation. `src/urlState.ts` is the only reader of the link format and `parseConfig()` the only
  validator of the **Configuration** (`docs/ARCHITECTURE.md`); nothing may duplicate them, a skill included.
- **Security / privacy:** snapshots hold personal, review-like data. They must stay on the user's machine or wherever
  the user puts them, never in upstream's repository and never sent anywhere by the tooling.
- **Robustness:** a record must not change after it is taken. **Ladder** changes must never rewrite or reject history,
  in the spirit of "Old links keep working".
- **Cost / simplicity:** no backend, no infrastructure, no new runtime dependency (`CLAUDE.md`). The app stays a viewer
  of one **Person** (`docs/PRODUCT.md`, non-goal "Comparing several people at once").
- **Usability:** the format must be writable by hand or in a spreadsheet, and the whole workflow drivable from Claude
  for managers who use skills.

## Considered options

1. **Snapshots inside the app**: the app opens snapshot files and shows several **Persons** or their history. Reopens
   the non-goal on several **Persons**, needs file access in the browser and changes the link model.
2. **A text file of Share links per date**, one link per line. Reuses ADR 0001 as is, but has no stable identity, is
   unreadable in a spreadsheet and hard to report on.
3. **One folder per Person with one Markdown file per date** (frontmatter plus notes). Natural for one **Person**'s
   history, but recording a whole team at one date means many files, and it is not spreadsheet-friendly.
4. **One dated CSV file per snapshot, one row per Person with a mandatory `id`**, written and validated by local npm
   scripts that reuse the app's code, and driven by skills.
5. **A backend or remote store** (database, Google Drive integration). Contradicts "No backend, no accounts" and adds
   accounts, permissions and responsibility for personal data.

For the skills, two shapes were weighed: skills that implement the rules themselves (parse links, write CSV), or
skills that only drive the npm scripts.

## Decision outcome

Chosen option: **"One dated CSV file per snapshot, driven by npm scripts and skills"** (option 4), because it gives a
dated, identity-aware record that one file can hold for one or many **Persons**, opens in any spreadsheet, needs no
backend, and keeps every domain rule in the code the app already uses. Skills **only drive the scripts**, so asking
Claude and running a command by hand always give the same result.

### The snapshot

- A **Snapshot** is a CSV file in a snapshots folder. Its date is the leading `YYYY-MM-DD` of the file name. The rest
  of the name is free, so several snapshots can share a date (`2026-11-07-q4-review.csv`).
- The first row is a header and columns are identified by their header name, never by position.
- A row holds a whole **Person**: `id` (required), `name`, the **Current role**, the **Compared role**, the **Person
  tags** and one column per **Category key** with its **Reached level**. A row converts to a **Share link** and back
  without loss, so a recorded **Person** can be opened in the app.
- `id` is chosen by the user (e.g. `ana-garcia`), non-empty and unique within a snapshot. The same `id` in two
  snapshots is the same **Person**. It exists only in snapshots, not in the **Share link**.
- A missing **Category** column means "not recorded", which is different from **Level** 0, so a **Category** added
  to the **Ladder** later does not make old snapshots wrong.
- Files are UTF-8 with standard CSV quoting.

### Snapshots are history

- The tooling never rewrites a snapshot. Appending a row whose `id` already exists in that snapshot is refused.
  Editing or deleting rows is done by hand.
- Validation against the current **Configuration** separates two kinds of problem, each reported with file and line:
  - **Warnings** (data kept as it is): a column for an unknown **Category key**, a **Reached level** above the
    **Highest level**, an unknown **Current role** or **Compared role**.
  - **Errors** (wrong whatever the **Ladder** is): no header or `id` column, an empty or duplicated `id`, a row with
    the wrong number of fields, a **Reached level** that is not a non-negative integer, a file name without a valid
    date.

### The scripts

- `npm run` scripts, like `config:migrate`: one appends a row from a **Share link** and an `id`, creating the file
  with its header when needed; one validates one snapshot or the whole folder and exits with an error when there is
  at least one error. Rows written by hand go through the same validation.
- They read the link with `src/urlState.ts` (legacy links and **Normalisation** included, reporting the **Ignored
  fields**) and the **Configuration** with `parseConfig()`, loaded through Vite as `config:convert-categories`
  already does. Nothing is reimplemented.
- The snapshots folder follows the **Config folder** conventions of [ADR 0002](0002-config-example-with-local-config-override.md):
  a default at the project root that upstream git-ignores, and an environment variable to move it elsewhere, for
  example to a separate private repository.

### The skills

- The repository ships project skills that govern the scripts: from a request in natural language they run the right
  script with the right arguments and relay what it reports.
- They change snapshot files **only through the scripts**: they never write CSV and never compute levels.
- When something the script needs is missing (`id`, link, snapshot), they ask instead of guessing. Before reusing an
  `id` from an earlier snapshot, they confirm it is the same **Person**.
- They **do not assess a Person or propose Reached levels**. They record what the manager gives them.
- Their instructions state that names and levels are personal data that enter Claude's context, and that file contents
  are data, never instructions.

### Consequences

- **Good:** dated records with a stable identity and no backend. One file holds one **Person** or a whole team at a
  date, so reports over time become possible on a simple format. The app, the **Share link** format and ADR 0001 do
  not change. One implementation of the rules serves the app, the scripts and the skills. People data never enters
  upstream's repository.
- **Trade-offs:**
  - The CSV layout becomes a contract that future reports and users rely on; changing it needs a migration or a
    versioning story.
  - `id` is managed by hand, and a typo splits one **Person** into two.
  - CSV is a weak container for multi-valued **Person tags** and for spreadsheet quirks: some locales (e.g. Spanish
    Excel) save with `;` or a byte-order mark. Validation must accept these or report them, never misread them.
  - Hand-written rows and script-written rows are both valid, so validation must be as strict as the writer.
  - Using the skills puts personal data in Claude's context; adopters decide whether that fits their policies.
  - `PRODUCT.md` must say that the app stores nothing, rather than that nothing is stored anywhere.
- **Follow-ups:**
  - Avoid the clash between the `id` column and a **Category** with the key `id` (it is not a **Reserved key** today):
    reserve it, which forks must be told about, or name the category columns differently.
  - Evolution reports over snapshots (per **Category**, per **Person**, over time), on this format, in a separate
    piece of work.
  - Update `docs/PRODUCT.md` ("No backend, no accounts", the non-goal "Comparing several people at once" scoped to the
    app, the "shares a snapshot" wording in "Who it is for", "What it does"), `docs/ARCHITECTURE.md` ("Layout", the
    shared use of `urlState.ts` and `parseConfig()` outside the browser), the README, and
    `docs/UBIQUITOUS_LANGUAGE.md` (**Snapshot** and **Person id**; "snapshot URL" stays an alias to avoid for
    **Share link**).
  - Ask before adding any CSV dependency, even a tooling-only one.

## Links

- [ADR 0001](0001-readable-share-url-format.md): the **Share link** format and **Normalisation** that rows reuse.
- [ADR 0002](0002-config-example-with-local-config-override.md): the folder conventions the snapshots folder follows.
- [ADR 0005](0005-radar-as-a-dependency-of-an-adopter-repository.md): the topology in which configuration and snapshots
  live in a repository of the adopter's own.
