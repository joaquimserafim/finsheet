import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Grid } from "./Grid";
import type { BulkEdit, GridModel } from "./types";

/**
 * Epic 9 — `Column.format` is DISPLAY ONLY. These prove the formatter never leaks past the read
 * display: the editor seeds from the RAW stored value, `onEdit` / `onBulkEdit` carry raw numbers,
 * the clipboard round-trips raw TSV, a formatted-text paste is rejected atomically, and the
 * editable guard is format-blind. The raw seams (`rawCellText`, `parseAccounting`, `computeCopy`)
 * are untouched by Epic 9; this is the belt-and-suspenders integration proof that the wiring keeps
 * it that way.
 */

const model: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left" },
		{ id: "revenue", header: "Revenue", numeric: true, format: { type: "currency" } },
		{ id: "margin", header: "Margin", numeric: true, format: { type: "percent" } },
		// A formatted BUT locked column — must render as a plain, non-editable cell.
		{
			id: "growth",
			header: "Growth",
			numeric: true,
			editable: false,
			format: { type: "percent" },
		},
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			id: "prod",
			label: "Product",
			values: { revenue: 1000, margin: 0.4, growth: 0.12 },
		},
		{ kind: "line", label: "Services", values: { revenue: 240, margin: 0.625, growth: 0.08 } },
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
function port(container: HTMLElement) {
	return must(container.querySelector<HTMLElement>(".finsheet"));
}
/** A minimal DataTransfer stub; `setData` is a spy so copy assertions can read what was serialised. */
function clip(text = "") {
	const data: Record<string, string> = { "text/plain": text };
	return {
		getData: (type: string) => data[type] ?? "",
		setData: vi.fn((type: string, value: string) => {
			data[type] = value;
		}),
	};
}
function fireClipboard(
	node: Element,
	type: "copy" | "paste",
	clipboardData: ReturnType<typeof clip>,
) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", { value: clipboardData });
	return fireEvent(node, event);
}

describe("Epic 9 — Column.format is display-only", () => {
	test("the editor seeds from the RAW stored value, not the formatted text", () => {
		const { container } = render(<Grid model={model} mode="edit" onEdit={vi.fn()} />);
		// Currency cell revenue=1000 (the default active cell) displays "$1,000", edits "1000".
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "Enter" });
		expect(must(editor(container)).value).toBe("1000");
		fireEvent.keyDown(must(editor(container)), { key: "Escape" });
		expect(editor(container)).toBeNull();
		// Move to the percent cell margin=0.4 (displays "40.0%") and open it → raw ratio "0.4".
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight" });
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "Enter" });
		expect(must(editor(container)).value).toBe("0.4");
	});

	test("onEdit emits the RAW parsed number — a % cell commits its ratio, never ×100", () => {
		const onEdit = vi.fn();
		const { container } = render(<Grid model={model} mode="edit" onEdit={onEdit} />);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight" }); // active → margin (1,2)
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "Enter" }); // open margin editor
		fireEvent.change(must(editor(container)), { target: { value: "0.2" } });
		fireEvent.keyDown(must(editor(container)), { key: "Enter" }); // commit
		expect(onEdit).toHaveBeenCalledWith({
			rowId: "prod",
			rowIndex: 1,
			columnId: "margin",
			value: 0.2,
		});
	});

	test("the editable guard is format-blind — a formatted locked column is a plain (non-input) cell", () => {
		const { container } = render(<Grid model={model} mode="edit" onEdit={vi.fn()} />);
		expect(cell(container, 1, 3)).toBeNull(); // growth is editable:false ⇒ no editable cell
		expect(container.textContent).toContain("12.0%"); // …but still formatted
	});

	test("copy emits RAW TSV from formatted cells (Excel gets the real numbers)", () => {
		const { container } = render(
			<Grid model={model} mode="bulk" onEdit={vi.fn()} onBulkEdit={vi.fn()} />,
		);
		// Select revenue+margin on the Product row, then copy.
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
		const cd = clip();
		fireClipboard(port(container), "copy", cd);
		expect(cd.setData).toHaveBeenCalledWith("text/plain", "1000\t0.4"); // not "$1,000\t40.0%"
	});

	test("a pasted '12.5%' is rejected atomically — format never widens parsing", () => {
		const onBulkEdit = vi.fn();
		const { container } = render(
			<Grid model={model} mode="bulk" onEdit={vi.fn()} onBulkEdit={onBulkEdit} />,
		);
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight" }); // active → margin (1,2)
		fireClipboard(port(container), "paste", clip("12.5%"));
		const arg = must(onBulkEdit.mock.calls[0])[0] as BulkEdit;
		expect(arg.edits).toHaveLength(0); // atomic: nothing written
		expect(arg.rejected).toEqual([{ rowIndex: 1, columnId: "margin", text: "12.5%" }]);
	});

	test("fill-down over a formatted column writes the RAW value (onBulkEdit stays raw)", () => {
		const onBulkEdit = vi.fn();
		const { container } = render(
			<Grid model={model} mode="bulk" onEdit={vi.fn()} onBulkEdit={onBulkEdit} />,
		);
		// Select the margin column across both rows, then fill down (Cmd+D).
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight" }); // active → margin (1,2)
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "ArrowDown", shiftKey: true }); // extend to (2,2)
		fireEvent.keyDown(must(cell(container, 2, 2)), { key: "d", metaKey: true });
		expect(onBulkEdit).toHaveBeenCalledWith({
			kind: "fill-down",
			edits: [{ rowIndex: 2, columnId: "margin", value: 0.4 }], // 0.625 → the RAW 0.4, not "40.0%"
		});
	});
});
