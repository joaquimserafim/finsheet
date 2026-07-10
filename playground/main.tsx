import { type CellEdit, Grid, type GridModel } from "finsheet";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/styles.css";

type Theme = "auto" | "light" | "dark";

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

/** Controlled edit-mode demo: the grid never mutates `model`; each committed edit
 *  round-trips through `onEdit` and back in as a fresh `model`. */
function Playground() {
	const [model, setModel] = useState(pnl);
	const [last, setLast] = useState<CellEdit | null>(null);
	const [theme, setTheme] = useState<Theme>("auto");

	// Keep the whole page's light/dark in step with the toggle (auto = follow the OS),
	// so the grid never sits as a lone dark box on a light page (or vice-versa).
	useEffect(() => {
		document.documentElement.style.colorScheme = theme === "auto" ? "light dark" : theme;
	}, [theme]);

	const onEdit = (change: CellEdit) => {
		setLast(change);
		setModel((prev) => ({
			columns: prev.columns,
			rows: prev.rows.map((row, i) =>
				i === change.rowIndex && "values" in row
					? { ...row, values: { ...row.values, [change.columnId]: change.value } }
					: row,
			),
		}));
	};

	return (
		<main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 760 }}>
			<div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
				<h1 style={{ margin: 0 }}>finsheet playground</h1>
				<div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
					{(["auto", "light", "dark"] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTheme(t)}
							aria-pressed={theme === t}
							style={{
								padding: "4px 10px",
								fontSize: 13,
								borderRadius: 6,
								border: "1px solid #8884",
								cursor: "pointer",
								color: "inherit",
								background: theme === t ? "#8883" : "transparent",
								fontWeight: theme === t ? 600 : 400,
							}}
						>
							{t}
						</button>
					))}
				</div>
			</div>
			<p>
				Edit mode — click or arrow to a numeric line cell, type to replace (or Enter/F2 to
				edit in place), <kbd>Enter</kbd>/<kbd>Tab</kbd> to commit, <kbd>Esc</kbd> to cancel,
				<kbd>Backspace</kbd> to clear. Subtotals, totals and the Δ column never edit.
			</p>
			<Grid
				model={model}
				mode="edit"
				onEdit={onEdit}
				theme={theme === "auto" ? undefined : theme}
				caption="Consolidated income statement (in thousands)"
			/>
			<p style={{ color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
				last commit:{" "}
				{last ? `rows[${last.rowIndex}].${last.columnId} = ${last.value ?? "—"}` : "—"}
			</p>
		</main>
	);
}

const root = document.getElementById("root");
if (!root) {
	throw new Error("missing #root element");
}

createRoot(root).render(
	<StrictMode>
		<Playground />
	</StrictMode>,
);
