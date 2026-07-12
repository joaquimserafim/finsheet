# Epic 9 — Per-column formatting

The **first** epic of milestone **v1.0.0**. finsheet already renders + edits financial
statements (`edit` + `bulk`, shipped in v0.2.0), but the whole grid speaks **one** number
language: every value cell runs through a single `formatAccounting(value, defaultFormat)`
closure. A real statement mixes languages in one table — a **currency** column beside a **%
margin** column beside plain **accounting** columns. Epic 9 adds one optional field,
**`Column.format`**, so each column can declare how *its* numbers look, while columns that
declare nothing render **byte-identical to today**. It is **additive, non-breaking, and
display-only**: the type it introduces is **frozen at 1.0**, so the whole epic is the smallest
shape that covers accounting + currency + percent without painting v1.x into a corner.

> Scoped by a five-lens design panel (api-shape · percent-semantics · render-seam/memo ·
> edit-clipboard interaction · scope-boundary → synthesis → 2 adversarial verifiers, both
> **PROCEED**). Where the lenses disagreed, the tie broke toward the option that keeps finsheet
> **minimal, non-breaking, and freeze-worthy** — recorded in *Locked decisions*. The verifiers'
> non-blocking fixes are folded in below (see *Review fixes*).

## Shape — in simple terms

Right now the grid dresses every number the same way: commas, parentheses for negatives, an
optional "in thousands" scale. That's fine for a plain P&L, but a real statement often puts a
**dollar** column, a **margin %** column, and a **growth %** column side by side — three
different number languages in one table. Per-column formatting lets each column say *how its own
numbers should look*:

- **Accounting** — the default. `1234` → `1,234`, `(1,234)` for negatives. Exactly what every
  column does today.
- **Currency** — accounting plus a symbol. `1234` → `$1,234`. The symbol is pure decoration.
- **Percent** — `0.125` → `12.5%`.

A column that doesn't ask for anything keeps looking **precisely** as it does now — same pixels,
same snapshot. And a per-column format **inherits** the statement-wide defaults (a statement "in
thousands" keeps all its money columns in thousands) and only overrides the fields it names.

**The one thing to hold onto: this changes only how numbers are *shown*, never what is
*stored*.** When you click into a cell to edit it, or copy it to Excel, you get the plain
underlying number back — not the dressed-up version. A currency cell that displays `$1,234`
edits and copies as `1234`. That's already how the "in thousands" scale behaves (shows `1,235`,
edits `1234567`), so per-column format just extends a rule finsheet already lives by.

**The tricky bit — percent.** finsheet's percent formatter takes a *ratio*: you feed it `0.125`
and it shows `12.5%` (it multiplies by 100 for you). That's the same ratio your own
`margin = profit / revenue` division naturally produces, and it matches how Excel stores a
percent cell internally (the cell holds `0.125`, the screen shows `12.5%`). The consequence,
because edit + copy always reveal the **raw** stored number: a percent cell that *displays*
`12.5%` will show **`0.125`** when you edit it, and copy **`0.125`** to the clipboard — not
`12.5`. That is surprising the first time, but it's the honest, consistent choice (same
raw-reveal rule as scale, one meaning of "%" across the library). Whether that trade is right, or
whether percent columns should instead store the friendlier `12.5`, is a **founder gate** below —
we recommend the ratio, but it's the maintainer's call because it freezes the percent column's
edit/copy feel forever.

## Stage 1 — Pure core (the frozen type + a pure resolver, 100% covered, no DOM)

All the new decision branches live here, in a pure module, node-covered **before** any React
glue — mirroring the `format.ts` / `selection.ts` / `fill.ts` / `clipboard.ts` split the repo
already uses. Nothing renders differently yet.

- [x] **Add the `ColumnFormat` union + the `Column.format` field.** New `src/columnFormat.ts` houses
  the discriminated union (arms = the exported `FormatOptions` / `CurrencyOptions` / `PercentOptions`,
  tagged by `type`, **accounting untagged**); `readonly format?: ColumnFormat` added to `Column`
  (`import type`); `ColumnFormat` exported from `index.ts` (frozen v1.0 surface). `types.test.ts`
  gained a mixed-format fixture + type-level guards: omission compiles, all three arms accepted,
  `symbol` on a percent arm is a passing `// @ts-expect-error`. **As-built correction:** the scoping
  worry about a `{ symbol }`-without-`type` foot-gun was WRONG — the union is *tighter* than predicted;
  TS **rejects** symbol-without-`type` (`symbol` lives only on the currency arm, which requires
  `type: "currency"`), so that test is now a passing `// @ts-expect-error` documenting the correct
  rejection, not a foot-gun. **228 tests / 100% cov** (the type-only file adds 0 statements),
  snapshots unblessed, typecheck + lint green. *(The `columnFormat.ts` split is because `types.ts` is
  runtime-free, so the Stage-2 resolver can't live there — NOT a type-only import cycle, which TS
  handles fine.)*
