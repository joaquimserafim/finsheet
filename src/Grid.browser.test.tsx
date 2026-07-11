import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { Grid, type GridProps } from "./Grid";
import type { GridModel } from "./types";

/**
 * Real-Chromium fidelity suite (Epic 6 Stage 4b) — the four things the happy-dom unit
 * suite structurally can't prove: real DOM focus receipt, the trailing-native-blur
 * double-commit guard (the one v8-ignore in CellEditor.tsx), the OS clipboard round-trip,
 * and that Grid never re-renders on a keystroke/move. Runs under `pnpm test:browser`
 * (a separate config), so the unit suite's 100% coverage gate is untouched.
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
		{ kind: "line", label: "Services", values: { actual: 240, budget: 200, var: -10 } },
		{ kind: "line", label: "Other", values: { actual: 120, budget: 100, var: 20 } },
	],
};

function cell(container: HTMLElement, row: number, col: number): HTMLElement {
	const el = container.querySelector<HTMLElement>(`[data-fs-row="${row}"][data-fs-col="${col}"]`);
	if (el === null) {
		throw new Error(`no editable cell ${row}:${col}`);
	}
	return el;
}

afterEach(() => {
	cleanup();
});

describe("real DOM focus", () => {
	test("keyboard navigation moves document.activeElement to the next editable cell", async () => {
		const { container } = await render(<Grid model={model} mode="bulk" onEdit={() => {}} />);
		cell(container, 1, 1).focus();
		expect(document.activeElement).toBe(cell(container, 1, 1));
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(cell(container, 1, 2)); // focusIntentRef → real .focus()
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(cell(container, 2, 2));
		// the locked "var" column (col 3) is skipped — ArrowRight is a boundary, focus holds
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(cell(container, 2, 2));
	});
});

describe("editor commit + the real trailing blur", () => {
	test("a keyboard commit does not double-commit when the native blur fires on unmount", async () => {
		const onEdit = vi.fn();
		const { container } = await render(<Grid model={model} mode="edit" onEdit={onEdit} />);
		cell(container, 1, 1).focus();
		await userEvent.keyboard("{Enter}"); // open the editor (reveals 1000, selected)
		await userEvent.keyboard("1234"); // replaces the selection
		await userEvent.keyboard("{Enter}"); // commit + move down → editor unmounts → real blur
		// In a real browser the trailing blur fires on the unmounting input; the committedRef
		// guard must swallow it — so exactly ONE commit, not two.
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onEdit).toHaveBeenCalledWith({
			rowId: "prod",
			rowIndex: 1,
			columnId: "actual",
			value: 1234,
		});
	});

	test("a blur that is NOT a keyboard commit still finalises the draft once", async () => {
		const onEdit = vi.fn();
		const { container } = await render(<Grid model={model} mode="edit" onEdit={onEdit} />);
		cell(container, 1, 1).focus();
		await userEvent.keyboard("{Enter}42"); // open + replace with 42
		await userEvent.click(cell(container, 3, 1)); // move focus away → real blur commits
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onEdit).toHaveBeenCalledWith({
			rowId: "prod",
			rowIndex: 1,
			columnId: "actual",
			value: 42,
		});
	});
});

describe("OS clipboard round-trip", () => {
	test("copy a range, then paste it into another row through the real system clipboard", async () => {
		const onBulkEdit = vi.fn();
		const { container } = await render(
			<Grid model={model} mode="bulk" onEdit={() => {}} onBulkEdit={onBulkEdit} />,
		);
		cell(container, 1, 1).focus();
		await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}"); // select 1:1..1:2 = 1000,950
		await userEvent.copy(); // → the real clipboard as "1000\t950"
		await userEvent.click(cell(container, 3, 1)); // collapse the active cell onto Other/actual
		await userEvent.paste(); // ← reads the real clipboard back
		expect(onBulkEdit).toHaveBeenCalledTimes(1);
		expect(onBulkEdit).toHaveBeenCalledWith({
			kind: "paste",
			edits: [
				{ rowIndex: 3, columnId: "actual", value: 1000 },
				{ rowIndex: 3, columnId: "budget", value: 950 },
			],
			rejected: [],
			skipped: [],
		});
	});
});

describe("render discipline (the useSyncExternalStore seam)", () => {
	test("<Grid> never re-renders on a move or a keystroke", async () => {
		let renders = 0;
		function Probed(props: GridProps) {
			renders++;
			return <Grid {...props} />;
		}
		const { container } = await render(<Probed model={model} mode="bulk" onEdit={() => {}} />);
		const initial = renders; // 1 (or 2 under a StrictMode double-invoke) — assert no growth
		cell(container, 1, 1).focus();
		await userEvent.keyboard("{ArrowRight}{ArrowDown}{ArrowLeft}{ArrowUp}"); // pure navigation
		expect(renders).toBe(initial); // Grid never re-rendered while the active cell moved
		await userEvent.keyboard("{Enter}9"); // open the editor + type into the uncontrolled input
		expect(renders).toBe(initial); // editing keystrokes never re-render Grid either
		await userEvent.keyboard("{Escape}");
	});
});
