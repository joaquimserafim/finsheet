import { type CSSProperties, memo } from "react";
import { EditableCell } from "./EditableCell";
import { isCellEditable } from "./editing";
import { GridCell } from "./GridCell";
import { cellPresentation } from "./internal";
import type { CellValue, Column, Row } from "./types";
import type { GridEditing } from "./useGridEditing";

interface GridRowProps {
	row: Row;
	/** Index of this row in `model.rows` — the row half of an edit coordinate. */
	rowIndex: number;
	columns: readonly Column[];
	/** Whether the label column (columns[0]) pins to the left. Resolved once by Grid. */
	stickyLeft: boolean;
	formatValue: (value: CellValue | undefined) => string;
	/** The editing controller in `edit` mode, or `null` in `view` mode. */
	editing: GridEditing | null;
}

/**
 * The label `<th scope="row">` in the sticky-left column. Shared by every labeled
 * row kind so the label always pins (and indents) identically. `--fs-depth` is
 * always emitted (`depth ?? 0`) so the CSS `calc()` and the render tests have a
 * stable hook to read.
 */
function labelCell(
	label: string,
	depth: number | undefined,
	labelColumn: Column | undefined,
	stickyLeft: boolean,
) {
	const { className, align } = labelColumn
		? cellPresentation(labelColumn, stickyLeft)
		: { className: undefined, align: "left" as const };
	return (
		<th
			scope="row"
			className={className}
			data-align={align}
			style={{ "--fs-depth": depth ?? 0 } as CSSProperties}
		>
			{label}
		</th>
	);
}

/**
 * One `<tr>` per row, `React.memo`-wrapped (the row-granularity seam). The
 * exhaustive `switch (row.kind)` closes with a `never` guard mirroring src/types.ts,
 * so adding a row kind without handling it here fails to compile. In `edit` mode each
 * editable value cell becomes an {@link EditableCell} (a roving-tabindex edit stop);
 * every other cell — and all of `view` mode — renders exactly as v0.1.0.
 */
function GridRowImpl({ row, rowIndex, columns, stickyLeft, formatValue, editing }: GridRowProps) {
	switch (row.kind) {
		case "spacer":
			// No label, no values; removed from the a11y tree so it doesn't inflate counts.
			return (
				// biome-ignore lint/a11y/noAriaHiddenOnFocusable: a decorative spacer <tr> is never focusable; aria-hidden intentionally drops the empty gap from the a11y tree.
				<tr data-kind="spacer" aria-hidden="true">
					<td colSpan={columns.length} />
				</tr>
			);
		case "section":
			// A section has no values: a TRULY empty value region, not a "–" cell.
			// The fill cell is skipped for a label-only model (colSpan 0 is invalid).
			return (
				<tr data-kind="section">
					{labelCell(row.label, row.depth, columns[0], stickyLeft)}
					{columns.length > 1 ? <td colSpan={columns.length - 1} /> : null}
				</tr>
			);
		case "line":
		case "subtotal":
		case "total":
			return (
				<tr data-kind={row.kind}>
					{labelCell(row.label, row.depth, columns[0], stickyLeft)}
					{columns.slice(1).map((column, i) => {
						const colIndex = i + 1;
						const value = row.values[column.id];
						if (editing !== null && isCellEditable(row, column)) {
							return (
								<EditableCell
									key={column.id}
									editing={editing}
									rowIndex={rowIndex}
									colIndex={colIndex}
									rowLabel={row.label}
									column={column}
									value={value}
									formatValue={formatValue}
								/>
							);
						}
						return (
							<GridCell
								key={column.id}
								column={column}
								value={value}
								formatValue={formatValue}
							/>
						);
					})}
				</tr>
			);
		default: {
			const _exhaustive: never = row;
			return _exhaustive;
		}
	}
}

export const GridRow = memo(GridRowImpl);
