---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "index.html"
---

# Frontend: React and TypeScript

Read `docs/ARCHITECTURE.md` and `docs/PRODUCT.md` before structural changes, and check `docs/adr/` so a change does
not contradict an accepted decision.

## Boundaries

- `src/model.ts` holds domain types and pure functions only: no React, no browser APIs.
- `src/config.ts` is the only place that turns the resolved configuration (typed `unknown`) into domain types. Every
  new config option is validated there and reported as a problem that names its file and folder, never trusted. Which
  folder each file comes from is decided at build time in `vite.config.ts`, not in `src/`.
- `src/urlState.ts` is the only place that reads or writes the share link format. Components never touch
  `location.search`, `location.hash` or `history` directly.
- `App` owns the `Person` and the selected Category. Components get data and callbacks as props and keep only UI
  state of their own (e.g. scroll position effects). No context, store, reducer or router.
- `src/` must work with any valid configuration: never hard-code Category or Role keys (`comm`, `front`…) or rely on
  the content of `config.example/`. Adopters customise their own `config/` folder only; `config.example/` is upstream's.

## Dependencies

- Do not add runtime dependencies without asking first. The goal is "Minimal": no chart, state, router, CSS-in-JS,
  UI kit or utility libraries. The radar stays hand-written SVG.
- Fonts are self-hosted Fontsource Latin subsets imported in `src/main.tsx`; no third-party requests at runtime.

## TypeScript

- `strict`, `noUnusedLocals`, `noUnusedParameters` and `verbatimModuleSyntax` are on: use `import { type X }` for
  types, no `any`, no non-null assertions unless the value is guaranteed (e.g. `document.getElementById("root")!`).
- Use the domain types from `model.ts` (`Person`, `Category`, `Role`, `Levels`, `KPI`) instead of redefining shapes.
- Style: double quotes, semicolons, 2-space indent, lines up to ~120 characters, as in the existing files.

## Components

- One component per file in `src/components/`, default export, props typed as `interface Props`.
- The root element has a stable, kebab-case class name (`category-panel`, `share-button`). Class names listed in the
  README ("Styles") are a public contract for the adopters' `theme.css`: do not rename or remove them; document new ones
  meant for theming.
- Express state with ARIA and data attributes (`aria-pressed`, `aria-current`, `data-status`) before adding classes;
  pass dynamic values to CSS as custom properties (`style={{ "--level-count": n }}`), not as inline colours or sizes.
- Render Markdown only with `react-markdown` (raw HTML stays disabled). Never use `dangerouslySetInnerHTML`.
- UI copy is English, sentence case, with singular/plural handled (`1 level` / `2 levels`).

## Accessibility and motion

- Every control is a real element (`<button type="button">`, `<select>`, `<input>` with a label or `aria-label`).
- Decorative elements get `aria-hidden="true"`; text needed only by screen readers uses `.visually-hidden`.
- Status messages that change use `aria-live="polite"` or `role="status"`; blocking errors use `role="alert"`.
- The radar is a pointer shortcut only: anything it does must also be possible from an accessible control.
- Animations live in CSS. JavaScript-driven motion (e.g. `scrollIntoView`) checks `prefers-reduced-motion`.
- Call optional browser APIs defensively (`scrollTo?.()`, `matchMedia?.()`) so happy-dom and old browsers do not
  break, and wrap `history` writes in `try/catch`: browsers throw when they are called too often.

## Tests and checks

- Tests live next to the code (`*.test.ts(x)`), with Vitest and Testing Library on happy-dom.
- Build configs inline with `parseConfig({...})` instead of reading `config/` or `config.example/`; only
  `config.test.ts` checks the resolved configuration and `config.example/` on its own.
- Query by role, label or visible text (`getByRole("button", { name: "Level 2" })`); use class selectors only to
  disambiguate. Stub browser APIs with `vi.stubGlobal` and restore them in `afterEach`.
- Before finishing, run `npm test -- --run` and `npm run build` (type-check + build), the same steps as CI.

## Docs

- New file or responsibility: update "Layout" (and "Extending" if it adds a new pattern) in `docs/ARCHITECTURE.md`.
- New config option, share link field or themable class name: update the README.
