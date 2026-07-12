# finsheet

[![CI](https://github.com/joaquimserafim/finsheet/actions/workflows/ci.yml/badge.svg)](https://github.com/joaquimserafim/finsheet/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/finsheet.svg)](https://www.npmjs.com/package/finsheet)
[![minzipped](https://img.shields.io/bundlephobia/minzip/finsheet)](https://bundlephobia.com/package/finsheet)
[![types](https://img.shields.io/npm/types/finsheet.svg)](https://www.npmjs.com/package/finsheet)
[![module: ESM only](https://img.shields.io/badge/module-ESM--only-blue)](https://nodejs.org/api/esm.html)
[![node](https://img.shields.io/node/v/finsheet.svg)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/finsheet.svg)](LICENSE)

A headless-leaning React grid for **financial statements** — sticky headers, tabular numerics,
subtotal/total rows, and three edit modes (`view` / `edit` / `bulk`) — without the row-model
abstraction tax of a general table library.

Statements are *authored structure*, not aggregated data, so rows are a **discriminated union**
(`section · line · subtotal · total · spacer`) and rendering is a `switch` on `kind`. Subtotals and
totals are first-class row kinds, not a config flag.

> **Status:** `v0.2.0`. Renders **read-only** statements and edits them — single-cell editing
> (`mode="edit"`) and **bulk mode** (`mode="bulk"` — range select + clipboard + fill). Row
> virtualization is **deferred** (per-edit work is already O(1) in row count); see [docs/ROADMAP.md](docs/ROADMAP.md).

📸 **[See the gallery →](docs/gallery.md)** — the grid across statement shapes, themes, editing, and formatting.

## Requirements

- **Node.js ≥ 24**
- **React ≥ 18** (peer dependency)
- **ESM-only** — no CommonJS build. The Node 24 floor means `require("finsheet")` still works via
  `require(esm)`.

## Install

```sh
pnpm add finsheet react react-dom
```

## Quick start

```tsx
import { Grid, type GridModel } from "finsheet"
import "finsheet/styles.css" // one stylesheet; the component never imports it for you

const model: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "22ch" },
		{ id: "fy2024", header: "FY2024", numeric: true },
		{ id: "fy2025", header: "FY2025", numeric: true },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{ kind: "line", label: "Product", depth: 1, values: { fy2024: 940, fy2025: 1040 } },
		{ kind: "line", label: "Services", depth: 1, values: { fy2024: 220, fy2025: 260 } },
		{ kind: "subtotal", label: "Total revenue", values: { fy2024: 1160, fy2025: 1300 } },
		{ kind: "spacer", id: "s1" },
		{ kind: "line", label: "Operating expenses", depth: 1, values: { fy2024: -980, fy2025: -1092 } },
		{ kind: "total", label: "Net income", values: { fy2024: 180, fy2025: 208 } },
	],
}

export function IncomeStatement() {
	return <Grid model={model} caption="Income statement (in thousands)" />
}
```

Negatives render in parentheses, `null`/absent cells as `–`, the trailing `total` pins to a sticky
footer, and `columns[0]` is the sticky label column.

More patterns in [examples/](examples/) — read-only, editable, balance sheet, and theming.

## The data model

`GridModel` is `{ columns, rows }`. `columns[0]` is the **label column** (renders `row.label`);
every other column is a **value column** addressed by its `id` in a row's `values`
(`Record<string, number | null>`, keyed by column id, sparse).

| Row `kind` | Renders |
| --- | --- |
| `section` | A group header (e.g. "Revenue"). Label only, empty value region. |
| `line` | A data row. The only editable kind (in `v0.2.0`). |
| `subtotal` | A running subtotal — single accounting underline above. |
| `total` | A grand total — heavier weight + double rule. The **trailing** one auto-pins to `<tfoot>`. |
| `spacer` | A themed vertical gap. No label, no values. |

A cell is `number | null`; `null` and absent both render the blank placeholder. `depth` indents the
label. See [src/types.ts](src/types.ts) for the full model.

## `<Grid>` props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `model` | `GridModel` | — | **Required.** Controlled; the grid never mutates it. |
| `defaultFormat` | `FormatOptions` | — | Statement-wide accounting format base (e.g. `{ scale: "thousands" }`); each column can override via `Column.format` (see [Per-column formats](#per-column-formats)). |
| `mode` | `"view" \| "edit" \| "bulk"` | `"view"` | `"edit"` = single-cell editing; `"bulk"` adds range select + clipboard + fill (a strict superset of `"edit"`). |
| `onEdit` | `(change: CellEdit) => void` | — | Fires on each committed single-cell edit. Apply it and pass a fresh `model` back. |
| `onBulkEdit` | `(change: BulkEdit) => void` | — | Fires once per bulk op (paste / cut / fill / clear) in `"bulk"` mode. Apply every `edit` and pass one fresh `model` back. |
| `stickyFooter` | `boolean` | `true` | Pin the trailing `total` to a sticky footer. `false` → inline, no footer. |
| `theme` | `"light" \| "dark"` | — | Force the color theme (stamps `data-theme`). Omit to follow the OS. |
| `caption` | `ReactNode` | — | Rendered as `<caption>`; supplies the table's accessible name. |
| `className` / `id` | `string` | — | Applied to the scroll container. |
| `aria-label` / `aria-labelledby` | `string` | — | Applied to the `<table>` when there's no caption. |

## Editing (`mode="edit"`)

In `edit` mode, finsheet supports single-cell editing while staying a **controlled component** — it
never mutates `model`. On each valid commit it fires `onEdit`; you apply the change to your own data
and pass a fresh `model` back:

```tsx
import { type CellEdit, Grid, type GridModel } from "finsheet"
import { useState } from "react"

function applyEdit(model: GridModel, change: CellEdit): GridModel {
	return {
		columns: model.columns,
		rows: model.rows.map((row, i) =>
			i === change.rowIndex && "values" in row
				? { ...row, values: { ...row.values, [change.columnId]: change.value } }
				: row,
		),
	}
}

export function EditableStatement({ initial }: { initial: GridModel }) {
	const [model, setModel] = useState(initial)
	return <Grid model={model} mode="edit" onEdit={(c) => setModel((m) => applyEdit(m, c))} />
}
```

**Only `line` cells in numeric, unlocked columns edit.** Subtotals, totals, sections and the label
column are never editable — guaranteed by row `kind`, not a runtime flag. Lock a single line with
`editable: false` on the row, or a whole column (e.g. a computed variance) with `editable: false`
on the `Column`.

| Key | Focused (not editing) | Editing |
| --- | --- | --- |
| Arrows | move to the next **editable** cell | move the text caret |
| Enter / F2 | start editing (keep the value) | commit + move down |
| Tab / Shift+Tab | move right / left | commit + move right / left |
| digit · `-` · `.` | start editing, replacing the value | — |
| Backspace / Delete | clear the cell → commit `null` | delete a character |
| Esc | — | cancel, keep the value |

Navigation **skips non-editable cells**, so Tab and arrows land only where you can type. Editing
reveals the **raw stored value** (unscaled), so a statement shown "in thousands" still edits the
real number. `onEdit` receives `{ rowId?, rowIndex, columnId, value }` — `value` is a parsed
`number`, or `null` when the cell was cleared. Full example:
[examples/editable-statement.tsx](examples/editable-statement.tsx).

> Range select + copy/paste (to and from a spreadsheet) and fill-down live in `bulk` mode, below.

## Bulk mode (`mode="bulk"`)

`bulk` is a strict **superset of `edit`** — every single-cell affordance above still works and still
fires `onEdit` — plus rectangular range selection and the spreadsheet gestures: clipboard copy/paste
(Excel/Sheets-compatible), fill, and range-clear. It stays a **controlled component**: each *bulk*
operation fires `onBulkEdit` **exactly once**, so one paste is one re-render and one undo step.

```tsx
import { type BulkEdit, type CellEdit, Grid, type GridModel } from "finsheet"
import { useState } from "react"

// Apply a whole bulk op (many cells across many rows) in one fresh model.
function applyBulk(model: GridModel, { edits }: BulkEdit): GridModel {
	if (edits.length === 0) return model
	const byRow = new Map<number, CellEdit[]>()
	for (const edit of edits) {
		const list = byRow.get(edit.rowIndex)
		if (list) list.push(edit)
		else byRow.set(edit.rowIndex, [edit])
	}
	return {
		columns: model.columns,
		rows: model.rows.map((row, i) => {
			const rowEdits = byRow.get(i)
			if (!rowEdits || !("values" in row)) return row
			const values = { ...row.values }
			for (const e of rowEdits) values[e.columnId] = e.value
			return { ...row, values }
		}),
	}
}

// `onEdit` still carries single-cell commits; `onBulkEdit` carries paste / cut / fill / clear.
<Grid model={model} mode="bulk"
	onEdit={(c) => setModel((m) => applyEdit(m, c))}
	onBulkEdit={(op) => setModel((m) => applyBulk(m, op))}
/>
```

| Key | Action |
| --- | --- |
| Shift + Arrow · Shift + click · drag | extend the selection into a rectangle |
| Cmd/Ctrl + A | select every editable cell |
| Cmd/Ctrl + C / X / V | copy / cut / paste (tab-separated, Excel-compatible) |
| Cmd/Ctrl + D / R | fill **down** / **right** from the range's leading edge |
| Delete / Backspace | clear the range (a single cell clears one, via `onEdit`) |
| Esc | collapse the selection to the focus cell |

**Editable cells only, always.** Paste, fill and clear write **only** `line` cells in numeric,
unlocked columns — a value landing on a subtotal, total, section or locked column is dropped and
**reported** (never silently written). Copy is inclusive, so you can lift a whole block — computed
rows and all — into a spreadsheet.

**Raw units, TSV wire format.** The clipboard is plain **TSV** in **raw stored units** (the unscaled
number), so a block round-trips losslessly to and from Excel/Sheets even when the statement is shown
"in thousands". Paste is **atomic**: if any cell fails to parse, nothing is written.

`onBulkEdit` receives a `BulkEdit` — apply every `edit` (each is the same `{ rowId?, rowIndex,
columnId, value }` shape as `onEdit`) and surface `rejected` / `skipped` if you want to warn:

```ts
interface BulkEdit {
	kind: "paste" | "fill-down" | "fill-right" | "clear"
	edits: CellEdit[]         // editable + actually-changed cells only (no-ops suppressed)
	rejected?: RejectedCell[] // paste cells that didn't parse → `edits` is empty (atomic)
	skipped?: SkippedCell[]   // non-editable targets a paste dropped — reported, never silent
}
```

Full example: [examples/bulk-statement.tsx](examples/bulk-statement.tsx).

## Formatting

The number formatters are pure and usable on their own:

```ts
import { formatAccounting, formatCurrency, formatPercent } from "finsheet"

formatAccounting(1234.5)                          // "1,235"
formatAccounting(-1234, { precision: 2 })         // "(1,234.00)"
formatAccounting(1_234_567, { scale: "thousands" }) // "1,235"
formatAccounting(null)                            // "–"
formatCurrency(-1234)                             // "($1,234)"
formatPercent(0.125)                              // "12.5%"  (input is a ratio)
```

`Grid` uses `formatAccounting` by default, with `defaultFormat` threading statement-wide options (a
"shown in thousands" scale, precision, locale) to every value cell.

### Per-column formats

One statement can mix number languages. Set `Column.format` to pick a column's family — accounting
(the default), **currency**, or **percent**:

```tsx
const columns = [
	{ id: "line", header: "", sticky: "left" },
	{ id: "revenue", header: "Revenue", numeric: true, format: { type: "currency" } },      // "$1,000"
	{ id: "eur", header: "EUR", numeric: true, format: { type: "currency", symbol: "€" } },  // "€1,000"
	{ id: "margin", header: "Margin", numeric: true, format: { type: "percent" } },          // 0.32 → "32.0%"
	{ id: "units", header: "Units", numeric: true },                                          // accounting (default)
]
```

- **Inherits `defaultFormat`, overrides per field.** A statement shown "in thousands" keeps its money
  columns in thousands unless a column restates a field. `type` is optional — omit it (or use
  `{ scale: … }`) for plain accounting.
- **Percent stores a ratio.** `formatPercent` takes a ratio, so a `margin` cell holds `0.32` and shows
  `"32.0%"` — the same value your `profit / revenue` division yields, and what Excel stores internally.
- **Display only.** Formatting never changes what's stored: editing and the clipboard always use the
  **raw** number. A `$1,000` cell edits and copies as `1000`; a `32.0%` cell edits and copies as `0.32`.
  A pasted `"12.5%"` is rejected (parsing stays raw), so a bad paste never silently stores a
  100×-wrong figure.

Full example: [examples/mixed-format.tsx](examples/mixed-format.tsx).

## Theming

Import the stylesheet once, then override the flat `--fs-*` custom properties. They're scoped to
`.finsheet` — the container class the `<Grid>` renders — at zero specificity, so your overrides
always win:

```css
.finsheet {
	--fs-bg: #fbfbfa;
	--fs-total-border-bottom: 2px solid var(--fs-border); /* the grand-total underline */
	--fs-max-block-size: 24rem; /* the scroll height that makes sticky work */
}
```

Light is the default; **dark follows the OS** (`prefers-color-scheme`). To force a theme regardless
of the OS, pass the `theme` prop — `<Grid theme="dark" />` — which stamps `data-theme` on the
`.finsheet` element. (Set `color-scheme` on your own page so the surrounding chrome matches.) Full
token list at the top of [src/styles.css](src/styles.css).

## Notes & limitations

- **The grid owns its scroll.** Sticky positioning resolves against the built-in scroll container,
  which needs a bounded height (`--fs-max-block-size`, default `32rem`). Don't wrap the grid in your
  own `overflow` ancestor, or sticky will resolve against the wrong box.
- **One sticky-left column** — set `sticky: "left"` on `columns[0]` (the label). It's ignored on
  other columns in v1.
- **Editing writes editable cells only.** In `edit`/`bulk` only `line` cells in numeric, unlocked
  columns accept input — enforced by row `kind`, not a runtime flag.
- **Row virtualization is deferred.** Per-edit work is already O(1) in row count (only the changed
  cells re-render, never the whole grid); a windower would bound only initial mount for very large
  statements — rare in authored statements. See the [roadmap](docs/ROADMAP.md) for the position.

## Development

```sh
pnpm install       # installs deps and sets up husky hooks via `prepare`
pnpm dev           # Vite playground (a live P&L)
pnpm test          # Vitest (watch)
pnpm test:coverage # Vitest + V8 coverage (100% gate)
pnpm test:browser  # Vitest in real Chromium (focus/clipboard fidelity; run `pnpm exec playwright install chromium` once)
pnpm build         # tsup → dist (ESM + .d.ts + styles.css)
pnpm lint          # Biome check
pnpm typecheck     # tsc --noEmit
```

Releasing is documented in [RELEASING.md](RELEASING.md).

## License

[MIT](LICENSE) © finsheet contributors
