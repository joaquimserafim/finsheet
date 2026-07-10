import { describe, expect, test } from "vitest";
import {
	buildEditableList,
	classifyKey,
	coordKey,
	ignoreDuringComposition,
	isCellEditable,
	modifierHeld,
	nextEditable,
	reconcileActive,
	sameCoord,
} from "./editing";
import type { Column, GridModel, Row } from "./types";

const numCol: Column = { id: "v", header: "V", numeric: true };
const lockedCol: Column = { id: "var", header: "Var", numeric: true, editable: false };
const textCol: Column = { id: "line", header: "" };

describe("isCellEditable", () => {
	const line: Row = { kind: "line", label: "x", values: {} };
	test("an editable line cell in a numeric, unlocked column", () => {
		expect(isCellEditable(line, numCol)).toBe(true);
	});
	test("locked by row, column, or non-numeric / non-line kind", () => {
		expect(
			isCellEditable({ kind: "line", label: "x", values: {}, editable: false }, numCol),
		).toBe(false);
		expect(isCellEditable(line, lockedCol)).toBe(false);
		expect(isCellEditable(line, textCol)).toBe(false); // numeric undefined
		expect(isCellEditable({ kind: "subtotal", label: "s", values: {} }, numCol)).toBe(false);
		expect(isCellEditable({ kind: "total", label: "t", values: {} }, numCol)).toBe(false);
		expect(isCellEditable({ kind: "section", label: "s" }, numCol)).toBe(false);
		expect(isCellEditable({ kind: "spacer", id: "z" }, numCol)).toBe(false);
	});
});

/** A P&L: label col + 2 editable (actual/budget) + 1 locked (var); section/spacer/subtotal gaps. */
const model: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left" },
		{ id: "actual", header: "Actual", numeric: true },
		{ id: "budget", header: "Budget", numeric: true },
		{ id: "var", header: "Var", numeric: true, editable: false },
	],
	rows: [
		{ kind: "section", label: "Revenue" }, // 0
		{ kind: "line", label: "Product", values: { actual: 1, budget: 2 } }, // 1
		{ kind: "line", label: "Services", values: { actual: 3 } }, // 2 (sparse but editable)
		{ kind: "subtotal", label: "Total", values: {} }, // 3
		{ kind: "spacer", id: "s" }, // 4
		{ kind: "total", label: "Net", values: {} }, // 5
	],
};

describe("buildEditableList", () => {
	test("row-major editable cells only, cols 1 & 2, rows 1 & 2 (locked var + non-line excluded)", () => {
		expect(buildEditableList(model)).toEqual([
			{ row: 1, col: 1 },
			{ row: 1, col: 2 },
			{ row: 2, col: 1 },
			{ row: 2, col: 2 },
		]);
	});
	test("a model with no editable rows yields an empty list", () => {
		expect(
			buildEditableList({
				columns: model.columns,
				rows: [{ kind: "total", label: "T", values: {} }],
			}),
		).toEqual([]);
	});
});

test("coordKey", () => {
	expect(coordKey({ row: 2, col: 3 })).toBe("2:3");
});

describe("classifyKey", () => {
	test("modifier combos are ignored", () => {
		expect(classifyKey("a", false, true, false)).toEqual({ kind: "none" });
	});
	test("navigating (not editing)", () => {
		expect(classifyKey("ArrowUp", false, false, false)).toEqual({ kind: "move", dir: "up" });
		expect(classifyKey("ArrowDown", false, false, false)).toEqual({
			kind: "move",
			dir: "down",
		});
		expect(classifyKey("ArrowLeft", false, false, false)).toEqual({
			kind: "move",
			dir: "left",
		});
		expect(classifyKey("ArrowRight", false, false, false)).toEqual({
			kind: "move",
			dir: "right",
		});
		expect(classifyKey("Tab", false, false, false)).toEqual({ kind: "move", dir: "next" });
		expect(classifyKey("Tab", true, false, false)).toEqual({ kind: "move", dir: "prev" });
		expect(classifyKey("Enter", false, false, false)).toEqual({
			kind: "startEdit",
			seed: null,
		});
		expect(classifyKey("F2", false, false, false)).toEqual({ kind: "startEdit", seed: null });
		expect(classifyKey("Backspace", false, false, false)).toEqual({ kind: "clear" });
		expect(classifyKey("Delete", false, false, false)).toEqual({ kind: "clear" });
		expect(classifyKey("Escape", false, false, false)).toEqual({ kind: "none" });
		expect(classifyKey("5", false, false, false)).toEqual({ kind: "startEdit", seed: "5" });
		expect(classifyKey("Home", false, false, false)).toEqual({ kind: "none" }); // multi-char, unhandled
	});
	test("editing", () => {
		expect(classifyKey("Enter", false, false, true)).toEqual({
			kind: "commitMove",
			dir: "down",
		});
		expect(classifyKey("Enter", true, false, true)).toEqual({ kind: "commitMove", dir: "up" });
		expect(classifyKey("Tab", false, false, true)).toEqual({ kind: "commitMove", dir: "next" });
		expect(classifyKey("Tab", true, false, true)).toEqual({ kind: "commitMove", dir: "prev" });
		expect(classifyKey("ArrowUp", false, false, true)).toEqual({
			kind: "commitMove",
			dir: "up",
		});
		expect(classifyKey("ArrowDown", false, false, true)).toEqual({
			kind: "commitMove",
			dir: "down",
		});
		expect(classifyKey("Escape", false, false, true)).toEqual({ kind: "cancel" });
		expect(classifyKey("ArrowLeft", false, false, true)).toEqual({ kind: "none" }); // caret
		expect(classifyKey("5", false, false, true)).toEqual({ kind: "none" }); // input handles it
	});
});

