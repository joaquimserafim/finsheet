import { expect, test } from "vitest";
import type { Column, GridModel } from "./index";

/**
 * These fixtures are primarily a **compile-time guard**: annotating each literal
 * with `: GridModel` makes `tsc` reject the file if the model can't express a
 * real statement (a missing/extra field, a value in a section row, an editable
 * flag on the wrong kind, etc.). The runtime `expect`s below are a light sanity
 * check that also exercises the discriminated union via `switch (row.kind)`.
 */

/**
 * A multi-period P&L: prior-year actuals (locked, historical) beside the current
 * year's Actual / Budget (editable inputs) and a computed Variance column
 * (numeric so it aligns, but locked). Exercises every row kind:
 * section · line · subtotal · total · spacer.
 */
const pnl: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "22ch" },
		{ id: "fy2024", header: "FY2024", numeric: true, editable: false },
		{ id: "fy2025a", header: "FY2025 Actual", numeric: true },
		{ id: "fy2025b", header: "FY2025 Budget", numeric: true },
		{ id: "variance", header: "Var (A–B)", numeric: true, editable: false },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			label: "Product revenue",
			depth: 1,
			values: { fy2024: 800, fy2025a: 1000, fy2025b: 950, variance: 50 },
		},
		{
			kind: "line",
			label: "Services revenue",
			depth: 1,
			values: { fy2024: 180, fy2025a: 240, fy2025b: 250, variance: -10 },
		},
		{
			kind: "subtotal",
			label: "Total revenue",
			values: { fy2024: 980, fy2025a: 1240, fy2025b: 1200, variance: 40 },
		},
		{ kind: "spacer", id: "s1" },
		{ kind: "section", label: "Cost of sales" },
		{
			kind: "line",
			label: "Cost of goods sold",
			depth: 1,
			values: { fy2024: -380, fy2025a: -460, fy2025b: -450, variance: -10 },
		},
		{
			kind: "subtotal",
			label: "Gross profit",
			values: { fy2024: 600, fy2025a: 780, fy2025b: 750, variance: 30 },
		},
		{ kind: "spacer", id: "s2" },
		{ kind: "section", label: "Operating expenses" },
		{
			kind: "line",
			label: "Sales & marketing",
			depth: 1,
			values: { fy2024: -160, fy2025a: -210, fy2025b: -200, variance: -10 },
		},
		{
			kind: "line",
			label: "Research & development",
			depth: 1,
			values: { fy2024: -120, fy2025a: -150, fy2025b: -160, variance: 10 },
		},
		{
			kind: "line",
			label: "General & administrative",
			depth: 1,
			// A sparse row: the prior year is simply not on file for this line.
			values: { fy2025a: -110, fy2025b: -100, variance: -10 },
		},
		{
			kind: "subtotal",
			label: "Operating income (EBIT)",
			values: { fy2024: 230, fy2025a: 310, fy2025b: 290, variance: 20 },
		},
		{ kind: "spacer", id: "s3" },
		{
			kind: "line",
			label: "Income tax",
			depth: 1,
			// A derived line the consumer computes → locked even in edit mode.
			editable: false,
			values: { fy2024: -58, fy2025a: -78, fy2025b: -73, variance: -5 },
		},
		{
			kind: "total",
			label: "Net income",
			values: { fy2024: 172, fy2025a: 232, fy2025b: 217, variance: 15 },
		},
	],
};

/**
 * A small balance sheet: two periods, nested sections (Assets → Current assets),
 * nested subtotals, and a grand `total`. `depth` drives indentation.
 */
const balanceSheet: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "24ch" },
		{ id: "y2025", header: "2025", numeric: true },
		{ id: "y2024", header: "2024", numeric: true },
	],
	rows: [
		{ kind: "section", label: "Assets", depth: 0 },
		{ kind: "section", label: "Current assets", depth: 1 },
		{ kind: "line", label: "Cash & equivalents", depth: 2, values: { y2025: 120, y2024: 100 } },
		{ kind: "line", label: "Accounts receivable", depth: 2, values: { y2025: 90, y2024: 80 } },
		{ kind: "line", label: "Inventory", depth: 2, values: { y2025: 60, y2024: 50 } },
		{
			kind: "subtotal",
			label: "Total current assets",
			depth: 1,
			values: { y2025: 270, y2024: 230 },
		},
		{
			kind: "line",
			label: "Property, plant & equipment",
			depth: 1,
			values: { y2025: 400, y2024: 380 },
		},
		{ kind: "line", label: "Goodwill", depth: 1, values: { y2025: 130, y2024: 130 } },
		{ kind: "subtotal", label: "Total assets", depth: 0, values: { y2025: 800, y2024: 740 } },
		{ kind: "spacer", id: "bs-gap" },
		{ kind: "section", label: "Liabilities & equity", depth: 0 },
		{ kind: "section", label: "Current liabilities", depth: 1 },
		{ kind: "line", label: "Accounts payable", depth: 2, values: { y2025: 80, y2024: 70 } },
		{
			kind: "subtotal",
			label: "Total current liabilities",
			depth: 1,
			values: { y2025: 80, y2024: 70 },
		},
		{ kind: "line", label: "Long-term debt", depth: 1, values: { y2025: 320, y2024: 310 } },
		{
			kind: "subtotal",
			label: "Total liabilities",
			depth: 1,
			values: { y2025: 400, y2024: 380 },
		},
		{ kind: "section", label: "Equity", depth: 1 },
		{ kind: "line", label: "Common stock", depth: 2, values: { y2025: 100, y2024: 100 } },
		{ kind: "line", label: "Retained earnings", depth: 2, values: { y2025: 300, y2024: 260 } },
		{ kind: "subtotal", label: "Total equity", depth: 1, values: { y2025: 400, y2024: 360 } },
		{
			kind: "total",
			label: "Total liabilities & equity",
			depth: 0,
			values: { y2025: 800, y2024: 740 },
		},
	],
};

/**
 * Sums the numeric cells of a given column across `line` rows only (skipping
 * sections/spacers, which carry no values, and subtotals/totals, to avoid
 * double counting). The `default` branch's `never` assignment is a compile-time
 * exhaustiveness guard: adding a new row kind without handling it fails `tsc`.
 * This mirrors how the renderer (Epic 3) and editor (Epics 5–6) narrow `Row`.
 */
function sumLineCells(model: GridModel, columnId: Column["id"]): number {
	let sum = 0;
	for (const row of model.rows) {
		switch (row.kind) {
			case "line": {
				const v = row.values[columnId];
				if (typeof v === "number") {
					sum += v;
				}
				break;
			}
			case "section":
			case "subtotal":
			case "total":
			case "spacer":
				break;
			default: {
				const _exhaustive: never = row;
				return _exhaustive;
			}
		}
	}
	return sum;
}

test("the P&L builds and its line cells reconcile to net income", () => {
	expect(pnl.columns[0]?.id).toBe("line");
	// Every P&L line (revenue, COGS, opex, tax) sums to net income for the column.
	expect(sumLineCells(pnl, "fy2025a")).toBe(232);
});

test("the balance sheet builds with nested subtotals and a grand total", () => {
	const grandTotal = balanceSheet.rows.at(-1);
	expect(grandTotal?.kind).toBe("total");
	// Asset lines (800) + liability & equity lines (800) across the "2025" column.
	expect(sumLineCells(balanceSheet, "y2025")).toBe(1600);
});
