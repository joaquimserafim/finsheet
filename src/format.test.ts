import { describe, expect, test } from "vitest";
import { formatAccounting, formatCurrency, formatPercent } from "./index";

/** The default nil placeholder, spelled out so the assertions read unambiguously. */
const DASH = "–";

describe("formatAccounting", () => {
	test("groups thousands and defaults to zero precision", () => {
		expect(formatAccounting(0)).toBe("0");
		expect(formatAccounting(5)).toBe("5");
		expect(formatAccounting(1000)).toBe("1,000");
		expect(formatAccounting(1_234_567)).toBe("1,234,567");
	});

	test("rounds to the requested precision (half away from zero)", () => {
		expect(formatAccounting(1234.5)).toBe("1,235");
		expect(formatAccounting(1234.5, { precision: 2 })).toBe("1,234.50");
		expect(formatAccounting(1234.567, { precision: 2 })).toBe("1,234.57");
		expect(formatAccounting(0, { precision: 2 })).toBe("0.00");
	});

	test("wraps negatives in parentheses by default", () => {
		expect(formatAccounting(-1234)).toBe("(1,234)");
		expect(formatAccounting(-1234, { precision: 2 })).toBe("(1,234.00)");
		expect(formatAccounting(-0.5)).toBe("(1)"); // 0.5 rounds away from zero
	});

	test("parens: false uses a leading minus instead", () => {
		expect(formatAccounting(-1234, { parens: false })).toBe("-1,234");
		expect(formatAccounting(1234, { parens: false })).toBe("1,234");
	});

	test("a value that rounds to zero is never signed", () => {
		expect(formatAccounting(-0.3)).toBe("0");
		expect(formatAccounting(-0.3, { parens: false })).toBe("0");
		expect(formatAccounting(-0)).toBe("0");
		expect(formatAccounting(-0.004, { precision: 2 })).toBe("0.00");
	});

	test("null / undefined / non-finite render the blank placeholder", () => {
		expect(formatAccounting(null)).toBe(DASH);
		expect(formatAccounting(undefined)).toBe(DASH);
		expect(formatAccounting(Number.NaN)).toBe(DASH);
		expect(formatAccounting(Number.POSITIVE_INFINITY)).toBe(DASH);
		expect(formatAccounting(null, { blank: "—" })).toBe("—");
		expect(formatAccounting(null, { blank: "" })).toBe("");
	});

	test("handles very large magnitudes", () => {
		expect(formatAccounting(1_234_567_890)).toBe("1,234,567,890");
		expect(formatAccounting(-9_876_543_210)).toBe("(9,876,543,210)");
	});

	describe("scale", () => {
		test("thousands divides by 1e3", () => {
			expect(formatAccounting(1_234_567, { scale: "thousands" })).toBe("1,235");
			expect(formatAccounting(1_234_567, { scale: "thousands", precision: 1 })).toBe(
				"1,234.6",
			);
		});

		test("millions divides by 1e6", () => {
			expect(formatAccounting(12_345_678, { scale: "millions", precision: 2 })).toBe("12.35");
			expect(formatAccounting(-2_500_000, { scale: "millions", precision: 1 })).toBe("(2.5)");
		});

		test("units is the identity scale", () => {
			expect(formatAccounting(1234, { scale: "units" })).toBe("1,234");
		});
	});

	test("locale overrides grouping and decimal marks", () => {
		// de-DE groups with "." and uses "," as the decimal separator.
		expect(formatAccounting(1234.5, { precision: 1, locale: "de-DE" })).toBe("1.234,5");
	});
});

describe("formatCurrency", () => {
	test("prefixes a symbol, default $", () => {
		expect(formatCurrency(1234)).toBe("$1,234");
		expect(formatCurrency(1234.5, { precision: 2 })).toBe("$1,234.50");
	});

	test("keeps the symbol inside the parentheses for negatives", () => {
		expect(formatCurrency(-1234)).toBe("($1,234)");
		expect(formatCurrency(-1234, { parens: false })).toBe("-$1,234");
	});

	test("respects a custom symbol and scale", () => {
		expect(formatCurrency(1000, { symbol: "€" })).toBe("€1,000");
		expect(formatCurrency(1_234_567, { scale: "thousands" })).toBe("$1,235");
	});

	test("null renders the blank placeholder (no symbol)", () => {
		expect(formatCurrency(null)).toBe(DASH);
		expect(formatCurrency(undefined)).toBe(DASH);
	});
});

describe("formatPercent", () => {
	test("treats the input as a ratio and defaults to one decimal", () => {
		expect(formatPercent(0.123)).toBe("12.3%");
		expect(formatPercent(1)).toBe("100.0%");
		expect(formatPercent(0)).toBe("0.0%");
	});

	test("honours precision", () => {
		expect(formatPercent(0.125, { precision: 0 })).toBe("13%");
		expect(formatPercent(0.12345, { precision: 2 })).toBe("12.35%");
	});

	test("wraps negatives in parentheses by default", () => {
		expect(formatPercent(-0.05)).toBe("(5.0%)");
		expect(formatPercent(-0.05, { parens: false })).toBe("-5.0%");
	});

	test("a ratio that rounds to zero is never signed", () => {
		expect(formatPercent(-0.0001, { precision: 1 })).toBe("0.0%");
	});

	test("null renders the blank placeholder (no percent sign)", () => {
		expect(formatPercent(null)).toBe(DASH);
		expect(formatPercent(undefined)).toBe(DASH);
	});
});
