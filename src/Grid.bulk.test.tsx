import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Grid } from "./Grid";
import type { GridModel } from "./types";

/**
 * Stage 3a — range selection (keyboard + band). Same P&L as the edit suite: editable
 * cells (row-major) are 1:1 1:2 · 2:1 2:2 · 3:1 3:2 (col 3 "var" is locked; rows 4/5
 * are subtotal/total). `bulk` is a superset of `edit`, so the active cell seeds on 1:1.
 * The clipboard / fill / pointer-drag layer arrives in Stage 3b.
 */
const model: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left" },
		{ id: "actual", header: "Actual", numeric: true },
		{ id: "budget", header: "Budget", numeric: true },
		{ id: "var", header: "Var", numeric: true, editable: false },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			id: "prod",
			label: "Product",
			values: { actual: 1000, budget: 950, var: 50 },
		},
		{ kind: "line", label: "Services", values: { actual: 240, budget: null, var: -10 } },
		{ kind: "line", label: "Other", values: { var: 0 } },
		{ kind: "subtotal", label: "Total", values: { actual: 1240 } },
		{ kind: "total", label: "Net", values: { actual: -1234 } },
	],
};

function must<T>(el: T | null | undefined): T {
	if (el === null || el === undefined) {
		throw new Error("expected the element to exist");
	}
	return el;
}

function cell(container: HTMLElement, row: number, col: number) {
	return container.querySelector<HTMLElement>(`[data-fs-row="${row}"][data-fs-col="${col}"]`);
}
function bulk() {
	return render(<Grid model={model} mode="bulk" onEdit={vi.fn()} />);
}
function selectedCount(container: HTMLElement) {
	return container.querySelectorAll("[data-fs-selected]").length;
}
function isSelected(container: HTMLElement, row: number, col: number) {
	return cell(container, row, col)?.getAttribute("data-fs-selected") === "true";
}
function isActive(container: HTMLElement, row: number, col: number) {
	return cell(container, row, col)?.getAttribute("aria-current") === "true";
}

describe("bulk mode is a superset of edit", () => {
	test("renders the same editable surface: first cell active, a single tab stop, no band", () => {
		const { container } = bulk();
		expect(cell(container, 1, 1)?.getAttribute("tabindex")).toBe("0");
		expect(container.querySelectorAll('[data-fs-row][tabindex="0"]')).toHaveLength(1);
		expect(selectedCount(container)).toBe(0);
	});
});

describe("range extension", () => {
	test("shift+arrow extends from the anchor; the focus corner is active, the anchor is banded", () => {
		const { container } = bulk();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
		expect(isActive(container, 1, 2)).toBe(true); // focus corner
		expect(isSelected(container, 1, 2)).toBe(false); // the focus corner is never in the band
		expect(isSelected(container, 1, 1)).toBe(true); // the anchor is
		expect(selectedCount(container)).toBe(1);
	});

	test("shift+arrow extends across rows into a rectangle", () => {
		const { container } = bulk();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "ArrowDown", shiftKey: true });
		// anchor 1:1, focus 2:2 → the 2×2 band minus the focus corner = 3 cells.
		expect(isActive(container, 2, 2)).toBe(true);
		expect(selectedCount(container)).toBe(3);
		expect(isSelected(container, 1, 1)).toBe(true);
		expect(isSelected(container, 2, 1)).toBe(true);
	});

	test("shift+arrow at the boundary keeps the selection (no extend past the edge)", () => {
		const { container } = bulk();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowLeft", shiftKey: true });
		expect(selectedCount(container)).toBe(0); // col 1 is the leftmost editable → swallowed
		expect(isActive(container, 1, 1)).toBe(true);
	});
});

describe("select all", () => {
	test("Cmd/Ctrl+A selects every editable cell; the last is the focus, the rest the band", () => {
		const { container } = bulk();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "a", metaKey: true });
		expect(selectedCount(container)).toBe(5); // 6 editable cells − the focus corner
		expect(isActive(container, 3, 2)).toBe(true); // the last editable cell is the focus
		expect(isSelected(container, 1, 1)).toBe(true);
	});
});

describe("collapse", () => {
	test("Escape collapses a multi-cell selection to the focus cell", () => {
		const { container } = bulk();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "Escape" });
		expect(selectedCount(container)).toBe(0);
		expect(isActive(container, 1, 2)).toBe(true); // the focus corner is kept
	});

	test("Escape on a single cell is a no-op (falls through to edit-mode handling)", () => {
		const { container } = bulk();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Escape" });
		expect(selectedCount(container)).toBe(0);
		expect(isActive(container, 1, 1)).toBe(true);
	});

	test("a plain arrow collapses the range and moves (bulk falls through to nav)", () => {
		const { container } = bulk();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "ArrowDown" }); // plain → move + collapse
		expect(selectedCount(container)).toBe(0);
		expect(isActive(container, 2, 2)).toBe(true);
	});
});

describe("pointer", () => {
	test("shift-click extends from the anchor to the clicked cell", () => {
		const { container } = bulk();
		fireEvent.click(must(cell(container, 2, 2)), { shiftKey: true });
		expect(isActive(container, 2, 2)).toBe(true);
		expect(selectedCount(container)).toBe(3); // 1:1, 1:2, 2:1
	});

	test("a plain click lands and collapses the range", () => {
		const { container } = bulk();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
		fireEvent.click(must(cell(container, 3, 1))); // plain → land + collapse
		expect(isActive(container, 3, 1)).toBe(true);
		expect(selectedCount(container)).toBe(0);
	});
});

describe("reconcile (preserve vs collapse)", () => {
	test("a same-shape re-render keeps the selection highlighted", () => {
		const { container, rerender } = render(<Grid model={model} mode="bulk" onEdit={vi.fn()} />);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
		expect(selectedCount(container)).toBe(1);
		// a fresh model object, identical structure → both corners survive → rect preserved.
		rerender(
			<Grid
				model={{ columns: model.columns, rows: [...model.rows] }}
				mode="bulk"
				onEdit={vi.fn()}
			/>,
		);
		expect(selectedCount(container)).toBe(1);
		expect(isActive(container, 1, 2)).toBe(true);
	});

	test("a structural change that invalidates the selection collapses the band", () => {
		const { container, rerender } = render(<Grid model={model} mode="bulk" onEdit={vi.fn()} />);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
		expect(selectedCount(container)).toBe(1);
		// every editable cell removed → both corners invalid → collapse.
		rerender(
			<Grid
				model={{
					columns: model.columns,
					rows: [{ kind: "total", label: "Net", values: { actual: 1 } }],
				}}
				mode="bulk"
				onEdit={vi.fn()}
			/>,
		);
		expect(selectedCount(container)).toBe(0);
		expect(container.querySelector("[data-fs-row]")).toBeNull();
	});
});