- [x] **Add the pure `formatColumnValue(value, format, defaultFormat)` resolver.** In
  `columnFormat.ts`: `format === undefined` ⇒ `formatAccounting(value, defaultFormat)`
  (allocation-free, so snapshot parity is free); else a merged bag `const merged = { ...defaultFormat,
  ...format }` (assigning to a const also sidesteps the excess-property check on the spread's `type`
  key) dispatched over a `switch` on a **typed local** (`const type = format.type ?? "accounting"`)
  to `formatAccounting` / `formatCurrency` / `formatPercent`, with a `never`-guarded default covered
  by a bogus-cast test (the repo idiom, `Grid.test.tsx:324`). `columnFormat.test.ts` = 7 tests, each
  arm **cross-checked against the raw formatter**: undefined byte-identical; untagged + explicit
  accounting; currency default `$` / `€` override / inherited scale; percent `0.125 → 12.5%` + scale
  can't corrupt a ratio; both precision cases (inherited 0-dp `13%` vs own 1-dp `13.0%`); merge
  precedence. **235 tests / 100% cov** (607 stmts, 473 branches — no new ignore regions). ✅ **Stage 1
  complete.**

## Stage 2 — Render seam (wire it in; memo + snapshot parity)

The single display hook. The raw seams (`rawCellText`, `parseAccounting`, `computeCopy`, `fill`,
`isCellEditable`) are **deliberately not touched** — that is what makes "display-only, raw
clipboard" true by construction.

- [x] **Widen the `formatValue` closure to `(value, column) => string` — parity proven.** `Grid.tsx`
  now delegates to `formatColumnValue(value, column.format, defaultFormat)`, useMemo deps **UNCHANGED**
  (the five primitive `defaultFormat` fields — `column` is an argument, never the memo key). Signature
  threaded through `GridRowProps` / `GridCellProps` / `EditableCellProps`; `column` passed at the two
  display call sites (`GridCell` + the `EditableCell` non-editing branch); the editor seed
  (`rawCellText`) and `GridRow`'s body untouched. **Acceptance met: zero `__snapshots__` churn** (235
  tests green under `test:run`, not `-u`; `git diff src/__snapshots__` empty) — objective proof it's
  additive. typecheck + lint clean.
- [ ] **Add one mixed-format snapshot.** Lock a mixed statement — a `% margin` column + a `$`
  currency column beside plain accounting columns — as a new `Grid.snapshot.test.tsx` case, so the
  formatted output is itself pinned.
- [ ] **Re-prove the Epic 7 invariant under formats.** Extend `Grid.perf.test.tsx` with a model
  carrying a `Column.format` column and assert `Grid` re-renders **0** times across
  move / open-editor / editor-keystroke / commit / shift-extend — the widened signature is only
  safe if `Grid = 0` still holds on the new path.
- [ ] **Display-only + raw-seam battery.** Tests proving `Column.format` never leaks past display:
  a percent/currency cell **seeds the editor from `rawCellText`** (input shows `0.125`, not
  `12.5%`); `onEdit` emits the **raw parsed number** (type `0.2` → `0.2`, never `0.002`/`20`);
  `computeCopy` emits **raw TSV** (`0.125`, not `12.5%`); paste writes raw and a pasted `12.5%` is
  **rejected atomically** (lands in `rejected[]`, edits empty); fill / range-clear / cut stay raw;
  and the editable guard is format-blind (a formatted `editable: false` column is a plain
  `GridCell`, never an input).

## Stage 3 — Docs, example, gallery & changelog

