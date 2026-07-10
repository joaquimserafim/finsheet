/**
 * finsheet — the edit store (Epic 5). A tiny external store wrapping the pure
 * {@link editReducer}, read by cells through `useSyncExternalStore`.
 *
 * Why an external store instead of `useReducer` in `Grid`: each cell subscribes to
 * its OWN packed status ({@link cellStatus}), a primitive. When the active cell
 * moves A → B, only A's and B's snapshots change (by `Object.is`), so React
 * re-renders exactly those two cells — not the whole grid, and not `Grid` itself.
 * The in-progress draft never enters this store (it lives in the uncontrolled
 * input), so a keystroke while editing triggers zero store notifications.
 */

import type { EditCoord } from "./editing";
import { type EditAction, type EditState, editReducer, initialEditState } from "./editReducer";
import { type SelectionRect, selectionRect, withinRect } from "./selection";

/**
 * A cell's status, packed into one primitive so a subscribing cell re-renders only
 * when ITS state changes. Idle cells all share `CELL_IDLE`, so a move never churns
 * the cells that stayed idle. `CELL_SELECTED` (bulk, Epic 6) marks a non-focus cell
 * inside the range band.
 */
export const CELL_IDLE = 0;
export const CELL_ACTIVE = 1;
export const CELL_EDITING = 2;
export const CELL_INVALID = 3;
export const CELL_SELECTED = 4;
export type CellStatus =
	| typeof CELL_IDLE
	| typeof CELL_ACTIVE
	| typeof CELL_EDITING
	| typeof CELL_INVALID
	| typeof CELL_SELECTED;

export interface EditStore {
	/** Subscribe to any state change; returns an unsubscribe. Stable identity. */
	subscribe(listener: () => void): () => void;
	/** The current state — read synchronously by event handlers (never for render). */
	getState(): EditState;
	/** The packed status for one coordinate — a cell's `getSnapshot`. */
	cellStatus(row: number, col: number): CellStatus;
	/** Apply an action through the pure reducer and notify subscribers. */
	dispatch(action: EditAction): void;
}

export function createEditStore(list: readonly EditCoord[]): EditStore {
	let state = initialEditState(list);
	// The selection rect, cached and recomputed ONCE per dispatch so `cellStatus`
	// (every cell's `getSnapshot`) stays O(1) and allocation-free — preserving the
	// `Object.is` seam. A collapsed selection (anchor null) is a 1×1 rect at `active`,
	// which only the focus cell matches, and it's handled by the ACTIVE branch first.
	let rect: SelectionRect | null = selectionRect(state.anchor, state.active);
	const listeners = new Set<() => void>();

	return {
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getState() {
			return state;
		},
		cellStatus(row, col) {
			const a = state.active;
			if (a !== null && a.row === row && a.col === col) {
				if (!state.editing) {
					return CELL_ACTIVE;
				}
				return state.invalid ? CELL_INVALID : CELL_EDITING;
			}
			return withinRect(rect, row, col) ? CELL_SELECTED : CELL_IDLE;
		},
		dispatch(action) {
			// The reducer always returns a fresh object; notify unconditionally. The
			// per-cell Object.is check on cellStatus — not a store-level guard — is what
			// keeps a dispatch to a re-render of only the cells whose status changed.
			state = editReducer(state, action);
			rect = selectionRect(state.anchor, state.active);
			for (const listener of listeners) {
				listener();
			}
		},
	};
}
