import { afterEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { Grid } from "../src/Grid";
import type { GridModel } from "../src/types";
import "../src/styles.css";

/**
 * Screenshot gallery (Epic 8 Stage 1) — one PNG per representative <Grid> config, written to
 * docs/screenshots/ and embedded in docs/gallery.md. Documentation artifacts, regenerated with
 * `pnpm screenshots`; never a regression gate. happy-dom has no layout engine, so this is the
 * only place the grid's real look (hairlines, sticky, dark mode, the selection band) is captured.
 *
 * `path` is resolved relative to THIS file, so "../docs/screenshots/…" lands at the repo root —
 * NOT the git-ignored default (__screenshots__/). Each shot crops to the `.finsheet` element.
 */

const incomeStatement: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "18rem" },
		{ id: "fy2024", header: "FY2024", numeric: true },
		{ id: "fy2025", header: "FY2025", numeric: true },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			label: "Product",
			depth: 1,
			values: { fy2024: 940_000, fy2025: 1_040_000 },
		},
		{ kind: "line", label: "Services", depth: 1, values: { fy2024: 220_000, fy2025: 260_000 } },
		{
			kind: "subtotal",
			label: "Total revenue",
			values: { fy2024: 1_160_000, fy2025: 1_300_000 },
		},
		{ kind: "spacer", id: "s1" },
		{ kind: "section", label: "Costs" },
		{
			kind: "line",
			label: "Cost of sales",
			depth: 1,
			values: { fy2024: -560_000, fy2025: -610_000 },
		},
		{
			kind: "line",
			label: "Operating expenses",
			depth: 1,
			values: { fy2024: -420_000, fy2025: -482_000 },
		},
		{
			kind: "subtotal",
			label: "Total costs",
			values: { fy2024: -980_000, fy2025: -1_092_000 },
		},
		{ kind: "total", label: "Net income", values: { fy2024: 180_000, fy2025: 208_000 } },
	],
};

/** Render a Grid at a statement-appropriate width and crop the PNG to the `.finsheet` box. */
async function shoot(name: string, ui: React.ReactElement): Promise<void> {
	// A viewport wider than the grid, so the element screenshot isn't clipped to a narrow
	// default viewport (the provider default cuts off the value columns otherwise).
	await page.viewport(1000, 800);
	const { container } = await render(<div style={{ inlineSize: "38rem" }}>{ui}</div>);
	const grid = container.querySelector<HTMLElement>(".finsheet");
	if (grid === null) {
		throw new Error(`no .finsheet element for shot "${name}"`);
	}
	await page.screenshot({ element: grid, path: `../docs/screenshots/${name}.png` });
	expect(grid).toBeTruthy();
}

afterEach(() => {
	cleanup();
});

test("income-statement-light", async () => {
	await shoot(
		"income-statement-light",
		<Grid
			model={incomeStatement}
			caption="Income statement (in thousands)"
			defaultFormat={{ scale: "thousands" }}
		/>,
	);
});
