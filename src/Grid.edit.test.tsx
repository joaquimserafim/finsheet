import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { Grid } from "./Grid";
import type { CellEdit, GridModel } from "./types";

/**
 * A P&L exercising every edit branch: two editable value columns (actual/budget), a
 * locked numeric column (var), an explicit-null cell, an absent cell, and
 * subtotal/total rows that must never be editable.
 *
 *   row 1 Product  actual 1000  budget 950   var 50
 *   row 2 Services actual 240   budget null  var -10
 *   row 3 Other    actual —     budget —     var 0
 *   row 4 Total (subtotal)   row 5 Net (total)
 *
 * Editable cells (row-major): 1:1 1:2  2:1 2:2  3:1 3:2 — active seeds on 1:1.
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
function editor(container: HTMLElement) {
	return container.querySelector<HTMLInputElement>(".finsheet-cell-input");
}
function tabindexOf(container: HTMLElement, row: number, col: number) {
	return cell(container, row, col)?.getAttribute("tabindex");
}

function editable(onEdit: (c: CellEdit) => void = vi.fn()) {
	return render(<Grid model={model} mode="edit" onEdit={onEdit} />);
}

/** Apply a committed edit to the model, for the controlled-loop tests. */
function applyEdit(m: GridModel, change: CellEdit): GridModel {
	return {
		columns: m.columns,
		rows: m.rows.map((row, i) =>
			i === change.rowIndex && "values" in row
				? { ...row, values: { ...row.values, [change.columnId]: change.value } }
				: row,
		),
	};
}

describe("view mode is untouched", () => {
	test("no editing affordances: no coords, no inputs, no tab stop", () => {
		const { container } = render(<Grid model={model} />); // default "view"
		expect(container.querySelector("[data-fs-row]")).toBeNull();
		expect(container.querySelector(".finsheet-cell-input")).toBeNull();
		expect(container.querySelector('[tabindex="0"]')).toBeNull();
	});
});

describe("roving structure", () => {
	test("only editable cells are tab stops; the first is active, the rest are -1", () => {
		const { container } = editable();
		expect(tabindexOf(container, 1, 1)).toBe("0");
		expect(tabindexOf(container, 1, 2)).toBe("-1");
		expect(container.querySelectorAll('[data-fs-row][tabindex="0"]')).toHaveLength(1);
	});

	test("locked columns, subtotals and totals are never editable", () => {
		const { container } = editable();
		expect(cell(container, 1, 3)).toBeNull(); // var column (editable: false)
		expect(cell(container, 4, 1)).toBeNull(); // subtotal row
		expect(cell(container, 5, 1)).toBeNull(); // total row
	});
});

describe("pointer", () => {
	test("clicking an editable cell makes it the active tab stop", () => {
		const { container } = editable();
		fireEvent.click(must(cell(container, 2, 1)));
		expect(tabindexOf(container, 2, 1)).toBe("0");
		expect(tabindexOf(container, 1, 1)).toBe("-1");
	});

	test("clicking a non-editable cell leaves the active cell unchanged", () => {
		const { container } = editable();
		fireEvent.click(must(container.querySelector('tr[data-kind="section"] th')));
		expect(tabindexOf(container, 1, 1)).toBe("0");
	});

	test("double-click opens the editor keeping the value; the td leaves the tab order", () => {
		const { container } = editable();
		fireEvent.doubleClick(must(cell(container, 2, 1)));
		expect(must(editor(container)).value).toBe("240");
		expect(tabindexOf(container, 2, 1)).toBe("-1");
	});

	test("double-click on a non-editable cell does nothing", () => {
		const { container } = editable();
		fireEvent.doubleClick(must(container.querySelector('tr[data-kind="section"] th')));
		expect(editor(container)).toBeNull();
	});

	test("clicking / double-clicking inside the editor never cancels or restarts it", () => {
		const { container } = editable();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.click(must(editor(container)));
		expect(editor(container)).not.toBeNull();
		fireEvent.doubleClick(must(editor(container)));
		expect(editor(container)).not.toBeNull();
	});
});

