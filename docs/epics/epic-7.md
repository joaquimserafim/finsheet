# Epic 7 — Performance hardening

Part of milestone **v0.2.0 — editing**. A **measure-first** epic, not a big build. The
re-render engineering the stub imagined was already built preemptively in Epics 3/5/6, so
Epic 7's real work is to **pin the invariant** (turn a loose "keystroke = 1 cell re-render"
into exact, gate-enforced, documented per-gesture counts + an N×M bench) and to **record one
decision in writing**: ship an opt-in row windower now, or defer it behind a documented
row-count threshold.

> Scoped by a design panel (virtualization · memo/re-render · interaction-a11y · measurement
> lenses → synthesis → 2 adversarial verifiers). Both verifiers returned **HOLD**; their
> fixes are folded in below (lean the epic to audit + measure + decide; move the windower to
> a future "on measured need" epic; drop the `--fs-depth` make-work — see *Review fixes*).

## Shape — the load-bearing realization

**Per-edit work is already O(1) in row count.** `Grid` never re-renders on an edit; only the
one or two cells whose packed status changed do (the `useSyncExternalStore` seam,
[editStore.ts](../../src/editStore.ts) + [EditableCell.tsx](../../src/EditableCell.tsx)),
proven live in [Grid.browser.test.tsx](../../src/Grid.browser.test.tsx). So **virtualization
does not improve edit latency** — it only bounds *initial mount cost*, *DOM node count*, and
*scroll smoothness* for very large statements. Authored financial statements are usually
dozens–hundreds of rows, so that ceiling is rarely reached. That reframes Epic 7 from "make
editing fast" (already done) to "prove it, and decide whether the mount/DOM ceiling is worth a
windower."

The structure is **already virtualization-ready** and needs no refactor to stay that way:
selection / copy / status are pure data over **absolute `model.rows` indices**, never DOM
reads; the pinned total already renders outside `<tbody>` in the sticky `<tfoot>`; sticky is
CSS-only with zero scroll listeners; the SSR snapshot is `CELL_IDLE`. Windowing the body later
touches none of it.

## Stage 1 — Baseline audit (already met — verify + document, no new code)

The stub's headline items were built ahead of time; these boxes read as **already met** and
their write-up lands in Stage 2's perf profile. (Every claim below was re-verified against the
code by the design panel.)

- [x] **`GridRow` memo + referentially-stable props** — `GridRow` is `React.memo`'d
  ([GridRow.tsx:119](../../src/GridRow.tsx)); `formatValue` is a `useMemo` keyed on the
  **primitive** `FormatOptions` fields (Grid.tsx, with a `biome-ignore` that literally cites
  "the GridRow memo boundary Epic 7 relies on"); the controller + every handler are
  `useCallback`/`useMemo`-stable. On a model swap only the changed `row` object breaks the
  memo, so only that row re-renders.
- [x] **`EditableCell` memo does real work; `GridCell` deliberately not memo'd** — `EditableCell`
  is memo'd with a per-coordinate `useSyncExternalStore` subscription; `GridCell` is
  intentionally **not** memo'd because it is only reached through the memo'd `GridRow`, never on
  the keystroke path, and its value usually *does* change on the edits that re-render its row
  (subtotals / variance recompute).
- [x] **colgroup-driven widths; zero inline style objects on value cells** — widths flow from
  `<colgroup><col>` via `internal.colWidth`; value `<td>`s carry only className + `data-*`. (The
  one remaining inline style is the intentional `--fs-depth` CSS-var on the label `<th>`, which
  drives arbitrary-depth indentation via `calc()` — kept on purpose; see *Review fixes*.)
- [x] **Per-cell store seam: an edit re-renders only changed cells, never `Grid`** — the store
  packs each cell's status into one primitive and recomputes the selection rect once per
  dispatch; a subscriber re-renders iff its `Object.is` snapshot changed. Tested at the store
  level and live in the browser suite.
- [x] **Structure is already virtualization-ready** — status/selection/copy are pure data over
  absolute model indices; the pinned total is already outside `<tbody>`; sticky is CSS-only; the
  SSR snapshot is `CELL_IDLE`.

## Stage 2 — Measure: pin the invariant + bench + perf profile

