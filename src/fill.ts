/**
 * finsheet — fill + range-clear core (Epic 6, bulk mode). Pure: no DOM, no React.
 *
 * Fill is a VERBATIM value copy — no series/pattern inference (extrapolating figures
 * fabricates data in a statement, the same reason GridCell refuses `?? 0`). Fill-down
 * sources each column's TOPMOST editable cell downward; fill-right sources each row's
 * LEFTMOST editable cell rightward — jumping over non-editable holes, no-op suppressed.
 * A fully non-editable line (e.g. a locked column) yields no source → no fill.
 */

import { type EditCoord, isCellEditable } from "./editing";
import type { SelectionRect } from "./selection";
import type { CellEdit, CellValue, Column, GridModel, LineRow, Row } from "./types";

/** Fill one ordered line of coords: source the first editable cell, write its raw value
 *  verbatim to the remaining editable cells (no-ops suppressed). */
function fillLine(model: GridModel, coords: readonly EditCoord[], patches: CellEdit[]): void {
	let source: CellValue = null;
	let haveSource = false;
	for (const { row: r, col: cc } of coords) {
		const row = model.rows[r] as Row;
		const column = model.columns[cc] as Column;
		if (!isCellEditable(row, column)) {
			continue; // a non-editable hole — never a source, never a target
		}
		if (!haveSource) {
			source = (row as LineRow).values[column.id] ?? null;
			haveSource = true;
			continue; // the source cell itself is not rewritten
		}
		if (source !== ((row as LineRow).values[column.id] ?? null)) {
			patches.push({ rowId: row.id, rowIndex: r, columnId: column.id, value: source });
		}
	}
}

/** Fill-down / fill-right within the rect (see module doc). */
export function computeFillPatches(
	model: GridModel,
	rect: SelectionRect,
	dir: "down" | "right",
): CellEdit[] {
	const patches: CellEdit[] = [];
	if (dir === "down") {
		for (let col = rect.minCol; col <= rect.maxCol; col++) {
			const line: EditCoord[] = [];
			for (let r = rect.minRow; r <= rect.maxRow; r++) {
				line.push({ row: r, col });
			}
			fillLine(model, line, patches);
		}
	} else {
		for (let r = rect.minRow; r <= rect.maxRow; r++) {
			const line: EditCoord[] = [];
			for (let col = rect.minCol; col <= rect.maxCol; col++) {
				line.push({ row: r, col });
			}
			fillLine(model, line, patches);
		}
	}
	return patches;
}

/** Clear every editable cell in the rect to `null` (skips already-blank + non-editable cells). */
export function computeClearPatches(model: GridModel, rect: SelectionRect): CellEdit[] {
	const patches: CellEdit[] = [];
	for (let r = rect.minRow; r <= rect.maxRow; r++) {
		const row = model.rows[r] as Row;
		for (let col = rect.minCol; col <= rect.maxCol; col++) {
			const column = model.columns[col] as Column;
			if (!isCellEditable(row, column)) {
				continue;
			}
			if (((row as LineRow).values[column.id] ?? null) !== null) {
				patches.push({ rowId: row.id, rowIndex: r, columnId: column.id, value: null });
			}
		}
	}
	return patches;
}
