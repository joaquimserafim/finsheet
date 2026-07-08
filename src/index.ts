/**
 * columnar — a headless-leaning React grid for financial statements.
 *
 * Public API. Epic 1 lands the core data model (types only); the `<Grid>`
 * component and formatters follow in Epics 2–3.
 */
export const VERSION = "0.0.0";

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
