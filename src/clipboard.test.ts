import { describe, expect, test } from "vitest";
import {
	computeCopy,
	computePastePatches,
	parseClipboard,
	rawCellText,
	serializeClipboard,
} from "./clipboard";
import { buildEditableList } from "./editing";
import type { SelectionRect } from "./selection";
import type { GridModel } from "./types";

/** label · actual(edit) · budget(edit) · var(locked); section/line/subtotal/spacer/total rows,
 *  a null cell (Services budget) and absent cells (Other budget/var). */
const model: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left" },
		{ id: "actual", header: "Actual", numeric: true },
		{ id: "budget", header: "Budget", numeric: true },
		{ id: "var", header: "Var", numeric: true, editable: false },
	],
	rows: [
		{ kind: "section", label: "Revenue" }, // 0
		{
			kind: "line",
			id: "prod",
			label: "Product",
			values: { actual: 1000, budget: 950, var: 50 },
		}, // 1
		{ kind: "line", label: "Services", values: { actual: 240, budget: null, var: -10 } }, // 2
		{ kind: "subtotal", label: "Total", values: { actual: 1240, budget: 1200, var: 40 } }, // 3
		{ kind: "spacer", id: "s" }, // 4
		{ kind: "line", label: "Other", values: { actual: 0 } }, // 5
		{ kind: "total", label: "Net", values: { actual: -500, budget: -400, var: -100 } }, // 6
	],
};
const list = buildEditableList(model); // [1:1, 1:2, 2:1, 2:2, 5:1, 5:2]
const rect = (minRow: number, maxRow: number, minCol: number, maxCol: number): SelectionRect => ({
	minRow,
	maxRow,
	minCol,
	maxCol,
});

describe("rawCellText", () => {
	test("blank for null / undefined; fixed-point otherwise (never exponential)", () => {
		expect(rawCellText(null)).toBe("");
		expect(rawCellText(undefined)).toBe("");
		expect(rawCellText(1000)).toBe("1000");
		expect(rawCellText(-1234)).toBe("-1234");
		expect(rawCellText(0)).toBe("0");
		expect(rawCellText(1234.5)).toBe("1234.5");
		expect(rawCellText(0.0000005)).toBe("0.0000005"); // not "5e-7"
		expect(rawCellText(1_234_567)).toBe("1234567"); // raw, ungrouped (a scaled statement copies raw)
	});
});

describe("parseClipboard", () => {
	test("TSV rows×cols; tolerant of CRLF / lone CR / one trailing newline / ragged / empty", () => {
		expect(parseClipboard("a\tb\nc\td")).toEqual([
			["a", "b"],
			["c", "d"],
		]);
		expect(parseClipboard("a\tb\r\n")).toEqual([["a", "b"]]); // trailing CRLF dropped
		expect(parseClipboard("x\n")).toEqual([["x"]]); // trailing LF dropped
		expect(parseClipboard("x\r")).toEqual([["x"]]); // trailing CR dropped
		expect(parseClipboard("a\r\nb")).toEqual([["a"], ["b"]]); // CRLF row sep
		expect(parseClipboard("a\rb")).toEqual([["a"], ["b"]]); // lone-CR row sep
		expect(parseClipboard("a\tb\nc")).toEqual([["a", "b"], ["c"]]); // ragged
		expect(parseClipboard("")).toEqual([]);
		expect(parseClipboard("\n")).toEqual([]);
	});
});

test("serializeClipboard → TSV (tabs, CRLF)", () => {
	expect(
		serializeClipboard([
			["a", "b"],
			["c", "d"],
		]),
	).toBe("a\tb\r\nc\td");
});

describe("computeCopy — geometric, inclusive, raw, kind-gated", () => {
	test("spans every row kind: line/subtotal/total emit raw; section/spacer/null/absent → ''", () => {
		expect(computeCopy(model, rect(0, 6, 1, 3))).toEqual([
			["", "", ""], // 0 section — no values
			["1000", "950", "50"], // 1 line (incl. the locked var column — reads are safe)
			["240", "", "-10"], // 2 line — budget is null → ""
			["1240", "1200", "40"], // 3 subtotal — raw
			["", "", ""], // 4 spacer — no values
			["0", "", ""], // 5 line — 0 renders "0"; budget/var absent → ""
			["-500", "-400", "-100"], // 6 total — raw
		]);
	});
});

