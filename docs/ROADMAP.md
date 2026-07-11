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
- [x] `@vitest/browser` focus/blur suite + re-render-count → **delivered in Epic 6 Stage 4b** (`src/Grid.browser.test.tsx`)
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

**Stage 3b — clipboard + fill + pointer (writes → `onBulkEdit`):** ✅ committed
- [x] `onCopy`/`onCut`/`onPaste` over the pure helpers → `onBulkEdit` (editor-guarded; empty-suppressed)
- [x] fill (`Cmd/Ctrl+D`/`R`) + Delete-over-range clear → `onBulkEdit` (single-cell Delete still `onEdit`)
- [x] `onPointerDown`/`Move`/`Up` drag-select (+ `[data-fs-dragging]` user-select guard) · `Grid` `onBulkEdit` prop + port bindings
- [x] `EditableCell` reveal shares `rawCellText` (duplicate killed); playground applies bulk ops
- [x] happy-dom RTL suite (mocked `clipboardData`/pointer; paste-into-open-editor bails) — 219 tests, 100% cov

**Stage 4a — docs:** ✅ committed
- [x] README bulk-mode section (`mode`/`onBulkEdit`/`BulkEdit`, keyboard table, TSV/raw-units + editable-guard notes)
- [x] `examples/bulk-statement.tsx` (typecheck-verified in CI) + examples index row

