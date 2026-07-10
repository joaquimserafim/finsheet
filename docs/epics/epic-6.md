# Epic 6 — Bulk mode (`bulk`): the spreadsheet

Part of milestone **v0.2.0 — editing**. Turns the single-cell edit surface into a
**spreadsheet in the browser**: rectangular range selection, system-clipboard copy/paste
(TSV — the Excel/xlsx clipboard format), fill-down/right, and range-clear — while staying a
controlled, financial-statement grid. `view` / `edit` behave exactly as Epic 5.

> Scoped by a design panel (selection · clipboard · keyboard/a11y · fill/perf lenses →
> synthesis → 2 adversarial verifiers). One verifier returned `SOLID`, the other
> `NEEDS_REVISION` with 3 majors + minors — **all folded in below** (see *Review fixes*).

## Shape — a superset of `edit`, one store

`mode="bulk"` is a strict **superset of `edit`**: everything edit does, plus selection +
clipboard + fill. It reuses the **one** Epic 5 store/reducer/controller — no second machine —
extended with a **single new field** `anchor: EditCoord | null`:

- `anchor === null` ⇒ a collapsed 1×1 selection = Epic 5's `active` cell, exactly.
- a range = `anchor` (the fixed corner) + `active` (the moving **focus** corner, keeping its
  exact Epic 5 roles: roving-tabindex target, editor target, reconcile-clamp target).
- **both corners are always editable coords** (a click/drag/shift-click over a non-editable
  cell resolves to `null` and is ignored; Shift+Arrow extends via `nextEditable`). So `active`
  never lands on a subtotal, and every Epic 5 invariant holds.

All **decision logic** lands in three new PURE, 100%-unit-testable modules — `selection.ts`,
`clipboard.ts`, `fill.ts` — that operate over `(model, editable-list, rect, tsv)` and never
touch the DOM (exactly the split that gave Epic 5 an honest 100% gate). The React/clipboard/
pointer glue is thin.

**Gates:** `interactive = mode === "edit" || mode === "bulk"` gates the shared Epic 5
machinery; `bulkMode = mode === "bulk"` gates the selection/clipboard/fill layer. In `edit`,
`anchor` is never set, so every new branch is inert.

## Contract

```ts
type GridMode = "view" | "edit" | "bulk";   // + "bulk"

interface GridProps {
	// … Epic 5 props …
	onBulkEdit?: (edit: BulkEdit) => void;   // fires once per bulk op; onEdit stays for single-cell
}

interface BulkEdit {
	readonly kind: "paste" | "fill-down" | "fill-right" | "clear";
	readonly edits: readonly CellEdit[];      // editable + changed-only + no-op-suppressed (reuses Epic 5 CellEdit)
	readonly rejected?: readonly RejectedCell[]; // paste parse-failures (⇒ edits is [] under atomic policy)
	readonly skipped?: readonly SkippedCell[];   // clipboard cells dropped because the target isn't editable
}
interface RejectedCell { readonly rowIndex: number; readonly columnId: string; readonly text: string; }
interface SkippedCell  { readonly rowIndex: number; readonly columnId: string; } // ← review fix (see below)
```

**Controlled, one swap per op.** The grid never mutates `model`. A bulk op fires **exactly one**
`onBulkEdit` → the consumer applies all `edits` and passes back **one** fresh `model` → one
re-render, one undo step. `edits` reuses `CellEdit` verbatim (`{rowId?, rowIndex, columnId,
value}`) and contains only editable, actually-changed cells. If `onBulkEdit` is absent, bulk ops
are inert (no silent N×`onEdit` fallback — the one-swap contract *is* the point).

## New pure modules (signatures)

