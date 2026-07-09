import { expect, test } from "vitest";
import { VERSION } from "./index";

test("exposes a semver package version", () => {
	// Version-agnostic so a release bump doesn't break the suite; keep VERSION in
	// sync with package.json manually (see RELEASING.md).
	expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
});