describe("computePastePatches", () => {
	test("1×1 broadcasts to every editable cell in the selection (no-ops suppressed)", () => {
		const r = computePastePatches(model, list, rect(1, 2, 1, 2), [["7"]]);
		expect(r.rejected).toEqual([]);
		expect(r.skipped).toEqual([]);
		expect(r.patches).toEqual([
			{ rowId: "prod", rowIndex: 1, columnId: "actual", value: 7 },
			{ rowId: "prod", rowIndex: 1, columnId: "budget", value: 7 },
			{ rowId: undefined, rowIndex: 2, columnId: "actual", value: 7 },
			{ rowId: undefined, rowIndex: 2, columnId: "budget", value: 7 },
		]);
	});

	test("1×1 with a matching value suppresses only the no-op cell", () => {
		const r = computePastePatches(model, list, rect(1, 2, 1, 2), [["1000"]]);
		// 1:1 already 1000 → suppressed; the other three change
		expect(r.patches.map((p) => `${p.rowIndex}:${p.columnId}`)).toEqual([
			"1:budget",
			"2:actual",
			"2:budget",
		]);
	});

	test("1×1 empty string clears editable cells; an already-blank cell is suppressed", () => {
		const r = computePastePatches(model, list, rect(1, 2, 1, 2), [[""]]);
		// 2:budget is already null → suppressed; the rest clear to null
		expect(r.patches).toEqual([
			{ rowId: "prod", rowIndex: 1, columnId: "actual", value: null },
			{ rowId: "prod", rowIndex: 1, columnId: "budget", value: null },
			{ rowId: undefined, rowIndex: 2, columnId: "actual", value: null },
		]);
	});

	test("multi block maps positionally from the selection top-left", () => {
		const r = computePastePatches(model, list, rect(1, 1, 1, 1), [
			["11", "22"],
			["33", "44"],
		]);
		expect(r.patches).toEqual([
			{ rowId: "prod", rowIndex: 1, columnId: "actual", value: 11 },
			{ rowId: "prod", rowIndex: 1, columnId: "budget", value: 22 },
			{ rowId: undefined, rowIndex: 2, columnId: "actual", value: 33 },
			{ rowId: undefined, rowIndex: 2, columnId: "budget", value: 44 },
		]);
	});

	test("a non-empty value on a non-editable target is skipped + reported (never silent)", () => {
		const r = computePastePatches(model, list, rect(1, 1, 1, 1), [["11", "22", "33"]]);
		expect(r.patches.map((p) => p.columnId)).toEqual(["actual", "budget"]);
		expect(r.skipped).toEqual([{ rowIndex: 1, columnId: "var" }]); // col 3 is locked
	});

	test("an EMPTY value on a non-editable target is not a skip (nothing to drop)", () => {
		const r = computePastePatches(model, list, rect(1, 1, 1, 1), [["11", "", ""]]);
		expect(r.skipped).toEqual([]);
		expect(r.patches).toEqual([
			{ rowId: "prod", rowIndex: 1, columnId: "actual", value: 11 },
			{ rowId: "prod", rowIndex: 1, columnId: "budget", value: null }, // "" clears
		]);
	});

	test("clips past the right edge (column undefined)", () => {
		const r = computePastePatches(model, list, rect(1, 1, 2, 2), [["11", "22"]]);
		// col 2 = budget (editable); col 3 = var (locked → skip, non-empty); col 4 = past edge (clipped)
		expect(r.patches).toEqual([{ rowId: "prod", rowIndex: 1, columnId: "budget", value: 11 }]);
		expect(r.skipped).toEqual([{ rowIndex: 1, columnId: "var" }]);
	});

	test("clips past the bottom edge (row undefined)", () => {
		const r = computePastePatches(model, list, rect(5, 5, 1, 1), [["8"], ["9"], ["10"]]);
		// row 5 editable; row 6 = total (skip); row 7 = past edge (clipped)
		expect(r.patches).toEqual([
			{ rowId: undefined, rowIndex: 5, columnId: "actual", value: 8 },
		]);
		expect(r.skipped).toEqual([{ rowIndex: 6, columnId: "actual" }]);
	});

	test("atomic reject: any unparseable non-empty cell ⇒ zero patches + rejected[]", () => {
		const r = computePastePatches(model, list, rect(1, 1, 1, 1), [["11", "abc"]]);
		expect(r.patches).toEqual([]); // 11 would have applied, but atomic
		expect(r.rejected).toEqual([{ rowIndex: 1, columnId: "budget", text: "abc" }]);
	});

	test("empty block → nothing", () => {
		expect(computePastePatches(model, list, rect(1, 1, 1, 1), [])).toEqual({
			patches: [],
			rejected: [],
			skipped: [],
		});
	});
});
