import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Grid } from "./Grid";
import type { BulkEdit, GridModel } from "./types";

/**
 * Bulk mode — the range/clipboard/fill/pointer surface. Same P&L as the edit suite:
 * editable cells (row-major) are 1:1 1:2 · 2:1 2:2 · 3:1 3:2 (col 3 "var" is locked;
 * rows 4/5 are subtotal/total). `bulk` is a superset of `edit`, so the active cell
 * seeds on 1:1. Stage 3a covers range selection (keyboard + band); Stage 3b adds the
 * write gestures — clipboard copy/cut/paste, fill-down/right, range-clear — and pointer
 * drag-select. (Real-clipboard fidelity + Cmd+R/D preventDefault land in the Stage 4
 * @vitest/browser suite.)
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
function bulkWith(onBulkEdit: (c: BulkEdit) => void) {
	return render(<Grid model={model} mode="bulk" onEdit={vi.fn()} onBulkEdit={onBulkEdit} />);
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
function port(container: HTMLElement) {
	return must(container.querySelector<HTMLElement>(".finsheet"));
}
function section(container: HTMLElement) {
	return must(container.querySelector<HTMLElement>('tr[data-kind="section"] th'));
}

/** A minimal DataTransfer stub carrying one text/plain payload; `setData` is a spy so
 *  copy/cut assertions can read what the grid serialised. */
function clip(text = "") {
	const data: Record<string, string> = { "text/plain": text };
	return {
		getData: (type: string) => data[type] ?? "",
		setData: vi.fn((type: string, value: string) => {
			data[type] = value;
		}),
	};
}

/** Dispatch a clipboard event carrying `clipboardData`. `new Event` (not ClipboardEvent)
 *  sidesteps happy-dom's read-only `clipboardData`; React surfaces the defined property. */
function fireClipboard(
	node: Element,
	type: "copy" | "cut" | "paste",
	clipboardData: ReturnType<typeof clip>,
) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", { value: clipboardData });
	return fireEvent(node, event);
}

/** Anchor 1:1 → active 2:2: the 2×2 rectangle over the two editable value columns. */
function selectTwoByTwo(container: HTMLElement) {
	fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
	fireEvent.keyDown(must(cell(container, 1, 2)), { key: "ArrowDown", shiftKey: true });
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

describe("clipboard — copy", () => {
	test("copy serialises the selection rectangle to raw TSV (blanks as empty cells)", () => {
		const { container } = bulk();
		selectTwoByTwo(container);
		const cd = clip();
		fireClipboard(port(container), "copy", cd);
		// rows 1–2 × cols actual/budget: 1000,950 · 240,(blank) — raw units, tabs + CRLF.
		expect(cd.setData).toHaveBeenCalledWith("text/plain", "1000\t950\r\n240\t");
	});
});

describe("clipboard — paste", () => {
	test("a multi-cell block maps positionally from the collapsed active cell", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		fireClipboard(port(container), "paste", clip("5\t6\r\n7\t8"));
		expect(onBulkEdit).toHaveBeenCalledTimes(1);
		expect(onBulkEdit).toHaveBeenCalledWith({
			kind: "paste",
			edits: [
				{ rowId: "prod", rowIndex: 1, columnId: "actual", value: 5 },
				{ rowId: "prod", rowIndex: 1, columnId: "budget", value: 6 },
				{ rowIndex: 2, columnId: "actual", value: 7 },
				{ rowIndex: 2, columnId: "budget", value: 8 },
			],
			rejected: [],
			skipped: [],
		});
	});

	test("a 1×1 clipboard broadcasts to every editable cell in the range", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		selectTwoByTwo(container);
		fireClipboard(port(container), "paste", clip("9"));
		const op = must(onBulkEdit.mock.calls[0])[0] as BulkEdit;
		expect(op.kind).toBe("paste");
		expect(op.edits).toHaveLength(4); // all four editable cells in the 2×2
		expect(op.edits.every((e) => e.value === 9)).toBe(true);
	});

	test("an unparseable cell rejects the whole paste (atomic) and reports it", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		fireClipboard(port(container), "paste", clip("abc"));
		expect(onBulkEdit).toHaveBeenCalledTimes(1);
		expect(onBulkEdit).toHaveBeenCalledWith({
			kind: "paste",
			edits: [], // atomic: one rejection ⇒ nothing written
			rejected: [{ rowIndex: 1, columnId: "actual", text: "abc" }],
			skipped: [],
		});
	});

	test("a non-editable target is skipped, not silently dropped", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		fireEvent.click(must(cell(container, 1, 2))); // land the paste corner on budget
		fireClipboard(port(container), "paste", clip("5\t6")); // col 2 → budget, col 3 → locked var
		expect(onBulkEdit).toHaveBeenCalledWith({
			kind: "paste",
			edits: [{ rowId: "prod", rowIndex: 1, columnId: "budget", value: 5 }],
			rejected: [],
			skipped: [{ rowIndex: 1, columnId: "var" }],
		});
	});

	test("pasting a value equal to the target emits nothing", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		fireClipboard(port(container), "paste", clip("1000")); // 1:1 already 1000
		expect(onBulkEdit).not.toHaveBeenCalled();
	});

	test("an empty clipboard is a no-op", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		fireClipboard(port(container), "paste", clip(""));
		expect(onBulkEdit).not.toHaveBeenCalled();
	});
});