describe("keyboard navigation", () => {
	test("arrows move to the next editable cell, skipping the locked column", () => {
		const { container } = editable();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight" });
		expect(tabindexOf(container, 1, 2)).toBe("0");
		// col 3 (var) is locked → right is a boundary, stays put
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "ArrowRight" });
		expect(tabindexOf(container, 1, 2)).toBe("0");
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "ArrowDown" });
		expect(tabindexOf(container, 2, 2)).toBe("0");
	});

	test("Tab past the last editable cell doesn't move (focus leaves the grid)", () => {
		const { container } = editable();
		fireEvent.click(must(cell(container, 3, 2)));
		fireEvent.keyDown(must(cell(container, 3, 2)), { key: "Tab" });
		expect(tabindexOf(container, 3, 2)).toBe("0");
	});

	test("a modifier combo is left to the browser (no navigation)", () => {
		const { container } = editable();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowDown", ctrlKey: true });
		expect(tabindexOf(container, 1, 1)).toBe("0");
	});

	test("an unhandled key while not editing is a no-op", () => {
		const { container } = editable();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Escape" });
		expect(tabindexOf(container, 1, 1)).toBe("0");
	});

	test("with no editable cells, keys are inert", () => {
		const onlyTotals: GridModel = {
			columns: model.columns,
			rows: [{ kind: "subtotal", label: "Total", values: { actual: 1 } }],
		};
		const { container } = render(<Grid model={onlyTotals} mode="edit" onEdit={vi.fn()} />);
		expect(container.querySelector("[data-fs-row]")).toBeNull();
		fireEvent.keyDown(must(container.querySelector("table")), { key: "ArrowDown" });
		expect(container.querySelector('[tabindex="0"]')).toBeNull();
	});
});

describe("editing", () => {
	test("typing a digit opens the editor seeded with it; Enter commits and moves down", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "7" });
		expect(must(editor(container)).value).toBe("7");
		fireEvent.keyDown(must(editor(container)), { key: "Enter" });
		expect(onEdit).toHaveBeenCalledWith({
			rowId: "prod",
			rowIndex: 1,
			columnId: "actual",
			value: 7,
		});
		expect(tabindexOf(container, 2, 1)).toBe("0"); // moved down
		expect(editor(container)).toBeNull();
	});

	test("Enter reveals the raw value; a changed Tab-commit fires onEdit and moves right", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		expect(must(editor(container)).value).toBe("1000"); // raw units revealed
		fireEvent.change(must(editor(container)), { target: { value: "1234" } });
		fireEvent.keyDown(must(editor(container)), { key: "Tab" });
		expect(onEdit).toHaveBeenCalledWith({
			rowId: "prod",
			rowIndex: 1,
			columnId: "actual",
			value: 1234,
		});
		expect(tabindexOf(container, 1, 2)).toBe("0");
	});

	test("re-committing the same value fires no onEdit but still leaves the editor", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.keyDown(must(editor(container)), { key: "Enter" }); // value unchanged
		expect(onEdit).not.toHaveBeenCalled();
		expect(editor(container)).toBeNull();
	});

	test("an unparseable commit is rejected: the editor stays open and flags invalid", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.change(must(editor(container)), { target: { value: "not a number" } });
		fireEvent.keyDown(must(editor(container)), { key: "Enter" });
		expect(onEdit).not.toHaveBeenCalled();
		const stillOpen = must(editor(container));
		expect(stillOpen.classList.contains("is-invalid")).toBe(true);
		expect(stillOpen.getAttribute("aria-invalid")).toBe("true");
		// and it is recoverable
		fireEvent.change(stillOpen, { target: { value: "5" } });
		fireEvent.keyDown(must(editor(container)), { key: "Enter" });
		expect(onEdit).toHaveBeenCalledWith({
			rowId: "prod",
			rowIndex: 1,
			columnId: "actual",
			value: 5,
		});
	});

	test("Escape discards the draft and keeps the cell active with its old value", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.change(must(editor(container)), { target: { value: "9999" } });
		fireEvent.keyDown(must(editor(container)), { key: "Escape" });
		expect(onEdit).not.toHaveBeenCalled();
		expect(editor(container)).toBeNull();
		expect(tabindexOf(container, 1, 1)).toBe("0");
		expect(must(cell(container, 1, 1)).textContent).toContain("1,000");
	});

	test("caret keys inside the editor are left to the input; the container ignores them", () => {
		const { container } = editable();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.keyDown(must(editor(container)), { key: "ArrowLeft" }); // caret, not a commit
		expect(editor(container)).not.toBeNull();
		// a key bubbling to the scroll port while editing must not navigate
		fireEvent.keyDown(must(container.querySelector<HTMLElement>(".finsheet")), {
			key: "ArrowDown",
		});
		expect(editor(container)).not.toBeNull();
	});

	test("Enter during IME composition does not commit", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.change(must(editor(container)), { target: { value: "5" } });
		fireEvent.keyDown(must(editor(container)), { key: "Enter", isComposing: true });
		expect(onEdit).not.toHaveBeenCalled();
		expect(editor(container)).not.toBeNull();
	});

	test("editing a null cell or an absent cell starts from an empty string", () => {
		const { container } = editable();
		fireEvent.doubleClick(must(cell(container, 2, 2))); // budget = null
		expect(must(editor(container)).value).toBe("");
		fireEvent.keyDown(must(editor(container)), { key: "Escape" });
		fireEvent.doubleClick(must(cell(container, 3, 1))); // actual absent
		expect(must(editor(container)).value).toBe("");
	});

	test("the editor's accessible name omits an empty column header", () => {
		const headerless: GridModel = {
			columns: [
				{ id: "line", header: "", sticky: "left" },
				{ id: "v", header: "", numeric: true }, // editable, no header
			],
			rows: [{ kind: "line", label: "Cash", values: { v: 5 } }],
		};
		const { container } = render(<Grid model={headerless} mode="edit" onEdit={vi.fn()} />);
		fireEvent.doubleClick(must(cell(container, 0, 1)));
		expect(must(editor(container)).getAttribute("aria-label")).toBe("Cash");
	});
});

