import { describe, expect, test, vi } from "vitest";
import { CELL_ACTIVE, CELL_EDITING, CELL_IDLE, CELL_INVALID, createEditStore } from "./editStore";

const A = { row: 1, col: 1 };
const B = { row: 1, col: 2 };

describe("createEditStore", () => {
	test("seeds active on the first cell; that cell is ACTIVE, the rest IDLE", () => {
		const store = createEditStore([A, B]);
		expect(store.getState()).toEqual({ active: A, editing: false, invalid: false });
		expect(store.cellStatus(1, 1)).toBe(CELL_ACTIVE);
		expect(store.cellStatus(1, 2)).toBe(CELL_IDLE); // active, wrong column
		expect(store.cellStatus(9, 1)).toBe(CELL_IDLE); // active, wrong row
	});

	test("cellStatus tracks the editing and invalid phases of the active cell", () => {
		const store = createEditStore([A]);
		store.dispatch({ type: "START_EDIT" });
		expect(store.cellStatus(1, 1)).toBe(CELL_EDITING);
		store.dispatch({ type: "INVALID" });
		expect(store.cellStatus(1, 1)).toBe(CELL_INVALID);
	});

	test("with no editable cells nothing is active — every cell is IDLE", () => {
		const store = createEditStore([]);
		expect(store.getState().active).toBe(null);
		expect(store.cellStatus(0, 1)).toBe(CELL_IDLE);
	});

	test("dispatch notifies subscribers; the unsubscribe stops them", () => {
		const store = createEditStore([A, B]);
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);

		store.dispatch({ type: "SET_ACTIVE", coord: B });
		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.cellStatus(1, 2)).toBe(CELL_ACTIVE);
		expect(store.cellStatus(1, 1)).toBe(CELL_IDLE);

		unsubscribe();
		store.dispatch({ type: "SET_ACTIVE", coord: A });
		expect(listener).toHaveBeenCalledTimes(1); // no longer notified
	});
});
