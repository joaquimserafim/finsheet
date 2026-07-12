/**
 * finsheet — an editable value cell (Epic 5). Used in `edit` mode for every cell
 * that passes the editability guard; non-editable cells stay on the plain
 * {@link GridCell}. `React.memo` plus a per-coordinate `useSyncExternalStore`
 * subscription is the one-cell-per-move seam: a move re-renders only the cell that
 * lost active and the cell that gained it — not the row, not the grid.
 */

import { memo, useEffect, useRef, useSyncExternalStore } from "react";
import { CellEditor } from "./CellEditor";
import { rawCellText } from "./clipboard";
import { CELL_ACTIVE, CELL_EDITING, CELL_IDLE, CELL_INVALID, CELL_SELECTED } from "./editStore";
import { cellPresentation } from "./internal";
import type { CellValue, Column } from "./types";
import type { GridEditing } from "./useGridEditing";

interface EditableCellProps {
	editing: GridEditing;
	rowIndex: number;
	colIndex: number;
	/** The row's label, for the editor input's accessible name. */
	rowLabel: string;
	column: Column;
	value: CellValue | undefined;
	formatValue: (value: CellValue | undefined, column: Column) => string;
}

function EditableCellImpl({
	editing,
	rowIndex,
	colIndex,
	rowLabel,
	column,
	value,
	formatValue,
}: EditableCellProps) {
	const { store, focusIntentRef, editSeedRef } = editing;
	const tdRef = useRef<HTMLTableCellElement>(null);

	const status = useSyncExternalStore(
		store.subscribe,
		() => store.cellStatus(rowIndex, colIndex),
		() => CELL_IDLE,
	);

	// On BECOMING the active (non-editing) cell via a keyboard move, claim DOM focus.
	// Gated by focusIntentRef so a pointer landing here — or a boundary Tab escaping —
	// is never yanked back into the grid.
	useEffect(() => {
		if (status === CELL_ACTIVE && focusIntentRef.current) {
			tdRef.current?.focus();
			focusIntentRef.current = false;
		}
	}, [status, focusIntentRef]);

	const { className, align } = cellPresentation(column, false);
	const isEditing = status === CELL_EDITING || status === CELL_INVALID;

	// Roving tabindex: the active cell is the single tab stop (`0`); it drops to `-1`
	// while editing, when the input becomes the tab stop instead. `aria-current` gives
	// assistive tech the active-cell indication a bare <td> otherwise lacks (with no
	// role=grid, aria-selected would be inert; aria-current is the valid token).
	return (
		<td
			ref={tdRef}
			className={className}
			data-align={align}
			data-fs-row={rowIndex}
			data-fs-col={colIndex}
			data-fs-selected={status === CELL_SELECTED ? "true" : undefined}
			aria-current={status === CELL_ACTIVE ? "true" : undefined}
			tabIndex={status === CELL_ACTIVE ? 0 : -1}
		>
			{isEditing ? (
				<CellEditor
					editing={editing}
					initialValue={editSeedRef.current ?? rawCellText(value)}
					invalid={status === CELL_INVALID}
					ariaLabel={column.header ? `${rowLabel}, ${column.header}` : rowLabel}
				/>
			) : (
				formatValue(value, column)
			)}
		</td>
	);
}

export const EditableCell = memo(EditableCellImpl);
