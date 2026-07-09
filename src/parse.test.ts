import { describe, expect, test } from "vitest";
import { parseAccounting } from "./parse";

describe("parseAccounting — valid", () => {
	test("empty / whitespace → null (cleared cell)", () => {
		expect(parseAccounting("")).toBe(null);
		expect(parseAccounting("   ")).toBe(null);
		expect(parseAccounting("\t\n")).toBe(null);
	});

	test("plain integers and signs", () => {
		expect(parseAccounting("0")).toBe(0);
		expect(parseAccounting("5")).toBe(5);
		expect(parseAccounting("-5")).toBe(-5);
		expect(parseAccounting("+5")).toBe(5);
		expect(parseAccounting("1234")).toBe(1234);
	});

	test("grouping separators are stripped (not validated)", () => {
		expect(parseAccounting("1,234")).toBe(1234);
		expect(parseAccounting("1,234,567")).toBe(1234567);
		expect(parseAccounting("1 234")).toBe(1234); // ASCII space grouping
		expect(parseAccounting("1,2,3,4")).toBe(1234); // stripped, not grouping-checked
		expect(parseAccounting("1 234")).toBe(1234); // NBSP grouping
		expect(parseAccounting("1 234")).toBe(1234); // narrow no-break space
	});

	test("decimals", () => {
		expect(parseAccounting(".5")).toBe(0.5);
		expect(parseAccounting("-.5")).toBe(-0.5);
		expect(parseAccounting("5.")).toBe(5);
		expect(parseAccounting("1,234.50")).toBe(1234.5);
	});

	test("accounting parentheses = negative", () => {
		expect(parseAccounting("(5)")).toBe(-5);
		expect(parseAccounting("(1,234)")).toBe(-1234);
		expect(parseAccounting("(1,234.00)")).toBe(-1234);
		expect(parseAccounting("(.5)")).toBe(-0.5);
		expect(parseAccounting("(  1,234  )")).toBe(-1234); // inner trimmed
	});

	test("currency symbol", () => {
		expect(parseAccounting("$1,234")).toBe(1234);
		expect(parseAccounting("-$5")).toBe(-5);
		expect(parseAccounting("($1,234)")).toBe(-1234);
	});

	test("negative zero normalises to 0", () => {
		expect(Object.is(parseAccounting("-0"), 0)).toBe(true);
		expect(Object.is(parseAccounting("(0)"), 0)).toBe(true);
		expect(Object.is(parseAccounting("-0"), -0)).toBe(false);
	});

	test("largest safe integer is accepted", () => {
		expect(parseAccounting(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
	});
});

describe("parseAccounting — invalid → undefined", () => {
	test("bare symbols / signs / dots", () => {
		expect(parseAccounting("-")).toBeUndefined();
		expect(parseAccounting("+")).toBeUndefined();
		expect(parseAccounting(".")).toBeUndefined();
		expect(parseAccounting("$")).toBeUndefined();
		expect(parseAccounting("%")).toBeUndefined();
	});

	test("unbalanced / empty / nested parentheses", () => {
		expect(parseAccounting("(")).toBeUndefined();
		expect(parseAccounting(")")).toBeUndefined();
		expect(parseAccounting("(5")).toBeUndefined();
		expect(parseAccounting("5)")).toBeUndefined();
		expect(parseAccounting("()")).toBeUndefined();
		expect(parseAccounting("( )")).toBeUndefined();
		expect(parseAccounting("((5))")).toBeUndefined();
		expect(parseAccounting("(-5)")).toBeUndefined(); // sign inside parens
	});

	test("malformed signs and numbers", () => {
		expect(parseAccounting("--5")).toBeUndefined();
		expect(parseAccounting("5-")).toBeUndefined();
		expect(parseAccounting("1.2.3")).toBeUndefined();
		expect(parseAccounting("$-5")).toBeUndefined(); // sign after symbol
	});

	test("non-decimal literals are rejected (validating grammar, not Number())", () => {
		expect(parseAccounting("1e3")).toBeUndefined();
		expect(parseAccounting("0x10")).toBeUndefined();
		expect(parseAccounting("Infinity")).toBeUndefined();
		expect(parseAccounting("NaN")).toBeUndefined();
		expect(parseAccounting("abc")).toBeUndefined();
		expect(parseAccounting("5%")).toBeUndefined();
		expect(parseAccounting("５")).toBeUndefined(); // full-width digit
	});

	test("the blank placeholder is NOT parseable back to null", () => {
		expect(parseAccounting("–")).toBeUndefined(); // en dash → invalid, not null
	});

	test("out-of-safe-range magnitudes are rejected", () => {
		expect(parseAccounting("99999999999999999999")).toBeUndefined();
		expect(parseAccounting(String(Number.MAX_SAFE_INTEGER + 2))).toBeUndefined();
	});
});
