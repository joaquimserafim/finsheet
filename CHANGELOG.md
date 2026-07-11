# Changelog

All notable changes to **finsheet** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-07-11

Editing. The grid stays a **controlled component** — it never mutates your `model`; it emits events
and you pass a fresh model back.

### Added

- **Single-cell editing** (`mode="edit"`) — controlled `onEdit`; Excel-like keyboard nav (arrows,
  Enter / F2 to edit, Tab to move, Esc to cancel, type-to-replace, Backspace / Delete to clear); a
  roving tabindex; navigation skips non-editable cells. Only `line` cells in numeric, unlocked columns
  edit — enforced by row `kind`, plus per-row / per-column `editable: false`.
- **Bulk mode** (`mode="bulk"`, a strict superset of `edit`) — rectangular range selection
  (Shift+arrow, Shift+click, drag, Cmd/Ctrl+A); clipboard copy / cut / paste as Excel-compatible
  **TSV in raw units** (paste is atomic — any parse failure writes nothing); fill down / right
  (Cmd/Ctrl+D / R); range clear. Each bulk op fires **`onBulkEdit` exactly once**, so one paste is one
  re-render and one undo step; non-editable paste targets are reported (`skipped`), never silently
  written.
- **`onBulkEdit` prop** and the **`BulkEdit`** type (with `rejected` / `skipped`), exported.
- **Performance guarantee, pinned + benched** — an edit re-renders only the one or two changed cells,
  never the whole grid (O(1) in row count). Row virtualization is deferred on that basis.
- **Screenshot gallery** — `pnpm screenshots` renders the grid across configs into `docs/screenshots/`;
  see [docs/gallery.md](docs/gallery.md).

## [0.1.0] — 2026-07-09

Initial public release: a read-only financial-statement grid.

### Added

- **Discriminated-union row model** — `section` / `line` / `subtotal` / `total` / `spacer`; subtotals
  and totals are first-class row kinds, and rendering is a `switch` on `kind`.
- **Rendering** — a semantic `<table>` with `table-layout: fixed` + `<colgroup>`; a sticky header, a
  sticky label column, and the trailing grand `total` auto-pinned to a sticky `<tfoot>`; `tabular-nums`
  right-aligned numerics.
- **Accounting formatters** — `formatAccounting` / `formatCurrency` / `formatPercent` (negatives in
  parentheses, thousands grouping, `scale` / `precision` / `locale`, a `null` placeholder).
- **Theming** — a flat `--fs-*` custom-property set (light default; dark via `prefers-color-scheme` and
  a forced `data-theme`). Ships one stylesheet.
- **Packaging** — ESM-only, Node 24+, `react` / `react-dom` as peer dependencies.

[0.2.0]: https://github.com/joaquimserafim/finsheet/releases/tag/v0.2.0
[0.1.0]: https://github.com/joaquimserafim/finsheet/releases/tag/v0.1.0