```ts
// selection.ts
interface SelectionRect { minRow: number; maxRow: number; minCol: number; maxCol: number; }
selectionRect(anchor, active): SelectionRect | null;
withinRect(rect, row, col): boolean;                       // O(1) bbox test
cellsInRange(list, rect): EditCoord[];                     // EDITABLE cells only
isMultiSelection(anchor, active): boolean;
reconcileSelection(list, active, anchor): { active, anchor };  // ← review-fixed rule below
sameSelection(a, b): boolean;
classifyBulkKey(key, shift, ctrl, meta, editing, multi): BulkIntent;  // {none} ⇒ fall through to classifyKey

// clipboard.ts
rawCellText(value): string;                                // extracted from EditableCell.rawEditValue
parseClipboard(text): string[][];                          // TSV → rows×cols (CRLF / lone-CR / trailing-\n / ragged tolerant)
serializeClipboard(cells): string;
computeCopy(model, rect): string[][];                      // geometric, inclusive, raw — kind-gated (see fix)
computePastePatches(model, list, rect, block): { patches, rejected, skipped };  // positional, atomic, guarded

// fill.ts
computeFillPatches(model, rect, dir): CellEdit[];          // verbatim value copy, NO series inference
computeClearPatches(model, rect): CellEdit[];              // editable in-range → null
```

## State model

`EditState` gains one field: `anchor: EditCoord | null`. New reducer actions: `EXTEND {coord}`
(`anchor = state.anchor ?? state.active; active = coord`), `SELECT_ALL`, `CLEAR_SELECTION`,
`RECONCILE {active, anchor}`. `SET_ACTIVE` and `START_EDIT` additionally set `anchor: null` (a
plain move/click/edit collapses the range; editing is always single-cell). `COMMIT`/`CANCEL`/
`INVALID` are unchanged (anchor already null while editing).

`editStore` adds one packed status `CELL_SELECTED = 4`. `cellStatus(row,col)` gains one O(1)
branch: focus cell → `ACTIVE`/`EDITING`/`INVALID` (Epic 5); else `withinRect(rect,…)` →
`CELL_SELECTED`; else `IDLE`. The rect is cached in the store closure, recomputed **once per
dispatch**, so `getSnapshot` stays O(1) and allocation-free and the `Object.is` seam survives.

**Store invariant (documented at the store):** created once via `createEditStore(list)`, never
sees model updates; `cellStatus` is a pure fn of `(active, anchor, row, col)`. The editable clip
is guaranteed by the **render split** (only `EditableCell` subscribes + carries `data-fs-row/col`;
section/spacer/subtotal/total/locked cells are plain `GridCell`s that never subscribe → they paint
as untinted gaps for free). Don't make `GridCell` subscribe.

## Keyboard

| Keys | Effect |
| --- | --- |
| **Shift+Arrow** | Extend: move the focus corner one editable cell (`nextEditable`, jumps over non-editable rows + the locked column); anchor fixed. `preventDefault`. |
| **Shift+Click** | Extend from the fixed anchor to the clicked editable cell. |
| **Click / Arrow / Tab / Enter / F2 / dbl-click** | Epic 5, **unchanged** — move the active cell and **collapse** the range to 1×1. |
| **Cmd/Ctrl+A** | Select all editable cells. `preventDefault`. |
| **Cmd/Ctrl+C / V / X** | Copy / paste / cut — **native clipboard events**, never routed through keydown. *(Guarded — see fix 1.)* |
| **Cmd/Ctrl+D / R** | Fill down / right within the selection. `preventDefault` (bookmark / reload). |
| **Delete / Backspace** | Multi-cell selection → clear editable in-range cells to `null` (one `kind:"clear"`). 1×1 → Epic 5 single-cell clear. |
| **Escape** | Live multi-cell selection → collapse to the active cell. Else → Epic 5 (editor cancel / no-op). |
| **digit / - / .** | Collapse to the focus cell + open the single-cell editor seeded with the char (Epic 5). |

## Clipboard — raw units, both directions

Native React `onCopy`/`onCut`/`onPaste` on the scroll port (bulk only): `preventDefault`, then
`e.clipboardData.get/setData("text/plain", …)` — synchronous, permission-free, no
`navigator.clipboard`. **TSV grammar:** split on `\r\n|\r|\n` (drop one trailing newline) then
`\t`; ragged rows tolerated. Numeric cells never embed tabs/newlines, so plain TSV is lossless
(CSV-style quoting is a non-goal).

