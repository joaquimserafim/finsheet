import { type ReactElement, type ReactNode, useMemo } from "react";
import { formatColumnValue } from "./columnFormat";
import type { FormatOptions } from "./format";
import { GridRow } from "./GridRow";
import { cellPresentation, colWidth } from "./internal";
import type { BulkEdit, CellEdit, CellValue, Column, GridMode, GridModel, Row } from "./types";
import { useGridEditing } from "./useGridEditing";

export interface GridProps {
	/** Controlled data. The grid never mutates it. */
	readonly model: GridModel;
	/**
	 * Statement-wide accounting format — the BASE every value column inherits, and can override
	 * per column via `Column.format`. E.g. `{ scale: "thousands" }` shows the whole statement in
	 * thousands. Omit for `formatAccounting` defaults (units, 0 dp, parens, "–" blank, en-US).
	 */
	readonly defaultFormat?: FormatOptions;
	/**
	 * Pin the trailing `total` row (the "bottom line") to a sticky `<tfoot>`.
	 * Default `true`. `false` renders it inline in `<tbody>` and emits no footer.
	 */
	readonly stickyFooter?: boolean;
	/**
	 * `"view"` (default) is the read-only v0.1.0 surface, byte-for-byte unchanged.
	 * `"edit"` makes numeric `line` cells a keyboard-navigable editing surface —
	 * pair it with {@link GridProps.onEdit}. `"bulk"` is a strict superset of `"edit"`
	 * that adds range selection, clipboard copy/paste, fill and range-clear — pair it
	 * with {@link GridProps.onBulkEdit} (single-cell edits still fire {@link GridProps.onEdit}).
	 */
	readonly mode?: GridMode;
	/**
	 * Fires on each committed single-cell edit in `edit`/`bulk` mode. The grid never
	 * mutates `model`: apply the {@link CellEdit} to your own data and pass a fresh `model`.
	 */
	readonly onEdit?: (change: CellEdit) => void;
	/**
	 * Fires once per bulk operation in `bulk` mode — a paste, cut, fill or range-clear.
	 * The grid stays controlled: apply every `edit` in the {@link BulkEdit} to your own
	 * data and pass back one fresh `model` (one re-render, one undo step).
	 */
	readonly onBulkEdit?: (change: BulkEdit) => void;
	/** Rendered as a `<caption>`; supplies the table's accessible name. */
	readonly caption?: ReactNode;
	/**
	 * Force the color theme by stamping `data-theme` on the `.finsheet` element.
	 * Omit to follow the OS (`prefers-color-scheme`); `"light"` / `"dark"` override it.
	 */
	readonly theme?: "light" | "dark";
	readonly className?: string;
	readonly id?: string;
	readonly "aria-label"?: string;
	readonly "aria-labelledby"?: string;
}

/**
 * Index of the terminal `total` row to pin, or `-1`. Scans from the end skipping
 * trailing spacers: the last non-spacer row is pinned only if it is a `total`, so
 * a mid-sheet total (e.g. "Total assets") stays inline in document order.
 */
function trailingTotalIndex(rows: readonly Row[]): number {
	for (let i = rows.length - 1; i >= 0; i--) {
		const row = rows[i];
		if (row === undefined || row.kind === "spacer") {
			continue;
		}
		return row.kind === "total" ? i : -1;
	}
	return -1;
}

/**
 * A read-only financial-statement grid. Renders a semantic `<table>` inside a
 * single scroll port: sticky header, optional sticky label column
 * (`Column.sticky: "left"`), per-`kind` row styling, and an optionally pinned
 * grand-total footer. Controlled: the caller owns `model`; the grid never mutates.
 *
 * Style it by importing the stylesheet once: `import "finsheet/styles.css"`.
 */
export function Grid({
	model,
	defaultFormat,
	stickyFooter = true,
	mode = "view",
	onEdit,
	onBulkEdit,
	caption,
	theme,
	className,
	id,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
}: GridProps): ReactElement {
	const { columns, rows } = model;
	const stickyLeft = columns[0]?.sticky === "left";

	// The editing controller — `null` in view mode (and Grid renders exactly as
	// v0.1.0). Never re-renders Grid itself: cells subscribe to it directly.
	const editing = useGridEditing({ model, mode, onEdit, onBulkEdit });
	// The bulk-only surface: clipboard + pointer range-select are wired only in bulk
	// mode (null otherwise), so `edit` stays exactly the Epic 5 single-cell surface.
	const bulkEditing = mode === "bulk" ? editing : null;

	// A referentially-stable bound formatter: keyed on the PRIMITIVE option fields,
	// not object identity, so an inline `defaultFormat={{…}}` doesn't defeat the
	// GridRow memo boundary Epic 7 relies on.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the primitive FormatOptions fields (not the object) on purpose — depending on `defaultFormat` would rebuild formatValue for every inline-literal prop and defeat the memo seam.
	const formatValue = useMemo(
		() => (value: CellValue | undefined, column: Column) =>
			formatColumnValue(value, column.format, defaultFormat),
		[
			defaultFormat?.scale,
			defaultFormat?.precision,
			defaultFormat?.parens,
			defaultFormat?.blank,
			defaultFormat?.locale,
		],
	);

	// One O(n) pass; excluded from <tbody> by INDEX identity so the pinned total
	// can never render twice.
	const pinnedIndex = useMemo(
		() => (stickyFooter ? trailingTotalIndex(rows) : -1),
		[rows, stickyFooter],
	);
	const pinnedRow = pinnedIndex >= 0 ? rows[pinnedIndex] : undefined;

	const renderRow = (row: Row, index: number) => (
		<GridRow
			key={row.id ?? `__row_${index}`}
			row={row}
			rowIndex={index}
			columns={columns}
			stickyLeft={stickyLeft}
			formatValue={formatValue}
			editing={editing}
		/>
	);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the scroll port delegates keyboard/pointer editing to the focusable cells + inputs of the wrapped <table> (roving tabindex); the handlers are absent entirely in view mode.
		<div
			className={className ? `finsheet ${className}` : "finsheet"}
			id={id}
			data-theme={theme}
			onKeyDown={editing?.onKeyDown}
			onClick={editing?.onClick}
			onDoubleClick={editing?.onDoubleClick}
			onCopy={bulkEditing?.onCopy}
			onCut={bulkEditing?.onCut}
			onPaste={bulkEditing?.onPaste}
			onPointerDown={bulkEditing?.onPointerDown}
			onPointerMove={bulkEditing?.onPointerMove}
			onPointerUp={bulkEditing?.onPointerUp}
		>
			<table
				className="finsheet-table"
				aria-label={ariaLabel}
				aria-labelledby={ariaLabelledBy}
			>
				{caption !== undefined ? <caption>{caption}</caption> : null}
				<colgroup>
					{columns.map((column, i) => {
						const width = colWidth(column, i === 0);
						return <col key={column.id} style={width ? { width } : undefined} />;
					})}
				</colgroup>
				<thead>
					<tr>
						{columns.map((column, i) => {
							const { className: cls, align } = cellPresentation(
								column,
								i === 0 && stickyLeft,
							);
							return (
								<th key={column.id} scope="col" className={cls} data-align={align}>
									{column.header}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, index) =>
						index === pinnedIndex ? null : renderRow(row, index),
					)}
				</tbody>
				{pinnedRow !== undefined ? (
					<tfoot>{renderRow(pinnedRow, pinnedIndex)}</tfoot>
				) : null}
			</table>
		</div>
	);
}
