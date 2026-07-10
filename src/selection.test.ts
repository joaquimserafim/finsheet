import { describe, expect, test } from "vitest";
import type { EditCoord } from "./editing";
import {
	type BulkIntent,
	cellsInRange,
	classifyBulkKey,
	isMultiSelection,
	reconcileSelection,
	sameSelection,
	selectionRect,
	withinRect,
} from "./selection";

const c = (row: number, col: number): EditCoord => ({ row, col });

describe("selectionRect", () => {
	test("null active → no rect", () => {
		expect(selectionRect(null, null)).toBe(null);
		expect(selectionRect(c(1, 1), null)).toBe(null); // anchor without active is meaningless
	});
	test("collapsed (anchor null) → a 1×1 rect at active", () => {
		expect(selectionRect(null, c(2, 3))).toEqual({
			minRow: 2,
			maxRow: 2,
			minCol: 3,
			maxCol: 3,
		});
	});
	test("two corners → the inclusive bbox regardless of order", () => {
		expect(selectionRect(c(5, 4), c(2, 1))).toEqual({
			minRow: 2,
			maxRow: 5,
			minCol: 1,
			maxCol: 4,
		});
		expect(selectionRect(c(2, 1), c(5, 4))).toEqual({
			minRow: 2,
			maxRow: 5,
			minCol: 1,
			maxCol: 4,
		});
	});
});

describe("withinRect", () => {
	const rect = { minRow: 2, maxRow: 4, minCol: 1, maxCol: 3 };
	test("null rect is never a member", () => {
		expect(withinRect(null, 3, 2)).toBe(false);
	});
	test("inside", () => {
		expect(withinRect(rect, 3, 2)).toBe(true);
		expect(withinRect(rect, 2, 1)).toBe(true); // corner
		expect(withinRect(rect, 4, 3)).toBe(true); // opposite corner
	});
	test("outside on each edge", () => {
		expect(withinRect(rect, 1, 2)).toBe(false); // row < min
		expect(withinRect(rect, 5, 2)).toBe(false); // row > max
		expect(withinRect(rect, 3, 0)).toBe(false); // col < min
		expect(withinRect(rect, 3, 4)).toBe(false); // col > max
	});
});

describe("cellsInRange", () => {
	const list = [c(1, 1), c(1, 2), c(2, 1), c(2, 2), c(3, 1)];
	test("null rect → empty", () => {
		expect(cellsInRange(list, null)).toEqual([]);
	});
	test("only the editable cells inside the rect, order preserved", () => {
		expect(cellsInRange(list, { minRow: 1, maxRow: 2, minCol: 1, maxCol: 2 })).toEqual([
			c(1, 1),
			c(1, 2),
			c(2, 1),
			c(2, 2),
		]);
	});
});

describe("isMultiSelection", () => {
	test("no selection / collapsed → false", () => {
		expect(isMultiSelection(null, null)).toBe(false);
		expect(isMultiSelection(null, c(1, 1))).toBe(false);
		expect(isMultiSelection(c(1, 1), c(1, 1))).toBe(false);
	});
	test("differing row or col → true", () => {
		expect(isMultiSelection(c(1, 1), c(3, 1))).toBe(true); // rows differ
		expect(isMultiSelection(c(1, 1), c(1, 3))).toBe(true); // cols differ
	});
});

describe("reconcileSelection", () => {
	const list = [c(1, 1), c(1, 2), c(2, 1), c(2, 2)];
	test("both corners survive → preserved (block stays highlighted)", () => {
		expect(reconcileSelection(list, c(2, 2), c(1, 1))).toEqual({
			active: c(2, 2),
			anchor: c(1, 1),
		});
	});
	test("collapsed selection that survives → preserved", () => {
		expect(reconcileSelection(list, c(2, 1), null)).toEqual({ active: c(2, 1), anchor: null });
	});
	test("anchor invalidated by a structural change → collapse to active", () => {
		expect(reconcileSelection(list, c(2, 2), c(9, 9))).toEqual({
			active: c(2, 2),
			anchor: null,
		});
	});
	test("active invalidated but anchor survives → COLLAPSE (no phantom rectangle)", () => {
		// the phantom-selection bug: keeping the anchor here would span rows 0..1
		expect(reconcileSelection(list, c(9, 9), c(1, 1))).toEqual({
			active: c(1, 1),
			anchor: null,
		});
	});
	test("null active → clamp to the first editable cell, no anchor", () => {
		expect(reconcileSelection(list, null, c(1, 2))).toEqual({ active: c(1, 1), anchor: null });
	});
});

describe("sameSelection", () => {
	test("equal on both corners", () => {
		expect(
			sameSelection(
				{ active: c(1, 1), anchor: c(2, 2) },
				{ active: c(1, 1), anchor: c(2, 2) },
			),
		).toBe(true);
	});
	test("differs on active, or on anchor", () => {
		expect(
			sameSelection({ active: c(1, 1), anchor: null }, { active: c(1, 2), anchor: null }),
		).toBe(false);
		expect(
			sameSelection({ active: c(1, 1), anchor: null }, { active: c(1, 1), anchor: c(2, 2) }),
		).toBe(false);
	});
});

describe("classifyBulkKey", () => {
	const intent = (
		key: string,
		s: boolean,
		ctrl: boolean,
		meta: boolean,
		multi: boolean,
	): BulkIntent => classifyBulkKey(key, s, ctrl, meta, multi);

	test("mod combos: select-all, fill down/right; other mod keys (incl clipboard) fall through", () => {
		expect(intent("a", false, true, false, false)).toEqual({ kind: "selectAll" });
		expect(intent("A", false, false, true, false)).toEqual({ kind: "selectAll" }); // meta + shifted letter
		expect(intent("d", false, true, false, false)).toEqual({ kind: "fill", dir: "down" });
		expect(intent("r", false, false, true, false)).toEqual({ kind: "fill", dir: "right" });
		expect(intent("c", false, true, false, false)).toEqual({ kind: "none" }); // copy → native event
		expect(intent("v", false, true, false, false)).toEqual({ kind: "none" }); // paste → native event
	});
	test("shift+arrows extend; shift+other falls through", () => {
		expect(intent("ArrowUp", true, false, false, false)).toEqual({ kind: "extend", dir: "up" });
		expect(intent("ArrowDown", true, false, false, false)).toEqual({
			kind: "extend",
			dir: "down",
		});
		expect(intent("ArrowLeft", true, false, false, false)).toEqual({
			kind: "extend",
			dir: "left",
		});
		expect(intent("ArrowRight", true, false, false, false)).toEqual({
			kind: "extend",
			dir: "right",
		});
		expect(intent("Home", true, false, false, false)).toEqual({ kind: "none" });
	});
	test("Escape clears a live multi-selection, else falls through", () => {
		expect(intent("Escape", false, false, false, true)).toEqual({ kind: "clearSelection" });
		expect(intent("Escape", false, false, false, false)).toEqual({ kind: "none" });
	});
	test("Delete / Backspace clear a range only when multi-selected", () => {
		expect(intent("Delete", false, false, false, true)).toEqual({ kind: "clearRange" });
		expect(intent("Backspace", false, false, false, true)).toEqual({ kind: "clearRange" });
		expect(intent("Delete", false, false, false, false)).toEqual({ kind: "none" }); // single cell → Epic 5
	});
	test("a plain key falls through", () => {
		expect(intent("5", false, false, false, false)).toEqual({ kind: "none" });
	});
});
