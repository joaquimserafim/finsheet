# Epic 5 — Single-cell editing + keyboard nav (`view` / `edit`)

Part of milestone **v0.2.0 — editing**. Turns the read-only grid into an editable,
keyboard-navigable surface in `edit` mode, while staying a controlled component and
re-rendering exactly one cell per keystroke. `view` mode stays identical to v0.1.0.

## Contract

- **`mode?: "view" | "edit"`** — default `"view"` (v0.1.0 consumers untouched).
- **`onEdit?: (change: CellEdit) => void`** — the grid never mutates `model`; on commit it
  fires `onEdit`, the consumer updates its data and passes a fresh `model` (controlled loop).
- The active cell types into a **local uncontrolled `<input>`** (draft state); only the
  *committed* value round-trips through the consumer — the key to one-cell-per-keystroke.

```ts
interface CellEdit {
	rowId?: string;      // row.id if present
	rowIndex: number;    // index into model.rows (always available)
	columnId: string;    // the value column's id
	value: CellValue;    // parsed number | null (null = cleared)
}
```

## Editability guard (from src/types.ts)

A cell is editable ⟺ `row.kind === "line" && row.editable !== false && col.numeric === true
&& col.editable !== false`. Subtotals, totals, sections, and the label column are **never**
editable — guaranteed by `kind`, no runtime opt-in.

## State machine (`useReducer` in `Grid`)

`{ activeCell: {row, col} | null, editing: boolean, draft: string }`
Actions: `FOCUS · MOVE(dir) · START_EDIT(initialChar?) · EDIT_CHANGE · COMMIT(moveDir?) ·
CANCEL · BLUR`. Roving tabindex (active cell `tabindex=0`, rest `-1`) = one focus target;
the container owns the keydown handler.

## Keyboard model (edit mode)

| Key | Focused (not editing) | Editing |
| --- | --- | --- |
| Arrows | move to next **editable** cell | move text caret |
| Enter | start editing | commit + move down |
| Tab / Shift+Tab | move right / left | commit + move right / left |
| Esc | — | cancel, keep focus |
| digit · `-` · `.` | start editing, replace | append |
| Backspace / Del | clear cell → commit `null` | delete char |
| F2 / double-click | start editing (keep value) | — |

## `parseAccounting(text): CellValue | undefined`

New pure fn, symmetric to `formatAccounting`: `""` → `null`; strips commas / spaces / `$`;
`(123)` → `-123`; invalid → `undefined` (reject the commit). Zero DOM, fully unit-tested.

## Perf — one cell per keystroke

`GridCell` becomes `React.memo`; only `isActive` / `isEditing` / `value` drive its re-render,
so a keystroke re-renders the active cell (and un-renders the previously active one) — nothing
else. An interaction test asserts the render count.

## Accessibility

Keep the semantic `<table>`; add roving `tabindex`, `aria-selected` on the active cell, an
accessible label on the edit input, and announce edit vs view. (Full `role="grid"` semantics
evaluated in the design panel.)

## Locked decisions (2026-07-09)

1. **Navigation skips non-editable cells** (fast data entry) — not focus-all.
2. **`onEdit` payload = `rowId?` + `rowIndex` + `columnId` + `value`** (index always available).
3. **Commit-only** `onEdit` — no dirty-draft callback.
4. **`@testing-library/user-event`** for interaction tests. → **Escalated (design panel): add
   `@vitest/browser`** (Chromium) for the focus/blur/Tab/keyboard suite; the pure core
   (`parse`/`editing`/`editReducer`) stays on happy-dom/node. Keeps a true 100% coverage gate.
5. **Scale editing = raw units, reveal on focus.** When `defaultFormat.scale` is set, focusing a
   cell reveals the full unscaled stored value; you edit the real number; `onEdit` stores it
   verbatim. Lossless, no 1000× trap. (Documented; display-unit editing deferred.)

## Design-panel revisions folded in (2026-07-09)

Both adversarial verifiers passed the architecture, `NEEDS_REVISION` on details. Folded in:
per-coord `useSyncExternalStore` subscription (a *move* re-renders only the two affected cells, not
every editable cell); `focusIntentRef`-gated focus effect (no focus-fight on boundary Tab escape);
reconcile effect dispatches only when the coord actually changes (no render loop); delegated
table handlers bail on events inside the editor input (click-in-editor never cancels); full ARIA
grid roles (`grid`/`row`/`gridcell`/`columnheader`/`rowheader` + `aria-readonly`); hardened
`parseAccounting` anchored grammar (rejects `(5`, `5)`, `0x10`, `Infinity`, `1e3`; pinned overflow
threshold; Unicode whitespace); active `<td>` drops to `tabindex=-1` while editing (input is the
sole tab stop); suppress no-op commits; skip the editable-scan in view mode; ignore Enter/Tab during
IME composition.

## Tasks

- [ ] `mode` + `onEdit` props, `CellEdit` type; `view` unchanged
- [ ] `parseAccounting` pure fn + tests
- [ ] `isEditable(row, col)` helper + navigable-cell index
- [ ] edit/nav reducer (active cell · editing · draft)
- [ ] roving tabindex + container keydown; focus management
- [ ] active-cell `<input>`: type-to-edit, commit on Enter/Tab/blur, cancel on Esc
- [ ] keyboard nav per table above, skipping non-editable cells
- [ ] `GridCell` → `React.memo`; verify 1-cell re-render
- [ ] CSS: focus ring + editing input + non-editable cursor (new `--fs-*` tokens)
- [ ] interaction tests (`user-event`): nav, edit, commit, cancel, guard, parse, re-render count
- [ ] README: editing + `onEdit` example

**Done when:** keyboard nav + single-cell edit work in `edit` mode; subtotals/totals never
editable; one cell re-renders per keystroke; `view` mode identical to v0.1.0.
