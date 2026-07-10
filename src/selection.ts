/**
 * finsheet — range-selection core (Epic 6, bulk mode). Pure: no DOM, no React.
 *
 * A selection is Epic 5's `active` (the moving FOCUS corner) plus one fixed corner,
 * `anchor`. `anchor === null` ⇒ a collapsed 1×1 selection = Epic 5's active cell,
 * exactly. Both corners are always editable coords, so the rectangle they span can
 * still cross non-editable rows/columns — the membership + patch helpers only ever act
 * on the EDITABLE cells inside it (the sacred guard, enforced structurally).
 *
 * Everything here is a pure function over `(list, rect, coords)` so selection works
 * identically whether all cells are mounted or the body is virtualized (Epic 7).
 */

import { type EditCoord, type MoveDir, reconcileActive, sameCoord } from "./editing";

/** The inclusive bounding box of the two selection corners. */
export interface SelectionRect {
	minRow: number;
	maxRow: number;
	minCol: number;
	maxCol: number;
}

/** The bounding rect of the two corners, or `null` when there is no selection. */
export function selectionRect(
	anchor: EditCoord | null,
	active: EditCoord | null,
): SelectionRect | null {
	if (active === null) {
		return null;
	}
	if (anchor === null) {
		return { minRow: active.row, maxRow: active.row, minCol: active.col, maxCol: active.col };
	}
	return {
		minRow: Math.min(anchor.row, active.row),
		maxRow: Math.max(anchor.row, active.row),
		minCol: Math.min(anchor.col, active.col),
		maxCol: Math.max(anchor.col, active.col),
	};
}

/** O(1) membership test: is `(row, col)` inside the rect? */
export function withinRect(rect: SelectionRect | null, row: number, col: number): boolean {
	return (
		rect !== null &&
		row >= rect.minRow &&
		row <= rect.maxRow &&
		col >= rect.minCol &&
		col <= rect.maxCol
	);
}

/** The EDITABLE cells inside the rect, from the editable list (row-major order preserved). */
export function cellsInRange(list: readonly EditCoord[], rect: SelectionRect | null): EditCoord[] {
	if (rect === null) {
		return [];
	}
	return list.filter((c) => withinRect(rect, c.row, c.col));
}

/** Whether the selection spans more than one cell. */
export function isMultiSelection(anchor: EditCoord | null, active: EditCoord | null): boolean {
	const rect = selectionRect(anchor, active);
	return rect !== null && (rect.minRow !== rect.maxRow || rect.minCol !== rect.maxCol);
}

/** A collapsed/extended selection pair. */
export interface Selection {
	active: EditCoord | null;
	anchor: EditCoord | null;
}

/**
 * After a model change, keep the selection valid — but SYMMETRICALLY: preserve BOTH
 * corners only when both survive as still-editable (so a same-shape post-batch re-render
 * keeps the pasted/filled block highlighted). If EITHER corner is invalidated by a
 * structural change, COLLAPSE — clamp `active` to a valid editable cell and drop the
 * anchor (never synthesise a phantom rectangle from a surviving anchor + clamped active).
 */
export function reconcileSelection(
	list: readonly EditCoord[],
	active: EditCoord | null,
	anchor: EditCoord | null,
): Selection {
	const activeOk =
		active !== null && list.some((c) => c.row === active.row && c.col === active.col);
	const anchorOk =
		anchor === null || list.some((c) => c.row === anchor.row && c.col === anchor.col);
	if (activeOk && anchorOk) {
		return { active, anchor };
	}
	return { active: reconcileActive(list, active), anchor: null };
}

/** Structural equality of two selections (both corners). */
export function sameSelection(a: Selection, b: Selection): boolean {
	return sameCoord(a.active, b.active) && sameCoord(a.anchor, b.anchor);
}

/** What a bulk-mode keydown means. `{ kind: "none" }` ⇒ fall through to Epic 5's `classifyKey`. */
export type BulkIntent =
	| { kind: "extend"; dir: MoveDir }
	| { kind: "selectAll" }
	| { kind: "fill"; dir: "down" | "right" }
	| { kind: "clearRange" }
	| { kind: "clearSelection" }
	| { kind: "none" };

/**
 * Classify a bulk-mode keydown. `mod` combos (ctrl/cmd) drive select-all + fill; Shift
 * drives range extend; Esc/Delete act on a live multi-cell selection. Anything else — and
 * every clipboard key (Cmd+C/V/X are native clipboard events, never keydown) — returns
 * `{ none }` so the untouched Epic 5 `classifyKey` handles it. The controller only calls
 * this when NOT editing (Epic 5's editing early-return still guards the editor).
 */
export function classifyBulkKey(
	key: string,
	shift: boolean,
	ctrl: boolean,
	meta: boolean,
	multi: boolean,
): BulkIntent {
	if (ctrl || meta) {
		switch (key.toLowerCase()) {
			case "a":
				return { kind: "selectAll" };
			case "d":
				return { kind: "fill", dir: "down" };
			case "r":
				return { kind: "fill", dir: "right" };
			default:
				return { kind: "none" }; // incl. c/v/x — handled as native clipboard events
		}
	}
	if (shift) {
		switch (key) {
			case "ArrowUp":
				return { kind: "extend", dir: "up" };
			case "ArrowDown":
				return { kind: "extend", dir: "down" };
			case "ArrowLeft":
				return { kind: "extend", dir: "left" };
			case "ArrowRight":
				return { kind: "extend", dir: "right" };
			default:
				return { kind: "none" };
		}
	}
	if (key === "Escape") {
		return multi ? { kind: "clearSelection" } : { kind: "none" };
	}
	if ((key === "Delete" || key === "Backspace") && multi) {
		return { kind: "clearRange" };
	}
	return { kind: "none" };
}