Turn the loose done-when into exact, **gate-enforced**, documented numbers. ✅ **committed.**

- [x] **Store `cellStatus`-delta assertions (the primary, in-gate proof)** —
  [editStore.test.ts](../../src/editStore.test.ts) grew a `reRendered(store, probe, act)` helper
  (the coords whose packed `cellStatus` changed across a dispatch = exactly the cells
  `useSyncExternalStore` re-renders) + 6 tests asserting the exact deltas: move = `[A,B]`,
  open-editor = `[A]`, commit+move = `[A,B]`, shift-extend = `[A,B]`, band-grow re-renders **only
  the delta** `[B,C,D]` (the anchor stays `SELECTED`), and a **600-cell** move re-renders exactly
  2 — O(1) in N. Deterministic, layout-free, in the 100% gate.
- [x] **N×M bench harness (outside `src/`, non-gating)** — [bench/grid-bench.tsx](../../bench/grid-bench.tsx)
  + `vitest.bench.config.ts` + `pnpm bench` (quarantined from the coverage include + bundle, like
  the browser config). Mounts 50 / 500 / 2000 rows under a `<Profiler>`; logs mount ms and
  **asserts** one commit per move regardless of N (see *Perf profile*).
- [x] **Documented perf profile (in this doc)** — the default-path per-gesture counts + the bench
  numbers + the consumer-guidance note (see *Perf profile* below).
