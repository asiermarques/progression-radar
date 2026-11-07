# Progression Radar

Static React + TypeScript (Vite) app that draws a person's career levels on a radar and compares them with a role.
No backend: content comes from `config/*.yml` at build time and the person's state lives in the URL.

## Read first

- `docs/PRODUCT.md`: what it does and the product decisions.
- `docs/ARCHITECTURE.md`: code layout, data flow and key decisions.
- `docs/DESIGN.md`: design system, before touching UI.
- `docs/adr/`: accepted decisions; do not contradict them.

## Rules

- `config/` belongs to adopters and `src/` must work with any valid config: never hard-code category or role keys.
- No new runtime dependencies without asking.

## Commands

- `npm run dev`: dev server.
- `npm test -- --run` and `npm run build`: run both before finishing (same as CI).
