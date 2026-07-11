import { Grid, type GridModel } from "finsheet";

// import "finsheet/styles.css";

/**
 * Theming is a flat `--fs-*` custom-property set. finsheet declares its defaults directly on the
 * `.finsheet` element (at zero specificity, via `:where`), so you override them with a rule that
 * ALSO targets `.finsheet` — `.finsheet { --fs-bg: … }` for every grid on the page, or a scoped
 * `.finsheet.my-theme { … }` plus a `className`, as below. Setting the tokens on an ANCESTOR does
 * NOT work: finsheet's own `.finsheet` declaration shadows the inherited value.
 *
 * Dark mode follows the OS automatically; to force a theme regardless of the OS, pass the `theme`
 * prop (or set `data-theme="light" | "dark"` on the `.finsheet` element). `defaultFormat` threads a
 * statement-wide scale/precision to every value cell.
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

// In a real app this rule lives in your own stylesheet, next to `import "finsheet/styles.css"`.
// Inlined here as a <style> so the example stays self-contained: a teal header band and a matching
// double "bottom line". The `.teal` class is added to `.finsheet` via the Grid's `className`.
const themeCss = `
.finsheet.teal {
	--fs-head-bg: #0f766e;
	--fs-head-fg: #ecfeff;
	--fs-border: #5eead4;
	--fs-total-border-bottom: 3px double #0f766e;
}`;

export default function ThemedStatement() {
	return (
		<>
			<style>{themeCss}</style>
			<Grid
				model={model}
				className="teal"
				defaultFormat={{ scale: "thousands" }}
				caption="Shown in thousands"
			/>
		</>
	);
}
