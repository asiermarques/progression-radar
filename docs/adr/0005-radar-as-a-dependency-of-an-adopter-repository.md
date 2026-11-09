---
title: The radar as a dependency of an adopter repository
status: Accepted
date: 2026-11-09
tags: [maintainability, tooling, config, security]
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
library"). What is decided here is a **tool**: the adopter's repository imports nothing from `src/` and overrides no
code. It runs the radar's commands against its own folders. The question is whether to adopt that model, and how,
without bringing back the problems the library had.

Today every configuration path is resolved from Vite's `root` (`vite.config.ts`, `resolveConfigSources(resolved.root,
…)` in `scripts/config-sources.ts`), while the snapshot commands already resolve the snapshots folder from the
directory they run in (`process.cwd()` in `scripts/snapshot.mjs`). Installed as a dependency, Vite's `root` is inside
`node_modules/progression-radar`, so the adopter's `config/` would not be found. The build also succeeds with an
invalid **Configuration**: `src/main.tsx` renders the error screen at run time, and only `src/config.test.ts` catches
it in upstream's CI, a test an adopter repository does not have.

## Decision drivers

- **Maintainability:** an upgrade should be a version bump, not a merge. Upstream and the adopter never edit the same
  file (the promise of ADR 0002), now with no fork at all. One code path serves both topologies.
- **Security / privacy:** **Persons**' data lives in a repository that contains only the adopter's data, with the
  access rules the adopter chooses. The code that reads that data and the skills that drive it are verifiable and
  change through reviewable diffs.
- **Cost / simplicity:** one repository per adopter, with a short `package.json`, its folders and a CI that runs
  validation and build. No new runtime dependency in the app.
- **Compatibility:** the **Share link** format, the **Configuration** files and the snapshot format do not change
  (ADR 0001, 0002, 0003, 0004). Forks keep working unchanged, and deep changes to `src/` still mean forking.
- **Distribution of skills:** the skills that govern the scripts (ADR 0004) reach the adopter's repository with the
  dependency and are updated with it.

## Considered options

1. **Keep fork or clone, with separate data repositories through environment variables** (today, ADR 0002). It
   already works, but means up to three repositories, upgrades by merge and setup for each one.
2. **The radar as a git submodule** of the adopter repository. No packaging needed, but submodules are awkward for
   non-developers and still need the adopter to run the radar's own scripts from inside it.
3. **The radar as a tool dependency** that exposes commands: dev server, build, snapshot scripts and the
   **Configuration** checks. It ships the skills. The adopter repository has `config/`, `snapshots/` and a
   `package.json`.
4. **The radar as a library again** (import components, override pieces). This is what 1.0 removed: a public API to
   keep stable and an override model that is hard to explain.

For distribution within option 3:

- **npm registry** (chosen): semver ranges, `npm outdated`, Dependabot and Renovate work out of the box, installs are
  tarball downloads, and provenance ties each version to a commit of this repository.
- **Git dependency** (`github:<org>/progression-radar#<tag>`): no registry, but every install clones, updates are less
  visible to tooling and there is no provenance. It keeps working with no extra support, because the package ships
  sources.

## Decision outcome

Chosen option: **"The radar as a tool dependency"** (option 3), **distributed through the npm registry**, because it
is the only option in which the adopter owns one repository with only their data and upgrades by changing a version.
It keeps what made 1.0 drop the library: nothing in `src/` becomes a public API, and customisation stays the
**Configuration**, `theme.css` and, for deeper changes, a fork.

### Two roots, one rule for both topologies

The code distinguishes two roots:

| root                  | holds                                              | in a fork or clone   | as a dependency                 |
|-----------------------|----------------------------------------------------|----------------------|---------------------------------|
| **package root**      | `index.html`, `src/`, `public/`, `config.example/` | the repository root  | `node_modules/progression-radar` |
| **working directory** | `config/`, `snapshots/`, `dist/`                   | the repository root  | the adopter repository root     |

- The **Config folder** (`config/` or `PROGRESSION_RADAR_CONFIG_DIR`), the snapshots folder (`snapshots/` or
  `PROGRESSION_RADAR_SNAPSHOTS_DIR`) and the build output resolve from the working directory. `config.example/` is
  resolved from the package root. Relative values of the environment variables resolve from the working directory.
- In a fork or clone both roots are the same folder, so behaviour is exactly today's. The same repository is used
  directly and as a dependency with no change.
- Vite's `root` stays the package root: the adopter repository has no `index.html` and no `src/`.
- Messages keep naming folders as today (`config/roles.yml`, `config.example/roles.yml`); absolute paths still never
  reach the bundle.

### Commands

- The package has a `progression-radar` binary with `dev`, `build`, `preview`, `check`, `snapshot record|link|check`,
  `init` and `skills`. It drives Vite through its JavaScript API (`createServer`, `build`, `preview`) with the
  package's `vite.config.ts`, `root` at the package root, `build.outDir` in the working directory (with
  `emptyOutDir: true`, since it is outside `root`) and `cacheDir` in the working directory (a package installed by
  pnpm can sit in a read-only store).
- Upstream's own npm scripts call the same binary, so upstream's CI and daily use exercise the path adopters use.
- The adopter repository keeps the npm script names a fork has (`dev`, `build`, `check`, `snapshot:record`,
  `snapshot:link`, `snapshot:check`), each calling the binary. The guides and the skills are the same in both
  topologies.
