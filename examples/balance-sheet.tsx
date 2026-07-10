import { Grid, type GridModel } from "finsheet";

// import "finsheet/styles.css";

/**
 * A balance sheet, showing how several `total` rows coexist. Placement is a renderer
 * concern: only the TRAILING total pins to the sticky footer — a mid-sheet total like
 * "Total assets" stays inline in document order. `depth` indents the line items.
 */
const balanceSheet: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "24ch" },
		{ id: "y2025", header: "2025", numeric: true },
		{ id: "y2024", header: "2024", numeric: true },
	],
	rows: [
		{ kind: "section", label: "Assets" },
		{ kind: "line", label: "Cash & equivalents", depth: 1, values: { y2025: 320, y2024: 280 } },
		{
			kind: "line",
			label: "Accounts receivable",
			depth: 1,
			values: { y2025: 210, y2024: 190 },
		},
		{
			kind: "line",
			label: "Property & equipment",
			depth: 1,
			values: { y2025: 470, y2024: 430 },
		},
		{ kind: "total", label: "Total assets", values: { y2025: 1000, y2024: 900 } }, // mid-sheet → inline
		{ kind: "spacer", id: "s1" },
		{ kind: "section", label: "Liabilities & equity" },
		{ kind: "line", label: "Accounts payable", depth: 1, values: { y2025: 180, y2024: 160 } },
		{ kind: "line", label: "Long-term debt", depth: 1, values: { y2025: 300, y2024: 320 } },
		{ kind: "subtotal", label: "Total liabilities", values: { y2025: 480, y2024: 480 } },
		{
			kind: "line",
			label: "Shareholders' equity",
			depth: 1,
			values: { y2025: 520, y2024: 420 },
		},
		// Trailing total → auto-pins to the sticky footer.
		{ kind: "total", label: "Total liabilities & equity", values: { y2025: 1000, y2024: 900 } },
	],
};

export default function BalanceSheet() {
	return <Grid model={balanceSheet} caption="Balance sheet (in thousands)" />;
}
