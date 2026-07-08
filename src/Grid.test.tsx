import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Grid } from "./index";
import type { GridModel } from "./types";

const DASH = "–";

/** A compact P&L exercising every row kind, a sticky label column, a sparse row,
 *  a locked (numeric, non-editable) variance column, and a TRAILING total. */
const pnl: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "22ch" },
		{ id: "actual", header: "Actual", numeric: true, width: 120 },
		{ id: "budget", header: "Budget", numeric: true },
		{ id: "var", header: "Var", numeric: true, editable: false },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			label: "Product",
			depth: 1,
			values: { actual: 1000, budget: 950, var: 50 },
		},
		// Sparse: budget is simply absent; renders blank, not 0.
		{ kind: "line", label: "Services", depth: 1, values: { actual: 240, var: -10 } },
		{
			kind: "subtotal",
			label: "Total revenue",
			values: { actual: 1240, budget: 1200, var: 40 },
		},
		{ kind: "spacer", id: "s1" },
		// An explicit zero must render "0", never blank.
		{ kind: "line", label: "Other", depth: 1, values: { actual: 0, budget: 0, var: 0 } },
		{ kind: "total", label: "Net income", values: { actual: -1234, budget: 217, var: -1451 } },
	],
};

function grid(model: GridModel) {
	const { container } = render(<Grid model={model} />);
	// biome-ignore lint/style/noNonNullAssertion: the Grid always renders a root .columnar div.
	return container.querySelector<HTMLElement>(".columnar")!;
}

describe("structure", () => {
	test("renders one scroll port wrapping a table with colgroup/thead/tbody", () => {
		const root = grid(pnl);
		expect(root.classList.contains("columnar")).toBe(true);
		const table = root.querySelector("table.columnar-table");
		expect(table).not.toBeNull();
		expect(table?.querySelector("colgroup")?.querySelectorAll("col")).toHaveLength(4);
		expect(table?.querySelector("thead")).not.toBeNull();
		expect(table?.querySelector("tbody")).not.toBeNull();
	});

	test("colgroup widths: number -> px, string -> verbatim, unset label -> token", () => {
		const cols = grid(pnl).querySelectorAll("col");
		expect(cols[0]?.style.width).toBe("22ch"); // label, explicit string
		expect(cols[1]?.style.width).toBe("120px"); // number -> px
		expect(cols[2]?.style.width).toBe(""); // unset value column stays auto
	});

	test("unset label column falls back to the --cn-label-w width token", () => {
		const cols = grid({
			columns: [
				{ id: "line", header: "", sticky: "left" },
				{ id: "v", header: "V", numeric: true },
			],
			rows: [{ kind: "line", label: "x", values: { v: 1 } }],
		}).querySelectorAll("col");
		expect(cols[0]?.style.width).toBe("var(--cn-label-w)");
	});

	test("header: a <th scope=col> per column; numeric header aligns right; corner is sticky", () => {
		const heads = grid(pnl).querySelectorAll("thead th");
		expect(heads).toHaveLength(4);
		expect(heads[0]?.getAttribute("scope")).toBe("col");
		expect(heads[0]?.classList.contains("is-sticky")).toBe(true); // top-left corner
		expect(heads[1]?.getAttribute("data-align")).toBe("right");
		expect(heads[1]?.classList.contains("is-num")).toBe(true);
	});
});

