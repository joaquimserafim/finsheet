/**
 * finsheet — edit/nav state machine (Epics 5–6). Pure: no DOM, no React.
 *
 * State is the ACTIVE (focus) cell, whether it is being edited, an invalid flag, and
 * — for `bulk` mode — the fixed `anchor` corner of a range selection. The in-progress
 * draft text deliberately lives NOWHERE here — it stays in the uncontrolled `<input>`
 * so a keystroke never touches this state (the one-cell-per-keystroke guarantee).
 *
 * `anchor === null` ⇒ a collapsed 1×1 selection = exactly Epic 5's `active` cell. A
 * range is `anchor` (fixed) + `active` (moving focus corner). Editing is always
 * single-cell, so every action that opens the editor or plainly moves collapses the
 * range (`anchor: null`).
 */

import type { EditCoord } from "./editing";

export interface EditState {
	active: EditCoord | null;
	/** The fixed corner of a range selection (`bulk`), or `null` for a collapsed 1×1. */
	anchor: EditCoord | null;
	editing: boolean;
	invalid: boolean;
}

export type EditAction =
	| { type: "SET_ACTIVE"; coord: EditCoord | null }
	| { type: "START_EDIT" }
	| { type: "COMMIT"; target: EditCoord | null }
	| { type: "CANCEL" }
	| { type: "INVALID" }
	// bulk (Epic 6):
	| { type: "EXTEND"; coord: EditCoord }
	| { type: "SELECT_ALL"; anchor: EditCoord | null; active: EditCoord | null }
	| { type: "CLEAR_SELECTION" }
	| { type: "RECONCILE"; active: EditCoord | null; anchor: EditCoord | null };

/** Start with the first editable cell focusable (tabindex), but NOT DOM-focused. */
export function initialEditState(list: readonly EditCoord[]): EditState {
	return { active: list[0] ?? null, anchor: null, editing: false, invalid: false };
}

export function editReducer(state: EditState, action: EditAction): EditState {
	switch (action.type) {
		case "SET_ACTIVE":
			// Focus/click/nav: land on a cell, collapse any range, not editing.
			return { active: action.coord, anchor: null, editing: false, invalid: false };
		case "START_EDIT":
			// Editing is always single-cell: collapse the range.
			return { active: state.active, anchor: null, editing: true, invalid: false };
		case "COMMIT":
			// A valid commit: stop editing and move to `target` (null = stay put, e.g. at a boundary).
			return {
				active: action.target ?? state.active,
				anchor: null,
				editing: false,
				invalid: false,
			};
		case "CANCEL":
			return { active: state.active, anchor: null, editing: false, invalid: false };
		case "INVALID":
			// Rejected parse: stay in the editor and flag it.
			return { active: state.active, anchor: null, editing: true, invalid: true };
		case "EXTEND":
			// Grow/steer the range: seed the anchor from the active cell on the first
			// extend, then keep it fixed while the focus corner moves. Never editing.
			return {
				active: action.coord,
				anchor: state.anchor ?? state.active,
				editing: false,
				invalid: false,
			};
		case "SELECT_ALL":
		case "RECONCILE":
			// Set both corners explicitly — select-all's extremes, or the reconciled pair
			// after a model change. Never editing (the reconcile effect cancels first).
			return { active: action.active, anchor: action.anchor, editing: false, invalid: false };
		case "CLEAR_SELECTION":
			// Esc on a multi-cell selection: collapse the range to the focus cell.
			return { active: state.active, anchor: null, editing: false, invalid: false };
	}
}
