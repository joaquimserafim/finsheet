import { afterEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
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

const balanceSheet: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "18rem" },
		{ id: "y2024", header: "2024", numeric: true },
		{ id: "y2025", header: "2025", numeric: true },
	],
	rows: [
		{ kind: "section", label: "Assets" },
		{
			kind: "line",
			label: "Cash & equivalents",
			depth: 1,
			values: { y2024: 320_000, y2025: 410_000 },
		},
		{
			kind: "line",
			label: "Accounts receivable",
			depth: 1,
			values: { y2024: 180_000, y2025: 210_000 },
		},
		{ kind: "line", label: "Inventory", depth: 1, values: { y2024: 140_000, y2025: 160_000 } },
		{ kind: "subtotal", label: "Total assets", values: { y2024: 640_000, y2025: 780_000 } },
		{ kind: "spacer", id: "b1" },
		{ kind: "section", label: "Liabilities & equity" },
		{
			kind: "line",
			label: "Accounts payable",
			depth: 1,
			values: { y2024: 120_000, y2025: 150_000 },
		},
		{
			kind: "line",
			label: "Long-term debt",
			depth: 1,
			values: { y2024: 200_000, y2025: 220_000 },
		},
		{
			kind: "subtotal",
			label: "Total liabilities",
			values: { y2024: 320_000, y2025: 370_000 },
		},
		{
			kind: "line",
			label: "Shareholders' equity",
			depth: 1,
			values: { y2024: 320_000, y2025: 410_000 },
		},
		{
			kind: "total",
			label: "Total liab. & equity",
			values: { y2024: 640_000, y2025: 780_000 },
		},
	],
};

const consolidated: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "16rem" },
		{ id: "fy2025", header: "FY2025", numeric: true },
	],
	rows: [
		{ kind: "section", label: "Segment revenue" },
		{ kind: "line", label: "Cloud", depth: 1, values: { fy2025: 4_820_000_000 } },
		{ kind: "line", label: "Devices", depth: 1, values: { fy2025: 1_240_000_000 } },
		{ kind: "subtotal", label: "Total revenue", values: { fy2025: 6_060_000_000 } },
		{ kind: "line", label: "Operating costs", depth: 1, values: { fy2025: -4_115_000_000 } },
		{ kind: "total", label: "Operating income", values: { fy2025: 1_945_000_000 } },
	],
};

/** A brand-neutral "paper" palette applied via `--fs-*` overrides on the `.finsheet` element. */
const THEME_CSS = `
.finsheet.gallery-paper {
	--fs-bg: #fbf9f4;
	--fs-fg: #2a2620;
	--fs-muted: #8a8377;
	--fs-border: #e2dccf;
	--fs-head-bg: #f1ece1;
	--fs-head-fg: #5b5346;
	--fs-section-fg: #2a2620;
	--fs-total-border-bottom: 3px double #c9c0ac;
	--fs-focus: #a8742f;
}`;

/** Locate an editable value cell by model row + value-column index (edit/bulk modes only). */
function cell(container: HTMLElement, row: number, col: number): HTMLElement {
	const el = container.querySelector<HTMLElement>(`[data-fs-row="${row}"][data-fs-col="${col}"]`);
	if (el === null) {
		throw new Error(`no editable cell ${row}:${col}`);
	}
	return el;
}

/** Render a Grid at a statement width, run an optional interaction, then crop the PNG to `.finsheet`. */
async function shoot(
	name: string,
	ui: React.ReactElement,
	interact?: (container: HTMLElement) => Promise<void>,
): Promise<void> {
	// A viewport wider than the grid, so the element screenshot isn't clipped to a narrow
	// default viewport (the provider default cuts off the value columns otherwise).
	await page.viewport(1000, 800);
	const { container } = await render(<div style={{ inlineSize: "38rem" }}>{ui}</div>);
	if (interact) {
		await interact(container);
	}
	const grid = container.querySelector<HTMLElement>(".finsheet");
	if (grid === null) {
		throw new Error(`no .finsheet element for shot "${name}"`);
	}
	const shotPath = await page.screenshot({
		element: grid,
		path: `../docs/screenshots/${name}.png`,
	});
	expect(shotPath).toBeTruthy();
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

test("income-statement-dark", async () => {
	await shoot(
		"income-statement-dark",
		<Grid
			model={incomeStatement}
			theme="dark"
			caption="Income statement (in thousands)"
			defaultFormat={{ scale: "thousands" }}
		/>,
	);
});

test("edit-mode", async () => {
	await shoot(
		"edit-mode",
		<Grid
			model={incomeStatement}
			mode="edit"
			onEdit={() => {}}
			caption="Editable — click a cell, then type / Enter to edit"
			defaultFormat={{ scale: "thousands" }}
		/>,
		async (container) => {
			// Activate Product / FY2024 → the keyboard-focus ring.
			await userEvent.click(cell(container, 1, 1));
		},
	);
});

test("bulk-selection", async () => {
	await shoot(
		"bulk-selection",
		<Grid
			model={incomeStatement}
			mode="bulk"
			onEdit={() => {}}
			onBulkEdit={() => {}}
			caption="Bulk — range select, copy / paste, fill"
			defaultFormat={{ scale: "thousands" }}
		/>,
		async (container) => {
			// Anchor at Product / FY2024, then extend to a 2×2 band over the two line rows.
			await userEvent.click(cell(container, 1, 1));
			await userEvent.keyboard("{Shift>}{ArrowRight}{ArrowDown}{/Shift}");
		},
	);
});

test("balance-sheet", async () => {
	await shoot(
		"balance-sheet",
		<Grid
			model={balanceSheet}
			caption="Balance sheet (in thousands)"
			defaultFormat={{ scale: "thousands" }}
		/>,
	);
});

test("scaled-millions", async () => {
	await shoot(
		"scaled-millions",
		<Grid
			model={consolidated}
			caption="Segment results (in millions)"
			defaultFormat={{ scale: "millions", precision: 1 }}
		/>,
	);
});

test("token-override", async () => {
	await shoot(
		"token-override",
		<>
			<style>{THEME_CSS}</style>
			<Grid
				model={incomeStatement}
				className="gallery-paper"
				caption="Themed via --fs-* overrides"
				defaultFormat={{ scale: "thousands" }}
			/>
		</>,
	);
});
