/**
 * finsheet — the editing controller (Epics 5–6). The one hook that turns the pure
 * core (editing.ts / editReducer.ts / editStore.ts / selection.ts) into live
 * behaviour, for both `edit` (single cell) and `bulk` (range selection).
 *
 * It owns: the editable-cell list (skipped entirely in `view` mode), the edit
 * {@link EditStore} (created once), a `focusIntentRef` that gates who may claim DOM
 * focus, an `editSeedRef` carrying the char that opened the editor, a `draggingRef`
 * arming pointer range-select, the container's delegated keyboard/pointer/clipboard
 * handlers, and the commit/cancel/blur funnels the editor input calls. `Grid` itself
 * never re-renders on an edit — only the cells whose packed status changed do.
 *
 * `edit` emits single-cell commits through `onEdit`; `bulk` adds the write gestures —
 * clipboard paste/cut, fill-down/right, and range-clear — each emitted as ONE
 * {@link BulkEdit} through `onBulkEdit` (copy writes only the system clipboard).
 *
 * Every decision lives in a pure, unit-tested helper (classifyKey / classifyBulkKey /
 * nextEditable / reconcileSelection / parseAccounting / sameSelection; and the write
 * planners computeCopy / computePastePatches / computeFillPatches / computeClearPatches);
 * this file is the wiring.
 */

