/**
 * finsheet — editing backbone (Epic 5). Pure: no DOM, no React.
 *
 * The editability guard, the navigable-cell list, the keyboard-intent classifier,
 * and directional navigation — all as pure functions so the tricky logic is
 * exhaustively unit-testable without a browser.
 */

import type { Column, GridModel, Row } from "./types";

/** A navigable editable cell: a `model.rows` index × a `columns` index (always ≥ 1). */
export interface EditCoord {
	row: number;
	col: number;
}

export type MoveDir = "up" | "down" | "left" | "right" | "next" | "prev";

/** What a keydown means, given the current editing phase. */
export type EditIntent =
	| { kind: "move"; dir: MoveDir }
	| { kind: "commitMove"; dir: MoveDir }
	| { kind: "startEdit"; seed: string | null }
	| { kind: "clear" }
	| { kind: "cancel" }
	| { kind: "none" };

/**
 * The locked editability rule (mirrors the doc in src/types.ts) — the single
 * source of truth. Only `line` value cells in numeric, non-locked columns edit.
 */
export function isCellEditable(row: Row, col: Column): boolean {
	return (
		row.kind === "line" &&
		row.editable !== false &&
		col.numeric === true &&
		col.editable !== false
	);
}

/**
 * Row-major list of every editable cell coordinate. `col` starts at 1 — `columns[0]`
 * is the label column and is never editable. Because editability is a row-predicate
 * ANDed with a column-predicate, the editable set is a perfect rows×cols rectangle,
 * so directional navigation is always well-defined.
 */
export function buildEditableList(model: GridModel): EditCoord[] {
	const list: EditCoord[] = [];
	for (const [row, r] of model.rows.entries()) {
		for (const [col, c] of model.columns.entries()) {
			if (col === 0) {
				continue; // label column
			}
			if (isCellEditable(r, c)) {
				list.push({ row, col });
			}
		}
	}
	return list;
}

export function coordKey(c: EditCoord): string {
	return `${c.row}:${c.col}`;
}

/** Map a keydown to an intent. `mod` = ctrl/cmd/alt held (those combos are left to the browser). */
export function classifyKey(
	key: string,
	shiftKey: boolean,
	mod: boolean,
	editing: boolean,
): EditIntent {
	if (mod) {
		return { kind: "none" };
	}
	if (editing) {
		switch (key) {
			case "Enter":
				return { kind: "commitMove", dir: shiftKey ? "up" : "down" };
			case "Tab":
				return { kind: "commitMove", dir: shiftKey ? "prev" : "next" };
			case "ArrowUp":
				return { kind: "commitMove", dir: "up" };
			case "ArrowDown":
				return { kind: "commitMove", dir: "down" };
			case "Escape":
				return { kind: "cancel" };
			default:
				return { kind: "none" }; // caret keys, printable, Backspace → the input handles it
		}
	}
	switch (key) {
		case "ArrowUp":
			return { kind: "move", dir: "up" };
		case "ArrowDown":
			return { kind: "move", dir: "down" };
		case "ArrowLeft":
			return { kind: "move", dir: "left" };
		case "ArrowRight":
			return { kind: "move", dir: "right" };
		case "Tab":
			return { kind: "move", dir: shiftKey ? "prev" : "next" };
		case "Enter":
		case "F2":
			return { kind: "startEdit", seed: null }; // keep the current value
		case "Backspace":
		case "Delete":
			return { kind: "clear" };
		case "Escape":
			return { kind: "none" };
		default:
			return key.length === 1 ? { kind: "startEdit", seed: key } : { kind: "none" };
	}
}

function axes(list: readonly EditCoord[]): { rows: number[]; cols: number[] } {
	const rows = [...new Set(list.map((c) => c.row))].sort((a, b) => a - b);
	const cols = [...new Set(list.map((c) => c.col))].sort((a, b) => a - b);
	return { rows, cols };
}

/** The editable cell in `dir` from `from`, or `null` at a boundary / if `from` isn't editable. */
export function nextEditable(
	list: readonly EditCoord[],
	from: EditCoord,
	dir: MoveDir,
): EditCoord | null {
	const idx = list.findIndex((c) => c.row === from.row && c.col === from.col);
	if (idx === -1) {
		return null;
	}
	if (dir === "next") {
		return list[idx + 1] ?? null;
	}
	if (dir === "prev") {
		return list[idx - 1] ?? null;
	}
	const { rows, cols } = axes(list);
	if (dir === "up" || dir === "down") {
		const cand = rows.filter((r) => (dir === "up" ? r < from.row : r > from.row));
		const target = dir === "up" ? cand.at(-1) : cand[0];
		return target === undefined ? null : { row: target, col: from.col };
	}
	const cand = cols.filter((c) => (dir === "left" ? c < from.col : c > from.col));
	const target = dir === "left" ? cand.at(-1) : cand[0];
	return target === undefined ? null : { row: from.row, col: target };
}

/** After a model change: keep `active` if still editable, else clamp to the first cell (or null). */
export function reconcileActive(
	list: readonly EditCoord[],
	active: EditCoord | null,
): EditCoord | null {
	if (active !== null && list.some((c) => c.row === active.row && c.col === active.col)) {
		return active;
	}
	return list[0] ?? null;
}
