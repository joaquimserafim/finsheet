import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * Screenshot gallery (Epic 8 Stage 1) — renders <Grid> across representative configs in
 * real Chromium and writes DOCUMENTATION PNGs to docs/screenshots/ (committed, regenerated
 * on demand via `pnpm screenshots`). NOT a visual-regression gate: these are curated docs,
 * never diffed in CI (cross-OS/font pixel diffs are flaky). Kept in a SEPARATE config so the
 * unit suite's 100% coverage gate and the default CI job stay untouched; no coverage here.
 */
export default defineConfig({
	test: {
		include: ["screenshots/**/*.screenshots.test.{ts,tsx}"],
		globals: true,
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
	},
});
