import { describe, expect, test } from "vitest";
import { type EditState, editReducer, initialEditState } from "./editReducer";

const A = { row: 1, col: 1 };
const B = { row: 1, col: 2 };
const C = { row: 2, col: 1 };

describe("initialEditState", () => {
	test("first editable cell is active, collapsed, not editing", () => {
		expect(initialEditState([A, B])).toEqual({
			active: A,
			anchor: null,
			editing: false,
			invalid: false,
		});
	});
	test("empty list → no active cell", () => {
		expect(initialEditState([])).toEqual({
			active: null,
			anchor: null,
			editing: false,
			invalid: false,
		});
	});
});

describe("editReducer", () => {
	const editingAt: EditState = { active: A, anchor: null, editing: true, invalid: false };
	// A live 2-corner range (B is the focus, A the anchor) — proves the range-collapsing actions.
	const rangeAtoB: EditState = { active: B, anchor: A, editing: false, invalid: false };

	test("SET_ACTIVE lands on a cell (or null), never editing, and collapses the range", () => {
		expect(editReducer(rangeAtoB, { type: "SET_ACTIVE", coord: B })).toEqual({
			active: B,
			anchor: null,
			editing: false,
			invalid: false,
		});
		expect(editReducer(editingAt, { type: "SET_ACTIVE", coord: null })).toEqual({
			active: null,
			anchor: null,
			editing: false,
			invalid: false,
		});
	});

	test("START_EDIT enters the editor on the active cell and collapses the range", () => {
		expect(editReducer(rangeAtoB, { type: "START_EDIT" })).toEqual({
			active: B,
			anchor: null,
			editing: true,
			invalid: false,
		});
	});

	test("COMMIT with a target moves; COMMIT null stays put", () => {
		expect(editReducer(editingAt, { type: "COMMIT", target: B })).toEqual({
			active: B,
			anchor: null,
			editing: false,
			invalid: false,
		});
		expect(editReducer(editingAt, { type: "COMMIT", target: null })).toEqual({
			active: A,
			anchor: null,
			editing: false,
			invalid: false,
		});
	});

	test("CANCEL leaves the editor, keeping the active cell", () => {
		expect(editReducer(editingAt, { type: "CANCEL" })).toEqual({
			active: A,
			anchor: null,
			editing: false,
			invalid: false,
		});
	});

	test("INVALID stays in the editor and flags it", () => {
		expect(editReducer(editingAt, { type: "INVALID" })).toEqual({
			active: A,
			anchor: null,
			editing: true,
			invalid: true,
		});
	});

	test("EXTEND seeds the anchor from the active cell on the first extend", () => {
		const collapsed: EditState = { active: A, anchor: null, editing: false, invalid: false };
		expect(editReducer(collapsed, { type: "EXTEND", coord: B })).toEqual({
			active: B,
			anchor: A, // seeded from the active cell
			editing: false,
			invalid: false,
		});
	});

	test("EXTEND keeps the fixed anchor on subsequent extends", () => {
		expect(editReducer(rangeAtoB, { type: "EXTEND", coord: C })).toEqual({
			active: C,
			anchor: A, // unchanged — only the focus corner moves
			editing: false,
			invalid: false,
		});
	});

	test("SELECT_ALL sets both corners to the given extremes", () => {
		expect(editReducer(editingAt, { type: "SELECT_ALL", anchor: A, active: C })).toEqual({
			active: C,
			anchor: A,
			editing: false,
			invalid: false,
		});
	});

	test("RECONCILE sets both corners to the reconciled pair", () => {
		expect(editReducer(rangeAtoB, { type: "RECONCILE", active: A, anchor: null })).toEqual({
			active: A,
			anchor: null,
			editing: false,
			invalid: false,
		});
	});

	test("CLEAR_SELECTION collapses the range to the focus cell", () => {
		expect(editReducer(rangeAtoB, { type: "CLEAR_SELECTION" })).toEqual({
			active: B, // the focus corner is kept
			anchor: null,
			editing: false,
			invalid: false,
		});
	});
});
