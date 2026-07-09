/**
 * finsheet — edit/nav state machine (Epic 5). Pure: no DOM, no React.
 *
 * State is only the ACTIVE cell, whether it is being edited, and an invalid flag.
 * The in-progress draft text deliberately lives NOWHERE here — it stays in the
 * uncontrolled `<input>` so a keystroke never touches this state (the
 * one-cell-per-keystroke guarantee).
 */

import type { EditCoord } from "./editing";

export interface EditState {
	active: EditCoord | null;
	editing: boolean;
	invalid: boolean;
}

export type EditAction =
	| { type: "SET_ACTIVE"; coord: EditCoord | null }
	| { type: "START_EDIT" }
	| { type: "COMMIT"; target: EditCoord | null }
	| { type: "CANCEL" }
	| { type: "INVALID" };

/** Start with the first editable cell focusable (tabindex), but NOT DOM-focused. */
export function initialEditState(list: readonly EditCoord[]): EditState {
	return { active: list[0] ?? null, editing: false, invalid: false };
}

export function editReducer(state: EditState, action: EditAction): EditState {
	switch (action.type) {
		case "SET_ACTIVE":
			// Focus/click/nav: land on a cell, not editing.
			return { active: action.coord, editing: false, invalid: false };
		case "START_EDIT":
			return { active: state.active, editing: true, invalid: false };
		case "COMMIT":
			// A valid commit: stop editing and move to `target` (null = stay put, e.g. at a boundary).
			return { active: action.target ?? state.active, editing: false, invalid: false };
		case "CANCEL":
			return { active: state.active, editing: false, invalid: false };
		case "INVALID":
			// Rejected parse: stay in the editor and flag it.
			return { active: state.active, editing: true, invalid: true };
	}
}
