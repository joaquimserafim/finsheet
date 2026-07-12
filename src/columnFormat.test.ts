import { describe, expect, test } from "vitest";
import { type ColumnFormat, formatColumnValue } from "./columnFormat";
import { type FormatOptions, formatAccounting, formatCurrency, formatPercent } from "./format";

/**
 * The pure heart of per-column formatting (Epic 9), tested to 100% branch coverage with
 * NO DOM. Each arm is cross-checked against the underlying `format.ts` formatter it must
 * reuse verbatim, so the resolver can never drift from them.
 */

describe("no format — byte-identical fall-through", () => {
	test("undefined format matches formatAccounting exactly, with and without defaultFormat", () => {
		const cases: [number | null, FormatOptions | undefined][] = [
			[1234.5, undefined],
			[-1234, { precision: 2 }],
			[1_234_567, { scale: "thousands" }],
			[null, undefined],
			[0, { parens: false }],
		];
		for (const [value, df] of cases) {
			expect(formatColumnValue(value, undefined, df)).toBe(formatAccounting(value, df));
		}
	});
});

describe("accounting arm (untagged + explicit)", () => {
	test("both match formatAccounting over the defaultFormat merge", () => {
		// Untagged { scale } ⇒ accounting (the `?? "accounting"` right-hand branch).
		expect(formatColumnValue(1_234_567, { scale: "thousands" }, undefined)).toBe(
			formatAccounting(1_234_567, { scale: "thousands" }),
		);
		// Explicit accounting inherits defaultFormat and overrides per field.
		const df: FormatOptions = { scale: "thousands", locale: "en-US" };
		expect(formatColumnValue(1_234_567, { type: "accounting", precision: 1 }, df)).toBe(
			formatAccounting(1_234_567, { scale: "thousands", locale: "en-US", precision: 1 }),
		);
	});
});

describe("currency arm", () => {
	test("default $, symbol override, and inherited defaultFormat.scale", () => {
		expect(formatColumnValue(1234, { type: "currency" }, undefined)).toBe("$1,234");
		expect(formatColumnValue(1234, { type: "currency" }, undefined)).toBe(
			formatCurrency(1234, {}),
		);
		expect(formatColumnValue(1000, { type: "currency", symbol: "€" }, undefined)).toBe(
			"€1,000",
		);
		// Inherits a statement-wide "in thousands" the column didn't restate.
		expect(formatColumnValue(1_234_567, { type: "currency" }, { scale: "thousands" })).toBe(
			formatCurrency(1_234_567, { scale: "thousands" }),
		);
	});
});

describe("percent arm (stores a ratio)", () => {
	test("0.125 → 12.5%, negatives in parens, and scale can never corrupt a ratio", () => {
		expect(formatColumnValue(0.125, { type: "percent" }, undefined)).toBe("12.5%");
		expect(formatColumnValue(-0.05, { type: "percent" }, undefined)).toBe("(5.0%)");
		// A statement-wide scale is typed away AND ignored at runtime for percent.
		expect(formatColumnValue(0.125, { type: "percent" }, { scale: "thousands" })).toBe("12.5%");
	});

	test("precision: inherits a 0-dp defaultFormat, else formatPercent's own 1-dp default", () => {
		// Founder gate #4: percent inherits defaultFormat.precision uniformly.
		expect(formatColumnValue(0.13, { type: "percent" }, { precision: 0 })).toBe("13%");
		expect(formatColumnValue(0.13, { type: "percent" }, { precision: 0 })).toBe(
			formatPercent(0.13, { precision: 0 }),
		);
		// No defaultFormat ⇒ formatPercent's own 1-dp default.
		expect(formatColumnValue(0.13, { type: "percent" }, undefined)).toBe("13.0%");
	});
});

describe("merge precedence", () => {
	test("the column's own field beats defaultFormat", () => {
		// defaultFormat says thousands; the column restates units ⇒ the column wins.
		expect(
			formatColumnValue(
				1_234_567,
				{ type: "accounting", scale: "units" },
				{ scale: "thousands" },
			),
		).toBe(formatAccounting(1_234_567, { scale: "units" }));
	});
});

describe("exhaustiveness guard", () => {
	test("an unknown format type trips the never guard (only reachable via a cast)", () => {
		const bogus = { type: "mystery" } as unknown as ColumnFormat;
		// The guard's fallback returns the raw type value; unreachable in typed code.
		expect(formatColumnValue(1, bogus, undefined)).toBe("mystery");
	});
});
