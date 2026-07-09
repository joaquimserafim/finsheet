import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "happy-dom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: ["src/**/*.{ts,tsx}"],
			// index.ts is barrel re-exports; types.ts is types-only (no runtime).
			exclude: ["src/**/*.test.{ts,tsx}", "src/index.ts", "src/types.ts"],
			thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
		},
	},
});
