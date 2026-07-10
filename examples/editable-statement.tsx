import { type CellEdit, Grid, type GridModel } from "finsheet";
import { useState } from "react";

// import "finsheet/styles.css";

/**
 * Controlled editing (`mode="edit"`). The grid NEVER mutates `model`: on each valid
 * commit it fires `onEdit`, you apply the change to your own data, and pass a fresh
 * `model` back. Click or arrow to a numeric `line` cell, type to replace (or Enter /
 * F2 to edit in place), Enter / Tab to commit, Esc to cancel, Backspace to clear.
 *
 * Subtotals, totals and the computed Δ column (locked via `editable: false`) never edit.
 */
const initial: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "22ch" },
		{ id: "actual", header: "Actual", numeric: true },
		{ id: "budget", header: "Budget", numeric: true },
		{ id: "var", header: "Δ", numeric: true, editable: false },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			id: "product",
			label: "Product",
			depth: 1,
			values: { actual: 1000, budget: 950, var: 50 },
		},
		{
			kind: "line",
			id: "services",
			label: "Services",
			depth: 1,
			values: { actual: 240, budget: 250, var: -10 },
		},
		{
			kind: "subtotal",
			label: "Total revenue",
			values: { actual: 1240, budget: 1200, var: 40 },
		},
	],
};

/** Immutably write one committed edit back into the model. */
function applyEdit(model: GridModel, change: CellEdit): GridModel {
	return {
		columns: model.columns,
		rows: model.rows.map((row, i) =>
			i === change.rowIndex && "values" in row
				? { ...row, values: { ...row.values, [change.columnId]: change.value } }
				: row,
		),
	};
}

export default function EditableStatement() {
	const [model, setModel] = useState(initial);
	return (
		<Grid
			model={model}
			mode="edit"
			onEdit={(change) => setModel((m) => applyEdit(m, change))}
		/>
	);
}
