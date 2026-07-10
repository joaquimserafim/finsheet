# finsheet

[![CI](https://github.com/joaquimserafim/finsheet/actions/workflows/ci.yml/badge.svg)](https://github.com/joaquimserafim/finsheet/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/finsheet.svg)](https://www.npmjs.com/package/finsheet)
[![minzipped](https://img.shields.io/bundlephobia/minzip/finsheet)](https://bundlephobia.com/package/finsheet)
[![types](https://img.shields.io/npm/types/finsheet.svg)](https://www.npmjs.com/package/finsheet)
[![module: ESM only](https://img.shields.io/badge/module-ESM--only-blue)](https://nodejs.org/api/esm.html)
[![node](https://img.shields.io/node/v/finsheet.svg)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/finsheet.svg)](LICENSE)

A headless-leaning React grid for **financial statements** — sticky headers, tabular numerics,
subtotal/total rows, and (soon) three edit modes — without the row-model abstraction tax of a
general table library.

Statements are *authored structure*, not aggregated data, so rows are a **discriminated union**
(`section · line · subtotal · total · spacer`) and rendering is a `switch` on `kind`. Subtotals and
totals are first-class row kinds, not a config flag.

> **Status:** `v0.1.0` ships the **read-only** grid. `v0.2.0` adds **single-cell editing**
> (`mode="edit"`); range select + paste (`bulk`) and virtualization follow. See
> [docs/ROADMAP.md](docs/ROADMAP.md).

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
| `defaultFormat` | `FormatOptions` | — | Statement-wide accounting format (e.g. `{ scale: "thousands" }`). |
| `mode` | `"view" \| "edit"` | `"view"` | `"edit"` turns numeric `line` cells into an editing surface (pair with `onEdit`). |
| `onEdit` | `(change: CellEdit) => void` | — | Fires on each committed edit. Apply it and pass a fresh `model` back. |
| `stickyFooter` | `boolean` | `true` | Pin the trailing `total` to a sticky footer. `false` → inline, no footer. |
| `theme` | `"light" \| "dark"` | — | Force the color theme (stamps `data-theme`). Omit to follow the OS. |
| `caption` | `ReactNode` | — | Rendered as `<caption>`; supplies the table's accessible name. |
| `className` / `id` | `string` | — | Applied to the scroll container. |
| `aria-label` / `aria-labelledby` | `string` | — | Applied to the `<table>` when there's no caption. |

## Editing (`mode="edit"`)

`v0.2.0` adds single-cell editing. finsheet stays a **controlled component** — it never mutates
`model`. On each valid commit it fires `onEdit`; you apply the change to your own data and pass a
fresh `model` back:

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

> Range select + copy/paste (to and from a spreadsheet) and fill-down arrive with `bulk` mode; see
> the [roadmap](docs/ROADMAP.md).

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

`Grid` formats every value cell through `formatAccounting`; `defaultFormat` threads statement-wide
options (a "shown in thousands" scale, precision, locale) to all of them.

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
- **Single formatter per grid.** A mixed-unit statement (a `% margin` column beside currency) needs
  per-column formatting — deferred to a later `Column.format`. Today all value cells use
  `formatAccounting` + `defaultFormat`.
- **Editing is single-cell** (`v0.2.0`). One cell at a time; range select, copy/paste, and
  fill-down (`bulk` mode), plus virtualization for long statements, are on the roadmap.

## Development

```sh
pnpm install       # installs deps and sets up husky hooks via `prepare`
pnpm dev           # Vite playground (a live P&L)
pnpm test          # Vitest (watch)
pnpm test:coverage # Vitest + V8 coverage (100% gate)
pnpm build         # tsup → dist (ESM + .d.ts + styles.css)
pnpm lint          # Biome check
pnpm typecheck     # tsc --noEmit
```

Releasing is documented in [RELEASING.md](RELEASING.md).

## License

[MIT](LICENSE) © finsheet contributors
