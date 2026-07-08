/**
 * columnar — number formatting (Epic 2).
 *
 * Pure functions: no DOM, no React. The `<Grid>` (Epic 3) formats each numeric
 * cell through these; consumers can also call them directly to pre-format values
 * or to match the grid's output exactly.
 *
 * Conventions shared by every formatter:
 *
 * - **Input is a {@link CellValue} widened with `undefined`**, so a sparse cell
 *   (`row.values[id]`, already `CellValue | undefined` under
 *   `noUncheckedIndexedAccess`) passes straight through. `null`, `undefined`, and
 *   any non-finite number (`NaN`, `±Infinity`) render as the `blank` placeholder.
 * - **Negatives are wrapped in parentheses** (accounting style) by default; pass
 *   `parens: false` for a leading minus sign.
 * - **Sign is decided after rounding**: a value that rounds to zero at the chosen
 *   precision is never negative, so `-0.3` at precision `0` renders `"0"`, not
 *   `"(0)"`.
 * - **Deterministic grouping**: formatting uses a fixed `"en-US"` locale by
 *   default (comma thousands, dot decimal). Override per call via `locale`.
 */

import type { CellValue } from "./types";

/** How much to divide a value by before formatting (statements shown "in thousands", etc.). */
export type Scale = "units" | "thousands" | "millions";

const SCALE_FACTOR: Record<Scale, number> = {
	units: 1,
	thousands: 1_000,
	millions: 1_000_000,
};

/** Default blank placeholder: an en dash (`"–"`), the usual accounting nil. */
const DASH = "–";

/** Options common to every formatter. */
interface CommonOptions {
	/** Fixed fraction digits. Default `0` (`formatPercent` defaults to `1`). */
	precision?: number;
	/** Wrap negatives in `()` (accounting). `false` → a leading `-`. Default `true`. */
	parens?: boolean;
	/** Rendered for `null` / `undefined` / non-finite input. Default `"–"`. */
	blank?: string;
	/** BCP-47 locale for digit grouping and the decimal mark. Default `"en-US"`. */
	locale?: string;
}

/** Options for {@link formatAccounting}. */
export interface FormatOptions extends CommonOptions {
	/** Divide by `1` / `1e3` / `1e6` before formatting. Default `"units"`. */
	scale?: Scale;
}

/** Options for {@link formatCurrency}. */
export interface CurrencyOptions extends FormatOptions {
	/** Currency symbol, placed inside the parentheses (`($1,234)`). Default `"$"`. */
	symbol?: string;
}

/** Options for {@link formatPercent}. The input is a ratio: `0.125` → `"12.5%"`. */
export type PercentOptions = CommonOptions;

/**
 * `Intl.NumberFormat` is expensive to construct, so memoize one per
 * `(locale, precision)`. The output stays a pure function of the input — this is
 * only a cache — and a grid re-render reuses formatters instead of rebuilding them.
 */
const nfCache = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, precision: number): Intl.NumberFormat {
	const key = `${locale}|${precision}`;
	let nf = nfCache.get(key);
	if (nf === undefined) {
		nf = new Intl.NumberFormat(locale, {
			minimumFractionDigits: precision,
			maximumFractionDigits: precision,
		});
		nfCache.set(key, nf);
	}
	return nf;
}

interface CoreOptions {
	precision: number;
	parens: boolean;
	blank: string;
	locale: string;
	divisor: number;
	multiplier: number;
	prefix: string;
	suffix: string;
}

/** The shared pipeline: scale → group the magnitude → affix → wrap the sign. */
function format(value: CellValue | undefined, o: CoreOptions): string {
	if (value == null || !Number.isFinite(value)) {
		return o.blank;
	}
	const scaled = (value / o.divisor) * o.multiplier;
	const body = numberFormat(o.locale, o.precision).format(Math.abs(scaled));
	// A formatted magnitude with no non-zero digit *is* zero, whatever the locale,
	// so a value that rounds away to zero never picks up a sign or parentheses.
	const negative = scaled < 0 && /[1-9]/.test(body);
	const inner = `${o.prefix}${body}${o.suffix}`;
	if (!negative) {
		return inner;
	}
	return o.parens ? `(${inner})` : `-${inner}`;
}

/**
 * Accounting format: grouped thousands, fixed precision, negatives in parentheses,
 * nil as a placeholder. The everyday statement formatter.
 *
 * @example
 * formatAccounting(1234.5)                         // "1,235"
 * formatAccounting(-1234, { precision: 2 })        // "(1,234.00)"
 * formatAccounting(1_234_567, { scale: "thousands" }) // "1,235"
 * formatAccounting(null)                           // "–"
 */
export function formatAccounting(
	value: CellValue | undefined,
	options: FormatOptions = {},
): string {
	const {
		precision = 0,
		scale = "units",
		parens = true,
		blank = DASH,
		locale = "en-US",
	} = options;
	return format(value, {
		precision,
		parens,
		blank,
		locale,
		divisor: SCALE_FACTOR[scale],
		multiplier: 1,
		prefix: "",
		suffix: "",
	});
}

/**
 * Accounting format with a leading currency symbol placed inside the sign wrap,
 * e.g. `"($1,234)"`.
 *
 * @example
 * formatCurrency(1234.5, { precision: 2 })   // "$1,234.50"
 * formatCurrency(-1234)                       // "($1,234)"
 * formatCurrency(1000, { symbol: "€" })       // "€1,000"
 */
export function formatCurrency(
	value: CellValue | undefined,
	options: CurrencyOptions = {},
): string {
	const {
		precision = 0,
		scale = "units",
		parens = true,
		blank = DASH,
		locale = "en-US",
		symbol = "$",
	} = options;
	return format(value, {
		precision,
		parens,
		blank,
		locale,
		divisor: SCALE_FACTOR[scale],
		multiplier: 1,
		prefix: symbol,
		suffix: "",
	});
}

/**
 * Percent format. The input is a **ratio** (matching `Intl` percent style):
 * `0.125` → `"12.5%"`. Defaults to one decimal place; negatives use parentheses.
 *
 * @example
 * formatPercent(0.123)                    // "12.3%"
 * formatPercent(-0.05)                    // "(5.0%)"
 * formatPercent(1, { precision: 0 })      // "100%"
 */
export function formatPercent(value: CellValue | undefined, options: PercentOptions = {}): string {
	const { precision = 1, parens = true, blank = DASH, locale = "en-US" } = options;
	return format(value, {
		precision,
		parens,
		blank,
		locale,
		divisor: 1,
		multiplier: 100,
		prefix: "",
		suffix: "%",
	});
}
