# columnar — Roadmap

A headless-leaning React grid for **financial statements**: sticky headers, tabular
numerics, subtotal/total rows, and three edit modes — without the row-model abstraction
tax of a general table library.

## Design principles

These are the decisions that keep us off the "abstraction tax" path. Revisit deliberately.

- **Rows are a discriminated union, not `T[]`.** `section | line | subtotal | total | spacer`.
  Subtotals/totals are first-class row kinds, not a config flag. Rendering is a `switch` on
  `kind`. This is the thing a general table library makes awkward.
- **Semantic `<table>` + CSS for sticky.** Real `<thead>/<tbody>/<tfoot>`, `table-layout: fixed`
  with a `<colgroup>`. Sticky = `position: sticky`, never scroll listeners.
- **Formatting is pure functions**, fully decoupled from the grid. `tabular-nums` + right-align
  is the CSS that makes numbers line up.
- **Controlled component.** Consumers own the data; the grid emits `onEdit`. Edit state for the
  active cell stays local so a keystroke re-renders one cell, not the grid.
- **Plain CSS + CSS custom properties** for theming (light/dark). No Tailwind dependency, no
  CSS-in-JS runtime. Ship one stylesheet.
- **ESM-only.** No CJS output. The Node 24 floor means `require(esm)` works, so CommonJS
  consumers can still `require('columnar')` — this keeps the `exports` map trivial and removes
  the entire dual-format interop failure class.
- **`react` / `react-dom` are peer deps.** Never bundled.

## Edit modes (Epic 5–6)

- `view` — read-only.
- `edit` — click / type to edit a single cell; Excel-like keyboard nav.
- `bulk` — range-select for paste and fill-down (spreadsheet-style).

## Non-goals (v1)

- No sorting / filtering / grouping pipeline (statements are authored structure, not aggregated
  data).
- No column reordering/resizing UI.
- No CJS build (ESM-only — see Design principles).
- Virtualization deferred — decided in Epic 7 based on measured need.

## Tooling & release

- **Runtime baseline: Node 24+** — `engines.node: ">=24"`, enforced locally via `.npmrc`
  `engine-strict=true`. Build `target: ES2024`; no down-leveling for older runtimes.
- **pnpm** package manager · **Biome** (tabs, width 4) lint+format · **Vitest** + happy-dom ·
  **tsup** build (**ESM-only** + `.d.ts`).
- **husky** for git hooks: `pre-commit` runs `biome check --staged` + `tsc --noEmit`. Biome's
  native `--staged` means no `lint-staged` needed.
- **GitHub Actions** for CI: full `lint` / `typecheck` / `test` / `build` on Node 24, plus an
  **install smoke test** that packs the tarball and imports it from a fixture.
- **Publishing is manual** — the maintainer runs `pnpm publish`. No automated release workflow,
  no npm provenance (see Deferred decisions).

---

## Milestone `v0.1.0` — Read-only grid, published to npm

Proves the render surface **and** the publish path on low-risk ground.

### Epic 0 — Repo foundation & tooling — ✅ done (`182c643`)
- [x] `package.json` metadata (description, `license: MIT`, `version: 0.0.0`, `contributors`, `repository`, keywords)
- [x] `engines.node: ">=24"` + `.nvmrc` (`24`) + `.npmrc` (`engine-strict=true`)
- [x] `exports` map (ESM-only: `import` + `types`, no `main`/`require`) + `files` + `sideEffects` (`["**/*.css"]`) + `peerDependencies` + `publishConfig`
- [x] `tsconfig.json` (strict, `moduleResolution: Bundler`, `jsx: react-jsx`, `target: ES2024`)
- [x] `biome.json` (tabs, width 4, recommended rules, organize imports)
- [x] `tsup.config.ts` (**esm only**, dts, external react/react-dom)
- [x] `vitest.config.ts` (happy-dom, globals, setup file)
- [x] husky: `prepare` script + `pre-commit` hook (`biome check --staged` + `tsc --noEmit`)
- [x] scripts: `build` / `test` / `lint` / `format` / `typecheck` / `prepare`
- [x] `.gitignore` (incl. `progress.md`), `LICENSE` (MIT), README skeleton, `playground/` Vite dev app
- **Done when:** `pnpm build && pnpm test && pnpm lint && pnpm typecheck` all green on an empty stub, and a bad commit is blocked by the pre-commit hook. ✅

### Epic 1 — Core data model — ✅ done (design panel + adversarial verify)
- [x] `Column` type (id, header, numeric, align, sticky, editable, width)
- [x] `Row` discriminated union (`section` / `line` / `subtotal` / `total` / `spacer`) via a private base chain; `RowKind`
- [x] `CellValue` / `CellValues`; `GridModel { readonly columns; readonly rows }`
- [x] editability model (row-level + column-level `editable`, opt-out; subtotals/totals never editable)
- [x] public API types exported from `src/index.ts`; typed sample P&L + balance sheet as a compile-time guard (`src/types.test.ts`)
- **Done when:** types compile and are exported. ✅ (`typecheck` + `.d.ts` build + tests green)

