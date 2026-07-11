/**
 * finsheet — a headless-leaning React grid for financial statements.
 *
 * Public API: the `<Grid>` component (read-only, single-cell `edit`, and `bulk` modes), the
 * pure accounting formatters, and the data-model types.
 */
export const VERSION = "0.2.0";

export type {
	CurrencyOptions,
	FormatOptions,
	PercentOptions,
	Scale,
} from "./format";
export {
	formatAccounting,
	formatCurrency,
	formatPercent,
} from "./format";
export type { GridProps } from "./Grid";
export { Grid } from "./Grid";
export { parseAccounting } from "./parse";
export type {
	Align,
	BulkEdit,
	CellEdit,
	CellValue,
	CellValues,
	Column,
	GridMode,
	GridModel,
	LineRow,
	RejectedCell,
	Row,
	RowKind,
	SectionRow,
	SkippedCell,
	SpacerRow,
	SubtotalRow,
	TotalRow,
} from "./types";