import {
	type ClipboardEvent as ReactClipboardEvent,
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { computeCopy, computePastePatches, parseClipboard, serializeClipboard } from "./clipboard";
import {
	buildEditableList,
	classifyKey,
	type EditCoord,
	type MoveDir,
	modifierHeld,
	nextEditable,
	sameCoord,
} from "./editing";
import { createEditStore, type EditStore } from "./editStore";
import { computeClearPatches, computeFillPatches } from "./fill";
import { parseAccounting } from "./parse";
import {
	classifyBulkKey,
	isMultiSelection,
	reconcileSelection,
	type SelectionRect,
	sameSelection,
	selectionRect,
} from "./selection";
import type {
	BulkEdit,
	CellEdit,
	CellValue,
	Column,
	GridMode,
	GridModel,
	LineRow,
	Row,
} from "./types";

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
	/** Bulk-only clipboard handlers (wired by `Grid` only in `bulk` mode). Copy/cut
	 *  serialise the selection rectangle to the system clipboard as raw TSV; cut and
	 *  paste additionally emit a {@link BulkEdit}. An open editor keeps them (its input
	 *  owns native text copy/paste). */
	onCopy: (e: ReactClipboardEvent) => void;
	onCut: (e: ReactClipboardEvent) => void;
	onPaste: (e: ReactClipboardEvent) => void;
	/** Bulk-only pointer range-select (wired by `Grid` only in `bulk` mode): press to
	 *  land the anchor, drag to extend, release to end. */
	onPointerDown: (e: ReactPointerEvent) => void;
	onPointerMove: (e: ReactPointerEvent) => void;
	onPointerUp: (e: ReactPointerEvent) => void;
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
	onBulkEdit: ((change: BulkEdit) => void) | undefined;
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
	const { model, mode, onEdit, onBulkEdit } = params;
	const editMode = mode === "edit";
	const bulkMode = mode === "bulk";
	// `bulk` is a strict superset of `edit`: both share the editable-cell scan, the
	// store, and the commit funnels; `bulkMode` alone gates the selection layer below.
	const interactive = editMode || bulkMode;

	// The editable-cell scan is skipped in view mode (a stable empty list).
	const list = useMemo(
		() => (interactive ? buildEditableList(model) : NO_CELLS),
		[interactive, model],
	);

	// Latest-value refs so every handler stays referentially stable yet never stale.
	const modelRef = useRef(model);
	modelRef.current = model;
	const listRef = useRef(list);
	listRef.current = list;
	const onEditRef = useRef(onEdit);
	onEditRef.current = onEdit;
	const onBulkEditRef = useRef(onBulkEdit);
	onBulkEditRef.current = onBulkEdit;

	const focusIntentRef = useRef(false);
	const editSeedRef = useRef<string | null>(null);
	// True while a pointer press is drag-selecting a range (armed on pointerdown).
	const draggingRef = useRef(false);
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
		// Keep BOTH selection corners valid after a model change. reconcileSelection
		// preserves the rect only when both corners survive (a same-shape re-render keeps
		// a pasted/filled block highlit), else collapses to the clamped active cell. In
		// edit mode `anchor` is always null, so this reduces to Epic 5's single-cell clamp
		// (RECONCILE with a null anchor == the old SET_ACTIVE).
		const cur = store.getState();
		const next = reconcileSelection(list, cur.active, cur.anchor);
		if (!sameSelection(cur, next)) {
			store.dispatch({ type: "RECONCILE", active: next.active, anchor: next.anchor });
		}
	}, [list, store]);

	const emitEdit = useCallback(
		(row: Row, rowIndex: number, columnId: string, value: CellValue) => {
			onEditRef.current?.({ rowId: row.id, rowIndex, columnId, value });
		},
		[],
	);

	// The single onBulkEdit funnel (paste / cut / fill / range-clear). Callers pre-filter
	// out empty ops, so a fired op always carries at least one thing to report.
	const emitBulk = useCallback((change: BulkEdit) => {
		onBulkEditRef.current?.(change);
	}, []);

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

			// Bulk mode first: selection gestures (extend / select-all / collapse) and the
			// write gestures (fill-down/right, range-clear → onBulkEdit). Anything
			// classifyBulkKey returns `{none}` for — including a single-cell Delete and every
			// clipboard key — falls through to the shared Epic 5 nav/edit handling below.
			if (bulkMode) {
				const multi = isMultiSelection(state.anchor, active);
				const bulk = classifyBulkKey(e.key, e.shiftKey, e.ctrlKey, e.metaKey, multi);
				// Every intent the bulk layer CLAIMS is consumed here, so the browser never
				// also acts on it (Shift+Arrow selecting page text, Cmd+A/D/R select-all/
				// bookmark/reload, Backspace navigating back). Only `{none}` is left un-
				// prevented — it falls through to the shared Epic 5 nav/edit handling below.
				if (bulk.kind !== "none") {
					e.preventDefault();
				}
				switch (bulk.kind) {
					case "extend": {
						const target = nextEditable(listRef.current, active, bulk.dir);
						if (target !== null) {
							focusIntentRef.current = true;
							store.dispatch({ type: "EXTEND", coord: target });
						}
						// else: at an edge — swallow, keeping the current selection.
						return;
					}
					case "selectAll": {
						const cells = listRef.current;
						focusIntentRef.current = true; // the focus corner moves to the last cell
						// active is non-null ⇒ the list is non-empty, so both extremes exist.
						store.dispatch({
							type: "SELECT_ALL",
							anchor: cells[0] as EditCoord,
							active: cells[cells.length - 1] as EditCoord,
						});
						return;
					}
					case "clearSelection":
						store.dispatch({ type: "CLEAR_SELECTION" });
						return;
					case "fill": {
						// active is non-null here ⇒ the rect is never null (a collapsed 1×1
						// at worst, which fills nothing — one cell, no target).
						const rect = selectionRect(state.anchor, active) as SelectionRect;
						const patches = computeFillPatches(modelRef.current, rect, bulk.dir);
						if (patches.length > 0) {
							emitBulk({
								kind: bulk.dir === "down" ? "fill-down" : "fill-right",
								edits: patches,
							});
						}
						return;
					}
					case "clearRange": {
						const rect = selectionRect(state.anchor, active) as SelectionRect;
						const patches = computeClearPatches(modelRef.current, rect);
						if (patches.length > 0) {
							emitBulk({ kind: "clear", edits: patches });
						}
						return;
					}
				}
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
		[store, beginEdit, clearActive, emitBulk, bulkMode],
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
			// Shift-click (bulk) extends from the fixed anchor to the clicked cell; a plain
			// click lands + collapses the range. `coord` is always an editable cell (only
			// EditableCells carry data-fs-row/col), so EXTEND's corners stay editable.
			if (bulkMode && e.shiftKey) {
				store.dispatch({ type: "EXTEND", coord });
				return;
			}
			store.dispatch({ type: "SET_ACTIVE", coord });
		},
		[store, bulkMode],
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

	// ── Bulk clipboard (Grid wires these only in bulk mode) ──────────────────────
	// An open editor input owns native copy/cut/paste of its own text: bail (no
	// preventDefault) so the browser handles the in-input selection. Off the editor,
	// the grid's selection rectangle is the unit. `active` (hence the rect) can be null
	// only when there are no editable cells — then there is nothing to copy.

	const onCopy = useCallback(
		(e: ReactClipboardEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest(".finsheet-cell-input") !== null) {
				return;
			}
			const state = store.getState();
			const rect = selectionRect(state.anchor, state.active);
			if (rect === null) {
				return;
			}
			e.clipboardData.setData(
				"text/plain",
				serializeClipboard(computeCopy(modelRef.current, rect)),
			);
			e.preventDefault();
		},
		[store],
	);

	const onCut = useCallback(
		(e: ReactClipboardEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest(".finsheet-cell-input") !== null) {
				return;
			}
			const state = store.getState();
			const rect = selectionRect(state.anchor, state.active);
			if (rect === null) {
				return;
			}
			e.clipboardData.setData(
				"text/plain",
				serializeClipboard(computeCopy(modelRef.current, rect)),
			);
			e.preventDefault();
			// Cut = copy, then clear the editable cells in the rectangle (one op).
			const patches = computeClearPatches(modelRef.current, rect);
			if (patches.length > 0) {
				emitBulk({ kind: "clear", edits: patches });
			}
		},
		[store, emitBulk],
	);

	const onPaste = useCallback(
		(e: ReactClipboardEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest(".finsheet-cell-input") !== null) {
				return;
			}
			const state = store.getState();
			const rect = selectionRect(state.anchor, state.active);
			if (rect === null) {
				return;
			}
			e.preventDefault(); // in bulk mode the grid owns the paste
			const block = parseClipboard(e.clipboardData.getData("text/plain"));
			if (block.length === 0) {
				return; // empty clipboard — nothing to place
			}
			const result = computePastePatches(modelRef.current, listRef.current, rect, block);
			// Report unless nothing at all happened (no writes, no rejects, no skips).
			if (result.patches.length + result.rejected.length + result.skipped.length > 0) {
				emitBulk({
					kind: "paste",
					edits: result.patches,
					rejected: result.rejected,
					skipped: result.skipped,
				});
			}
		},
		[store, emitBulk],
	);

	// ── Bulk pointer range-select (Grid wires these only in bulk mode) ───────────
	// Press lands the anchor (collapsing any range); a drag onto other cells extends;
	// release ends it. A shift-press is left to onClick (shift-click extends from the
	// kept anchor), and a press inside the open editor is left to the input.

	const onPointerDown = useCallback(
		(e: ReactPointerEvent) => {
			if (e.shiftKey) {
				return;
			}
			const target = e.target as HTMLElement;
			if (target.closest(".finsheet-cell-input") !== null) {
				return;
			}
			const coord = coordFromEvent(target);
			if (coord === null) {
				return;
			}
			focusIntentRef.current = false; // the native press already moves focus here
			draggingRef.current = true;
			store.dispatch({ type: "SET_ACTIVE", coord });
		},
		[store],
	);

	const onPointerMove = useCallback(
		(e: ReactPointerEvent) => {
			if (!draggingRef.current) {
				return;
			}
			const coord = coordFromEvent(e.target as HTMLElement);
			if (coord === null) {
				return; // over a gap / non-editable region — hold the current selection
			}
			// Suppress the drag's text selection while a range is forming.
			e.currentTarget.setAttribute("data-fs-dragging", "true");
			if (sameCoord(store.getState().active, coord)) {
				return; // still over the focus cell — nothing to extend
			}
			store.dispatch({ type: "EXTEND", coord });
		},
		[store],
	);

	const onPointerUp = useCallback((e: ReactPointerEvent) => {
		draggingRef.current = false;
		e.currentTarget.removeAttribute("data-fs-dragging");
	}, []);

	const controller = useMemo<GridEditing>(
		() => ({
			store,
			focusIntentRef,
			editSeedRef,
			onKeyDown,
			onClick,
			onDoubleClick,
			onCopy,
			onCut,
			onPaste,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			commitActive,
			blurActive,
			cancelActive,
		}),
		[
			store,
			onKeyDown,
			onClick,
			onDoubleClick,
			onCopy,
			onCut,
			onPaste,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			commitActive,
			blurActive,
			cancelActive,
		],
	);

	return interactive ? controller : null;
}