- [x] **happy-dom `Grid` render-count guard** — [Grid.perf.test.tsx](../../src/Grid.perf.test.tsx):
  a `Probed` wrapper asserts `Grid` re-renders **0 times** across move / open-editor / **editor
  keystroke** (the case the store test can't see — typing dispatches nothing) / commit / extend.
  Ported the browser-only counter into the gate. *(227 unit tests, 100% coverage.)*

## Stage 3 — Record the virtualization decision (the one founder gate)

- [x] **DECIDED (2026-07-11): defer.** Row virtualization does **not** ship in v0.2.0. Rationale,
  from Stage 2's bench: per-edit work is already O(1) (1 commit/move, flat from 50 → 2000 rows),
  so a windower buys **nothing** for edit latency — only the O(N) *mount* column (~45 → ~431 ms),
  which authored statements rarely reach; native scroll + sticky wins under ~150 rows; the
  structure is already virtualization-ready, so deferral is **fully reversible at zero structural
  cost**; and a windowed path would double the interaction/a11y test matrix. The verified windower
  design is parked in *Deferred — the windower* below and in the ROADMAP's deferred decisions, to
  be picked up **only on measured need** (a real statement past ~150 rows with a felt mount cost).

## Perf profile (default path — `virtualize` off)

Re-render counts per gesture, restating the loose "keystroke = 1" as **"O(1) cells (0/1/2),
never O(N), never `Grid`"**:

| Gesture | `Grid` | cells |
| --- | --- | --- |
| arrow / Tab move | 0 | 2 (vacated → idle, arrived → active) |
| open editor (Enter / F2 / type) | 0 | 1 |
| keystroke **inside** the editor input | 0 | 0 (uncontrolled input; no store dispatch) |
| commit + move | 0 | 2 |
| shift-extend one cell | 0 | 1–2 (band grows by one; focus corner moves) |

`Grid` is **0 on every gesture** — the invariant Epic 7 locks. (A committed edit re-renders the
one `GridRow` whose `row` object identity the consumer replaced — a *commit-time*, not
keystroke-time, cost.)

**Scaling** (`pnpm bench`, `edit` mode, 6 value columns — mount ms is indicative only: happy-dom
has no layout engine, so absolute timing is not browser-real; the **commits/move** column is the
deterministic, asserted fact):

| rows | mount (indicative) | commits / move |
| --- | --- | --- |
| 50 | ~45 ms | **1** |
| 500 | ~178 ms | **1** |
| 2000 | ~447 ms | **1** |

Mount is **O(N)** (every row mounts — the ceiling a windower would lower); a move is a **flat one
commit** independent of N (the two changed cells, batched). This is the whole case for Epic 7's
decision: editing is already O(1), so virtualization would buy only the mount/DOM-node column.

> **Consumer note.** Preserve the identity of **unchanged** row objects when you apply an
> `onEdit` / `onBulkEdit` back into your model, so the `GridRow` memo can skip them. A naive
> full `rows.map(...)` rebuild allocates a fresh object for every row and re-renders them all on
> each commit — correct, but O(N) per commit instead of O(changed).

## Locked decisions

- **The stub's memo / stable-callback / colgroup-width items are already met** — verify and
  document, do not rebuild.
- **Keep `GridCell` non-memo'd** — it is off the keystroke path and its value usually changes on
  the edits that re-render its row; memo-comparing every non-editable cell would cost more than
  it saves.
- **Prove the re-render *count* as a pure property of the store's packed-status seam, in the
  gate**; keep wall-clock in a separate non-gating bench **outside `src/`**.
- **Restate the done-when as exact per-gesture counts, not a literal "1"** (an arrow move is
  necessarily 2 cells).
- **If a windower ever ships, it is opt-in via a `virtualize` prop, default off, byte-identical
  when off** (so `Grid.snapshot.test.tsx` parity holds and v0.1/v0.2 render is unchanged).

## Founder gate — RESOLVED (defer)

**The one primary call: does row virtualization ship in v0.2.0, or defer? → DEFERRED** (2026-07-11,
from the bench; see Stage 3). Every
other windowing question — build-vs-buy the windower, the `virtualize` prop shape, windowed
`aria-rowcount`/`rowindex` semantics, measured vs estimated heights, drag-select autoscroll — is
**contingent on shipping** and is captured in the deferred sketch below; none of it is reopened
inside this performance epic.

## Deferred — the windower (a future "on measured need" epic)

If the gate resolves to **ship** (now or later), the design panel's verified implementation
sketch — **not** committable Epic 7 boxes — is:

- **`windowRange.ts`, pure-math-first** — a prefix-sum height model over `<tbody>` rows,
  `windowRange(heights, scrollTop, viewportH, overscan, forcedIndex?) → {startIndex, endIndex,
  padTop, padBottom}`, operating in **absolute `model.rows` index space** (the pinned-total hole
  + any trailing spacers handled explicitly in the prefix-sum), with an **unmeasured** state
  (`viewportH` 0/undefined ⇒ full range = all rows ⇒ SSR / happy-dom degrade to render-all) and
  a `sameRange` setState guard. Earns an **honest 100% node coverage** before any DOM glue
  exists — mirroring the `selection.ts` / `clipboard.ts` / `fill.ts` split.
- **Opt-in `virtualize` prop + spacer-row windowed `<tbody>`** — default off ⇒ the current
  `rows.map` path, byte-identical. On ⇒ a top pad `<tr>` + the mounted slice (each row rendered
  with its **absolute** index as `data-fs-row`) + a bottom pad `<tr>`, still skipping the pinned
  index. **Window via spacer rows, not transforms** (transforms break `table-layout: fixed` +
  colgroup + the sticky-left label). The scroll state lives in a `WindowedBody` child **in the
  very first commit**, so `Grid`/`thead`/`tfoot` never sit on the scroll re-render path.
- **Force-mount the active/editing row** (`windowRange` `forcedIndex = active.row`) — fixes three
  real regressions windowing would otherwise introduce at once: the single roving-tabindex
  tab-stop always exists (so the delegated port keydown keeps firing instead of focus falling to
  `<body>` and nav dying), the open uncontrolled editor's draft isn't silently discarded on
  unmount, and the focus effect still has its target. Off-window keyboard moves scroll the target
  into view.
- **Windowed a11y** — restoring truthful row-count semantics once rows unmount touches the
  locked Epic 6 "no `role=grid`" decision, so it routes through **Epic 8's** composite-grid work
  (aria-rowcount / rowindex + announcer as one coherent unit), **not** a perf-epic bolt-on.
- **Deferrable refinements** — measured row heights (ResizeObserver; heights are token-derived so
  estimates can drift the scroll thumb), pointer drag-select autoscroll past the window edge
  (deferred from Epic 6; `Cmd+A` + shift-click already cover long selections), and precomputing
  the editable-list index map + axes (at the 10k-row regime, `nextEditable`'s per-move O(n) and
  the per-swap list build become the real latency — windowing the DOM without this just moves the
  bottleneck).

**Coverage discipline for the windower**: happy-dom has no layout engine (`scrollTop` /
`clientHeight` = 0), so the **entire** scroll-driven path degrades to render-all in the gate. All
*decision branches* must live in `windowRange.ts` (node-covered); the DOM glue must be
**branch-free straight-line I/O** (read geometry → call `windowRange` → `sameRange`-guarded
setState) behind `/* v8 ignore */`, asserted live in the real-Chromium suite — the same honest
split Epic 6 used. Acceptance check: `pnpm test:coverage` stays green with **no windowed decision
branch inside an ignore region**.

## Risks

- **happy-dom has no layout** — every scroll/measurement path is real-Chromium-only; if the range
  math isn't isolated into a pure `windowRange.ts`, the 100% gate erodes into `/* v8 ignore */`.
- **Scrolling an open editor / the active cell out of view** discards the draft and strands focus
  (keyboard nav dies) — a *correctness* regression that does not exist today, avoided only by
  force-mounting the active row.
- **`aria-rowindex` on native `<tr>` without `role=grid`** has uneven AT support — the sharpest
  a11y risk; keep it inside Epic 8's composite-grid work, don't reopen it here.
- **Estimate-only pad heights drift the scroll thumb** under themed fonts / token overrides
  (row heights are CSS-token-derived, vary by kind) — measured heights may be needed sooner than
  hoped.
- **A threshold-forked render path** (windowed vs native) doubles the interaction/a11y test
  matrix — a reason to *defer* rather than ship two paths speculatively.
- **A bench file left under `src/`** gets swept into the 100% coverage include — it must live in
  `bench/`.

## Review fixes (folded from the 2 adversarial verifiers, both HOLD)

- **Leaned the epic** — the windower (originally 5 speculative ship-path stages) is moved OUT of
  Epic 7 into the deferred sketch above, so every remaining Epic 7 box is committable now and the
  done-when is single-valued. The code is already virtualization-ready, so this costs nothing.
- **Dropped the `--fs-depth` cleanup** — replacing the label `<th>`'s `style={{ "--fs-depth" }}`
  with capped `data-depth` CSS was a real capability regression (max nesting depth) for **zero**
  perf gain (the style sits above no memo boundary). Instead the ROADMAP wording is corrected to
  "no per-cell inline style objects **on value cells**", noting the one intentional `--fs-depth`
  CSS-var that keeps arbitrary-depth indentation via `calc()`.
- **Perf profile scoped to the default path** — the exact counts are the `virtualize`-off
  invariant; a windowed move that crosses the slice boundary additionally re-renders the
  `WindowedBody` (O(1), bounded by slice size). `Grid = 0` stays universal across both paths.
- **Windowing decision math confined to `windowRange.ts`**; the ignore budget is the whole
  scroll handler (not "~3 lines"), with a coverage acceptance check.
- **Founder gates collapsed to one primary** (ship vs defer); build-vs-buy, prop shape, aria,
  measured heights, autoscroll are all marked contingent-on-ship.
- **Redundant re-render proofs trimmed** — the store `cellStatus`-delta assertions are the
  primary in-gate proof; the happy-dom `Probed` guard is optional (the browser suite already
  proves Grid-never-re-renders).

## Done when

`docs/epics/epic-7.md` documents the default-path perf profile (exact per-gesture re-render
counts; `Grid = 0`), proven in the happy-dom gate via store `cellStatus`-delta assertions and an
N×M `<Profiler>` bench (in `bench/`, outside the gate and bundle) showing those commits are O(1)
independent of row count; the stub's memo / colgroup items are recorded as already met; and the
virtualization founder gate is **resolved in writing** (ship the opt-in `virtualize` prop, or
defer with the documented ~150-row threshold). The 100% happy-dom coverage gate stays green
throughout.

**✅ Epic 7 COMPLETE** (2026-07-11) — Stage 1 (already met) · Stage 2 (measured: 227 unit tests /
100% cov + `pnpm bench`) · Stage 3 (**virtualization deferred**). The windower is parked for a
future "on measured need" epic. Remaining v0.2.0 work: **Epic 8 — visual polish + release**.
