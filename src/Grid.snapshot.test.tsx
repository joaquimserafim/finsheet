import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Grid } from "./Grid";
import type { GridModel } from "./types";

/**
 * Full-markup regression guards. Unlike the behavioural tests (which assert one fact
 * each), these pin the ENTIRE rendered structure — every class, `data-*`, ARIA and
 * scope attribute — so an accidental markup or class-name change is caught loudly.
 * Run `vitest -u` to bless an intended change.
 */
const statement: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "20ch" },
		{ id: "actual", header: "Actual", numeric: true, width: 110 },
		{ id: "budget", header: "Budget", numeric: true },
		{ id: "var", header: "Δ", numeric: true, editable: false },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			id: "prod",
			label: "Product",
			depth: 1,
			values: { actual: 1000, budget: 950, var: 50 },
		},
		{ kind: "line", label: "Services", depth: 1, values: { actual: 240, var: -10 } },
		{
			kind: "subtotal",
			label: "Total revenue",
			values: { actual: 1240, budget: 1200, var: 40 },
		},
		{ kind: "spacer", id: "s1" },
		{ kind: "total", label: "Net income", values: { actual: -1234, budget: 217, var: -1451 } },
	],
};

/**
 * A mixed-format statement (Epic 9): a `$` currency column, a `€` currency column, and a
 * `%` margin column (stored as a ratio) beside the plain accounting label. Pins the FORMATTED
 * markup — `$1,000`, `(€600)`, `40.0%` — so per-column display can't regress silently.
 */
const mixedFormat: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "20ch" },
		{ id: "revenue", header: "Revenue", numeric: true, format: { type: "currency" } },
		{ id: "cost", header: "Cost", numeric: true, format: { type: "currency", symbol: "€" } },
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
			values: { revenue: 1000, cost: -600, margin: 0.4 },
		},
		{
			kind: "line",
			label: "Services",
			depth: 1,
			values: { revenue: 240, cost: -90, margin: 0.625 },
		},
		{ kind: "total", label: "Total", values: { revenue: 1240, cost: -690, margin: 0.444 } },
	],
};

describe("rendered-markup snapshots", () => {
	test("view mode — the full read-only statement", () => {
		const { container } = render(<Grid model={statement} caption="Income statement" />);
		expect(container.firstChild).toMatchSnapshot();
	});

	test("edit mode — roving tabindex, data-coords, aria-current, editor seam", () => {
		const { container } = render(<Grid model={statement} mode="edit" onEdit={vi.fn()} />);
		expect(container.firstChild).toMatchSnapshot();
	});

	test("thousands scale + inline (non-sticky) trailing total", () => {
		const { container } = render(
			<Grid model={statement} defaultFormat={{ scale: "thousands" }} stickyFooter={false} />,
		);
		expect(container.firstChild).toMatchSnapshot();
	});

	test("mixed per-column formats — $ / € currency + % margin (Epic 9)", () => {
		const { container } = render(<Grid model={mixedFormat} caption="Mixed formats" />);
		expect(container.firstChild).toMatchSnapshot();
	});
});
