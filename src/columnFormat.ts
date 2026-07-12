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

import type { CurrencyOptions, FormatOptions, PercentOptions } from "./format";

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
