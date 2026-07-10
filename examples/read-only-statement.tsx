import { Grid, type GridModel } from "finsheet";

// Import the stylesheet once, in your app entry:  import "finsheet/styles.css";

/**
 * The "hello world": a read-only P&L. Sticky header, a sticky label column, accounting
 * numerics, a subtotal, and a trailing `total` that auto-pins to a sticky footer.
 * Rows are an authored discriminated union — `section` / `line` / `subtotal` / `total`
 * / `spacer` — not a flat array; that is the whole point of finsheet.
 */
const income: GridModel = {
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
		{
			kind: "line",
			label: "Operating expenses",
			depth: 1,
			values: { fy2024: -900, fy2025: -1015 },
		},
		{ kind: "total", label: "Operating income", values: { fy2024: 260, fy2025: 285 } },
	],
};

export default function ReadOnlyStatement() {
	return <Grid model={income} caption="Consolidated income statement" />;
}
