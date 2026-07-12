import { cellPresentation } from "./internal";
import type { CellValue, Column } from "./types";

interface GridCellProps {
	column: Column;
	value: CellValue | undefined;
	formatValue: (value: CellValue | undefined, column: Column) => string;
}

/**
 * One read-only value `<td>` — identical in `view` and `edit` mode. Value columns
 * are never sticky in v1, so presentation is a plain column lookup. `value` is
 * passed to the formatter as-is (`CellValue | undefined`) — never coerced with
 * `?? 0`, which would fabricate a real figure; `formatAccounting` already maps
 * `null` / `undefined` to the blank placeholder.
 *
 * In `edit` mode the editable cells use {@link EditableCell} instead; this renders
 * every cell the editability guard rejects (locked columns, subtotals, totals) and
 * every cell in `view` mode.
 */
export function GridCell({ column, value, formatValue }: GridCellProps) {
	const { className, align } = cellPresentation(column, false);
	return (
		<td className={className} data-align={align}>
			{formatValue(value, column)}
		</td>
	);
}
