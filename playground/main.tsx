import { Grid, type GridModel } from "finsheet";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/styles.css";

/** A multi-period P&L: wide enough to scroll horizontally (sticky label column)
 *  and tall enough to scroll vertically (sticky header + pinned net-income footer). */
const pnl: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "24ch" },
		{ id: "fy2021", header: "FY2021", numeric: true, width: 110 },
		{ id: "fy2022", header: "FY2022", numeric: true, width: 110 },
		{ id: "fy2023", header: "FY2023", numeric: true, width: 110 },
		{ id: "fy2024", header: "FY2024", numeric: true, width: 110 },
		{ id: "fy2025", header: "FY2025", numeric: true, width: 110 },
		{ id: "var", header: "Δ YoY", numeric: true, editable: false, width: 110 },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			label: "Product",
			depth: 1,
			values: { fy2021: 620, fy2022: 710, fy2023: 845, fy2024: 940, fy2025: 1040, var: 100 },
		},
		{
			kind: "line",
			label: "Services",
			depth: 1,
			values: { fy2021: 120, fy2022: 150, fy2023: 190, fy2024: 220, fy2025: 260, var: 40 },
		},
		{
			kind: "subtotal",
			label: "Total revenue",
			values: {
				fy2021: 740,
				fy2022: 860,
				fy2023: 1035,
				fy2024: 1160,
				fy2025: 1300,
				var: 140,
			},
		},
		{ kind: "spacer", id: "s1" },
		{ kind: "section", label: "Cost of sales" },
		{
			kind: "line",
			label: "Cost of goods sold",
			depth: 1,
			values: {
				fy2021: -300,
				fy2022: -340,
				fy2023: -400,
				fy2024: -440,
				fy2025: -480,
				var: -40,
			},
		},
		{
			kind: "subtotal",
			label: "Gross profit",
			values: { fy2021: 440, fy2022: 520, fy2023: 635, fy2024: 720, fy2025: 820, var: 100 },
		},
		{ kind: "spacer", id: "s2" },
		{ kind: "section", label: "Operating expenses" },
		{
			kind: "line",
			label: "Sales & marketing",
			depth: 1,
			values: {
				fy2021: -140,
				fy2022: -165,
				fy2023: -195,
				fy2024: -215,
				fy2025: -240,
				var: -25,
			},
		},
		{
			kind: "line",
			label: "Research & development",
			depth: 1,
			values: {
				fy2021: -95,
				fy2022: -115,
				fy2023: -140,
				fy2024: -160,
				fy2025: -185,
				var: -25,
			},
		},
		{
			kind: "line",
			label: "General & administrative",
			depth: 1,
			values: { fy2021: -70, fy2022: -80, fy2023: -95, fy2024: -105, fy2025: -118, var: -13 },
		},
		{
			kind: "subtotal",
			label: "Operating income (EBIT)",
			values: { fy2021: 135, fy2022: 160, fy2023: 205, fy2024: 240, fy2025: 277, var: 37 },
		},
		{ kind: "spacer", id: "s3" },
		{
			kind: "line",
			label: "Income tax",
			depth: 1,
			editable: false,
			values: { fy2021: -34, fy2022: -40, fy2023: -51, fy2024: -60, fy2025: -69, var: -9 },
		},
		{
			kind: "total",
			label: "Net income",
			values: { fy2021: 101, fy2022: 120, fy2023: 154, fy2024: 180, fy2025: 208, var: 28 },
		},
	],
};

const root = document.getElementById("root");
if (!root) {
	throw new Error("missing #root element");
}

createRoot(root).render(
	<StrictMode>
		<main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 720 }}>
			<h1>finsheet playground</h1>
			<p>
				Read-only P&amp;L — scroll to check the sticky header, sticky label column, and
				pinned net-income footer.
			</p>
			<Grid model={pnl} caption="Consolidated income statement (in thousands)" />
		</main>
	</StrictMode>,
);