- [ ] **README + in-source truthing.** Document `Column.format` (the three arms, the
  untagged-accounting default, the per-field merge rule, the percent-stores-a-ratio semantics) and
  **delete** the "Single formatter per grid … deferred to a later `Column.format`" limitation plus
  the props-table line that says every value cell uses `formatAccounting`. State loudly that
  formatted columns are display-only — edit reveal + `onEdit` + `onBulkEdit` + clipboard are all
  raw units, a % column reveals its raw ratio, and formatted-text paste (`12.5%`) is rejected by
  design. **Also fix the now-stale JSDoc on the `defaultFormat` prop in `Grid.tsx`** (it calls the
  per-column `Column.format` "deferred" — no longer true — and says `defaultFormat` is "threaded to
  every value cell" — it becomes the base each column *inherits* from and can override).
- [ ] **`examples/mixed-format.tsx`** — a `% margin` column + a currency column beside accounting
  columns, typecheck-verified in CI, plus its row in the examples index / `examples/README.md`
  (the repo's per-feature convention).
- [ ] **Gallery shot + CHANGELOG.** Regenerate one mixed-format shot via `pnpm screenshots`
  (reusing the Epic 8 Chromium stack) into `docs/screenshots/` + `docs/gallery.md`, and add a
  CHANGELOG entry under a new **`[Unreleased]`** section (per-column formatting; additive /
  non-breaking). **No version bump** — the v1.0.0 cut + the `GridModel` freeze write-up are Epic 12.

## Locked decisions

- **`Column.format` is a discriminated union whose three arms ARE the exported Options types,
  tagged by `type`, accounting untagged.** Recommended TS shape:
  ```ts
  export type ColumnFormat =
      | ({ readonly type?: "accounting" } & FormatOptions)
      | ({ readonly type: "currency" } & CurrencyOptions)
      | ({ readonly type: "percent" } & PercentOptions);
  ```
  Chosen over a **flat bag** `{ variant?, symbol?, scale?, … }` because the three families are
  shape-asymmetric (only currency has `symbol`; percent has no `scale`) — a flat bag would
  type-accept `{ type: "percent", scale: "thousands", symbol: "$" }`, three silently-ignored fields
  *frozen forever*. Reusing the already-exported Options types adds zero new vocabulary and cannot
  drift from the formatters. *(Exact field name, discriminant token, and untagged default are a
  founder gate — see below.)*
- **One object field `Column.format`, not scattered `Column.scale` + `Column.precision`.** The
  ROADMAP line names a *capability*, not three top-level fields. One object avoids duplicating
  `FormatOptions` onto `Column`, avoids `Column.scale` vs `Column.format.scale` ambiguity, and keeps
  the frozen surface narrow. It reads well beside the statement-wide `defaultFormat`.
- **No formatter FUNCTIONS in the 1.0 union.** A `(value) => string` can't be serialized/frozen
  (breaks "GridModel is data"), can't reduce to a stable memo key (a fresh identity every render
  defeats the Epic 7 seam), and duplicates the pure formatters. The three families cover the entire
  stated domain. Decisive: a `{ type: "custom", format }` arm — or `{ type: "bps" }`, `"multiple"`
  (`1.5x`) — can be **added additively** to the union in v1.x, so the tagged union keeps the door
  open without committing now.
- **Compose = per-field spread of `column.format` over `defaultFormat`, then dispatch.** A
  currency/accounting column inherits `defaultFormat`'s scale/locale/precision/parens/blank and
  overrides per-field; a percent column inherits the shared fields, and `scale` is both typed away
  (`PercentOptions` has no `scale`) and ignored at runtime (`formatPercent` destructures only its
  own fields) — so scale can **never** corrupt a percent. Full-replacement (no inheritance) was
  rejected: it forces every column to re-declare locale/scale.
- **The no-`format` default is byte-identical to today.** `formatColumnValue(value, undefined,
  defaultFormat)` resolves to exactly `formatAccounting(value, defaultFormat)` with no special
  casing, so snapshot parity falls out of the resolver's structure, not a bolt-on guard.
- **Widen the ONE `formatValue` closure to `(value, column)`; keep the memo key on `defaultFormat`
  primitives only.** Chosen over a `Map<columnId, formatter>` prop (adds a second
  referential-stability invariant that can regress Epic 7) and over resolving a bound formatter in
  `GridRow` (mints a new closure identity per render, breaking the `EditableCell` memo). Because
  `column` is an *argument*, `formatValue`'s identity is unchanged on an edit, the `GridRow` memo
  boundary holds, and `Grid = 0` re-renders survives. A runtime `column.format` change still
  re-renders correctly via the normal `columns`-identity path — no staleness, no spurious rebuild.
- **The type + resolver live in a new pure `src/columnFormat.ts`, 100%-node-covered before any DOM
  glue** — so the render seam adds zero new branches and the 100% happy-dom gate stays green without
  new ignore regions. The split is required because `types.ts` is runtime-free (the resolver can't
  live there); it is **not** to dodge a type-only import cycle (those are fine in TS).
- **Display-only: `parse.ts` and `clipboard.ts` stay format-BLIND.** Epic 9 changes only the
  display formatter selection. Raw copy already ignores `defaultFormat.scale`, so raw-copy is the
  *established* contract that format extends — not a new rule.
- **No version bump / publish.** The CHANGELOG entry lands under `[Unreleased]`; the v1.0.0 release
  and `GridModel` freeze are Epic 12.

## Founder gates — RESOLVED (2026-07-12)

All four ratified **as recommended** (maintainer, 2026-07-12): **(1)** percent stores the **ratio**
(`0.125`); **(2)** field `format`, discriminant `type`, accounting untagged; **(3)** copy + paste stay
**raw** for 1.0 (`12.5%` paste rejected-and-surfaced); **(4)** percent **inherits**
`defaultFormat.precision` uniformly. The rationale for each is recorded below.

1. **Percent storage — ratio (`0.125`) vs percentage (`12.5`)? [THE headline call; must resolve
   *before* Stage 1 freezes.]** It forks the *formatter path*, not just the UX. **Ratio** reuses the
   frozen `formatPercent` (×100) with **zero `format.ts` change**, matches Excel's internal cell
   model and the ratio a consumer's own `margin`/`YoY` division yields, and is the same display-only
   principle `scale` already ships — the cost is that a `12.5%` cell edits/copies as `0.125`.
   **Percentage** reveals the friendlier `12.5` on edit/copy but makes `formatPercent` render
   `1250%` (wrong), so it needs a *new* non-×100 percent path (accounting + `%` suffix), a second
   meaning of "%" that diverges from the exported `formatPercent(0.125)`, and a wider frozen surface.
   **Recommendation: store the RATIO** (kernel-minimal, freeze-clean; % columns are usually
   `editable: false` derived columns, so the raw reveal is rarely hit). *Maintainer decides.*
2. **The exact `Column.format` name + discriminant tokens (frozen at 1.0).** Recommend the field
   `format` (reads well beside `defaultFormat`), discriminant `type: "accounting" | "currency" |
   "percent"`, accounting **untagged**. Low-controversy but frozen forever — note `kind` is already
   the *Row*-union discriminant, so `type` here means the codebase carries two discriminant
   conventions (the alternative is `kind` everywhere). *Maintainer signs off on the spelling.*
3. **Copy + paste of a formatted column: stay raw, or understand formatted text?** Today
   `parseAccounting` strips a leading `$` (so `$1,234` pastes) but **rejects** `%` and non-`$`
   symbols (`12.5%` → rejected atomically). **Recommendation: keep parse + copy raw and column-blind
   for 1.0** — edit-reveal already shows raw, so "edit and paste both speak raw units" is the
   consistent model; a `12.5%` paste stays *rejected-and-surfaced* (never a silent 100×-wrong
   half-parse). Teaching parse `%`/÷100 is a real widening that threads `column` through
   `clipboard.ts` + the editor commit and is coupled to gate 1 — defer to a follow-up epic. *Maintainer
   ratifies.*
4. **[Minor] Does a percent column inherit a statement-wide `defaultFormat.precision`?** Under the
   locked compose rule it does (a 0-dp statement renders `13%`, not `13.0%`). **Recommendation:
   inherit all shared fields uniformly** (percent drops only `scale`) for one simple rule — flagged
   only because a maintainer might want percent precision to stay independent at `formatPercent`'s
   1-dp default.

## Risks

- **Percent raw-reveal surprises consumers** — a `12.5%` cell editing/copying as `0.125`, and
  feeding `12.5` into a ratio column silently rendering `1250%`. Mitigated by loud JSDoc + README
  wording (Stage 3); a dev-mode "you fed 12.5 into a ratio column" validator is a *possible* future
  ergonomic guard, explicitly not built here.
- **Format leaking into a raw seam** (editor seed, `onEdit`, copy TSV, paste) is the sharpest
  correctness regression — guarded by the Stage 2 display-only battery, which asserts each raw seam
  stays format-blind.
- **Memo-key regression** — closing over `columns`, or passing a per-column bound `formatValue`,
  would rebuild the closure / break the `EditableCell` memo and re-render every editable cell,
  violating the Epic 7 `Grid = 0` seam. Guarded by keeping `column` an argument + the perf re-run.
- **Snapshot drift** — any allocation or argument difference in the no-`format` fall-through breaks
  byte-parity; the fall-through must be exactly `formatAccounting(value, defaultFormat)`. Guarded by
  the unblessed-snapshot check.
- **Coverage of the resolver's `never` default** — the identically-shaped guard in `GridRow.tsx`
  already reaches 100% v8 coverage with no ignore, so the resolver's should too; if v8 ever flags
  its default block, the in-repo remedy is a `/* v8 ignore start/stop */` pair (as in
  `CellEditor.tsx`) — trivial and in-pattern.
- **`nfCache` keyspace grows** by a few `(locale, precision)` entries (percent at precision 1 beside
  accounting at precision 0) — bounded by distinct locale×precision across a statement's columns; no
  leak, formatters stay shared.

## Out of scope

- **Format-aware / percent-aware PARSE** — making the editor + paste understand `%` / `$` /
  formatted text and ÷100. Parse stays column-blind and raw for 1.0; a `12.5%` paste stays
  rejected-and-surfaced. Additive + reversible later; coupled to gate 1/3, not Epic 9.
- **An "copy as displayed text" mode** (`12.5%` / `$1,234` on the clipboard) — a future opt-in v1.x
  affordance; v1.0 copy stays raw TSV.
- **Arbitrary formatter FUNCTIONS** (`format?: (v) => string`) and a **format DSL / Excel format
  string** (`#,##0.00%`) — not serializable/freezable, huge frozen surface; the three-arm union
  covers the domain. Both are additive-later-safe on the union.
- **Widening the statement-wide `defaultFormat`** beyond `FormatOptions` (a grid-wide currency or
  percent default) — `defaultFormat` stays the accounting base every column inherits presentation
  from; the family choice is per-column.
- **Per-CELL (row×col) formatting, conditional/value-dependent formatting** (negatives in red), and
  **auto-detecting format from data** — format is a declared per-column property; the rest are
  styling or heuristics, un-freezable here.
- **Any CSS/token or alignment change** — a percent column stays `numeric: true` → right-aligned /
  tabular; format changes display *text* only, so `styles.css` and cell presentation are untouched
  (part of what keeps snapshot parity).
- **Grouped / multi-level headers** (Epic 10) and the **version bump + `GridModel` freeze + v1.0.0
  publish** (Epic 12).

## Review fixes (folded from the 2 adversarial verifiers, both PROCEED)

- **`never` guard keys off a typed local**, not the `format.type ?? "accounting"` expression (which
  does not narrow `format` to `never`) — Stage 1 box 2.
- **`symbol`-on-percent test is a real `// @ts-expect-error`** (fails loudly if TS stops rejecting),
  plus a negative test documenting the intentional `{ symbol }`-without-`type` foot-gun — Stage 1 box 1.
- **Corrected the `columnFormat.ts` split rationale** — it's because `types.ts` is runtime-free (the
  resolver can't live there), NOT a type-only import cycle (TS supports those) — Stage 1 + Locked
  decisions + Risks.
- **Stage 3 truthing also fixes the in-source `Grid.tsx` JSDoc** ("deferred per-column `Column.format`"
  + "threaded to every value cell" both go stale) — not just the README prose.
- **Explicit precision tests** for percent inheriting a 0-dp `defaultFormat` vs its own 1-dp default;
  and a note that the spread carries the `type` key into the formatters harmlessly (don't strip it).
- **Tightened the Stage 2 box boundary** — the existing-snapshot parity is folded into the wiring
  box's acceptance; adding the one mixed-format snapshot is its own box.
- **`ColumnFormat` is exported from `index.ts`** so the frozen v1.0 surface is complete.

## Done when

`Column.format` is a frozen, serializable discriminated union (accounting / currency / percent,
reusing the exported Options types) selectable per column; a pure `formatColumnValue` resolver is
100%-node-covered with the no-format branch byte-identical to today; the `formatValue` seam is
column-aware with the `Grid = 0`-re-renders Epic 7 invariant re-proven and the existing snapshots
unblessed (plus one new mixed-format snapshot); the display-only battery proves edit-reveal, `onEdit`
/ `onBulkEdit`, and the clipboard all stay in RAW units (a % column reveals its raw ratio, a `12.5%`
paste is rejected atomically); the docs are truthed (the "Single formatter per grid" limitation +
stale `Grid.tsx` JSDoc deleted, `examples/mixed-format.tsx` added, a gallery shot + an `[Unreleased]`
CHANGELOG entry); and the four founder gates are resolved in writing — above all the
percent-stores-a-ratio call, which must land before the Stage 1 type freezes. The 100% happy-dom
coverage gate stays green throughout. **No version bump** (Epic 12).