### Epic 2 — Formatting (pure functions) — ✅ done
- [x] `formatAccounting` (negatives in parens, thousands sep, `null` → placeholder)
- [x] scaling option (units / thousands / millions)
- [x] currency + percent variants
- [x] unit tests (0, negative, null, decimals, huge)
- **Done when:** formatters fully covered, zero DOM. ✅ (23 tests green; `.d.ts` build clean)

### Epic 3 — Rendering (read-only)
- [ ] `<Grid>` skeleton — `table-layout: fixed` + `<colgroup>`
- [ ] sticky header (top) + sticky first column (left) + corner z-index
- [ ] row renderer switching on `kind`; subtotal/total styling
- [ ] `tabular-nums` + right-align numeric cells; grand total in sticky `<tfoot>`
- [ ] `styles.css` with CSS variables (light/dark)
- [ ] render tests (RTL): structure, sticky, formatted values
- **Done when:** renders a real P&L read-only; header + first column stick; numbers align.

### Epic 4 — CI & manual v0.1.0 release
- [ ] README (install, quickstart, API, theming) + `RELEASING.md` (manual publish steps)
- [ ] GitHub Actions CI: `lint` / `typecheck` / `test` / `build` on Node 24
- [ ] CI **install smoke test**: `pnpm pack` → install the tarball into an ESM fixture → `import` it at runtime + `tsc --noEmit` against it
- [ ] manual publish: `pnpm build && pnpm publish --access public` (run by maintainer)
- **Done when:** package installs + imports cleanly in a fresh app.

---

## Milestone `v0.2.0` — Editing

### Epic 5 — Single-cell editing + keyboard nav (`view` / `edit`)
- [ ] `mode` prop + reducer
- [ ] controlled `value` + `onEdit`; editable guard (totals/subtotals not editable)
- [ ] active-cell state + roving tabindex
- [ ] keyboard: arrows / Enter (commit + down) / Tab (right) / Esc (cancel) / type-to-edit
- [ ] local uncontrolled input on active cell; commit on blur/Enter
- [ ] interaction tests (user-event; consider `@vitest/browser`)
- **Done when:** keyboard nav + single-cell edit works; one cell re-renders per keystroke.

### Epic 6 — Bulk mode (`bulk`)
- [ ] range-selection model (anchor + focus, shift/drag)
- [ ] clipboard paste (parse TSV into the range)
- [ ] fill-down / fill-right
- [ ] respect editable guard across a range
- [ ] interaction tests
- **Done when:** paste a block and fill-down work against editable cells only.

### Epic 7 — Performance hardening
- [ ] memo boundaries (Row / Cell) + stable callbacks
- [ ] colgroup-driven widths (no per-cell inline style objects)
- [ ] bench harness (N rows × M cols; keystroke re-render count)
- [ ] virtualization decision — threshold + optional `@tanstack/react-virtual`, or defer
- **Done when:** documented perf profile; keystroke = 1 cell re-render.

### Epic 8 — Docs & v0.2.0 release
- [ ] editing + bulk usage docs
- [ ] manual publish `v0.2.0`

---

## Deferred decisions

- **Virtualization** — evaluate in Epic 7. Under ~100–150 rows, native scroll + sticky is
  faster and simpler. If needed: `@tanstack/react-virtual`, with pinned total rows kept outside
  the windowed body (sticky `<tfoot>`).
- **Releases are manual** (`pnpm version` + `pnpm publish`), run by the maintainer. No
  auto-publish workflow. Changesets deferred until contributor volume justifies it.
- **npm provenance** — deferred. Provenance requires publishing from CI via OIDC; a manual local
  `pnpm publish` can't attach it. Revisit with a `workflow_dispatch` publish job if the
  provenance badge becomes worthwhile.
- **No `publint` / `@arethetypeswrong/cli`.** ESM-only makes the `exports` map trivial, and the
  Epic 4 install smoke test exercises the real packed tarball end-to-end — so package-shape and
  type-resolution are covered by actually installing it, not by a static linter.

Data-model widenings surfaced by the Epic 1 design panel (all **non-breaking**, add when the
consuming epic needs them — not speculatively now):

- **Grouped / multi-level column headers** — `Column.header` is flat, so an actual/budget/variance
  P&L can't band value columns under a period super-header. Add optional `group?: string` when the
  Epic 3 renderer supports spanning `<thead>` cells.
- **Text / note columns** — cells are numeric-only (`CellValue = number | null`), so a
  published-format "Note" reference column isn't expressible. Add optional `note?: string` on rows,
  or widen non-numeric columns, if needed later.
- **Per-column format / unit hints** (percent vs currency, scale, precision) — deferred to Epic 2
  formatters; add `format?` / `precision?` on `Column` then.
- **Per-cell editability** — current rule is `line.editable && column.editable` (AND of two flags);
  it can't express one line where `actual` is editable but `budget` isn't. Out of scope for authored
  statements.
- **Value/column key safety** — `values` is keyed by unconstrained `string`, so a typo'd column key
  renders blank rather than erroring. A generic `GridModel<C>` could tie keys to declared column ids
  but fights the minimal/ergonomic goal; prefer a dev-mode runtime validator instead.