describe("clipboard — cut", () => {
	test("cut copies the rectangle and clears its editable cells in one op", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		selectTwoByTwo(container);
		const cd = clip();
		fireClipboard(port(container), "cut", cd);
		expect(cd.setData).toHaveBeenCalledWith("text/plain", "1000\t950\r\n240\t");
		expect(onBulkEdit).toHaveBeenCalledTimes(1);
		expect(onBulkEdit).toHaveBeenCalledWith({
			kind: "clear",
			edits: [
				{ rowId: "prod", rowIndex: 1, columnId: "actual", value: null },
				{ rowId: "prod", rowIndex: 1, columnId: "budget", value: null },
				{ rowIndex: 2, columnId: "actual", value: null }, // 2:2 already blank → skipped
			],
		});
	});

	test("cut over an already-blank range copies but emits no clear", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		fireEvent.click(must(cell(container, 3, 1)));
		fireEvent.click(must(cell(container, 3, 2)), { shiftKey: true }); // both blank
		const cd = clip();
		fireClipboard(port(container), "cut", cd);
		expect(cd.setData).toHaveBeenCalledWith("text/plain", "\t"); // two blank cells
		expect(onBulkEdit).not.toHaveBeenCalled();
	});
});

describe("clipboard — guards", () => {
	test("an open editor keeps native copy/cut/paste (the input owns them)", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "F2" });
		const input = must(container.querySelector<HTMLElement>(".finsheet-cell-input"));
		const cd = clip("9\t9");
		fireClipboard(input, "copy", cd);
		fireClipboard(input, "cut", cd);
		fireClipboard(input, "paste", cd);
		expect(cd.setData).not.toHaveBeenCalled(); // copy/cut bailed to the input
		expect(onBulkEdit).not.toHaveBeenCalled(); // cut/paste bailed
		expect(container.querySelector(".finsheet-cell-input")).not.toBeNull(); // still editing
	});

	test("with no editable cells the clipboard is inert", () => {
		const onBulkEdit = vi.fn();
		const noEdit: GridModel = {
			columns: model.columns,
			rows: [{ kind: "total", label: "Net", values: { actual: 1 } }],
		};
		const { container } = render(
			<Grid model={noEdit} mode="bulk" onEdit={vi.fn()} onBulkEdit={onBulkEdit} />,
		);
		const cd = clip("5");
		fireClipboard(port(container), "copy", cd);
		fireClipboard(port(container), "cut", cd);
		fireClipboard(port(container), "paste", cd);
		expect(cd.setData).not.toHaveBeenCalled();
		expect(onBulkEdit).not.toHaveBeenCalled();
	});

	test("a bulk write with no onBulkEdit handler never throws", () => {
		const { container } = bulk(); // no onBulkEdit
		selectTwoByTwo(container);
		expect(() => fireClipboard(port(container), "paste", clip("5\t6\r\n7\t8"))).not.toThrow();
	});
});

