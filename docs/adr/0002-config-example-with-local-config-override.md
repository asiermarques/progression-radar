---
title: Example configuration with a local config folder that overrides it per file
status: Accepted
date: 2026-11-07
tags: [maintainability, tooling, config]
---

# 0002. Example configuration with a local config folder that overrides it per file

## Context and problem statement

Adopters customise a deployment by editing `config/` (`categories.yml`, `roles.yml`, `site.yml`, `theme.css` and
images). The product decision "Customisation by forking" in `docs/PRODUCT.md` promises that, because `src/` stays
untouched, upstream updates merge cleanly.

That promise does not hold: `config/` is both the sample that upstream maintains and the content of the adopter, so
both sides edit the same files. Upstream already changed `config/theme.css` in `5199cd3` ("improve design"), and
`config/site.yml` carries the author's own footer, which every adopter has to replace. Every upstream change to
those files is a merge conflict for a fork, and a person who only clones the repository to run it locally has no way
to keep their changes out of the repository.

The question: how can a person keep their own configuration (local only, in a fork, or in a separate repository)
without it colliding with upstream, while keeping the app static, build-time configured and validated?

## Decision drivers

- **Maintainability**: upstream updates must merge without conflicts for adopters, which means upstream and the
  adopter must never edit the same file.
- **Maintainability**: one simple rule that is easy to document, with no merge semantics to learn.
- **Cost / simplicity**: clone and `npm run dev` must keep working with no copy step, and the public demo must keep
  building unchanged. No new runtime dependency.
- **Correctness**: "Configuration mistakes are shown, not hidden": whatever configuration is resolved is still
  validated by `parseConfig()` and by the tests.
- **Flexibility**: support the configuration living locally only, committed in a fork, or in a separate (private)
  repository.

## Considered options

1. **Keep `config/` and document "resolve the conflicts"**: no change; the cost lands on every adopter at every
   update.
2. **Git tricks (`skip-worktree`, `assume-unchanged`, `.gitattributes merge=ours`)**: per-clone setup; it breaks or
   silently hides upstream changes when upstream edits the file.
3. **Deep merge of the adopter's YAML over the sample** (e.g. categories merged by `key`): upstream sample
   categories leak into the adopter's ladder, removing one needs a deletion syntax, and the rules are hard to explain.
4. **`config.example/` shipped by upstream plus a local `config/` folder that overrides it file by file, with its
   path configurable through an environment variable.**

## Decision outcome

Chosen option: **"`config.example/` plus a local `config/` that overrides it per file"**, because upstream and the
adopter never own the same file, so there is nothing to conflict, and a single "the file in your folder wins" rule
covers every case without merge semantics.

The rules:

- **`config.example/`** is the sample configuration and the defaults. It is owned by upstream and adopters do not
  edit it.
- **The config folder** is the adopter's. Its path comes from **`PROGRESSION_RADAR_CONFIG_DIR`** and defaults to
  **`config`** at the project root. A relative path resolves from the project root; an absolute path (or one
  outside the project, such as `../my-ladder`) is used as-is, so the configuration can live in a separate
  repository.
- **Per-file fallback.** Each file (`categories.yml`, `roles.yml`, `site.yml`, `theme.css`) is taken from the config
  folder if it exists there, and from `config.example/` otherwise. A missing or empty config folder therefore means
  "use the example": clone and run, and the demo, work with no extra step.
- **Whole-file replacement, no merging.** A file in the config folder replaces the example file completely. This
  also applies to `site.yml` (the example footer is not inherited) and to `theme.css` (the base theme lives in
  `src/styles.css`, so the example `theme.css` is only documentation).
- **Images** referenced from `site.yml` (e.g. `logo`) are looked up in the config folder first, then in
  `config.example/`.
- **Upstream git-ignores the config folder** (`config/*`) and tracks only `config/README.md`, which explains how to
  use it. Local changes are never committed by mistake. A fork that deploys from its own repository either commits a
  differently named folder and sets `PROGRESSION_RADAR_CONFIG_DIR` (e.g. in the Netlify UI), or adds its files with
  `git add -f`.
- Resolution happens **at build time** in the Vite plugin (e.g. a virtual module that `src/config.ts` and
  `src/main.tsx` import), so the app stays static with no runtime fetch, and `parseConfig()` remains the only place
  that validates the configuration.

### Consequences

- **Good:** upstream can change the sample, its comments and the demo footer freely; forks pull without conflicts.
  A person can keep a local configuration out of the repository without any git setup. The configuration can live
  in a private repository next to the app. An adopter's CI validates *their* resolved configuration, because the
  shipped-configuration test loads whatever the build resolves.
- **Trade-offs:** with whole-file replacement, an adopter's file does not show new optional fields added to the
  example (their defaults still apply; a new required field is reported by validation, as intended). The env var
  adds a second place where the configuration may come from, so error messages must say which folder each file was
  read from. Creating a new file in the config folder while `vite dev` runs needs a server restart (editing an
  existing one reloads). Folders outside the project must be allowed in Vite's `server.fs.allow` in dev.
- **Follow-ups:**
  - Implement it: rename `config/` to `config.example/`, add `config/README.md` and the `.gitignore` rules, resolve
    files and images in `vite.config.ts`, and include the source folder in validation messages.
  - Keep `config.example/theme.css` comment-only, so no adopter ever needs upstream's rules from it.
  - Update the product decision "Customisation by forking" in `docs/PRODUCT.md`, the "Goals", "Layout", data flow and
    "Customisation without being a library" sections of `docs/ARCHITECTURE.md`, `.claude/rules/frontend-react.md`
    ("Adopters customise `config/` only") and the README ("Configuration", "Keeping your fork up to date",
    "Upgrading").
  - **Migration note for existing forks:** git detects the `config/` → `config.example/` rename and moves a fork's
    own edits into `config.example/`. After pulling, they move their files back to `config/` (or their own folder),
    commit them with `git add -f` or point `PROGRESSION_RADAR_CONFIG_DIR` at them, and restore the example with
    `git checkout upstream/master -- config.example`.
  - Netlify (`netlify.toml`) needs no change: the demo builds from the per-file fallback.

## Update

[ADR 0005](0005-radar-as-a-dependency-of-an-adopter-repository.md) extends this decision, it does not supersede it:
the per-file fallback is unchanged. The **Config folder** (and `PROGRESSION_RADAR_CONFIG_DIR`) now resolves from the
directory a command runs in and `config.example/` from the installed radar. In a fork or a clone both are the same
folder.

## Links

- `docs/PRODUCT.md`: "Customisation by forking" and "Configuration mistakes are shown, not hidden".
- `docs/ARCHITECTURE.md`: "Customisation without being a library".
