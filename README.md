# finsheet

[![CI](https://github.com/joaquimserafim/finsheet/actions/workflows/ci.yml/badge.svg)](https://github.com/joaquimserafim/finsheet/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/finsheet.svg)](https://www.npmjs.com/package/finsheet)

A headless-leaning React grid for **financial statements** — sticky headers, tabular numerics,
subtotal/total rows, and (soon) three edit modes — without the row-model abstraction tax of a
general table library.

Statements are *authored structure*, not aggregated data, so rows are a **discriminated union**
(`section · line · subtotal · total · spacer`) and rendering is a `switch` on `kind`. Subtotals and
totals are first-class row kinds, not a config flag.

> **Status:** `v0.1.0` ships the **read-only** grid. Editing (`view` / `edit` / `bulk`) lands in
> `v0.2.0`. See [docs/ROADMAP.md](docs/ROADMAP.md).

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
| `stickyFooter` | `boolean` | `true` | Pin the trailing `total` to a sticky footer. `false` → inline, no footer. |
| `caption` | `ReactNode` | — | Rendered as `<caption>`; supplies the table's accessible name. |
| `className` / `id` | `string` | — | Applied to the scroll container. |
| `aria-label` / `aria-labelledby` | `string` | — | Applied to the `<table>` when there's no caption. |

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

Light is the default; **dark follows the OS** (`prefers-color-scheme`) unless you force it with
`data-theme="light" | "dark"` on the `.finsheet` element. Full token list at the top of
[src/styles.css](src/styles.css).

## Notes & limitations (v0.1.0)

- **The grid owns its scroll.** Sticky positioning resolves against the built-in scroll container,
  which needs a bounded height (`--fs-max-block-size`, default `32rem`). Don't wrap the grid in your
  own `overflow` ancestor, or sticky will resolve against the wrong box.
- **One sticky-left column** — set `sticky: "left"` on `columns[0]` (the label). It's ignored on
  other columns in v1.
- **Single formatter per grid.** A mixed-unit statement (a `% margin` column beside currency) needs
  per-column formatting — deferred to a later `Column.format`. Today all value cells use
  `formatAccounting` + `defaultFormat`.
- **Read-only.** Editing modes arrive in `v0.2.0`.

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
