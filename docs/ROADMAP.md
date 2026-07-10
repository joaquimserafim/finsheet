# finsheet — Roadmap

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
  consumers can still `require('finsheet')` — this keeps the `exports` map trivial and removes
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

### Epic 3 — Rendering (read-only) — ✅ done (design panel + adversarial verify)
- [x] `<Grid>` skeleton — `table-layout: fixed` + `<colgroup>`
- [x] sticky header (top) + sticky first column (left) + corner z-index (4-tier scale)
- [x] row renderer switching on `kind` (memo'd `GridRow`, `never` guard); subtotal/total styling
- [x] `tabular-nums` + right-align numeric cells; trailing grand total auto-pinned to sticky `<tfoot>`
- [x] `styles.css` with `--fs-*` CSS variables (light default, dark via `prefers-color-scheme` + `[data-theme]`)
- [x] render tests (RTL): structure, per-kind rendering, formatted values, hooks, tfoot pinning, a11y
- **Done when:** renders a real P&L read-only; header + first column stick; numbers align. ✅ (48 tests;
  Vite playground build green. NOTE: live-browser sticky/z-index/theming eyeball is a maintainer step —
  happy-dom has no layout engine, so tests assert the DOM/CSS contract, not computed geometry.)

### Epic 4 — CI & manual v0.1.0 release
- [x] README (install, quickstart, `<Grid>` props, formatters, theming) + `RELEASING.md` (manual publish + GitHub release)
- [x] GitHub Actions CI: `lint` / `typecheck` / `test:coverage` / `build` on Node 24
- [x] CI **install smoke test**: `pnpm pack` → install the tarball into a fresh ESM app → `import` it at runtime + `tsc --noEmit` against it
- [x] coverage: V8 provider, 100% threshold gate (`pnpm test:coverage`)
- [x] release readiness: version `0.1.0` (package.json + `VERSION`), `prepublishOnly` build guard
- [x] manual publish — **published as `finsheet@0.1.0`** (verified installable from npm: import + `styles.css` ship)
- [ ] GitHub release: tag `v0.1.0` + `gh release create` — **run by the maintainer** (if not already)
- **Done when:** package installs + imports cleanly in a fresh app. ✅ **Shipped — `finsheet@0.1.0` live on npm.**

---

## Milestone `v0.2.0` — Editing

### Epic 5 — Single-cell editing + keyboard nav (`view` / `edit`)
*Functionally complete + shipped: Stage 1 pure core `9f0280c`, Stage 2 React layer `c2ca820`, Stage 3 README
`dcf3966`. The one remaining box (browser suite) is **deferred to Epic 8** — every box below is binary.*
- [x] `mode` prop + reducer
- [x] controlled `value` + `onEdit`; editable guard (totals/subtotals not editable)
- [x] active-cell state + roving tabindex
- [x] keyboard: arrows / Enter (commit + down) / Tab (right) / Esc (cancel) / type-to-edit
- [x] local uncontrolled input on active cell; commit on blur/Enter
- [x] interaction tests — happy-dom RTL suite (134 tests, 100% cov)
- [x] README editing docs (Editing section, `mode`/`onEdit` props, keyboard table, examples link)
- [ ] `@vitest/browser` focus/blur suite + strict 1-cell re-render-count → **deferred to Epic 8** (rides with Epic 6 Stage 4)
- **Done when:** keyboard nav + single-cell edit works; one cell re-renders per keystroke. — **met.**

### Epic 6 — Bulk mode (`bulk`) — "the spreadsheet"
*The spreadsheet-in-the-browser surface: range editing + Excel/xlsx interop (the clipboard is TSV).
Full design + resolved founder gates in [docs/epics/epic-6.md](epics/epic-6.md). Broken into **binary,
per-stage deliverables** — each box flips only when its commit lands (never "half-done").*

**Stage 1 — pure core (logic):** ✅ committed `3b0b62e`
- [x] selection model — `selectionRect`/`withinRect`/`cellsInRange`/`reconcileSelection`/`classifyBulkKey`
- [x] clipboard core — TSV parse/serialize + `computeCopy` + `computePastePatches` (atomic, `skipped[]`)
- [x] fill core — `computeFillPatches` (verbatim) + `computeClearPatches`

**Stage 2 — state + store:** ✅ committed
- [x] reducer `anchor` field + `EXTEND`/`SELECT_ALL`/`CLEAR_SELECTION`/`RECONCILE` (`SET_ACTIVE`/`START_EDIT` collapse)
- [x] `editStore` `CELL_SELECTED` + `cellStatus` branch (rect cached, recomputed once per dispatch)
- [x] `GridMode "bulk"` + `BulkEdit` types (exported with `RejectedCell`/`SkippedCell`)

**Stage 3a — selection gestures (keyboard + band):** ✅ committed
- [x] `bulkMode`/`interactive` gate; keydown tries `classifyBulkKey` first → falls through to edit nav
- [x] shift-arrow / shift-click extend · `Cmd/Ctrl+A` select-all · Esc collapse
- [x] reconcile effect → `reconcileSelection`/`sameSelection` (preserve-rect vs collapse)
- [x] `EditableCell` `data-fs-selected` + `--fs-select-bg` band CSS; playground edit/bulk toggle
- [x] happy-dom RTL selection suite (12 tests)

**Stage 3b — clipboard + fill + pointer (writes → `onBulkEdit`):**
- [ ] `onCopy`/`onCut`/`onPaste` over the pure helpers → `onBulkEdit` (editor-guarded — fix 1; empty-suppressed — fix 6)
- [ ] fill (`Cmd/Ctrl+D`/`R`) + Delete-over-range clear → `onBulkEdit`
- [ ] `onPointerDown`/`Move`/`Up` drag-select · `Grid` `onBulkEdit` prop + port bindings
- [ ] happy-dom RTL suite (mocked `clipboardData`/pointer; paste-into-open-editor bails)

**Stage 4 — browser + docs:**
- [ ] `@vitest/browser` real clipboard/pointer suite (also closes Epic 5's deferred browser suite)
- [ ] README bulk-mode section

**Done when:** paste a block from a spreadsheet + fill-down write **editable cells only**; copy round-trips;
non-editable targets skipped + reported; one `onBulkEdit` → one model swap → one undo.

### Epic 7 — Performance hardening
- [ ] memo boundaries (Row / Cell) + stable callbacks
- [ ] colgroup-driven widths (no per-cell inline style objects)
- [ ] bench harness (N rows × M cols; keystroke re-render count)
- [ ] virtualization decision — threshold + optional `@tanstack/react-virtual`, or defer
- **Done when:** documented perf profile; keystroke = 1 cell re-render.

### Epic 8 — Docs & v0.2.0 release
- [ ] editing + bulk usage docs
- [ ] **visual polish pass** — level the default theme to the Simo design-system caliber (hairline rules, spacing, tabular figures, refined light/dark)
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
