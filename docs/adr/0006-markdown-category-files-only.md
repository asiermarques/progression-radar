---
title: Markdown category files only
status: Accepted
date: 2026-11-09
tags: [config, maintainability, data-model]
---

# 0006. Markdown category files only

## Context and problem statement

[ADR 0003](0003-markdown-category-files-alongside-yaml.md) introduced one Markdown **Category file** per category in a
`categories/` folder and kept `categories.yml` alongside it, so that existing configuration folders kept working without
migration. The sample (`config.example/categories/`) and the guides already use the Markdown form, and
`npm run config:convert-categories` (`scripts/convert-categories.ts`) converts a `categories.yml` into category files,
keeping every `key` explicit in the frontmatter.

Supporting both forms has a lasting cost:

- `scripts/config-sources.ts` resolves two forms of the categories unit (`form: "file"` and `form: "folder"`), reports
  a folder that has both, and falls back to the example's `categories.yml` when neither folder has categories.
- `src/config.ts` names YAML entries by their position (`config/categories.yml entry #3`) instead of `file:line`, and
  keeps `kpis` as a legacy alias of `expectations`, which only YAML can contain.
- Tests, guides (`docs/guides/categories.md`, `configuration.md`, `upgrading.md`) and the README describe both forms.
- `progression-radar init` copies the sample's `categories/` folder into a `config/` that already has a
  `categories.yml`, which leaves the **Configuration** invalid: a mistake that exists only because two forms do.

[ADR 0005](0005-radar-as-a-dependency-of-an-adopter-repository.md) makes the **Configuration** files part of a public
contract versioned with semver from the first 1.x release on npm, which has not happened yet. Removing a format after
that release is a major version; removing it before is not.

The question is whether to keep `categories.yml` as a second category format, and if not, how to remove it without
breaking the decision that configuration mistakes are shown, not hidden (`docs/PRODUCT.md`).

## Decision drivers

- **Maintainability:** one category format to read, validate, test and document. Every problem has a file and a line.
- **Correctness:** "Configuration mistakes are shown, not hidden" (`docs/PRODUCT.md`). An adopter who upgrades with a
  `categories.yml` must never get a site that silently shows the sample's categories.
- **Compatibility:** the **Share link** and the **Snapshot** format do not change (ADR 0001, ADR 0004): category keys
  must survive the migration.
- **Cost / timing:** the contract of ADR 0005 starts with the first npm 1.x release; a format that is not in it costs
  nothing to keep out.

## Considered options

1. **Keep both forms** (ADR 0003 as it is). Nothing breaks, but the cost of two forms stays and enters the semver
   contract.
2. **Markdown category files only, with an explicit error and the converter.** A `categories.yml` is a configuration
   problem that points to `config:convert-categories`; the converter stays.
3. **Deprecate first.** 1.x keeps reading `categories.yml` with a warning in `build` and `check`, and a later major
   version removes it.

## Decision outcome

Chosen option: **"Markdown category files only, with an explicit error and the converter"** (option 2), because it
leaves one category format before the semver contract of ADR 0005 starts, and the converter already gives every
existing `categories.yml` a one-command migration that keeps its keys. Option 3 would only make sense if the npm 1.x
release came first.

### Rules

- The categories of a **Config folder** and of the **Sample configuration** are a `categories/` folder of category
  files, with the format, reader rules, order and per-unit fallback of ADR 0003. They are the only source of
  categories.
- A `categories.yml` in the **Config folder** is a **configuration problem**, never an ignored or unrecognised file:
  `build` and `check` fail and the app's error screen lists it, with a message that names the file and the command,
  e.g. `config/categories.yml is no longer read; convert it with npm run config:convert-categories`. It is reported
  whether or not a `categories/` folder is also there, and the categories never fall back to the sample because of it.
- `config convert-categories` (`npm run config:convert-categories`) stays as the migration path. It is the only code
  that reads a `categories.yml`, and it still accepts the legacy `kpis` list. It keeps renaming the YAML to
  `categories.yml.bak`, which the build only warns about.
- The `kpis` alias leaves `parseConfig()`. The raw shape that `parseConfig()` receives does not change: it is the one
  the category reader already produces.
- `yaml` stays a dependency: `roles.yml`, `site.yml` and the frontmatter of category files are YAML.

### Consequences

- **Good:** one category format in the code, the tests and the guides. Every category problem is reported as
  `file:line`. The resolution of the categories unit loses a branch, the "both exist" problem and the fallback to the
  example's `categories.yml`. `init` can no longer produce a configuration with both forms. The npm package starts its
  semver contract with one format.
- **Trade-offs:**
  - A breaking change for forks and separate configuration repositories that still use `categories.yml`: they must run
    the converter once.
  - Adopters who generate their ladder from another tool (a spreadsheet, an HR system) produce Markdown with
    `## Level N` headings instead of a YAML list, which is more fragile to generate.
  - The YAML reading of categories does not disappear: it moves into the converter, which has to be kept and tested
    while it exists.
- **Follow-ups:**
  - `scripts/config-sources.ts`: drop the `"file"` form and the fallback to the example's `categories.yml`; report a
    `categories.yml` in the **Config folder** as a configuration problem; with no `categories/` in either folder, report
    the missing folder.
  - `src/config.ts`: drop the positional `entry #N` names and the `kpis` alias.
  - `scripts/convert-categories.ts`: keep reading `kpis`, now on its own.
  - `scripts/config-migrate.mjs`: a fork that edited the removed `config.example/categories.yml` ends up with a
    `config/categories.yml`, now invalid: run the conversion after the move, or say so in its next steps.
  - Tests: remove the YAML cases from `config-sources` and `config`, add the "no longer read" problem (with and without
    a `categories/` folder, in the dev server, `build` and `check`), and keep the converter's.
  - Docs: `docs/guides/categories.md` (the `categories.yml` section becomes the conversion), `configuration.md`,
    `upgrading.md` (a section for adopters with `categories.yml`, and the notes about `kpis` and the former
    `config.example/categories.yml`), the README, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`,
    `docs/UBIQUITOUS_LANGUAGE.md` and `config/README.md`.
  - Ship it before the first 1.x release on npm (ADR 0005). If that release comes first, reconsider option 3.
  - Removing the converter itself is a later decision.

## Links

- [ADR 0003](0003-markdown-category-files-alongside-yaml.md): the category file format, which stays; its "alongside
  YAML" part is replaced by this decision.
- [ADR 0005](0005-radar-as-a-dependency-of-an-adopter-repository.md): the semver contract that includes the
  **Configuration** files.
- [ADR 0001](0001-readable-share-url-format.md) and [ADR 0004](0004-local-csv-snapshots-outside-the-app.md): category
  keys are part of the **Share link** and of the snapshots, so the converter keeps them.
- `docs/PRODUCT.md`: "Configuration mistakes are shown, not hidden".