describe("clearing", () => {
	test("Backspace clears a populated cell to null; Delete on a blank cell is a no-op", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Backspace" });
		expect(onEdit).toHaveBeenCalledWith({
			rowId: "prod",
			rowIndex: 1,
			columnId: "actual",
			value: null,
		});
		onEdit.mockClear();
		fireEvent.click(must(cell(container, 3, 1))); // Other/actual is absent
		fireEvent.keyDown(must(cell(container, 3, 1)), { key: "Delete" });
		expect(onEdit).not.toHaveBeenCalled();
	});
});

describe("blur", () => {
	test("blur commits a changed value and leaves the editor", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.change(must(editor(container)), { target: { value: "42" } });
		fireEvent.blur(must(editor(container)));
		expect(onEdit).toHaveBeenCalledWith({
			rowId: "prod",
			rowIndex: 1,
			columnId: "actual",
			value: 42,
		});
		expect(editor(container)).toBeNull();
	});

	test("blur with an unchanged value leaves the editor without firing onEdit", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.blur(must(editor(container)));
		expect(onEdit).not.toHaveBeenCalled();
		expect(editor(container)).toBeNull();
	});

	test("blur with an invalid draft discards it (value unchanged)", () => {
		const onEdit = vi.fn();
		const { container } = editable(onEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.change(must(editor(container)), { target: { value: "xyz" } });
		fireEvent.blur(must(editor(container)));
		expect(onEdit).not.toHaveBeenCalled();
		expect(editor(container)).toBeNull();
		expect(must(cell(container, 1, 1)).textContent).toContain("1,000");
	});
});

describe("controlled loop & lifecycle", () => {
	test("a committed edit round-trips through the consumer and updates the value", () => {
		function Harness() {
			const [m, setM] = useState(model);
			return (
				<Grid model={m} mode="edit" onEdit={(c) => setM((prev) => applyEdit(prev, c))} />
			);
		}
		const { container } = render(<Harness />);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.change(must(editor(container)), { target: { value: "2500" } });
		fireEvent.keyDown(must(editor(container)), { key: "Tab" });
		expect(must(cell(container, 1, 1)).textContent).toContain("2,500");
	});

	test("committing without an onEdit handler does not throw", () => {
		const { container } = render(<Grid model={model} mode="edit" />);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.change(must(editor(container)), { target: { value: "3" } });
		expect(() => fireEvent.keyDown(must(editor(container)), { key: "Enter" })).not.toThrow();
	});

	test("a model change that removes every editable cell clears the active cell", () => {
		const { container, rerender } = editable();
		expect(tabindexOf(container, 1, 1)).toBe("0");
		const noEdits: GridModel = {
			columns: model.columns,
			rows: [{ kind: "total", label: "Net", values: { actual: 1 } }],
		};
		rerender(<Grid model={noEdits} mode="edit" onEdit={vi.fn()} />);
		expect(container.querySelector("[data-fs-row]")).toBeNull();
		expect(container.querySelector('[tabindex="0"]')).toBeNull();
	});

	test("edit mode renders on the server (no DOM) without throwing", () => {
		const html = renderToString(<Grid model={model} mode="edit" />);
		expect(html).toContain("finsheet-table");
	});
});

