import { type ReactElement, type ReactNode, useMemo } from "react";
import type { FormatOptions } from "./format";
import { formatAccounting } from "./format";
import { GridRow } from "./GridRow";
import { cellPresentation, colWidth } from "./internal";
import type { CellValue, GridModel, Row } from "./types";

export interface GridProps {
	/** Controlled data. The grid never mutates it. */
	model: GridModel;
	/**
	 * Statement-wide accounting format threaded to every value cell — e.g.
	 * `{ scale: "thousands" }` for a statement shown in thousands, or `precision`.
	 * Omit for `formatAccounting` defaults (units, 0 dp, parens, "–" blank, en-US).
	 * Distinct from the deferred per-column `Column.format`.
	 */
	defaultFormat?: FormatOptions;
	/**
	 * Pin the trailing `total` row (the "bottom line") to a sticky `<tfoot>`.
	 * Default `true`. `false` renders it inline in `<tbody>` and emits no footer.
	 */
	stickyFooter?: boolean;
	/** Rendered as a `<caption>`; supplies the table's accessible name. */
	caption?: ReactNode;
	className?: string;
	id?: string;
	"aria-label"?: string;
	"aria-labelledby"?: string;
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
 * Style it by importing the stylesheet once: `import "columnar/styles.css"`.
 */
export function Grid({
	model,
	defaultFormat,
	stickyFooter = true,
	caption,
	className,
	id,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
}: GridProps): ReactElement {
	const { columns, rows } = model;
	const stickyLeft = columns[0]?.sticky === "left";

	// A referentially-stable bound formatter: keyed on the PRIMITIVE option fields,
	// not object identity, so an inline `defaultFormat={{…}}` doesn't defeat the
	// GridRow memo boundary Epic 7 relies on.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the primitive FormatOptions fields (not the object) on purpose — depending on `defaultFormat` would rebuild formatValue for every inline-literal prop and defeat the memo seam.
	const formatValue = useMemo(
		() => (value: CellValue | undefined) => formatAccounting(value, defaultFormat),
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
			columns={columns}
			stickyLeft={stickyLeft}
			formatValue={formatValue}
		/>
	);

	return (
		<div className={className ? `columnar ${className}` : "columnar"} id={id}>
			<table
				className="columnar-table"
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