describe("fill", () => {
	test("Cmd/Ctrl+D fills each column down from its top editable cell", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		selectTwoByTwo(container);
		fireEvent.keyDown(must(cell(container, 2, 2)), { key: "d", metaKey: true });
		expect(onBulkEdit).toHaveBeenCalledWith({
			kind: "fill-down",
			edits: [
				{ rowIndex: 2, columnId: "actual", value: 1000 }, // 240 → 1000 (from 1:1)
				{ rowIndex: 2, columnId: "budget", value: 950 }, // blank → 950 (from 1:2)
			],
		});
	});

	test("Cmd/Ctrl+R fills each row right from its left editable cell", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		selectTwoByTwo(container);
		fireEvent.keyDown(must(cell(container, 2, 2)), { key: "r", ctrlKey: true });
		expect(onBulkEdit).toHaveBeenCalledWith({
			kind: "fill-right",
			edits: [
				{ rowId: "prod", rowIndex: 1, columnId: "budget", value: 1000 }, // 950 → 1000
				{ rowIndex: 2, columnId: "budget", value: 240 }, // blank → 240
			],
		});
	});

	test("fill on a single cell has no source, so it emits nothing", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "d", metaKey: true });
		expect(onBulkEdit).not.toHaveBeenCalled();
	});
});

describe("range clear", () => {
	test("Delete over a range clears every editable cell in it, in one op", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		selectTwoByTwo(container);
		fireEvent.keyDown(must(cell(container, 2, 2)), { key: "Delete" });
		expect(onBulkEdit).toHaveBeenCalledWith({
			kind: "clear",
			edits: [
				{ rowId: "prod", rowIndex: 1, columnId: "actual", value: null },
				{ rowId: "prod", rowIndex: 1, columnId: "budget", value: null },
				{ rowIndex: 2, columnId: "actual", value: null }, // 2:2 already blank
			],
		});
	});

	test("Delete over an already-blank range emits nothing", () => {
		const onBulkEdit = vi.fn();
		const { container } = bulkWith(onBulkEdit);
		fireEvent.click(must(cell(container, 3, 1)));
		fireEvent.click(must(cell(container, 3, 2)), { shiftKey: true });
		fireEvent.keyDown(must(cell(container, 3, 2)), { key: "Delete" });
		expect(onBulkEdit).not.toHaveBeenCalled();
	});

	test("Delete on a single cell falls through to a single-cell onEdit (not a bulk op)", () => {
		const onEdit = vi.fn();
		const onBulkEdit = vi.fn();
		const { container } = render(
			<Grid model={model} mode="bulk" onEdit={onEdit} onBulkEdit={onBulkEdit} />,
		);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Delete" });
		expect(onEdit).toHaveBeenCalledWith({
			rowId: "prod",
			rowIndex: 1,
			columnId: "actual",
			value: null,
		});
		expect(onBulkEdit).not.toHaveBeenCalled();
	});
});

describe("pointer drag-select", () => {
	test("dragging from a press extends a range; releasing ends it and keeps it", () => {
		const { container } = bulk();
		const div = port(container);
		fireEvent.pointerDown(must(cell(container, 1, 1)));
		expect(isActive(container, 1, 1)).toBe(true);
		// a move that stays on the anchor cell arms the drag but extends nothing
		fireEvent.pointerMove(must(cell(container, 1, 1)));
		expect(div.getAttribute("data-fs-dragging")).toBe("true");
		expect(selectedCount(container)).toBe(0);
		// dragging over a non-cell (a section header) holds the current selection
		fireEvent.pointerMove(section(container));
		expect(selectedCount(container)).toBe(0);
		// extend to 2:2 → the 2×2 band minus the focus corner = 3 banded cells
		fireEvent.pointerMove(must(cell(container, 2, 2)));
		expect(isActive(container, 2, 2)).toBe(true);
		expect(selectedCount(container)).toBe(3);
		fireEvent.pointerUp(div);
		expect(div.getAttribute("data-fs-dragging")).toBeNull();
		expect(selectedCount(container)).toBe(3); // the selection persists after release
	});

	test("shift+pointerdown does not start a drag (shift-click owns extension)", () => {
		const { container } = bulk();
		fireEvent.pointerDown(must(cell(container, 2, 2)), { shiftKey: true });
		fireEvent.pointerMove(must(cell(container, 2, 2)));
		expect(isActive(container, 1, 1)).toBe(true); // active unchanged (still the seed)
		expect(selectedCount(container)).toBe(0);
	});

	test("pressing inside an open editor never starts a drag", () => {
		const { container } = bulk();
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "F2" });
		const input = must(container.querySelector<HTMLElement>(".finsheet-cell-input"));
		fireEvent.pointerDown(input);
		expect(container.querySelector(".finsheet-cell-input")).not.toBeNull(); // still editing
	});

	test("pointerdown on a non-editable cell does nothing", () => {
		const { container } = bulk();
		fireEvent.pointerDown(section(container));
		expect(isActive(container, 1, 1)).toBe(true);
		expect(selectedCount(container)).toBe(0);
	});
});