**Units = RAW, always** (reconciles Epic 5 "edit raw units, reveal on focus"; avoids the 1000×
scale trap). Both copy and paste use the unscaled stored number; `defaultFormat.scale` is
display-only. A statement shown "in thousands" copies `1234567`, not `1235`. Copy reads
`model.values` via the shared `rawCellText` — **never DOM textContent** (also correct under
virtualization). Wire format: plain decimal, no grouping, leading minus, `.` decimal, en-US.
`parseAccounting` accepts `()`/`$`/commas/spaces on the way back, so the round-trip is lossless.

- **Copy** — geometric, inclusive over the visual value-column rectangle (`minCol ≥ 1`, the label
  column is never in range). Interior subtotal/total/locked cells emit their raw value;
  section/spacer/null cells emit `""` — a complete, structurally-aligned Excel snapshot.
- **Paste** — positional from the selection top-left; maps `TSV[i][j]` → `(minRow+i, minCol+j)`,
  clipped at grid bounds. Writes **only** where `isCellEditable`; per cell `parseAccounting`
  (`"" → null` clears; `(1,234)`/`$1,000` handled; `parsed === current` suppressed). A **1×1
  clipboard fills the whole selection**; a multi-cell block ignores selection size (no tiling).
  Copy(geometric) ↔ paste(positional) are exact inverses on a pure-editable selection.

## Editability at non-editable cells (the sacred guard)

A rectangle spanning non-editable cells is safe on **every** path:

- **Select** — corners are always editable; interior non-editable cells never subscribe → they
  render as untinted **gaps** in the band (truthful: "won't be written").
- **Copy** — reads are safe → inclusive (raw value, or `""` for section/spacer/null).
- **Paste / Fill / Clear** — writes are guarded on `isCellEditable`; a non-editable target
  **consumes its clipboard cell but is skipped** (never written). Subtotals recompute from inputs.
- The **label column (col 0) is never in a range** (editable columns are ≥ 1).

## Fill — verbatim, no series inference

`Cmd/Ctrl+D` (down) / `Cmd/Ctrl+R` (right) broadcast from the selection's leading **editable**
edge: fill-down sources each column's topmost editable cell downward; fill-right sources each
row's leftmost editable cell rightward — jumping over non-editable holes, no-op suppressed.
**No series/pattern inference** (no `1,2,3 → 4,5,6`): extrapolating figures fabricates data in a
statement — the same reason `GridCell` refuses `?? 0`. Fill copies the raw value exactly. No
tiling. No draggable fill-handle nub in v1 (deferred). 1×1 fill is a no-op.

## Performance / virtualization-friendly (Epic 7 is deferred)

Selection is **data** — two coords in the store, never a `Set` of DOM nodes, never materialized
per render. Every decision (copy/paste/fill/clear + membership) is pure over `(model, list, rect,
tsv)` and never reads the DOM, so a 500-row range works with 30 rows mounted, and a cell scrolled
into a live selection reads the correct `CELL_SELECTED` from the cached rect immediately. Copy
serializes `model` (raw) so it's correct for off-screen cells a DOM-scrape would miss. Re-render
granularity is unchanged: one subscription + one packed int per cell; extending flips only the
delta-band cells + the 2 focus-swap cells. Only pointer drag-select is bounded by mounted cells
(drag-past-edge autoscroll deferred to Epic 7).

## Accessibility