describe("row kinds", () => {
	test("line: sticky <th scope=row> label + one <td> per value column", () => {
		const line = grid(pnl).querySelector('tr[data-kind="line"]');
		const label = line?.querySelector("th");
		expect(label?.getAttribute("scope")).toBe("row");
		expect(label?.classList.contains("is-sticky")).toBe(true);
		expect(label?.textContent).toBe("Product");
		expect(line?.querySelectorAll("td")).toHaveLength(3); // 4 columns - 1 label
	});

	test("section: label + ONE empty fill cell (truly empty, not a dash)", () => {
		const section = grid(pnl).querySelector('tr[data-kind="section"]');
		expect(section?.querySelector("th")?.textContent).toBe("Revenue");
		const fills = section?.querySelectorAll("td");
		expect(fills).toHaveLength(1);
		expect(fills?.[0]?.getAttribute("colspan")).toBe("3");
		expect(fills?.[0]?.textContent).toBe(""); // no formatter, no "–"
	});

	test("subtotal & total carry their data-kind and a full value row", () => {
		const root = grid(pnl);
		const subtotal = root.querySelector('tr[data-kind="subtotal"]');
		expect(subtotal?.querySelectorAll("td")).toHaveLength(3);
		const total = root.querySelector('tr[data-kind="total"]');
		expect(total).not.toBeNull();
	});

	test("spacer: aria-hidden full-width empty row, no label", () => {
		const spacer = grid(pnl).querySelector('tr[data-kind="spacer"]');
		expect(spacer?.getAttribute("aria-hidden")).toBe("true");
		expect(spacer?.querySelector("th")).toBeNull();
		const cell = spacer?.querySelectorAll("td");
		expect(cell).toHaveLength(1);
		expect(cell?.[0]?.getAttribute("colspan")).toBe("4");
	});

	test("section fill cell is skipped for a label-only (single-column) model", () => {
		const section = grid({
			columns: [{ id: "line", header: "", sticky: "left" }],
			rows: [{ kind: "section", label: "Assets" }],
		}).querySelector('tr[data-kind="section"]');
		expect(section?.querySelector("th")?.textContent).toBe("Assets");
		expect(section?.querySelectorAll("td")).toHaveLength(0);
	});
});

describe("formatting", () => {
	test("formats values via formatAccounting: grouping, parens, zero", () => {
		const root = grid(pnl);
		expect(root.textContent).toContain("1,000");
		expect(root.textContent).toContain("(1,234)"); // negative total
		const otherRow = [...root.querySelectorAll('tr[data-kind="line"]')].find((r) =>
			r.textContent?.startsWith("Other"),
		);
		expect(otherRow?.querySelector("td")?.textContent).toBe("0"); // 0, not blank
	});

	test("null and absent cells render the blank placeholder", () => {
		const services = [...grid(pnl).querySelectorAll('tr[data-kind="line"]')].find((r) =>
			r.textContent?.startsWith("Services"),
		);
		const cells = services?.querySelectorAll("td");
		expect(cells?.[1]?.textContent).toBe(DASH); // budget absent -> "–"
	});

	test("defaultFormat threads a statement-wide scale to every cell", () => {
		const { container } = render(
			<Grid
				model={{
					columns: [
						{ id: "line", header: "", sticky: "left" },
						{ id: "v", header: "V", numeric: true },
					],
					rows: [{ kind: "line", label: "Big", values: { v: 1_234_567 } }],
				}}
				defaultFormat={{ scale: "thousands" }}
			/>,
		);
		expect(container.querySelector('tr[data-kind="line"] td')?.textContent).toBe("1,235");
	});
});

describe("presentation hooks", () => {
	test("numeric value cells get is-num + data-align=right; label is left", () => {
		const line = grid(pnl).querySelector('tr[data-kind="line"]');
		expect(line?.querySelector("th")?.getAttribute("data-align")).toBe("left");
		const td = line?.querySelector("td");
		expect(td?.classList.contains("is-num")).toBe(true);
		expect(td?.getAttribute("data-align")).toBe("right");
	});

	test("Column.align overrides the numeric default", () => {
		const td = grid({
			columns: [
				{ id: "line", header: "", sticky: "left" },
				{ id: "v", header: "V", numeric: true, align: "center" },
			],
			rows: [{ kind: "line", label: "x", values: { v: 1 } }],
		}).querySelector("td");
		expect(td?.getAttribute("data-align")).toBe("center");
	});

	test("depth sets --cn-depth on the label cell; unset -> 0", () => {
		const root = grid(pnl);
		const product = [...root.querySelectorAll('tr[data-kind="line"]')].find((r) =>
			r.textContent?.startsWith("Product"),
		);
		expect(product?.querySelector("th")?.style.getPropertyValue("--cn-depth")).toBe("1");
		const section = root.querySelector<HTMLElement>('tr[data-kind="section"] th');
		expect(section?.style.getPropertyValue("--cn-depth")).toBe("0"); // depth undefined -> 0
	});

	test("without Column.sticky the label column is NOT sticky", () => {
		const line = grid({
			columns: [
				{ id: "line", header: "" },
				{ id: "v", header: "V", numeric: true },
			],
			rows: [{ kind: "line", label: "x", values: { v: 1 } }],
		}).querySelector('tr[data-kind="line"] th');
		expect(line?.classList.contains("is-sticky")).toBe(false);
	});
});

