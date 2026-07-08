import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: "playground",
	plugins: [react()],
	resolve: {
		alias: {
			columnar: new URL("./src/index.ts", import.meta.url).pathname,
		},
	},
});