describe("review fixes", () => {
	test("type-to-edit keeps the seed char (caret at end); F2 selects all so typing replaces", () => {
		const { container } = editable();
		// seeded by a typed digit → caret collapsed at the end (append), NOT select-all
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "7" });
		const seeded = must(editor(container));
		expect(seeded.value).toBe("7");
		expect(seeded.selectionStart).toBe(1);
		expect(seeded.selectionEnd).toBe(1);
		fireEvent.keyDown(seeded, { key: "Escape" });
		// opened with the existing value → whole value selected (typing replaces it)
		fireEvent.doubleClick(must(cell(container, 1, 1)));
		const revealed = must(editor(container));
		expect(revealed.value).toBe("1000");
		expect(revealed.selectionStart).toBe(0);
		expect(revealed.selectionEnd).toBe(4);
	});

	test("the active cell exposes aria-current for assistive tech", () => {
		const { container } = editable();
		expect(must(cell(container, 1, 1)).getAttribute("aria-current")).toBe("true");
		expect(cell(container, 1, 2)?.getAttribute("aria-current")).toBe(null);
	});

	test("a sub-1e-6 value seeds as a plain decimal and re-commits cleanly (no false invalid)", () => {
		const onEdit = vi.fn();
		const tiny: GridModel = {
			columns: [
				{ id: "line", header: "", sticky: "left" },
				{ id: "v", header: "V", numeric: true },
			],
			rows: [{ kind: "line", id: "r", label: "Rate", values: { v: 0.0000005 } }],
		};
		const { container } = render(<Grid model={tiny} mode="edit" onEdit={onEdit} />);
		fireEvent.keyDown(must(cell(container, 0, 1)), { key: "Enter" });
		expect(must(editor(container)).value).toBe("0.0000005"); // not "5e-7"
		fireEvent.keyDown(must(editor(container)), { key: "Enter" }); // unchanged commit
		expect(onEdit).not.toHaveBeenCalled(); // no-op suppressed, not rejected as invalid
		expect(editor(container)).toBeNull(); // left the editor cleanly
	});

	test("removing a row under an open editor discards the draft (no wrong-row commit)", () => {
		const onEdit = vi.fn();
		const { container, rerender } = render(<Grid model={model} mode="edit" onEdit={onEdit} />);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" }); // edit Product
		fireEvent.change(must(editor(container)), { target: { value: "1500" } });
		// consumer drops the section row → length 6 → 5, Product shifts up
		rerender(
			<Grid
				model={{ columns: model.columns, rows: model.rows.slice(1) }}
				mode="edit"
				onEdit={onEdit}
			/>,
		);
		expect(editor(container)).toBeNull(); // editor torn down, draft discarded
		expect(onEdit).not.toHaveBeenCalled(); // never committed to the wrong row
	});

	test("a same-length reorder under the editor also discards the draft", () => {
		const onEdit = vi.fn();
		const { container, rerender } = render(<Grid model={model} mode="edit" onEdit={onEdit} />);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" }); // edit Product (id "prod") at row 1
		fireEvent.change(must(editor(container)), { target: { value: "1500" } });
		const r = model.rows;
		// swap rows 1 and 2 → row 1 now holds Services (different identity), same length
		rerender(
			<Grid
				model={{
					columns: model.columns,
					rows: [must(r[0]), must(r[2]), must(r[1]), must(r[3]), must(r[4]), must(r[5])],
				}}
				mode="edit"
				onEdit={onEdit}
			/>,
		);
		expect(editor(container)).toBeNull();
		expect(onEdit).not.toHaveBeenCalled();
	});

	test("a same-shape re-render while editing keeps the editor open (draft preserved)", () => {
		const onEdit = vi.fn();
		const { container, rerender } = render(<Grid model={model} mode="edit" onEdit={onEdit} />);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.change(must(editor(container)), { target: { value: "1500" } });
		// an unrelated parent re-render: a fresh model object, identical structure
		rerender(
			<Grid
				model={{ columns: model.columns, rows: [...model.rows] }}
				mode="edit"
				onEdit={onEdit}
			/>,
		);
		expect(must(editor(container)).value).toBe("1500"); // still editing, draft intact
	});

	test("flipping to view mode while editing tears the editor down with no spurious commit", () => {
		const onEdit = vi.fn();
		const { container, rerender } = render(<Grid model={model} mode="edit" onEdit={onEdit} />);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		fireEvent.change(must(editor(container)), { target: { value: "1500" } });
		rerender(<Grid model={model} mode="view" onEdit={onEdit} />);
		expect(editor(container)).toBeNull();
		expect(container.querySelector("[data-fs-row]")).toBeNull(); // back to the read-only surface
		expect(onEdit).not.toHaveBeenCalled();
	});
});