describe("footer pinning", () => {
	test("a trailing total is pinned into <tfoot> exactly once, not in <tbody>", () => {
		const root = grid(pnl);
		const foot = root.querySelector("tfoot");
		expect(foot?.querySelector('tr[data-kind="total"] th')?.textContent).toBe("Net income");
		expect(root.querySelector("tbody")?.textContent).not.toContain("Net income");
		expect(screen.getAllByText("Net income")).toHaveLength(1); // double-render guard
	});

	test("the pinned footer label cell is sticky (bottom-left corner)", () => {
		const label = grid(pnl).querySelector("tfoot th");
		expect(label?.classList.contains("is-sticky")).toBe(true);
	});

	test("a mid-sheet total (rows follow it) stays inline; no <tfoot>", () => {
		const root = grid({
			columns: [
				{ id: "line", header: "", sticky: "left" },
				{ id: "v", header: "V", numeric: true },
			],
			rows: [
				{ kind: "total", label: "Total assets", values: { v: 800 } },
				{ kind: "section", label: "Liabilities" },
			],
		});
		expect(root.querySelector("tfoot")).toBeNull();
		expect(root.querySelector("tbody")?.textContent).toContain("Total assets");
	});

	test("stickyFooter={false} keeps the terminal total inline and emits no footer", () => {
		const { container } = render(<Grid model={pnl} stickyFooter={false} />);
		expect(container.querySelector("tfoot")).toBeNull();
		expect(container.querySelector("tbody")?.textContent).toContain("Net income");
	});

	test("trailing spacers after the total don't stop it pinning", () => {
		const root = grid({
			columns: [
				{ id: "line", header: "", sticky: "left" },
				{ id: "v", header: "V", numeric: true },
			],
			rows: [
				{ kind: "total", label: "Net income", values: { v: 10 } },
				{ kind: "spacer", id: "z" },
			],
		});
		expect(root.querySelector("tfoot th")?.textContent).toBe("Net income");
	});
});

describe("accessibility & edge cases", () => {
	test("caption supplies the table's accessible name", () => {
		render(<Grid model={pnl} caption="Income statement" />);
		expect(screen.getByRole("table", { name: "Income statement" })).toBeInTheDocument();
	});

	test("aria-label names the table when there is no caption", () => {
		render(<Grid model={pnl} aria-label="P&L" />);
		expect(screen.getByRole("table", { name: "P&L" })).toBeInTheDocument();
	});

	test("an empty rows array renders a valid table without crashing", () => {
		const root = grid({ columns: pnl.columns, rows: [] });
		expect(root.querySelector("thead")).not.toBeNull();
		expect(root.querySelector("tbody")?.children).toHaveLength(0);
		expect(root.querySelector("tfoot")).toBeNull();
	});

	test("className is appended to the root, not replaced", () => {
		const { container } = render(<Grid model={pnl} className="my-grid" />);
		const root = container.querySelector(".columnar");
		expect(root?.classList.contains("columnar")).toBe(true);
		expect(root?.classList.contains("my-grid")).toBe(true);
	});
});
