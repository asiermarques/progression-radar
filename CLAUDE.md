# Progression Radar

Static React + TypeScript (Vite) app that draws a person's career levels on a radar and compares them with a role.
No backend: content comes from `config.example/` and the adopter's `config/` folder at build time and the person's state lives in the URL.

## Read first

- `docs/PRODUCT.md`: what it does and the product decisions.
- `docs/ARCHITECTURE.md`: code layout, data flow and key decisions.
- `docs/DESIGN.md`: design system, before touching UI.
- `docs/guides/`: user guides (getting started, configuration, categories, roles, styles, share link, snapshots,
  deployment, upgrading). Keep the matching guide up to date when behaviour changes; the README only lists and links.
- `docs/adr/`: accepted decisions; do not contradict them.

## Rules

- `config.example/` is the upstream sample and `config/` (or `PROGRESSION_RADAR_CONFIG_DIR`) belongs to adopters and is
  git-ignored: each file is read from the adopter's folder if it is there, else from the example. `src/` must work with
  any valid config: never hard-code category or role keys.
- No new runtime dependencies without asking.
- **Versioning** ([ADR 0005](docs/adr/0005-radar-as-a-dependency-of-an-adopter-repository.md)): the radar is published to
  npm and `version` in `package.json` is the published one. Until 1.0.0 is on npm (`npm view progression-radar
  versions`), changes go into 1.0.0 with no bump. After that, every change that reaches adopters bumps `version` in the
  same change, by semver on the public contract (the commands and npm script names, the Configuration files, the
  Share link format and the snapshot format; `src/` is not part of it): **major** when it breaks the contract (and
  `docs/guides/upgrading.md` says what to do), **minor** for new behaviour that keeps it, **patch** for fixes. Say
  which bump a change needs, and why, when you finish it.
- Do not reference user stories, requisite ids or issue numbers (`US-001`, `#25`, `FR-003`…) in code, comments, tests,
  `docs/`, the README or commit messages. Describe the behaviour itself; only the ADRs (`docs/adr/`) may be cited.
  Those references belong to `.workflow/` and the issue tracker.

## Commands

- `npm run dev`: dev server.
- `npm test -- --run` and `npm run build`: run both before finishing (same as CI).
