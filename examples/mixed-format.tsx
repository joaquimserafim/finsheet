import { Grid, type GridModel } from "finsheet";

// import "finsheet/styles.css";

/**
 * Per-column formatting (Epic 9). One statement mixes number languages via `Column.format`: a `$`
 * revenue column, a `€` cost column, a plain accounting units column (no `format`), and a `%` gross
 * margin column. A column that declares no `format` renders exactly as before.
 *
 * Two things to know:
 * - **Percent stores a ratio.** The margin column holds `0.4` and shows `"40.0%"` — the same value a
 *   `(revenue − cost) / revenue` division yields, and what Excel stores internally.
 * - **Display only.** Formatting never changes what's stored: editing and the clipboard always use
 *   the RAW number (a `$1,000` cell edits/copies as `1000`; a `40.0%` cell as `0.4`). A per-column
 *   format inherits the statement-wide `defaultFormat` and overrides only the fields it names.
 */
const model: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "20ch" },
		{ id: "revenue", header: "Revenue", numeric: true, format: { type: "currency" } },
		{ id: "cost", header: "Cost", numeric: true, format: { type: "currency", symbol: "€" } },
		{ id: "units", header: "Units", numeric: true }, // no format ⇒ accounting default
		{
			id: "margin",
			header: "Margin",
			numeric: true,
			editable: false,
			format: { type: "percent" },
		},
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			label: "Product",
			depth: 1,
			values: { revenue: 1000, cost: -600, units: 4200, margin: 0.4 },
		},
		{
			kind: "line",
			label: "Services",
			depth: 1,
			values: { revenue: 240, cost: -90, units: 1300, margin: 0.625 },
		},
		{
			kind: "subtotal",
			label: "Total",
			values: { revenue: 1240, cost: -690, units: 5500, margin: 0.444 },
		},
	],
};

export default function MixedFormatStatement() {
	return <Grid model={model} caption="Mixed per-column formats" />;
}
