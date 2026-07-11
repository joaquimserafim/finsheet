import { defineConfig } from "vitest/config";

/**
 * Epic 7 — the non-gating scaling bench (`pnpm bench`). Separate from the unit config so the
 * bench in bench/ never enters the 100% coverage include (`src/**`) nor the default CI test run.
 * happy-dom is enough: it runs React commits (so the per-move commit-count invariant is real);
 * only wall-clock timing is indicative, not browser-accurate — which the bench logs, never gates.
 */
export default defineConfig({
	test: {
		include: ["bench/**/*.tsx"],
		globals: true,
		environment: "happy-dom",
		setupFiles: ["./vitest.setup.ts"],
	},
});
