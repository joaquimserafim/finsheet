import { cleanup, fireEvent, render } from "@testing-library/react";
import { Profiler } from "react";
import { describe, expect, test } from "vitest";
import { Grid } from "../src/Grid";
import type { GridModel, Row } from "../src/types";

/**
 * Epic 7 — the N×M scaling bench. NON-gating: it lives OUTSIDE src/ so it never enters the 100%
 * coverage include nor the shipped bundle, and it is run by hand via `pnpm bench`, not in CI.
 *
 * It measures two things across 50 / 500 / 2000 rows:
 *   • mount cost — expected to grow ~O(N) (every row mounts). Wall-clock is INDICATIVE only
 *     (happy-dom has no layout engine, so absolute ms is not browser-real) — logged, never asserted.
 *   • per-gesture commits — the load-bearing invariant: a move produces ONE React commit
 *     (the two changed cells, batched) INDEPENDENT of N. This IS asserted — it is deterministic.
 */
function makeModel(rows: number, cols: number): GridModel {
	const columns = [
		{ id: "line", header: "", sticky: "left" as const },
		...Array.from({ length: cols }, (_, i) => ({
			id: `c${i}`,
			header: `P${i}`,
			numeric: true,
		})),
	];
	const body: Row[] = Array.from({ length: rows }, (_, r) => ({
		kind: "line" as const,
		id: `r${r}`,
		label: `Line ${r}`,
		values: Object.fromEntries(columns.slice(1).map((c, i) => [c.id, r * 10 + i])),
	}));
	return { columns, rows: body };
}

function must<T>(el: T | null | undefined): T {
	if (el === null || el === undefined) {
		throw new Error("expected an editable cell to exist");
	}
	return el;
}

describe("grid mount + gesture scaling", () => {
	test("mount grows with N; per-move commits stay O(1)", () => {
		const M = 6;
		const results: { rows: number; cols: number; mountMs: number; commitsPerMove: number }[] =
			[];

		for (const n of [50, 500, 2000]) {
			const model = makeModel(n, M);
			let commits = 0;
			const t0 = performance.now();
			const { container } = render(
				<Profiler
					id="grid"
					onRender={() => {
						commits++;
					}}
				>
					<Grid model={model} mode="edit" onEdit={() => {}} />
				</Profiler>,
			);
			const mountMs = performance.now() - t0;

			commits = 0; // count only the gesture below, not the mount commit
			const first = must(container.querySelector<HTMLElement>("[data-fs-row][data-fs-col]"));
			first.focus();
			fireEvent.keyDown(first, { key: "ArrowDown" }); // move active down one row

			results.push({
				rows: n,
				cols: M,
				mountMs: Math.round(mountMs * 100) / 100,
				commitsPerMove: commits,
			});
			cleanup(); // unmount before the next size so document.body stays clean
		}

		// process.stdout (not console.*) so the numbers always surface, even piped/non-TTY.
		process.stdout.write(`\n  finsheet bench — ${M} value columns\n`);
		process.stdout.write("  rows | mount ms | commits/move\n");
		for (const r of results) {
			process.stdout.write(
				`  ${String(r.rows).padStart(4)} | ${String(r.mountMs).padStart(8)} | ${r.commitsPerMove}\n`,
			);
		}

		// The deterministic invariant: one commit per move, the SAME across every N (O(1), not O(N)).
		const perMove = results.map((r) => r.commitsPerMove);
		expect(perMove.every((c) => c === 1)).toBe(true);
	});
});
