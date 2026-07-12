/**
 * finsheet — per-column display format (Epic 9).
 *
 * A value column may declare `format` to choose how ITS numbers are shown,
 * independent of the statement-wide `defaultFormat`. Three families, reusing the
 * `format.ts` option bags verbatim so the vocabulary can never drift from the
 * formatters:
 *
 * - **accounting** — the default; the `type` discriminant is OPTIONAL, so
 *   `{ scale: "thousands" }` is a valid accounting format. Renders via `formatAccounting`.
 * - **currency** — `formatCurrency` (accounting + a leading `symbol`).
 * - **percent** — `formatPercent`; the stored value is a **RATIO** (`0.125` → "12.5%").
 *
 * DISPLAY ONLY. Editing, `onEdit` / `onBulkEdit`, and the clipboard always use the
 * RAW stored value regardless of a column's format — a percent cell reveals + copies
 * its raw ratio (`0.125`), never "12.5%". A per-column format inherits the
 * statement-wide `defaultFormat` and overrides only the fields it names.
 *
 * FROZEN v1.0 surface: this union's shape is stable API. New families (e.g. a
 * `"custom"` or `"bps"` arm) can only be ADDED to the union additively later.
 */

import {
	type CurrencyOptions,
	type FormatOptions,
	formatAccounting,
	formatCurrency,
	formatPercent,
	type PercentOptions,
} from "./format";
import type { CellValue } from "./types";

/**
 * How a single value column formats its numbers. A discriminated union on `type`
 * whose arms ARE the {@link FormatOptions} / {@link CurrencyOptions} /
 * {@link PercentOptions} bags. `type` is optional and defaults to `"accounting"`.
 *
 * @example
 * const revenue: ColumnFormat = { type: "currency", symbol: "$" };
 * const margin: ColumnFormat = { type: "percent" };        // stores a ratio: 0.32 → "32.0%"
 * const scaled: ColumnFormat = { scale: "thousands" };     // untagged ⇒ accounting
 */
export type ColumnFormat =
	| ({ readonly type?: "accounting" } & FormatOptions)
	| ({ readonly type: "currency" } & CurrencyOptions)
	| ({ readonly type: "percent" } & PercentOptions);

/**
 * Resolve a value column's display text — the pure heart of Epic 9, with no DOM.
 *
 * - **No `format`** ⇒ exactly `formatAccounting(value, defaultFormat)`, allocation-free, so an
 *   unformatted column is byte-identical to v0.1 / v0.2 (this is what makes snapshot parity free).
 * - **With a `format`** ⇒ the column inherits `defaultFormat` and overrides per field
 *   (`{ ...defaultFormat, ...format }`), then dispatches to the family's formatter. A percent
 *   column's `scale` is both typed away (`PercentOptions` has none) and ignored at runtime, so a
 *   statement "in thousands" can never corrupt a ratio.
 *
 * DISPLAY ONLY: `value` is the RAW stored number; this never runs on the edit / clipboard paths.
 */
export function formatColumnValue(
	value: CellValue | undefined,
	format: ColumnFormat | undefined,
	defaultFormat: FormatOptions | undefined,
): string {
	if (format === undefined) {
		return formatAccounting(value, defaultFormat);
	}
	// One merged options bag, reused by every arm; assigning it to a const also sidesteps
	// excess-property checks on the discriminant `type` / a foreign `symbol` (the formatters
	// destructure only their own fields, so the extras are inert).
	const merged = { ...defaultFormat, ...format };
	// Switch on a typed LOCAL, not `format.type ?? "accounting"` directly: the `??` expression
	// does not narrow `format`, so the `never` guard must key off this local.
	const type: "accounting" | "currency" | "percent" = format.type ?? "accounting";
	switch (type) {
		case "accounting":
			return formatAccounting(value, merged);
		case "currency":
			return formatCurrency(value, merged);
		case "percent":
			return formatPercent(value, merged);
		default: {
			const _exhaustive: never = type;
			return _exhaustive;
		}
	}
}
