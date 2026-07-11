import { type BulkEdit, type CellEdit, Grid, type GridModel } from "finsheet";
import { useState } from "react";

// import "finsheet/styles.css";

/**
 * Controlled bulk editing (`mode="bulk"`) — a strict superset of `mode="edit"`. Every
 * single-cell affordance still works and still fires `onEdit`; on top, a rectangular
 * SELECTION (Shift+arrow / Shift+click / drag, Cmd/Ctrl+A) enables spreadsheet gestures:
 *
 *   Cmd/Ctrl+C / X / V  copy / cut / paste (tab-separated, Excel-compatible, raw units)
 *   Cmd/Ctrl+D / R      fill down / right from the range's edge
 *   Delete              clear the whole range
 *
 * Each bulk gesture fires `onBulkEdit` EXACTLY ONCE — so one paste is one re-render and
 * one undo step. Only `line` cells in numeric, unlocked columns are ever written; the Δ
 * column below (`editable: false`) is copied but never pasted/filled/cleared into.
 */
const initial: GridModel = {
	columns: [
		{ id: "line", header: "", sticky: "left", width: "22ch" },
		{ id: "fy2023", header: "FY2023", numeric: true },
		{ id: "fy2024", header: "FY2024", numeric: true },
		{ id: "fy2025", header: "FY2025", numeric: true },
		{ id: "var", header: "Δ", numeric: true, editable: false },
	],
	rows: [
		{ kind: "section", label: "Revenue" },
		{
			kind: "line",
			id: "product",
			label: "Product",
			depth: 1,
			values: { fy2023: 845, fy2024: 940, fy2025: 1040, var: 100 },
		},
		{
			kind: "line",
			id: "services",
			label: "Services",
			depth: 1,
			values: { fy2023: 190, fy2024: 220, fy2025: 260, var: 40 },
		},
		{
			kind: "subtotal",
			label: "Total revenue",
			values: { fy2023: 1035, fy2024: 1160, fy2025: 1300, var: 140 },
		},
	],
};

/** Immutably write one committed single-cell edit back into the model. */
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

/** Apply a whole bulk op (many cells across many rows) in ONE fresh model. */
function applyBulk(model: GridModel, { edits }: BulkEdit): GridModel {
	if (edits.length === 0) {
		return model;
	}
	const byRow = new Map<number, CellEdit[]>();
	for (const edit of edits) {
		const list = byRow.get(edit.rowIndex);
		if (list === undefined) {
			byRow.set(edit.rowIndex, [edit]);
		} else {
			list.push(edit);
		}
	}
	return {
		columns: model.columns,
		rows: model.rows.map((row, i) => {
			const rowEdits = byRow.get(i);
			if (rowEdits === undefined || !("values" in row)) {
				return row;
			}
			const values = { ...row.values };
			for (const edit of rowEdits) {
				values[edit.columnId] = edit.value;
			}
			return { ...row, values };
		}),
	};
}

export default function BulkStatement() {
	const [model, setModel] = useState(initial);
	return (
		<Grid
			model={model}
			mode="bulk"
			onEdit={(change) => setModel((m) => applyEdit(m, change))}
			onBulkEdit={(op) => setModel((m) => applyBulk(m, op))}
		/>
	);
}