- `check` validates the **Configuration** with `loadConfig()` and runs the snapshot check. `build` fails when the
  **Configuration** is invalid, so an adopter's CI (`npm ci && npm run check && npm run build`) never deploys an error
  screen.
- The build of the tool does not type-check: `tsc` stays in upstream's CI and adopters do not need TypeScript.
- Every TypeScript file is loaded through Vite (`runnerImport`, the config loader), never through Node's own type
  stripping, which does not work inside `node_modules`.

### Package

- The package ships sources, not a built bundle, because the **Configuration** is compiled into the bundle at build
  time. `files` lists `src/`, `scripts/`, `config.example/`, `public/`, `index.html`, `vite.config.ts` and the skills;
  the publisher's `config/` and `snapshots/` are never included.
- The build-time tools the commands need (`vite`, `@vitejs/plugin-react`, `yaml`, `mdast-util-from-markdown`) move
  from `devDependencies` to `dependencies`. They are not new dependencies and none of them reaches the bundle.
- No install scripts (`postinstall`, `prepare`).
- The public contract, versioned with semver, is the commands and npm script names, the **Configuration** files, the
  **Share link** format and the snapshot format. `src/` is not a contract.

### Distribution and releases

- Published to npm as `progression-radar` from 1.x on. The name already belongs to the project: versions 0.1.0 to
  0.2.8 are the old library. A `^0.2.x` range never resolves to 1.x, and the 0.x versions are deprecated with a message
  that points to the guide. The repository drops `"private": true` and its version matches the published one.
- A GitHub Actions workflow publishes on a `vX.Y.Z` tag, after the tests, the build and the packaging test, with
  provenance and trusted publishing (OIDC) instead of a stored token. Each release has a changelog entry.
- Git dependencies keep working with no extra support. They are the path for forks that change `src/` and want their
  data in a separate repository (`github:<org>/progression-radar#<tag>`).

### Skills

- `progression-radar skills` copies the skills shipped in the package to the adopter repository's `.claude/skills/`,
  replacing the previous copy (upstream owns those files), and `init` runs it. The adopter commits them, so an update to
  a skill that handles personal data arrives as a reviewable diff.
- `check` warns when the copied skills are older than the installed package.
- Rejected: copying on install (needs an install script, which pnpm blocks by default and is a supply-chain risk), a
  plugin or marketplace (its version drifts from the scripts it drives) and referencing them inside `node_modules`
  (not loaded from there, and changes would be invisible).

### Migration

- A clone that already keeps its configuration in a separate repository through `PROGRESSION_RADAR_CONFIG_DIR`: that
  repository becomes the adopter repository by adding the `package.json` (or running `npx progression-radar init`)
  and, if wanted, its `snapshots/`.
- A fork: create the adopter repository with `npx progression-radar init` and copy `config/` and `snapshots/` into it.
  A guide is enough; no migration command is needed.
- Forks that change `src/` stay as they are, or use their fork as a git dependency.

### Testing both topologies

A CI job packs the package (`npm pack`), installs it in a fixture adopter repository with a minimal `config/` and
runs `check` and `build` with npm and with pnpm. The existing jobs cover the fork topology.

### Consequences

- **Good:** one repository per adopter, with only their **Ladder** and snapshots. Upgrades by version, without merges
  or conflicts. People data is fully separated from upstream's code. The skills are updated together with the scripts
  they govern, through reviewable diffs. The same repository serves forks, clones and dependents, and an invalid
  **Configuration** now fails the build in every topology.
- **Trade-offs:** upstream takes on a release process, an npm account with 2FA and trusted publishing, and a versioned
  public contract (commands, script names and formats). Packaging a Vite app as a runnable tool is more complex than a
  fork. Two topologies to document and test. Build-time tools become dependencies of the package, so adopters install
  them. The `docs/PRODUCT.md` non-goal changes meaning.
- **Follow-ups:**
  - Implement the two roots in `scripts/config-sources.ts`, `vite.config.ts` and the snapshot and conversion scripts,
    the `progression-radar` binary, the failing build on an invalid **Configuration**, `files`, the dependency moves,
    the packaging CI job and the release workflow.
  - ADR 0002 is extended, not superseded: the **Config folder** resolves from the working directory and
    `config.example/` from the package root; the per-file fallback is unchanged. Say so in ADR 0002.
  - Rewrite the non-goal in `docs/PRODUCT.md` (the radar is not a component library: nothing in `src/` is imported or
    overridden; it is used as a tool dependency or as a fork), update `docs/ARCHITECTURE.md` ("Goals", "Layout",
    "Snapshots outside the browser", "Customisation without being a library"), add the adopter repository to
    `docs/UBIQUITOUS_LANGUAGE.md` (and widen **Adopter**), update the guides (getting started, configuration,
    deployment, upgrading, snapshots) and the README.
  - Deprecate the 0.x versions on npm when 1.x is published.

## Links

- [ADR 0002](0002-config-example-with-local-config-override.md): the **Config folder** and per-file fallback this model
  keeps.
- [ADR 0004](0004-local-csv-snapshots-outside-the-app.md): the snapshots and skills that motivate an adopter repository.
- `docs/PRODUCT.md`: non-goal "Being an npm package or library…"; `docs/ARCHITECTURE.md`: "Customisation without being
  a library".
