import { cellPresentation } from "./internal";
import type { CellValue, Column } from "./types";

interface GridCellProps {
	column: Column;
	value: CellValue | undefined;
	formatValue: (value: CellValue | undefined) => string;
}

/**
 * One value `<td>`. Value columns are never sticky in v1, so presentation is a
 * plain column lookup. `value` is passed to the formatter as-is (`CellValue |
 * undefined`) — never coerced with `?? 0`, which would fabricate a real figure;
 * `formatAccounting` already maps `null` / `undefined` to the blank placeholder.
 *
 * The cell-granularity seam for Epic 5 editing: this becomes `React.memo` once a
 * per-cell `isActive` / `onEdit` prop first exists. Not exported.
 */
export function GridCell({ column, value, formatValue }: GridCellProps) {
	const { className, align } = cellPresentation(column, false);
	return (
		<td className={className} data-align={align}>
			{formatValue(value)}
		</td>
	);
}
