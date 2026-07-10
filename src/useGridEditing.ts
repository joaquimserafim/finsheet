/**
 * finsheet — the editing controller (Epic 5). The one hook that turns the pure
 * core (editing.ts / editReducer.ts / editStore.ts) into live behaviour.
 *
 * It owns: the editable-cell list (skipped entirely in `view` mode), the edit
 * {@link EditStore} (created once), a `focusIntentRef` that gates who may claim DOM
 * focus, an `editSeedRef` carrying the char that opened the editor, the container's
 * delegated keyboard/pointer handlers, and the commit/cancel/blur funnels the
 * editor input calls. `Grid` itself never re-renders on an edit — only the two
 * cells whose packed status changed do.
 *
 * Every decision lives in a pure, unit-tested helper (classifyKey / nextEditable /
 * reconcileActive / parseAccounting / sameCoord); this file is the wiring.
 */

import {
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";
import {
	buildEditableList,
	classifyKey,
	type EditCoord,
	type MoveDir,
	modifierHeld,
	nextEditable,
	reconcileActive,
	sameCoord,
} from "./editing";
import { createEditStore, type EditStore } from "./editStore";
import { parseAccounting } from "./parse";
import type { CellEdit, CellValue, Column, GridMode, GridModel, LineRow, Row } from "./types";

/** Stable empty list for `view` mode, so the reconcile effect never re-fires. */
const NO_CELLS: readonly EditCoord[] = [];

/** The live editing surface handed to `Grid` and its cells. `null` in `view` mode. */
export interface GridEditing {
	store: EditStore;
	/** When `true`, the newly-active cell's effect claims DOM focus. Set by keyboard
	 *  moves; cleared for pointer/blur so we never fight the browser's own focus. */
	focusIntentRef: RefObject<boolean>;
	/** The character that opened the editor (`null` = keep the existing value). */
	editSeedRef: RefObject<string | null>;
	/** Delegated container handlers. */
	onKeyDown: (e: ReactKeyboardEvent) => void;
	onClick: (e: ReactMouseEvent) => void;
	onDoubleClick: (e: ReactMouseEvent) => void;
	/**
	 * Called by the editor input on Enter/Tab. Commits `text` and moves in `moveDir`.
	 * Returns `true` when it LEFT the editor (valid commit), `false` when it stayed
	 * (invalid — flagged, editor kept open). The caller uses the return to arm a guard
	 * so a post-unmount blur can't commit a second time.
	 */
	commitActive: (text: string, moveDir: MoveDir) => boolean;
	/**
	 * Called by the editor input on focus loss. Finalises without reclaiming focus:
	 * a valid `text` commits (staying put), an invalid one is discarded. Always
	 * leaves the editor — we never keep an unfocused editor open.
	 */
	blurActive: (text: string) => void;
	/** Called by the editor input on Escape. Discards the draft, refocuses the cell. */
	cancelActive: () => void;
}

export interface UseGridEditingParams {
	model: GridModel;
	mode: GridMode;
	onEdit: ((change: CellEdit) => void) | undefined;
}

/**
 * The `{ row, column }` an active coordinate points at. `active` is ALWAYS a valid
 * editable coordinate — it is seeded from `buildEditableList` and re-clamped by the
 * reconcile effect on every model change — so these lookups are never `undefined`.
 * The cast keeps the commit funnels free of a guard branch that could never be hit.
 */
function cellAt(model: GridModel, active: EditCoord): { row: Row; column: Column } {
	return { row: model.rows[active.row] as Row, column: model.columns[active.col] as Column };
}

/** The stored value at a value row's column. An absent cell reads as `null`, so a
 *  re-typed blank commits as a no-op rather than a spurious change. */
function valueAt(row: Row, columnId: string): CellValue {
	return (row as LineRow).values[columnId] ?? null;
}

/** Read a coordinate off the nearest editable cell in the event path, or `null`. */
function coordFromEvent(target: HTMLElement): EditCoord | null {
	const cell = target.closest<HTMLElement>("[data-fs-row][data-fs-col]");
	if (cell === null) {
		return null;
	}
	return { row: Number(cell.dataset.fsRow), col: Number(cell.dataset.fsCol) };
}

export function useGridEditing(params: UseGridEditingParams): GridEditing | null {
	const { model, mode, onEdit } = params;
	const editMode = mode === "edit";

	// The editable-cell scan is skipped in view mode (a stable empty list).
	const list = useMemo(() => (editMode ? buildEditableList(model) : NO_CELLS), [editMode, model]);

	// Latest-value refs so every handler stays referentially stable yet never stale.
	const modelRef = useRef(model);
	modelRef.current = model;
	const listRef = useRef(list);
	listRef.current = list;
	const onEditRef = useRef(onEdit);
	onEditRef.current = onEdit;

	const focusIntentRef = useRef(false);
	const editSeedRef = useRef<string | null>(null);
	// Identity of the row under the open editor, captured at beginEdit, so a structural
	// model change (row insert / remove / reorder) can be detected and the stale draft
	// discarded rather than committed to whatever row now sits at that index.
	const editAnchorRef = useRef<{ len: number; id: string | undefined }>({
		len: 0,
		id: undefined,
	});

	// One store for the grid's lifetime, seeded from the first render's list.
	const storeRef = useRef<EditStore | null>(null);
	if (storeRef.current === null) {
		storeRef.current = createEditStore(list);
	}
	const store = storeRef.current;

	// After the model (and thus the editable list) changes, keep the active cell
	// valid — but dispatch ONLY when the clamped coord actually moved, so a parent
	// re-render with an unchanged shape can't loop.
	useEffect(() => {
		// If the rows structure changed WHILE a cell is being edited (the edited row was
		// removed / reordered, or a row was inserted / removed above it), the position-
		// keyed active cell no longer denotes the same row — so discard the in-flight
		// draft instead of letting a later commit write it to the wrong row. A same-shape
		// re-render (same length, same id at the active row) keeps the editor open.
		const state = store.getState();
		if (state.editing) {
			const model = modelRef.current;
			const anchor = editAnchorRef.current;
			const active = state.active as EditCoord;
			const activeRow = model.rows[active.row] as Row;
			if (model.rows.length !== anchor.len || activeRow.id !== anchor.id) {
				store.dispatch({ type: "CANCEL" });
			}
		}
		const current = store.getState().active;
		const next = reconcileActive(list, current);
		if (!sameCoord(current, next)) {
			store.dispatch({ type: "SET_ACTIVE", coord: next });
		}
	}, [list, store]);

	const emitEdit = useCallback(
		(row: Row, rowIndex: number, columnId: string, value: CellValue) => {
			onEditRef.current?.({ rowId: row.id, rowIndex, columnId, value });
		},
		[],
	);

	const beginEdit = useCallback(
		(seed: string | null) => {
			editSeedRef.current = seed;
			// The input focuses itself on mount; the cell's td-focus effect must not also fire.
			focusIntentRef.current = false;
			const active = store.getState().active as EditCoord; // the editor only opens on an active cell
			editAnchorRef.current = {
				len: modelRef.current.rows.length,
				id: cellAt(modelRef.current, active).row.id,
			};
			store.dispatch({ type: "START_EDIT" });
		},
		[store],
	);

	const cancelActive = useCallback(() => {
		focusIntentRef.current = true; // return keyboard focus to the cell
		store.dispatch({ type: "CANCEL" });
	}, [store]);

	// `active` is supplied by the keydown handler, which has already proven it non-null.
	const clearActive = useCallback(
		(active: EditCoord) => {
			const { row, column } = cellAt(modelRef.current, active);
			if (valueAt(row, column.id) !== null) {
				emitEdit(row, active.row, column.id, null);
			}
			// Stay active, not editing: the cleared value arrives via a fresh model.
		},
		[emitEdit],
	);

	const commitActive = useCallback(
		(text: string, moveDir: MoveDir): boolean => {
			const active = store.getState().active as EditCoord; // editor only mounts when active
			const parsed = parseAccounting(text);
			if (parsed === undefined) {
				store.dispatch({ type: "INVALID" }); // stay in the editor, flagged
				return false;
			}
			const { row, column } = cellAt(modelRef.current, active);
			if (parsed !== valueAt(row, column.id)) {
				emitEdit(row, active.row, column.id, parsed); // suppress a no-op commit
			}
			focusIntentRef.current = true; // a keyboard move reclaims focus (target, or self at an edge)
			store.dispatch({
				type: "COMMIT",
				target: nextEditable(listRef.current, active, moveDir),
			});
			return true;
		},
		[store, emitEdit],
	);

	const blurActive = useCallback(
		(text: string) => {
			const active = store.getState().active as EditCoord;
			focusIntentRef.current = false; // never reclaim focus from wherever it just went
			const parsed = parseAccounting(text);
			if (parsed === undefined) {
				store.dispatch({ type: "CANCEL" }); // discard an invalid draft on the way out
				return;
			}
			const { row, column } = cellAt(modelRef.current, active);
			if (parsed !== valueAt(row, column.id)) {
				emitEdit(row, active.row, column.id, parsed);
			}
			store.dispatch({ type: "COMMIT", target: null });
		},
		[store, emitEdit],
	);

	const onKeyDown = useCallback(
		(e: ReactKeyboardEvent) => {
			const state = store.getState();
			if (state.editing) {
				return; // editing keys belong to the editor input (it stops their propagation)
			}
			const active = state.active;
			if (active === null) {
				return;
			}
			const mod = modifierHeld(e.ctrlKey, e.metaKey, e.altKey);
			const intent = classifyKey(e.key, e.shiftKey, mod, false);
			switch (intent.kind) {
				case "move": {
					const target = nextEditable(listRef.current, active, intent.dir);
					if (target !== null) {
						e.preventDefault();
						focusIntentRef.current = true;
						store.dispatch({ type: "SET_ACTIVE", coord: target });
					} else if (intent.dir !== "next" && intent.dir !== "prev") {
						// Arrow at an edge: swallow it. A Tab at an edge falls through with no
						// preventDefault, so focus can leave the grid naturally.
						e.preventDefault();
					}
					return;
				}
				case "startEdit":
					e.preventDefault();
					beginEdit(intent.seed);
					return;
				case "clear":
					e.preventDefault();
					clearActive(active);
					return;
				default:
					return; // "none" — leave the key to the browser
			}
		},
		[store, beginEdit, clearActive],
	);

	const onClick = useCallback(
		(e: ReactMouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest(".finsheet-cell-input") !== null) {
				return; // a click inside the editor must not re-activate or cancel it
			}
			const coord = coordFromEvent(target);
			if (coord === null) {
				return;
			}
			focusIntentRef.current = false; // the native click already moved focus here
			store.dispatch({ type: "SET_ACTIVE", coord });
		},
		[store],
	);

	const onDoubleClick = useCallback(
		(e: ReactMouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest(".finsheet-cell-input") !== null) {
				return;
			}
			const coord = coordFromEvent(target);
			if (coord === null) {
				return;
			}
			store.dispatch({ type: "SET_ACTIVE", coord });
			beginEdit(null); // open the editor keeping the current value
		},
		[store, beginEdit],
	);

	const controller = useMemo<GridEditing>(
		() => ({
			store,
			focusIntentRef,
			editSeedRef,
			onKeyDown,
			onClick,
			onDoubleClick,
			commitActive,
			blurActive,
			cancelActive,
		}),
		[store, onKeyDown, onClick, onDoubleClick, commitActive, blurActive, cancelActive],
	);

	return editMode ? controller : null;
}
