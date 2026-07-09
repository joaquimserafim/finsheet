/**
 * finsheet — internal render helpers (Epic 3). Not part of the public API.
 *
 * These resolve column-derived presentation in ONE place so a header cell and its
 * column's body cells can never drift apart.
 */

import type { Align, Column } from "./types";

/**
 * The class + effective alignment a column's cells carry.
 *
 * `sticky` is decided by the CALLER from column POSITION, not from the column
 * alone: v1 pins only the label column (index 0) when it declares `sticky: "left"`.
 * A `sticky: "left"` on any other column is intentionally ignored — a single flat
 * `left: 0` rule can only offset one sticky column correctly.
 */
export function cellPresentation(
	column: Column,
	sticky: boolean,
): { className: string | undefined; align: Align } {
	const classes: string[] = [];
	if (column.numeric) {
		classes.push("is-num");
	}
	if (sticky) {
		classes.push("is-sticky");
	}
	return {
		className: classes.length > 0 ? classes.join(" ") : undefined,
		align: column.align ?? (column.numeric ? "right" : "left"),
	};
}

/**
 * The `<col>` width for `table-layout: fixed`: a number is px, a string is used
 * verbatim. An unset LABEL column falls back to `--fs-label-w` via the `width`
 * property — `min-width` is ignored on `<col>` under fixed layout, so the floor
 * that stops the label column collapsing to 0 must be a real width. Unset value
 * columns stay auto and absorb the container's slack.
 */
export function colWidth(column: Column, isLabel: boolean): string | undefined {
	if (column.width !== undefined) {
		return typeof column.width === "number" ? `${column.width}px` : column.width;
	}
	return isLabel ? "var(--fs-label-w)" : undefined;
}
