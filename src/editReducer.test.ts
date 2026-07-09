import { describe, expect, test } from "vitest";
import { type EditState, editReducer, initialEditState } from "./editReducer";

const A = { row: 1, col: 1 };
const B = { row: 1, col: 2 };

describe("initialEditState", () => {
	test("first editable cell is active but not editing", () => {
		expect(initialEditState([A, B])).toEqual({ active: A, editing: false, invalid: false });
	});
	test("empty list → no active cell", () => {
		expect(initialEditState([])).toEqual({ active: null, editing: false, invalid: false });
	});
});

describe("editReducer", () => {
	const editingAt: EditState = { active: A, editing: true, invalid: false };

	test("SET_ACTIVE lands on a cell (or null), never editing", () => {
		expect(editReducer(editingAt, { type: "SET_ACTIVE", coord: B })).toEqual({
			active: B,
			editing: false,
			invalid: false,
		});
		expect(editReducer(editingAt, { type: "SET_ACTIVE", coord: null })).toEqual({
			active: null,
			editing: false,
			invalid: false,
		});
	});

	test("START_EDIT enters the editor on the active cell", () => {
		expect(editReducer(initialEditState([A]), { type: "START_EDIT" })).toEqual({
			active: A,
			editing: true,
			invalid: false,
		});
	});

	test("COMMIT with a target moves; COMMIT null stays put", () => {
		expect(editReducer(editingAt, { type: "COMMIT", target: B })).toEqual({
			active: B,
			editing: false,
			invalid: false,
		});
		expect(editReducer(editingAt, { type: "COMMIT", target: null })).toEqual({
			active: A,
			editing: false,
			invalid: false,
		});
	});

	test("CANCEL leaves the editor, keeping the active cell", () => {
		expect(editReducer(editingAt, { type: "CANCEL" })).toEqual({
			active: A,
			editing: false,
			invalid: false,
		});
	});

	test("INVALID stays in the editor and flags it", () => {
		expect(editReducer(editingAt, { type: "INVALID" })).toEqual({
			active: A,
			editing: true,
			invalid: true,
		});
	});
});