Stay faithful to Epic 5's deliberate **no-`role=grid`** decision (dropped on this irregular table;
the correct composite grid is scheduled for Epic 8). Epic 6: keep roving tabindex (one tab stop) +
`aria-current` on the focus corner; mark selected cells with a **`data-fs-selected`** attribute
for CSS-only band styling — **no `aria-selected`** (inert on a bare `<td>`) and no
`aria-multiselectable` (needs a composite-role host). A visually-hidden `role="status"` live-region
announcer ("3×2 selected", "Pasted 6 cells, 2 skipped") is **deferred to Epic 8** alongside the
composite grid (it's a small self-contained add if wanted sooner). Known limitation carried from
Epic 5: without `role=grid`, AT users are in focus/forms mode; multi-select is perceivable to
sighted keyboard users but not announced until Epic 8.

## Coverage strategy

**Pure / 100% in node+happy-dom:** `selection.ts`, `clipboard.ts`, `fill.ts` (every decision), plus
the new reducer/store cases. **Browser-only (`@vitest/browser` Chromium, `/* v8 ignore */` in node,
exactly Epic 5's trailing-blur pattern):** native `ClipboardEvent` round-trip to/from Excel TSV
(happy-dom's `clipboardData` isn't faithful), real focus, pointer drag-select
(`setPointerCapture`/`elementFromPoint`), `Cmd+R`/`Cmd+D` `preventDefault`, and the re-render-count
assertions. *Keep the ignore surface honest* (fix 8): the `onCopy/onCut/onPaste` handler bodies and
the `EXTEND`-from-coord dispatch are covered in node via mocked `ClipboardEvent`/pointer events;
**only `document.elementFromPoint` drag sequences are ignored.** This also unblocks Epic 5's own
deferred `@vitest/browser` suite — they land together.

## Review fixes folded in (from the adversarial verifiers)

1. **(major) Open-editor clipboard guard.** `onCopy/onCut/onPaste` must **early-return without
   `preventDefault`** when `store.getState().editing` is true *or* the event target is inside
   `.finsheet-cell-input` — so `Cmd+C/V/X` while editing a cell go to the **input's** own
   copy/paste (pasting a figure into a cell you're editing must work), mirroring Epic 5's
   `onClick`/`onKeyDown` editor-bail. Node-coverable by firing a synthetic clipboard event
   targeting the input.
2. **(major) No silent drops — `skipped[]`.** Positional paste that lands clipboard values on
   non-editable targets must **report** them via `BulkEdit.skipped` (nearly free — those cells are
   already visited), so the consumer can surface "N cells skipped (non-editable)". Never silently
   discard pasted figures in a subtotal-dense statement.
3. **(major) `reconcileSelection` is symmetric.** Preserve **both** corners only if **both** survive
   as still-editable after a model change (→ rect kept for a same-shape post-batch re-render, so the
   pasted/filled block stays highlighted). If **either** corner is invalidated by a structural
   change, **collapse** — drop the anchor, set active to the reconciled cell. (The naive "keep anchor
   iff editable" rule could synthesize a huge phantom rectangle after deleting one row.) `sameSelection`
   still gates the dispatch → no render loop.
4. **(minor) Post-op selection = preserve rect (only).** After paste/fill, keep the existing rect
   highlighted; **drop** "select the affected region" for v1 (it can't point a corner at a
   non-editable clipped cell, and the async model swap has no clean trigger). Revisit in Epic 8.
5. **(minor) `computeCopy` gates on `row.kind`** before reading `.values` — only `line`/`subtotal`/
   `total` are `ValuedRow`; `section`/`spacer` emit `""` for every in-range column **without
   touching `.values`** (they have none). Add section-in-range + spacer-in-range copy tests.
6. **(minor) Suppress empty bulk ops.** Skip the `onBulkEdit` call entirely when `edits.length === 0
   && !rejected?.length && !skipped?.length` (an all-no-op paste/fill/clear emits nothing), mirroring
   Epic 5's no-op-commit suppression. A rejected/skipped-only paste still fires so the consumer can toast.
7. **(minor) "Byte-identical" restated.** Edit-mode **observable** parity (rendered DOM + `onEdit`) is
   preserved — and **guarded by `Grid.snapshot.test.tsx`**. But adding `anchor` changes `EditState`'s
   shape, so `editReducer.test.ts` / `editStore.test.ts` gain `anchor: null` in their `toEqual`
   assertions + the new action/`CELL_SELECTED` cases. Don't claim those test files are frozen.
8. **(minor) `noUncheckedIndexedAccess` cast-vs-guard.** Bounded model reads (copy/fill) use the
   in-repo `as Row`/`as Column` cast (like `cellAt`) → no unreachable branch; only the **unbounded**
   paste-past-end target uses a reachable `=== undefined` guard. Keeps 100% honest.
9. **(minor) Focused-`<td>` clipboard reliability.** Make "a focused `<td>` receives copy/cut/paste"
   the **first** `@vitest/browser` assertion (Chromium; note Firefox/Safari risk). If unreliable, add
   a localized hidden clipboard-capture element — additive glue that doesn't touch the pure core.

## Locked decisions

- Distinct `mode="bulk"` = strict superset of `edit`; one store/reducer/controller + a single
  `anchor` field. `interactive = edit||bulk`; `bulkMode = mode === "bulk"`. No second store.
- Selection = `anchor` (fixed) + `active` (moving focus corner); both always editable; rect +
  membership are pure derivations, never a `Set`.
- `cellStatus` gains one packed `CELL_SELECTED=4`; rect cached, recomputed once per dispatch;
  `Object.is` minimal-re-render seam preserved.
- Clipboard = **raw units** both ways, via `rawCellText` (never DOM text); TSV; leading-minus
  negatives; `""`→`null` clear; en-US `.`-decimal no-grouping wire format.
- Copy = geometric + inclusive (kind-gated); paste = positional + write-guarded + **atomic reject**;
  they're exact inverses on a pure-editable selection.
- Fill = verbatim value copy, **no** series inference; keyboard `Cmd/Ctrl+D/R`; no tiling, no handle (v1).
- `onBulkEdit(BulkEdit{kind, edits, rejected?, skipped?})`; one event → one model swap → one undo;
  `onEdit` unchanged; empty ops suppressed.
- a11y: `data-fs-selected` band, no `role=grid`, no `aria-selected`; keep roving tabindex +
  `aria-current`; live-region announcer → Epic 8.

## Founder gates — RESOLVED (2026-07-10)

All settled by the founder; folded into the locked decisions above.

1. **Paste mapping → POSITIONAL.** TSV row aligns to the visual row; a subtotal slot is consumed +
   skipped. Exact inverse of copy (round-trips); never slides an input value across a subtotal boundary.
2. **Selection visual → GAPPY band.** Non-editable cells stay un-tinted inside a range (honest about
   what will be written); keeps the `EditableCell`/`GridCell` split. Solid rectangle deferred to Epic 8.
3. **`Cmd/Ctrl+R` fill-right → SHIP** (with `Cmd/Ctrl+D`), behind reliable `preventDefault`; re-verify
   the reload/bookmark suppression in the `@vitest/browser` suite.
4. **Scope → SHIP `Cmd+A` (select-all) + Cut (copy+clear)** in Epic 6. Excel within-selection Enter/Tab
   cycling stays deferred.
5. **aria-live announcer → Epic 8** (lands with the composite grid as one coherent a11y unit).
6. **Defaults confirmed:** **atomic** paste-reject · **inclusive** raw copy of interior subtotals ·
   **leading-minus** negatives on the wire · empty pasted cell **clears** (`""`→`null`) · **raw units**
   both directions.

## Tasks (staged, reviewable — same discipline as Epic 5)

**Stage 1 — pure core (node/happy-dom, 100% cov):** ✅ **committed `3b0b62e`** (178 tests, 100% cov)
- [x] `selection.ts`: `SelectionRect` + `selectionRect`/`withinRect`/`cellsInRange`/`isMultiSelection` + tests
- [x] `selection.ts`: `reconcileSelection` (symmetric collapse — fix 3) + `sameSelection` + tests
- [x] `selection.ts`: `classifyBulkKey` (+ tests proving `{none}` falls through to the untouched `classifyKey`)
- [x] `clipboard.ts`: `rawCellText` + `parseClipboard`/`serializeClipboard` TSV grammar + tests *(EditableCell switchover → Stage 3)*
- [x] `clipboard.ts`: `computeCopy` (geometric, inclusive, raw, **kind-gated** — fix 5) + tests
- [x] `clipboard.ts`: `computePastePatches` (positional, clip, guard-skip → `skipped[]`, `""`→null, **atomic reject**, 1×1-fills-selection, no-op suppress) + tests
- [x] `fill.ts`: `computeFillPatches` down/right + `computeClearPatches` + tests
- [x] `types.ts`: `RejectedCell` + `SkippedCell` (needed by `clipboard.ts`; `BulkEdit` + `GridMode "bulk"` → Stage 2)

**Stage 2 — state + store:** ✅ **committed** (185 tests, 100% cov)
- [x] `editReducer.ts`: `EditState += anchor`; `EXTEND`/`SELECT_ALL`/`CLEAR_SELECTION`/`RECONCILE`; `SET_ACTIVE`/`START_EDIT` set `anchor:null`; updated `editReducer.test.ts`/`editStore.test.ts` (`anchor:null`) — fix 7
- [x] `editStore.ts`: `CELL_SELECTED=4` + `cellStatus` branch + cached rect (recomputed once per dispatch) + tests
- [x] `types.ts`: `GridMode += "bulk"`; `BulkEdit`; exported `BulkEdit`/`RejectedCell`/`SkippedCell` from `index.ts`

**Stage 3a — selection gestures, keyboard + band (happy-dom RTL):** ✅ **committed** (197 tests, 100% cov)
- [x] `useGridEditing.ts`: `bulkMode`/`interactive` gate; keydown tries `classifyBulkKey` first (extend / select-all / collapse) → falls through to Epic 5 nav; `onClick` shift-extend
- [x] `useGridEditing.ts`: reconcile effect → `reconcileSelection`/`sameSelection` (`RECONCILE`; preserve-rect vs collapse; edit mode reduces to the old single-cell clamp)
- [x] `EditableCell.tsx`: `data-fs-selected` on `CELL_SELECTED`. `styles.css`: `--fs-select-bg` token + `td[data-fs-selected]` band. Playground: edit/bulk toggle
- [x] happy-dom RTL suite `Grid.bulk.test.tsx`: shift+arrow extent (+ boundary), Cmd/Ctrl+A, shift-click, Escape collapse, plain-arrow fall-through, reconcile preserve-vs-collapse

**Stage 3b — clipboard + fill + pointer, writes → `onBulkEdit` (happy-dom RTL):**
- [ ] `useGridEditing.ts`: `onCopy/onCut/onPaste` over the pure helpers → `onBulkEdit` (**editor-guarded** — fix 1; **empty-suppressed** — fix 6)
- [ ] `useGridEditing.ts`: fill (`Cmd/Ctrl+D`/`R`) + Delete-over-range clear → `onBulkEdit`; `onPointerDown/Move/Up` drag-select (+ `[data-fs-dragging] { user-select: none }`)
- [ ] `EditableCell.tsx`: import `rawCellText`. `Grid.tsx`: `onBulkEdit` prop; bind clipboard/pointer handlers on the port (bulk only)
- [ ] happy-dom RTL suite: `Cmd+D/R` fill, Delete range-clear, paste via mocked `clipboardData`, **paste-into-open-editor bails**

**Stage 4 — browser + docs:**
- [ ] `@vitest/browser` (Chromium): real clipboard round-trip to/from Excel TSV; focused-`<td>` receipt (fix 9); pointer drag-select; `Cmd+R/D` preventDefault; re-render-count assertions; `/* v8 ignore */` only `elementFromPoint` (fix 8). *(Also clears Epic 5's deferred browser suite.)*
- [ ] README: bulk-mode section (`mode`, `onBulkEdit`/`BulkEdit`, keyboard table, copy/paste/fill, editable-guard behaviour, raw-units note)
- [ ] `docs/epics/epic-6.md`: fold in as-built notes + resolved gates

**Done when:** paste a block from a spreadsheet + fill-down write **editable cells only**; copy
round-trips to/from Excel; non-editable targets are skipped and **reported**; one `onBulkEdit` →
one model swap → one undo step; `view`/`edit` observably identical to Epic 5.
