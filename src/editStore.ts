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

/**
 * A cell's status, packed into one primitive so a subscribing cell re-renders only
 * when ITS state changes. Idle cells all share `CELL_IDLE`, so a move never churns
 * the cells that stayed idle.
 */
export const CELL_IDLE = 0;
export const CELL_ACTIVE = 1;
export const CELL_EDITING = 2;
export const CELL_INVALID = 3;
export type CellStatus =
	| typeof CELL_IDLE
	| typeof CELL_ACTIVE
	| typeof CELL_EDITING
	| typeof CELL_INVALID;

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
			if (a === null || a.row !== row || a.col !== col) {
				return CELL_IDLE;
			}
			if (!state.editing) {
				return CELL_ACTIVE;
			}
			return state.invalid ? CELL_INVALID : CELL_EDITING;
		},
		dispatch(action) {
			// The reducer always returns a fresh object; notify unconditionally. The
			// per-cell Object.is check on cellStatus — not a store-level guard — is what
			// keeps a dispatch to a re-render of only the cells whose status changed.
			state = editReducer(state, action);
			for (const listener of listeners) {
				listener();
			}
		},
	};
}
