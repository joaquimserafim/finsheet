import { expect, test } from "vitest";
import { VERSION } from "./index";

test("exposes the package version", () => {
	expect(VERSION).toBe("0.0.0");
});
