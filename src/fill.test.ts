import { describe, expect, test } from "vitest";
import { computeClearPatches, computeFillPatches } from "./fill";
import type { SelectionRect } from "./selection";
import type { GridModel } from "./types";

/** label · a(edit) · b(edit) · x(locked); an interior subtotal row (non-editable) and a
 *  null cell (r3.b) to exercise the holes + no-op/blank branches. */
const model: GridModel = {
	columns: [
		{ id: "line", header: "" },
		{ id: "a", header: "A", numeric: true },
		{ id: "b", header: "B", numeric: true },
		{ id: "x", header: "X", numeric: true, editable: false },
	],
	rows: [
		{ kind: "line", id: "r0", label: "R0", values: { a: 10, b: 20, x: 1 } }, // 0
		{ kind: "subtotal", label: "Sub", values: { a: 99, b: 99, x: 99 } }, // 1 (interior hole)
		{ kind: "line", id: "r2", label: "R2", values: { a: 10, b: 40, x: 2 } }, // 2 (a already 10)
		{ kind: "line", id: "r3", label: "R3", values: { a: 50, b: null, x: 3 } }, // 3 (b is null)
	],
};
const rect = (minRow: number, maxRow: number, minCol: number, maxCol: number): SelectionRect => ({
	minRow,
	maxRow,
	minCol,
	maxCol,
});

describe("computeFillPatches — down", () => {
	test("sources each column's topmost editable, jumps holes, suppresses no-ops, locked col has no source", () => {
		const patches = computeFillPatches(model, rect(0, 3, 1, 3), "down");
		expect(patches).toEqual([
			// col a: source r0=10 → r2 already 10 (suppressed) → r3 gets 10
			{ rowId: "r3", rowIndex: 3, columnId: "a", value: 10 },
			// col b: source r0=20 → r2 gets 20, r3 (null) gets 20
			{ rowId: "r2", rowIndex: 2, columnId: "b", value: 20 },
			{ rowId: "r3", rowIndex: 3, columnId: "b", value: 20 },
			// col x: locked → no editable source → nothing
		]);
	});

	test("a 1×1 fill is a no-op (only a source, nothing below)", () => {
		expect(computeFillPatches(model, rect(0, 0, 1, 1), "down")).toEqual([]);
	});

	test("a blank source clears the cells below (source ?? null → null)", () => {
		const blank: GridModel = {
			columns: [
				{ id: "line", header: "" },
				{ id: "a", header: "A", numeric: true },
			],
			rows: [
				{ kind: "line", id: "t0", label: "T0", values: { a: null } }, // topmost editable is blank
				{ kind: "line", id: "t1", label: "T1", values: { a: 5 } },
			],
		};
		expect(computeFillPatches(blank, rect(0, 1, 1, 1), "down")).toEqual([
			{ rowId: "t1", rowIndex: 1, columnId: "a", value: null },
		]);
	});
});

describe("computeFillPatches — right", () => {
	test("sources each row's leftmost editable, writes rightward, skips the locked column", () => {
		const patches = computeFillPatches(model, rect(0, 0, 1, 3), "right");
		expect(patches).toEqual([{ rowId: "r0", rowIndex: 0, columnId: "b", value: 10 }]); // a=10 → b; x locked
	});

	test("a fully non-editable line (a subtotal row) yields no source → no patches", () => {
		expect(computeFillPatches(model, rect(1, 1, 1, 3), "right")).toEqual([]);
	});
});

describe("computeClearPatches", () => {
	test("clears editable in-range cells to null; skips non-editable + already-blank cells", () => {
		const patches = computeClearPatches(model, rect(0, 3, 1, 3));
		expect(patches).toEqual([
			{ rowId: "r0", rowIndex: 0, columnId: "a", value: null },
			{ rowId: "r0", rowIndex: 0, columnId: "b", value: null },
			// row 1 subtotal — skipped; col x locked — skipped
			{ rowId: "r2", rowIndex: 2, columnId: "a", value: null },
			{ rowId: "r2", rowIndex: 2, columnId: "b", value: null },
			{ rowId: "r3", rowIndex: 3, columnId: "a", value: null },
			// r3.b already null → suppressed
		]);
	});
});
