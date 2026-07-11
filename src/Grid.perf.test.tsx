import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Grid, type GridProps } from "./Grid";
import type { GridModel } from "./types";

/**
 * Epic 7 — the render-discipline guard, in-gate. The store `cellStatus`-delta tests
 * (editStore.test.ts) prove WHICH cells re-render per gesture; this proves the other half —
 * `<Grid>` itself re-renders ZERO times on any gesture, including an editor keystroke (which
 * dispatches nothing, so the store test can't observe it). A `Probed` wrapper counts Grid body
 * executions; the browser suite asserts the same live (outside the gate), this locks it inside it.
 */
const model: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left" },
		{ id: "actual", header: "Actual", numeric: true },
		{ id: "budget", header: "Budget", numeric: true },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{ kind: "line", id: "prod", label: "Product", values: { actual: 1000, budget: 950 } },
		{ kind: "line", label: "Services", values: { actual: 240, budget: 200 } },
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

describe("Epic 7 — Grid never re-renders on a gesture", () => {
	test("move, open-editor, editor keystroke, and commit each re-render <Grid> zero times", () => {
		let renders = 0;
		function Probed(props: GridProps) {
			renders++;
			return <Grid {...props} />;
		}
		const { container } = render(<Probed model={model} mode="bulk" onEdit={() => {}} />);
		const initial = renders; // 1 (relative-guarded against a StrictMode double-invoke)

		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight" });
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "ArrowDown" });
		expect(renders).toBe(initial); // moves → Grid 0

		fireEvent.keyDown(must(cell(container, 2, 1)), { key: "Enter" }); // open the editor
		expect(renders).toBe(initial); // open editor → Grid 0

		fireEvent.change(must(editor(container)), { target: { value: "42" } }); // keystroke
		expect(renders).toBe(initial); // uncontrolled input, no dispatch → Grid 0

		fireEvent.keyDown(must(editor(container)), { key: "Enter" }); // commit + move
		expect(renders).toBe(initial); // Grid 0 (onEdit is a no-op here, so model is unchanged)
	});

	test("a shift-extend range selection re-renders <Grid> zero times", () => {
		let renders = 0;
		function Probed(props: GridProps) {
			renders++;
			return <Grid {...props} />;
		}
		const { container } = render(
			<Probed model={model} mode="bulk" onEdit={() => {}} onBulkEdit={() => {}} />,
		);
		const initial = renders;
		fireEvent.keyDown(must(cell(container, 1, 1)), { key: "ArrowRight", shiftKey: true });
		fireEvent.keyDown(must(cell(container, 1, 2)), { key: "ArrowDown", shiftKey: true });
		expect(renders).toBe(initial); // building a 2×2 band → Grid 0
	});
});