describe("nextEditable", () => {
	const list = buildEditableList(model); // [1:1, 1:2, 2:1, 2:2]
	test("list order (next / prev) with boundaries", () => {
		expect(nextEditable(list, { row: 1, col: 1 }, "next")).toEqual({ row: 1, col: 2 });
		expect(nextEditable(list, { row: 2, col: 2 }, "next")).toBe(null); // last
		expect(nextEditable(list, { row: 1, col: 2 }, "prev")).toEqual({ row: 1, col: 1 });
		expect(nextEditable(list, { row: 1, col: 1 }, "prev")).toBe(null); // first
	});
	test("geometry: left / right within a row, skipping the locked column", () => {
		expect(nextEditable(list, { row: 1, col: 1 }, "right")).toEqual({ row: 1, col: 2 });
		expect(nextEditable(list, { row: 1, col: 2 }, "right")).toBe(null); // col 3 (var) is locked → edge
		expect(nextEditable(list, { row: 1, col: 2 }, "left")).toEqual({ row: 1, col: 1 });
		expect(nextEditable(list, { row: 1, col: 1 }, "left")).toBe(null);
	});
	test("geometry: up / down within a column, across section/spacer gaps", () => {
		expect(nextEditable(list, { row: 1, col: 1 }, "down")).toEqual({ row: 2, col: 1 });
		expect(nextEditable(list, { row: 2, col: 1 }, "down")).toBe(null);
		expect(nextEditable(list, { row: 2, col: 2 }, "up")).toEqual({ row: 1, col: 2 });
		expect(nextEditable(list, { row: 1, col: 2 }, "up")).toBe(null);
	});
	test("a coordinate not in the list returns null", () => {
		expect(nextEditable(list, { row: 0, col: 1 }, "down")).toBe(null);
	});
});

describe("reconcileActive", () => {
	const list = buildEditableList(model);
	test("keeps a still-editable active cell", () => {
		expect(reconcileActive(list, { row: 2, col: 1 })).toEqual({ row: 2, col: 1 });
	});
	test("clamps a removed / null active to the first editable cell", () => {
		expect(reconcileActive(list, { row: 9, col: 9 })).toEqual({ row: 1, col: 1 });
		expect(reconcileActive(list, null)).toEqual({ row: 1, col: 1 });
	});
	test("empty list → null", () => {
		expect(reconcileActive([], { row: 1, col: 1 })).toBe(null);
	});
});

describe("sameCoord", () => {
	test("null combinations", () => {
		expect(sameCoord(null, null)).toBe(true);
		expect(sameCoord(null, { row: 1, col: 1 })).toBe(false);
		expect(sameCoord({ row: 1, col: 1 }, null)).toBe(false);
	});
	test("two coordinates: equal, differing row, differing col", () => {
		expect(sameCoord({ row: 1, col: 2 }, { row: 1, col: 2 })).toBe(true);
		expect(sameCoord({ row: 1, col: 2 }, { row: 3, col: 2 })).toBe(false);
		expect(sameCoord({ row: 1, col: 2 }, { row: 1, col: 5 })).toBe(false);
	});
});

describe("ignoreDuringComposition", () => {
	test("only Enter / Tab, and only while composing", () => {
		expect(ignoreDuringComposition("Enter", true)).toBe(true);
		expect(ignoreDuringComposition("Tab", true)).toBe(true);
		expect(ignoreDuringComposition("a", true)).toBe(false); // composing, but not a commit key
		expect(ignoreDuringComposition("Enter", false)).toBe(false); // not composing
	});
});

describe("modifierHeld", () => {
	test("true when any of ctrl / meta / alt is held", () => {
		expect(modifierHeld(false, false, false)).toBe(false);
		expect(modifierHeld(true, false, false)).toBe(true);
		expect(modifierHeld(false, true, false)).toBe(true);
		expect(modifierHeld(false, false, true)).toBe(true);
	});
});
