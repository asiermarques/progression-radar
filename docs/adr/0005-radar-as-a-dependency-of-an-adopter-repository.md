---
title: The radar as a dependency of an adopter repository
status: Proposed
date: 2026-11-07
tags: [maintainability, tooling, config]
---

# 0005. The radar as a dependency of an adopter repository

## Context and problem statement

Today an **Adopter** forks or clones this repository and keeps their **Configuration** in the **Config folder**, which
can also live in a separate repository through `PROGRESSION_RADAR_CONFIG_DIR`
([ADR 0002](0002-config-example-with-local-config-override.md)). Updates arrive by merging upstream into the fork.

With snapshots ([ADR 0004](0004-local-csv-snapshots-outside-the-app.md)) the adopter's valuable asset is no longer
only the **Ladder** but also the history of **Persons**: personal data that should not sit next to upstream's code. The
adopter then has to coordinate up to three repositories (the code fork, the configuration and the snapshots) with
environment variables. The preferred shape is a repository the adopter owns that holds only their configuration and
snapshots, and uses the radar as a dependency.

This conflicts with a documented non-goal: "Being an npm package or library that other projects depend on and
override (removed in 1.0)" (`docs/PRODUCT.md`). What 1.0 removed was a **library**: other projects imported its
components and overrode pieces through a Babel `lib/` build (`docs/ARCHITECTURE.md`, "Customisation without being a
library"). What is proposed here is a **tool**: the adopter's repository imports nothing from `src/` and overrides no
code. It runs the radar's commands against its own folders. The question is whether to adopt that model, and how,
without bringing back the problems the library had.

## Decision drivers

- **Maintainability:** an upgrade should be a version bump, not a merge. Upstream and the adopter never edit the same
  file (the promise of ADR 0002), now with no fork at all.
- **Security / privacy:** **Persons**' data lives in a repository that contains only the adopter's data, with the
  access rules the adopter chooses.
- **Cost / simplicity:** one repository per adopter, with a short `package.json`, its folders and a CI that runs
  build and validation. No new runtime dependency in the app.
- **Compatibility:** the **Share link** format, the **Configuration** files and the snapshot format do not change
  (ADR 0001, 0002, 0003, 0004). Forks keep working, and deep changes to `src/` still mean forking.
- **Distribution of skills:** the skills that govern the scripts (ADR 0004) should reach the adopter's repository with
  the dependency and be updated with it.

## Considered options

1. **Keep fork or clone, with separate data repositories through environment variables** (today, ADR 0002). It
   already works, but means up to three repositories, upgrades by merge and setup for each one.
2. **The radar as a git submodule** of the adopter repository. No packaging needed, but submodules are awkward for
   non-developers and still need the adopter to run the radar's own scripts from inside it.
3. **The radar as a tool dependency** (npm package or git dependency) that exposes commands: dev server, build,
   snapshot scripts and the **Configuration** checks. It ships the skills. The adopter repository has `config/`,
   `snapshots/` and a `package.json`.
4. **The radar as a library again** (import components, override pieces). This is what 1.0 removed: a public API to
   keep stable and an override model that is hard to explain.

## Decision outcome

Proposed option: **"The radar as a tool dependency"** (option 3), because it is the only one in which the adopter owns
one repository with only their data and upgrades by changing a version. And it keeps what made 1.0 drop the library:
nothing in `src/` becomes a public API, and customisation stays the **Configuration**, `theme.css` and, for deeper
changes, a fork.

Proposed shape:

- The adopter repository holds `config/` (same files and rules as the **Config folder**, ADR 0002 and 0003),
  `snapshots/` (ADR 0004) and a `package.json` that depends on the radar.
- The radar exposes commands that run from the adopter repository: dev server, production build (static files, as
  today), snapshot scripts and validation. Paths resolve from the adopter repository, and `config.example/` stays the
  fallback inside the dependency.
- The public contract is the set of commands, the **Configuration** files, the **Share link** format and the snapshot
  format, versioned with semver. `src/` is not a contract.
- The skills ship inside the dependency and are made available to the adopter repository.
- Forking stays supported for adopters who change `src/`.

Still open before this can be accepted:

- **Distribution:** npm registry, git dependency or a template repository that pins one of them.
- **Running Vite from a dependency:** the app is built with Vite plugins that resolve the **Config folder** (ADR 0002);
  it must work with the project root in the adopter repository, including dev-server file access and reloads outside
  the package.
- **Skills:** how they reach the adopter repository (copied on install, a plugin or marketplace, or referenced from
  the dependency) and how they are updated.
- **Migration:** how a fork or a clone with `PROGRESSION_RADAR_CONFIG_DIR` moves to an adopter repository, in the spirit
  of `npm run config:migrate`.
- **Product wording:** the non-goal has to be rewritten, not removed, to say that the radar is not a component library
  and that a tool dependency is supported.

### Consequences

- **Good:** one repository per adopter, with only their **Ladder** and snapshots. Upgrades by version, without merges
  or conflicts. People data is fully separated from upstream's code. The skills are updated together with the scripts
  they govern.
- **Trade-offs:** upstream takes on a release process and a versioned public contract (commands and formats). Packaging
  a Vite app as a runnable tool is more complex than a fork. Two supported topologies (dependency and fork) to
  document and test. The `docs/PRODUCT.md` non-goal changes meaning.
- **Follow-ups:**
  - Resolve the open points above and update this ADR to Accepted, or reject it.
  - When accepted: say in ADR 0002 that "project root" means the adopter repository in this model (ADR 0002 is
    extended, not superseded: the per-file fallback is unchanged), rewrite the non-goal in `docs/PRODUCT.md`, and
    update `docs/ARCHITECTURE.md` ("Goals", "Layout", "Customisation without being a library") and the README
    ("Configuration", "Upgrading").
  - Until then, ADR 0004 works with the current topology, and its snapshots folder can already live in a separate
    repository through its environment variable.

## Links

- [ADR 0002](0002-config-example-with-local-config-override.md): the **Config folder** and per-file fallback this model
  keeps.
- [ADR 0004](0004-local-csv-snapshots-outside-the-app.md): the snapshots and skills that motivate an adopter repository.
- `docs/PRODUCT.md`: non-goal "Being an npm package or library…"; `docs/ARCHITECTURE.md`: "Customisation without being
  a library".
