/**
 * finsheet — clipboard core (Epic 6, bulk mode). Pure: no DOM, no React, no
 * `navigator.clipboard`. The thin React glue (Stage 3) reads/writes the native
 * `ClipboardEvent`'s TSV text and calls these.
 *
 * The wire format is plain **TSV** (tab-separated cells, CRLF rows) — the format the
 * system clipboard carries to/from Excel/Sheets — in **RAW units** (the unscaled stored
 * number, matching Epic 5's "edit raw units, reveal on focus"; `defaultFormat.scale` is
 * display-only). Reads are always safe on non-editable cells, so copy is inclusive;
 * writes go through {@link isCellEditable}, so paste never touches a computed/locked cell.
 */

import { type EditCoord, isCellEditable } from "./editing";
import { parseAccounting } from "./parse";
import { cellsInRange, type SelectionRect } from "./selection";
import type {
	CellEdit,
	CellValue,
	Column,
	GridModel,
	LineRow,
	RejectedCell,
	Row,
	SkippedCell,
} from "./types";

/**
 * A stored value as raw, non-exponential, non-grouped decimal text (or `""` for a blank).
 * Shared by copy AND the single-cell editor seed so the two can never diverge: a tiny
 * `5e-7` renders `"0.0000005"` (which `parseAccounting` round-trips), never exponential.
 */
export function rawCellText(value: CellValue | undefined): string {
	if (value === null || value === undefined) {
		return "";
	}
	return value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
}

/**
 * Parse clipboard text into a rows×cols grid of raw strings. Splits rows on `\r\n` / `\r`
 * / `\n` and cells on `\t`, dropping ONE trailing row terminator (Excel appends one).
 * Tolerant of ragged rows; empty input → `[]`.
 */
export function parseClipboard(text: string): string[][] {
	const body = text.replace(/\r\n$|\r$|\n$/, "");
	if (body === "") {
		return [];
	}
	return body.split(/\r\n|\r|\n/).map((line) => line.split("\t"));
}

/** Serialize a rows×cols grid back to TSV (tabs between cells, CRLF between rows). */
export function serializeClipboard(cells: readonly (readonly string[])[]): string {
	return cells.map((row) => row.join("\t")).join("\r\n");
}

/**
 * Copy the visual value-column rectangle to a raw TSV grid, INCLUSIVE and geometric:
 * `line`/`subtotal`/`total` rows emit each cell's raw stored value; `section`/`spacer`
 * rows (which have no `values`) emit `""`. The label column (col 0) is never in a rect.
 * All indices are grid-bounded (the rect comes from editable corners), so the reads cast.
 */
export function computeCopy(model: GridModel, rect: SelectionRect): string[][] {
	const out: string[][] = [];
	for (let r = rect.minRow; r <= rect.maxRow; r++) {
		const row = model.rows[r] as Row;
		const valued = row.kind === "line" || row.kind === "subtotal" || row.kind === "total";
		const cells: string[] = [];
		for (let col = rect.minCol; col <= rect.maxCol; col++) {
			if (valued) {
				const column = model.columns[col] as Column;
				cells.push(rawCellText((row as LineRow).values[column.id]));
			} else {
				cells.push(""); // section / spacer — no values field to read
			}
		}
		out.push(cells);
	}
	return out;
}

/** The result of computing a paste: the (editable, changed) patches, plus what was
 *  rejected (unparseable) and skipped (non-editable target) — never silent. */
export interface PasteResult {
	patches: CellEdit[];
	rejected: RejectedCell[];
	skipped: SkippedCell[];
}

/**
 * Compute the patches for pasting `block` (a raw TSV grid) at the selection.
 *
 * - A **1×1** clipboard broadcasts its single value to EVERY editable cell in the
 *   selection; a **multi-cell** block maps POSITIONALLY from the top-left, clipping past
 *   the grid edge and ignoring the selection's size (no tiling).
 * - Only editable targets are written; a non-empty value landing on a non-editable cell
 *   is recorded in `skipped` (never silently dropped).
 * - Per cell: `parseAccounting` — `""` clears (→ `null`), a no-op is suppressed, garbage
 *   is rejected. **Atomic:** any rejection ⇒ zero patches (never half-paste a statement).
 */
export function computePastePatches(
	model: GridModel,
	list: readonly EditCoord[],
	rect: SelectionRect,
	block: string[][],
): PasteResult {
	const rejected: RejectedCell[] = [];
	const skipped: SkippedCell[] = [];
	const patches: CellEdit[] = [];
	const targets: { coord: EditCoord; text: string }[] = [];

	const oneByOne = block.length === 1 && (block[0] as string[]).length === 1;
	if (oneByOne) {
		const text = (block[0] as string[])[0] as string;
		for (const coord of cellsInRange(list, rect)) {
			targets.push({ coord, text });
		}
	} else {
		for (let i = 0; i < block.length; i++) {
			const cols = block[i] as string[];
			for (let j = 0; j < cols.length; j++) {
				const row = model.rows[rect.minRow + i];
				const column = model.columns[rect.minCol + j];
				if (row === undefined || column === undefined) {
					continue; // clipped past the grid edge
				}
				if (isCellEditable(row, column)) {
					targets.push({
						coord: { row: rect.minRow + i, col: rect.minCol + j },
						text: cols[j] as string,
					});
				} else if ((cols[j] as string) !== "") {
					skipped.push({ rowIndex: rect.minRow + i, columnId: column.id });
				}
			}
		}
	}

	for (const { coord, text } of targets) {
		const column = model.columns[coord.col] as Column;
		const parsed = parseAccounting(text);
		if (parsed === undefined) {
			rejected.push({ rowIndex: coord.row, columnId: column.id, text });
			continue;
		}
		const row = model.rows[coord.row] as LineRow;
		if (parsed !== (row.values[column.id] ?? null)) {
			patches.push({
				rowId: row.id,
				rowIndex: coord.row,
				columnId: column.id,
				value: parsed,
			});
		}
	}

	return rejected.length > 0
		? { patches: [], rejected, skipped }
		: { patches, rejected, skipped };
}
