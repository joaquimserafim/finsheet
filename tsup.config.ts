import { defineConfig } from "tsup";

export default defineConfig({
	// styles.css is a separate entry (emitted to dist/styles.css) because the JS
	// never imports it — consumers `import "finsheet/styles.css"` themselves.
	entry: ["src/index.ts", "src/styles.css"],
	format: ["esm"],
	dts: { entry: "src/index.ts" },
	sourcemap: true,
	clean: true,
	treeshake: true,
	target: "es2024",
	external: ["react", "react-dom", "react/jsx-runtime"],
});
