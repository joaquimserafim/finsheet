import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "happy-dom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		// Real-Chromium tests run via their own configs: fidelity (vitest.browser.config.ts)
		// and the screenshot gallery (vitest.screenshots.config.ts). Keep both out of the
		// happy-dom unit run AND the 100% coverage gate — this config has no explicit
		// `include`, so the default glob would otherwise sweep up their .test files.
		exclude: [...configDefaults.exclude, "src/**/*.browser.test.{ts,tsx}", "screenshots/**"],
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