**Stage 4b — browser suite (fidelity):** ✅ committed
- [x] `@vitest/browser` (real Chromium via Playwright, separate config + CI job — unit gate untouched): real DOM focus receipt, the trailing-blur **double-commit guard asserted live** (the one `CellEditor` v8-ignore), **OS clipboard copy→paste round-trip**, and `<Grid>`-never-re-renders render counts. 5 tests. **Also closes Epic 5's deferred focus/blur + re-render-count suite.**
- Deliberately unscoped: browser pointer-drag (no real drag-select primitive in userEvent; stays happy-dom-covered) and `Cmd+R/D` preventDefault (asserted at the unit level; a real reload/bookmark can't be observed in-harness). The v8-ignore **stays** — browser coverage can't merge into the happy-dom gate.

**Done when:** paste a block from a spreadsheet + fill-down write **editable cells only**; copy round-trips;
non-editable targets skipped + reported; one `onBulkEdit` → one model swap → one undo.

### Epic 7 — Performance hardening
*Measure-first: the re-render engineering was already built in Epics 3/5/6 (Grid never re-renders
on an edit — only 1–2 cells do), so Epic 7 pins that invariant and records ONE decision. Full
scope + resolved gates in [docs/epics/epic-7.md](epics/epic-7.md), scoped via a 4-lens design
panel (both adversarial verifiers HOLD).*

**Stage 1 — Baseline audit (already met):**
- [x] `GridRow` / `EditableCell` memo + stable callbacks (`formatValue` primitive-keyed; controller memoized)
- [x] colgroup-driven widths — no per-cell inline style objects **on value cells** (the label `<th>` keeps an intentional `--fs-depth` CSS-var for arbitrary-depth `calc()` indentation)
- [x] `GridCell` deliberately non-memo'd (off the keystroke path); per-cell `useSyncExternalStore` seam re-renders only changed cells, never `Grid`

**Stage 2 — Measure:** ✅ committed
- [x] store `cellStatus`-delta assertions + a happy-dom `Grid` render-count guard — in-gate proof of the exact per-gesture counts (move=2 · open=1 · keystroke=0 · commit=2 · Grid=0), incl. a 600-cell move = 2 (O(1) in N)
- [x] N×M `<Profiler>` bench in `bench/` (outside the 100% gate + shipped bundle); `pnpm bench` — mount O(N) (~45/178/447 ms at 50/500/2000 rows), **1 commit/move flat**
- [x] documented perf profile in [epic-7.md](epics/epic-7.md) (per-gesture counts + bench; O(1) cells — 0/1/2 — never O(N), never `Grid`)

**Stage 3 — Decision (founder gate):** ✅ committed
- [x] **DECIDED (2026-07-11): defer** — virtualization does not ship in v0.2.0 (the bench shows editing is already O(1); a windower buys only the O(N) mount column, rare for authored statements; the structure is already virtualization-ready so deferral is reversible). Windower design parked in epic-7.md + Deferred decisions, for a future "on measured need" epic.

**Done when:** documented default-path perf profile (per-gesture re-render counts, `Grid` = 0), proven in-gate + benched O(1) in row count; virtualization gate resolved in writing. — **✅ Epic 7 COMPLETE.**

### Epic 8 — Snapshots, docs truthing & v0.2.0 release
*The last epic of v0.2.0, deliberately **small**. Not a blind CSS polish pass — instead: **capture**
how the grid looks across configs as committed, regenerable screenshots (the visual-QA surface
happy-dom can't give us), **truth up** the docs that still describe v0.1.0, and **cut** the release.
Full scope + resolved gates in [docs/epics/epic-8.md](epics/epic-8.md). Any CSS polish is a reviewed
follow-up once the gallery makes the current look visible.*

**Stage 1 — Snapshot gallery** (reuses the Epic 6 Chromium/`@vitest/browser` stack; no new dep)
- [ ] screenshot harness — `pnpm screenshots` → PNGs to a committed `docs/screenshots/` (not the ignored `__screenshots__/`)
- [ ] config fixtures captured — read-only (light/dark), `edit`, `bulk` selection, balance sheet, thousands-scale, token-override
- [ ] gallery embed — README "Gallery" section (and/or `docs/gallery.md`) referencing every shot

**Stage 2 — Docs truthing (v0.1.0 → v0.2.0)**
- [x] README truthing — status callout → `v0.2.0`, "virtualization follows" → deferred, limitations bullet, present-tense editing
- [ ] examples audit — all five `examples/*.tsx` + index match the shipping API
- [ ] CHANGELOG.md — Keep-a-Changelog with a `0.2.0` entry (+ back-filled `0.1.0`)

**Stage 3 — Release prep (v0.2.0)**
- [ ] version bump `0.1.0 → 0.2.0` — `package.json` + the `VERSION` constant in `src/index.ts`, in sync
- [ ] RELEASING.md v0.2.0 pass — generalize the v0.1.0-hardcoded notes/tag + add v0.2.0 release notes
- [ ] **(maintainer)** green-gate + `pnpm publish` v0.2.0 + tag + `gh release` — the manual act, gated on all above

**Done when:** a committed screenshot gallery across configs (embedded in the README); docs describe the
shipping `edit`/`bulk` surface (virtualization deferred); version `0.2.0` in sync; RELEASING.md covers
v0.2.0; gates green; **`finsheet@0.2.0`** published.

---

## Milestone `v1.0.0` — Comparative statements & API stability

v1.0 is a **stability commitment** as much as a feature set: publishing `1.0.0` tells consumers the
`GridModel` shape and the `--fs-*` token names won't break under them. So the milestone adds the few
**in-domain** things today's model can't express (all **non-breaking** widenings — the ones the Epic 1
design panel surfaced), fixes the two real gaps the editing surface shipped with, then **writes down
the deferred positions and freezes the contract**. Each epic below is a *sketch* — it gets a
design-panel scope in `docs/epics/` before build, like Epics 5–8.

### Epic 9 — Per-column formatting
- [ ] `Column.format` / `scale` / `precision` — a `% margin` or `YoY growth %` column beside currency
  (today's single-formatter-per-grid can't express it; already flagged in Notes & limitations)
- [ ] threads through `formatAccounting`; a per-column override beats `defaultFormat`; **raw units
  preserved** for editing + the clipboard (edit reveals the unscaled number regardless of column format)
- **Non-breaking** — additive optional fields on `Column`; a single-format grid renders unchanged.

### Epic 10 — Grouped column headers
- [ ] `Column.group` — band `Actual │ Budget │ Δ` under a period super-header (the comparative-statement
  layout finsheet can't render today)
- [ ] spanning `<thead>` row; colgroup / sticky / header-association still correct; snapshot parity when unused
- **Non-breaking** — additive optional field; a flat-header grid renders unchanged.

### Epic 11 — Print & selection a11y (the two real fixes)
- [ ] **print stylesheet** — an `@media print` block: release the scroll box (`overflow: visible`),
  lean on native `<thead>`/`<tfoot>` page repetition, keep the accounting rules / drop the tints, force
  black-on-white regardless of theme, page-break discipline on subtotal/total rows. *(Today the scroll
  container clips printed statements — a real bug, not a nicety.)*
- [ ] **selection-band non-color affordance** — the range is conveyed by background tint only
  (`data-fs-selected`), which trips WCAG 1.4.1 (use of color); add a border/outline cue.
- **Both additive + brand-neutral** — no token renames.

### Epic 12 — API stability & v1.0 release
- [ ] **write the deferred positions** — virtualization deferred ("on measured need", ~150-row
  threshold, a future opt-in `virtualize` prop; the structure is already windowing-ready) and the a11y
  contract (native `<table>` semantics; `role=grid` / `aria-rowindex` / announcer a **documented
  non-goal**). The two are **coupled**: no windowing ⇒ native semantics stay truthful.
- [ ] **freeze the contract** — the `GridModel` shape + the `--fs-*` token names are stable API;
  document the semver policy (additive-only within 1.x)
- [ ] manual publish **`v1.0.0`**

Deferred *within* v1.0 (add on need, not speculatively): a note / text column, column-key type safety
(a dev-mode validator over a generic `GridModel<C>`), and virtualization (only past the measured
row-count threshold).

---

## Deferred decisions

- **Virtualization** — **DEFERRED** (Epic 7, 2026-07-11) to a future "on measured need" epic
  (per-edit work is already O(1) in row count, and the structure is already virtualization-ready,
  so windowing only bounds mount / DOM-node / scroll cost for very large statements — rare in
  authored statements; native scroll + sticky wins under ~150 rows). The
  verified windower sketch lives in [docs/epics/epic-7.md](epics/epic-7.md): an **opt-in,
  default-off `virtualize` prop**, a pure `windowRange.ts` (100% node-covered) over absolute model
  indices, top/bottom spacer `<tr>` windowing (never transforms — keeps `table-layout: fixed` +
  colgroup + the sticky label), the pinned total kept outside `<tbody>`, and the active/editing
  row force-mounted so focus + the tab-stop + the editor draft survive scroll. Build-vs-buy leans
  **in-house** over `@tanstack/react-virtual` (the `<table>` medium forces spacer-row windowing
  anyway; its ResizeObserver measurement can't be covered in the happy-dom gate regardless).
  Windowed a11y (`aria-rowcount`/`rowindex`) routes through Epic 8's composite-grid work, not a
  perf-epic bolt-on.
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
