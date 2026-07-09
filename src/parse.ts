/**
 * finsheet — accounting input parsing (Epic 5). Pure: no DOM, no React.
 *
 * `parseAccounting` is the input-side inverse of `formatAccounting`'s numeric
 * decoration — it turns what a user types back into a {@link CellValue}. It is a
 * VALIDATING grammar, not a lenient `Number()` call: anything that isn't an
 * unambiguous accounting figure is rejected (`undefined`) rather than coerced,
 * so a typo can never silently store a wrong number in a statement.
 *
 * Scope of the inverse (documented, not total):
 * - It inverts the numeric decoration only — grouping, the `$` symbol, and the
 *   accounting `(…)` negative. It does NOT invert the `"–"` blank placeholder
 *   (`parseAccounting("–")` is `undefined`, not `null`) nor the scale/precision
 *   rounding a formatter applies. The editor seeds from the raw stored value
 *   (`null → ""`), never from a formatted string.
 * - Commas and spaces are STRIPPED, not grouping-validated: `"1,2,3"` → `123`.
 *
 * @returns the parsed number; `null` for an empty/whitespace-only string (a
 * cleared cell); `undefined` for anything invalid (reject the commit).
 */

import type { CellValue } from "./types";

export function parseAccounting(text: string): CellValue | undefined {
	const trimmed = text.trim();
	if (trimmed === "") {
		return null;
	}

	let body = trimmed;
	let negative = false;

	// Accounting negative: a single balanced (…) wrapping the whole value.
	if (body.startsWith("(") && body.endsWith(")")) {
		negative = true;
		body = body.slice(1, -1).trim();
	}
	// No stray/nested parentheses may remain — rejects "(5", "5)", "((5))", "(-5)".
	if (/[()]/.test(body)) {
		return undefined;
	}

	// Optional single leading sign (never together with the accounting parens).
	const first = body[0];
	if (first === "+" || first === "-") {
		if (negative) {
			return undefined; // a sign inside accounting parens, e.g. "(-5)"
		}
		negative = first === "-";
		body = body.slice(1);
	}

	// Optional single leading currency symbol, then strip grouping separators
	// (commas + any Unicode whitespace incl. NBSP / U+202F).
	body = body.replace(/^\$/, "").replace(/[,\s]/g, "");

	// Must now be a plain decimal: ASCII digits only, at most one dot, ≥1 digit.
	// Rejects exponent ("1e3"), hex ("0x10"), letters ("Infinity"), full-width digits.
	if (!/^[0-9]*\.?[0-9]*$/.test(body) || !/[0-9]/.test(body)) {
		return undefined;
	}

	const n = Number(`${negative ? "-" : ""}${body}`);
	// Digits-only guarantees a finite number; guard only the out-of-safe-range case.
	if (Math.abs(n) > Number.MAX_SAFE_INTEGER) {
		return undefined;
	}
	// Normalise -0 (e.g. "(0)", "-0") to 0.
	return n === 0 ? 0 : n;
}
