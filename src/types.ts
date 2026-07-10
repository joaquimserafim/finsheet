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
export type CellValues = Readonly<Record<string, CellValue>>;

/** Horizontal alignment. Default: `numeric` columns → `"right"`, else `"left"`. */
export type Align = "left" | "right" | "center";

/**
 * A column is data. Its position in {@link GridModel.columns} is its on-screen
 * order; `columns[0]` is the label column (renders `row.label`).
 */
export interface Column {
	/** Stable key: value rows address cells by this id, and it is the React key. */
	readonly id: string;
	/** Header text shown in `<thead>`. */
	readonly header: string;
	/**
	 * Marks a value column: `tabular-nums` + right-aligned by default, and a
	 * prerequisite for a cell being editable. Omit for text columns (the label).
	 */
	readonly numeric?: boolean;
	/** Overrides the default alignment (`"right"` when `numeric`, else `"left"`). */
	readonly align?: Align;
	/** Pins the column to the left edge while the body scrolls horizontally. */
	readonly sticky?: "left";
	/**
	 * Locks this column against edits even on an editable line (e.g. a computed
	 * variance column: `numeric: true` so it renders right-aligned/tabular,
	 * `editable: false` so it is never an input). Default: editable.
	 */
	readonly editable?: boolean;
	/** `<colgroup>` width for `table-layout: fixed`. Number = px; string = any CSS length. */
	readonly width?: number | string;
}

/** Fields shared by every row kind. */
interface RowBase {
	/** Stable identity for React keys and cell addressing. Falls back to row index. */
	readonly id?: string;
}

/** Fields shared by the labelled (non-spacer) rows. */
interface LabeledRow extends RowBase {
	/** Text rendered in the label column (`columns[0]`). */
	readonly label: string;
	/** Indentation depth for nested sections / subtotals. Default `0`. */
	readonly depth?: number;
}

/** Fields shared by the value-bearing rows (`line` / `subtotal` / `total`). */
interface ValuedRow extends LabeledRow {
	/** Cells keyed by {@link Column.id}. Sparse; absent cells render blank. */
	readonly values: CellValues;
}

/** A group header with no values, e.g. "Assets" or "Operating expenses". */
export interface SectionRow extends LabeledRow {
	readonly kind: "section";
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
	readonly kind: "line";
	/** Locks the whole line against edits (e.g. a computed/reference line). Default: editable. */
	readonly editable?: boolean;
}

/** A running subtotal (e.g. gross profit, EBIT). Computed-looking; never editable. */
export interface SubtotalRow extends ValuedRow {
	readonly kind: "subtotal";
}

/**
 * A grand total (e.g. net income, total assets, total liabilities & equity):
 * the heaviest visual weight; never editable. Placement is a renderer concern —
 * a statement may carry several `total` rows in document order (e.g. "Total
 * assets" mid-sheet and a closing "Total liabilities & equity"); the Epic 3
 * renderer decides which, if any, to pin to a sticky `<tfoot>`.
 */
export interface TotalRow extends ValuedRow {
	readonly kind: "total";
}

/** A visual gap between groups. No label, no values; styled by a themed default gap. */
export interface SpacerRow extends RowBase {
	readonly kind: "spacer";
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

/**
 * The grid's interaction mode. `"view"` (default) is the read-only v0.1.0 surface,
 * byte-for-byte unchanged. `"edit"` turns numeric `line` cells into a keyboard-
 * navigable, single-cell editing surface. `"bulk"` (Epic 6) is not yet built.
 */
export type GridMode = "view" | "edit";

/**
 * A single committed cell edit, emitted by `Grid`'s `onEdit`. The grid stays a
 * controlled component: it NEVER mutates `model`. On a valid commit it fires this,
 * the consumer applies it to its own data, and passes a fresh `model` back.
 *
 * `rowIndex` is always present (an index into `model.rows`); `rowId` is present
 * only when the edited row declares an `id`. Address the change by whichever your
 * data layer keys on.
 */
export interface CellEdit {
	/** `row.id` of the edited row, when it declares one. */
	readonly rowId?: string;
	/** Index of the edited row in `model.rows`. Always available. */
	readonly rowIndex: number;
	/** `id` of the edited value column. */
	readonly columnId: string;
	/** The committed value: a parsed `number`, or `null` when the cell was cleared. */
	readonly value: CellValue;
}

/**
 * A clipboard cell a bulk paste (Epic 6) could NOT parse — reported (not coerced) so
 * the consumer can surface it. Under the atomic policy, any `rejected` ⇒ nothing pasted.
 */
export interface RejectedCell {
	readonly rowIndex: number;
	readonly columnId: string;
	/** The raw clipboard text that failed to parse. */
	readonly text: string;
}

/**
 * A non-empty clipboard cell a bulk paste (Epic 6) dropped because its target isn't
 * editable (a subtotal/total/section row or a locked column). Reported so the loss is
 * never silent.
 */
export interface SkippedCell {
	readonly rowIndex: number;
	readonly columnId: string;
}
