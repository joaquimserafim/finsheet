/**
 * finsheet — core data model (Epic 1).
 *
 * Types only: no runtime, no React. The `<Grid>` (Epic 3) renders a
 * {@link GridModel} by `switch`-ing on {@link Row.kind}; the editor (Epics 5–6)
 * reads the editability flags below to decide which cells accept input.
 *
 * Load-bearing conventions:
 *
 * 1. **Rows are a discriminated union on `kind`**, never a homogeneous `T[]`.
 *    Subtotals and totals are first-class row kinds, not a config flag, so the
 *    renderer styles and the editor gates them by `kind` alone.
 * 2. **Column order is layout order** (left → right). `columns[0]` is the label
 *    column: it renders `row.label`, not a value. Every *other* column is a
 *    value column, addressed in a row's `values` by its `id`. Because
 *    {@link CellValue} is numeric-only, labels live on the row, not in `values`
 *    — so there is no separate row-header field and `GridModel` stays
 *    `{ columns; rows }`.
 * 3. **Cells are keyed by column id, never by position.** Reordering `columns`
 *    can never desync a row's data.
 *
 * Everything beyond `kind`, `label`, and `values` is optional with a sane
 * render default, so the everyday line row is just `{ kind: "line", label, values }`.
 */

/** A single value cell. `null` is an explicit blank (renders as a placeholder). */
export type CellValue = number | null;

/**
 * A row's cells, keyed by {@link Column.id}. Sparse: an absent key renders
 * blank, exactly like `null`. Keying by id (not index) makes column reordering
 * safe. Pairs with `noUncheckedIndexedAccess` — `values[id]` is already
 * `CellValue | undefined`.
 */
export type CellValues = Record<string, CellValue>;

/** Horizontal alignment. Default: `numeric` columns → `"right"`, else `"left"`. */
export type Align = "left" | "right" | "center";

/**
 * A column is data. Its position in {@link GridModel.columns} is its on-screen
 * order; `columns[0]` is the label column (renders `row.label`).
 */
export interface Column {
	/** Stable key: value rows address cells by this id, and it is the React key. */
	id: string;
	/** Header text shown in `<thead>`. */
	header: string;
	/**
	 * Marks a value column: `tabular-nums` + right-aligned by default, and a
	 * prerequisite for a cell being editable. Omit for text columns (the label).
	 */
	numeric?: boolean;
	/** Overrides the default alignment (`"right"` when `numeric`, else `"left"`). */
	align?: Align;
	/** Pins the column to the left edge while the body scrolls horizontally. */
	sticky?: "left";
	/**
	 * Locks this column against edits even on an editable line (e.g. a computed
	 * variance column: `numeric: true` so it renders right-aligned/tabular,
	 * `editable: false` so it is never an input). Default: editable.
	 */
	editable?: boolean;
	/** `<colgroup>` width for `table-layout: fixed`. Number = px; string = any CSS length. */
	width?: number | string;
}

/** Fields shared by every row kind. */
interface RowBase {
	/** Stable identity for React keys and cell addressing. Falls back to row index. */
	id?: string;
}

/** Fields shared by the labelled (non-spacer) rows. */
interface LabeledRow extends RowBase {
	/** Text rendered in the label column (`columns[0]`). */
	label: string;
	/** Indentation depth for nested sections / subtotals. Default `0`. */
	depth?: number;
}

/** Fields shared by the value-bearing rows (`line` / `subtotal` / `total`). */
interface ValuedRow extends LabeledRow {
	/** Cells keyed by {@link Column.id}. Sparse; absent cells render blank. */
	values: CellValues;
}

/** A group header with no values, e.g. "Assets" or "Operating expenses". */
export interface SectionRow extends LabeledRow {
	kind: "section";
}

/**
 * A data row with values — the common case, and the only editable kind.
 *
 * A cell at column `col` is editable in `edit`/`bulk` mode ⇔
 *   `row.editable !== false` && `col.numeric === true` && `col.editable !== false`.
 *
 * Default is opt-out: within edit mode a line's numeric cells are editable
 * unless the line or the column locks them. (In `view` mode nothing is editable.)
 */
export interface LineRow extends ValuedRow {
	kind: "line";
	/** Locks the whole line against edits (e.g. a computed/reference line). Default: editable. */
	editable?: boolean;
}

/** A running subtotal (e.g. gross profit, EBIT). Computed-looking; never editable. */
export interface SubtotalRow extends ValuedRow {
	kind: "subtotal";
}

/**
 * A grand total (e.g. net income, total assets, total liabilities & equity):
 * the heaviest visual weight; never editable. Placement is a renderer concern —
 * a statement may carry several `total` rows in document order (e.g. "Total
 * assets" mid-sheet and a closing "Total liabilities & equity"); the Epic 3
 * renderer decides which, if any, to pin to a sticky `<tfoot>`.
 */
export interface TotalRow extends ValuedRow {
	kind: "total";
}

/** A visual gap between groups. No label, no values; styled by a themed default gap. */
export interface SpacerRow extends RowBase {
	kind: "spacer";
}

/** The row discriminated union the Grid renders via `switch (row.kind)`. */
export type Row = SectionRow | LineRow | SubtotalRow | TotalRow | SpacerRow;

/** The discriminant literal — handy for exhaustive `switch`es and style maps keyed by kind. */
export type RowKind = Row["kind"];

/** The complete grid input: column definitions plus the ordered rows. */
export interface GridModel {
	/** `readonly` — the grid is a controlled component and never mutates consumer data. */
	columns: readonly Column[];
	/** `readonly` — the grid is a controlled component and never mutates consumer data. */
	rows: readonly Row[];
}
