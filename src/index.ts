/**
 * finsheet — a headless-leaning React grid for financial statements.
 *
 * Public API. Epic 1 lands the core data model (types only); Epic 2 adds the pure
 * formatting functions; Epic 3 adds the read-only `<Grid>` component.
 */
export const VERSION = "0.1.0";

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
export type {
	Align,
	CellValue,
	CellValues,
	Column,
	GridModel,
	LineRow,
	Row,
	RowKind,
	SectionRow,
	SpacerRow,
	SubtotalRow,
	TotalRow,
} from "./types";
