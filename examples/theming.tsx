import { Grid, type GridModel } from "finsheet";
import type { CSSProperties } from "react";

// import "finsheet/styles.css";

/**
 * Theming is a flat `--fs-*` custom-property set scoped to `.finsheet` at specificity 0
 * (via `:where`), so your own value always wins — and custom properties inherit, so you
 * can set them on any ancestor. Dark mode follows the OS automatically; to force a theme
 * regardless of the OS, set `data-theme="light" | "dark"` on the `.finsheet` element.
 *
 * `defaultFormat` threads a statement-wide scale/precision to every value cell.
 */
const model: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "20ch" },
		{ id: "q1", header: "Q1", numeric: true },
		{ id: "q2", header: "Q2", numeric: true },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			label: "Subscriptions",
			depth: 1,
			values: { q1: 1_240_000, q2: 1_380_000 },
		},
		{ kind: "line", label: "Services", depth: 1, values: { q1: 320_000, q2: 360_000 } },
		{ kind: "total", label: "Total revenue", values: { q1: 1_560_000, q2: 1_740_000 } },
	],
};

// Override any token — here a teal header band and a matching double "bottom line".
const teal: CSSProperties = {
	"--fs-head-bg": "#0f766e",
	"--fs-head-fg": "#ecfeff",
	"--fs-border": "#5eead4",
	"--fs-total-border-bottom": "3px double #0f766e",
} as CSSProperties;

export default function ThemedStatement() {
	return (
		<div style={teal}>
			<Grid
				model={model}
				defaultFormat={{ scale: "thousands" }}
				caption="Shown in thousands"
			/>
		</div>
	);
}
