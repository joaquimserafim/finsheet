# Examples

Self-contained, copy-pasteable `finsheet` usage. Each file default-exports one React
component. They import from `finsheet` (the published package name) — drop any of them
into a React 19 app, and import the stylesheet once in your entry:

```ts
import "finsheet/styles.css";
```

| File | Shows |
| --- | --- |
| [read-only-statement.tsx](read-only-statement.tsx) | The basics — a read-only P&L: sticky header + label column, a subtotal, a pinned grand-total footer. |
| [editable-statement.tsx](editable-statement.tsx) | `mode="edit"` — controlled single-cell editing: keyboard nav, `onEdit`, a locked (computed) column. |
| [bulk-statement.tsx](bulk-statement.tsx) | `mode="bulk"` — range select + clipboard copy/paste (Excel TSV) + fill/clear, applied via one `onBulkEdit` per op. |
| [balance-sheet.tsx](balance-sheet.tsx) | Several `total` rows — a mid-sheet "Total assets" stays inline; only the trailing total pins to the footer. |
| [theming.tsx](theming.tsx) | Custom `--fs-*` tokens, `data-theme`, and a statement-wide `defaultFormat` scale. |
| [mixed-format.tsx](mixed-format.tsx) | Per-column `Column.format` — a `$` / `€` currency column and a `%` margin column beside plain accounting; display-only (raw edit/clipboard). |

> These files are type-checked against the library source in CI (via a `finsheet` →
> `src` path alias), so they can't drift out of date with the API.
