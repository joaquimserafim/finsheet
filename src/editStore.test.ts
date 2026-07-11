import { describe, expect, test, vi } from "vitest";
import {
	CELL_ACTIVE,
	CELL_EDITING,
	CELL_IDLE,
	CELL_INVALID,
	CELL_SELECTED,
	createEditStore,
	type EditStore,
} from "./editStore";

const A = { row: 1, col: 1 };
const B = { row: 1, col: 2 };
const C = { row: 2, col: 1 };
const D = { row: 2, col: 2 };
const E = { row: 3, col: 1 };
const F = { row: 3, col: 2 };

type Coord = { row: number; col: number };

/**
 * The coords (drawn from `probe`) whose packed `cellStatus` changed across `act` — which is
 * EXACTLY the set of cells `useSyncExternalStore` re-renders, since a subscriber re-renders iff
 * its `Object.is` snapshot changed. So "which cells re-render" is a deterministic, layout-free
 * property of the store, asserted here inside the 100% gate (Epic 7's perf profile).
 */
function reRendered(store: EditStore, probe: readonly Coord[], act: () => void): Coord[] {
	const before = probe.map((c) => store.cellStatus(c.row, c.col));
	act();
	return probe.filter((c, i) => store.cellStatus(c.row, c.col) !== before[i]);
}

describe("createEditStore", () => {
	test("seeds active on the first cell; that cell is ACTIVE, the rest IDLE", () => {
		const store = createEditStore([A, B]);
		expect(store.getState()).toEqual({
			active: A,
			anchor: null,
			editing: false,
			invalid: false,
		});
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

	test("a range marks the focus corner ACTIVE, the rest of the band SELECTED, outside IDLE", () => {
		const store = createEditStore([A, B, C, D]);
		store.dispatch({ type: "EXTEND", coord: D }); // anchor A (seeded), focus D → 2×2 band
		expect(store.cellStatus(2, 2)).toBe(CELL_ACTIVE); // the focus corner
		expect(store.cellStatus(1, 1)).toBe(CELL_SELECTED); // anchor corner, in-band
		expect(store.cellStatus(1, 2)).toBe(CELL_SELECTED); // interior, in-band
		expect(store.cellStatus(2, 1)).toBe(CELL_SELECTED); // interior, in-band
		expect(store.cellStatus(9, 9)).toBe(CELL_IDLE); // outside the rect
	});

	test("collapsing the range (CLEAR_SELECTION) clears the band on the next dispatch", () => {
		const store = createEditStore([A, B, C, D]);
		store.dispatch({ type: "EXTEND", coord: D });
		expect(store.cellStatus(1, 1)).toBe(CELL_SELECTED);
		store.dispatch({ type: "CLEAR_SELECTION" }); // focus stays D, anchor dropped
		expect(store.cellStatus(1, 1)).toBe(CELL_IDLE); // band gone — rect recached to 1×1
		expect(store.cellStatus(2, 2)).toBe(CELL_ACTIVE);
	});
});

describe("re-render accounting — cellStatus deltas ARE the cells that re-render (Epic 7)", () => {
	const list = [A, B, C, D, E, F];
	const Z = { row: 9, col: 9 }; // never editable → always IDLE, a sentinel that must never change
	const probe = [...list, Z];

	test("a move (SET_ACTIVE) re-renders exactly 2 cells: vacated → idle, arrived → active", () => {
		const store = createEditStore(list); // seeded active A
		const changed = reRendered(store, probe, () =>
			store.dispatch({ type: "SET_ACTIVE", coord: B }),
		);
		expect(changed).toEqual([A, B]);
	});

	test("opening the editor (START_EDIT) re-renders exactly 1 cell (active → editing)", () => {
		const store = createEditStore(list);
		const changed = reRendered(store, probe, () => store.dispatch({ type: "START_EDIT" }));
		expect(changed).toEqual([A]);
	});

	test("commit + move (COMMIT) re-renders exactly 2 cells (editor → idle, target → active)", () => {
		const store = createEditStore(list);
		store.dispatch({ type: "START_EDIT" });
		const changed = reRendered(store, probe, () =>
			store.dispatch({ type: "COMMIT", target: B }),
		);
		expect(changed).toEqual([A, B]);
	});

	test("a shift-extend into a new cell re-renders 2 cells (anchor → band, focus → active)", () => {
		const store = createEditStore(list); // active A, anchor null
		const changed = reRendered(store, probe, () =>
			store.dispatch({ type: "EXTEND", coord: B }),
		);
		expect(changed).toEqual([A, B]); // A: active → selected · B: idle → active
	});

	test("growing an existing band re-renders only the delta, never the whole band", () => {
		const store = createEditStore(list);
		store.dispatch({ type: "EXTEND", coord: B }); // 1×2 band: A selected, B active
		// grow to a 2×2 band (anchor A, focus D): A stays SELECTED (unchanged), the delta is B/C/D
		const changed = reRendered(store, probe, () =>
			store.dispatch({ type: "EXTEND", coord: D }),
		);
		expect(changed).toEqual([B, C, D]); // A NOT re-rendered — already SELECTED
	});

	test("the count is O(1) in row count: a move re-renders 2 cells whether the list is 6 or 600", () => {
		const big: Coord[] = Array.from({ length: 300 }, (_, r) => [
			{ row: r, col: 1 },
			{ row: r, col: 2 },
		]).flat();
		const store = createEditStore(big); // seeded active { row: 0, col: 1 }
		const changed = reRendered(store, big, () =>
			store.dispatch({ type: "SET_ACTIVE", coord: { row: 150, col: 2 } }),
		);
		expect(changed).toEqual([
			{ row: 0, col: 1 },
			{ row: 150, col: 2 },
		]); // exactly 2 of 600 — independent of N
	});
});
