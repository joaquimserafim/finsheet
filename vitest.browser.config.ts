import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * Real-browser fidelity suite (Epic 6 Stage 4b) — the handful of things happy-dom can't
 * simulate: real focus/blur, the OS clipboard round-trip, pointer hit-testing, and React
 * commit counts. Kept in a SEPARATE config (run with `pnpm test:browser`) so the unit
 * suite's 100% coverage gate and the default CI job stay untouched; no coverage here.
 */
export default defineConfig({
	test: {
		include: ["src/**/*.browser.test.{ts,tsx}"],
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
	},
});
