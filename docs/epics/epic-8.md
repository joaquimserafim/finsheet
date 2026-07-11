# Epic 8 — Snapshots, docs truthing & v0.2.0 release

The last epic of milestone **v0.2.0 — editing**, and deliberately **small**. Not the blind
"visual polish" CSS sweep the stub imagined — instead three concrete things: **capture** how the
grid actually looks across configs as committed, regenerable screenshots; **truth up** the docs
that still describe v0.1.0; and **cut** the v0.2.0 release. Any CSS polish becomes a reviewed
follow-up once the gallery makes the current look visible — never a speculative pass.

## Shape — capture before polish

The load-bearing realization: **happy-dom has no layout engine**, so nothing in the coverage gate
can show what the grid *looks* like. Every visual claim — hairlines, dark mode, sticky axes, the
selection band — has been a maintainer eyeball step since Epic 3. A committed screenshot gallery
turns that into a durable, reviewable artifact, and it is the honest prerequisite to any visual
polish: **you can't level a look you can't see.** So Epic 8 captures first; polish (if a config
looks weak) is a small follow-up reviewed against the PNGs, not a blind CSS sweep.

The browser engine already exists — Epic 6 Stage 4b stood up `@vitest/browser` + Playwright +
Chromium in a **separate, non-gating** config ([vitest.browser.config.ts](../../vitest.browser.config.ts),
run via `pnpm test:browser`). The gallery reuses it: no new dependency, no Storybook.

## Stage 1 — Snapshot gallery

Reuses the existing real-Chromium stack; writes **documentation** PNGs (curated, regenerated on
demand), never a gating regression baseline.

- [x] **Screenshot harness** — `pnpm screenshots` (`vitest.screenshots.config.ts` +
  `screenshots/gallery.screenshots.test.tsx`, reusing the Chromium/Playwright stack) renders a `<Grid>`
  and writes a PNG to the **committed** `docs/screenshots/` via a test-file-relative `path` (never the
  git-ignored `__screenshots__/`); a wide `page.viewport(1000, 800)` avoids the default-viewport clip.
  **Proven end-to-end** with `income-statement-light.png`. Kept out of the default run + 100% gate
  (`screenshots/**` excluded); typechecks via `screenshots/vite-env.d.ts` + the tsconfig include.
- [x] **Config fixtures captured** — all 7 shots, each a small fixture model → one PNG in
  `docs/screenshots/`: `income-statement-light`, `income-statement-dark` (`theme="dark"`), `edit-mode`
  (`mode="edit"` + a driven `userEvent.click` → the focus ring), `bulk-selection` (`mode="bulk"` +
  driven shift-arrow → a 2×2 selection band), `balance-sheet` (different structure + the pinned grand
  total), `scaled-millions` (`scale: "millions"` + `precision: 1`), and `token-override` (a brand-neutral
  "paper" `--fs-*` override). Each PNG was eyeballed. (The scale demo landed as *millions*, not a second
  thousands shot, to avoid duplicating the flagship.)
- [x] **Gallery embed** — [`docs/gallery.md`](gallery.md) embeds all 7 PNGs (grouped: statements /
  themes / editing) with captions + the `pnpm screenshots` regeneration command and a link to the
  fixtures; the README links to it from a "Gallery" line under the status callout. **✅ Stage 1 complete.**

## Stage 2 — Docs truthing (v0.1.0 → v0.2.0)

The status blurbs were written for v0.1.0 (read-only). Editing + bulk shipped; virtualization is
deferred (Epic 7). Make the docs describe the **shipping** surface.

- [x] **README truthing** — status callout now reads `v0.2.0` (renders + edits: `edit` + `bulk`); the
  "virtualization follows" line → **deferred** (O(1) per-edit; only mount scales); the Notes &
  limitations "still on the roadmap" line → a dedicated deferred-virtualization bullet; the Editing
  section's `v0.2.0 adds` framing → present tense. No `v0.1.0` / "on the roadmap" phrasing left.
- [x] **Examples audit** — all five `examples/*.tsx` + the index verified against the shipping API.
  Found + fixed a **real bug** in `theming.tsx`: it set `--fs-*` on an **ancestor** `<div>`, which
  `:where(.finsheet)`'s own token declarations **shadow** (verified live in the browser harness — the
  header stayed the default grey, not teal). Rewrote it to the supported on-`.finsheet` pattern
  (`.finsheet.teal { … }` + `className`, proven teal) and corrected the JSDoc. The other four examples +
  `examples/README.md` were accurate.
- [x] **CHANGELOG.md** — [`CHANGELOG.md`](../../CHANGELOG.md) created (Keep a Changelog + SemVer): a
  `0.2.0` entry (editing, bulk, the pinned O(1) re-render guarantee, the gallery) + a back-filled
  `0.1.0` entry (`2026-07-09`, from the npm publish date). **✅ Stage 2 complete.**

## Stage 3 — Release prep (v0.2.0)

- [x] **Version bump** — `0.2.0` in `package.json` **and** the `VERSION` constant in
  [src/index.ts](../../src/index.ts), **in sync** (`index.test.ts` is version-agnostic; 227 tests
  green). Also refreshed index.ts's module doc (was "read-only" only) to name the `edit` / `bulk` modes.
- [x] **RELEASING.md v0.2.0 pass** — the tag/notes are now a `VERSION=v0.2.0` variable + v0.2.0 notes
  (drawn from `CHANGELOG.md`); the version-bump step now also requires a dated CHANGELOG entry; the
  local gate gained `pnpm test:browser`. No hardcoded `v0.1.0` tag left (only historical references).
- [ ] **(maintainer) Publish** — full local gate green (`lint` / `typecheck` / `test:coverage` /
  `test:browser` / `build` / `pnpm pack --dry-run`), then the manual act: `pnpm publish` +
  `git tag v0.2.0` + `gh release create`. **Run by the maintainer**, gated on everything above; this
  box flips when **`finsheet@0.2.0`** is live.

## Out of scope

- **The CSS visual-polish pass** — deferred *behind* the gallery. Capture first; polish only the
  configs the PNGs show as weak, as a small reviewed follow-up (or a v1 item). No blind sweep.
- **Visual-regression pixel-diffing in CI** — the gallery is *documentation* (curated, regenerated on
  demand), not a gating baseline. Cross-OS / font pixel diffs are flaky and would fight the minimal
  ethos. (Layer `toMatchScreenshot` later, CI-only, if ever wanted.)
- **Any v1 feature** — per-column formatting, grouped headers, the print stylesheet and the
  selection-band a11y fix all belong to the **`v1.0.0` milestone**, not here.
- **`role=grid` / composite a11y** and **virtualization** — documented non-goals / deferred (the
  positions get *written* in the v1.0 milestone, not built here).

## Locked decisions

- **Documentation screenshots, not regression baselines** — committed PNGs, regenerable via
  `pnpm screenshots`, never a CI gate.
- **Reuse the existing Chromium / `@vitest/browser` stack** — no Storybook, no new dependency.
- **Write to `docs/screenshots/` (non-ignored); keep `__screenshots__/` ignored** — the curated
  gallery is versioned; any future scratch baselines are not.
- **Brand-neutral throughout** — no CSS identity change in this epic; the gallery includes a
  token-override shot precisely to show finsheet themes to the host.
- **Publishing stays a manual maintainer act** — the epic scopes prep + gate-green + release notes;
  the `pnpm publish` is the maintainer's.

## Founder gates — RESOLVED (2026-07-11)

- **The config list** → the **7-shot set** above (income light/dark, `edit`, `bulk` selection, balance
  sheet, thousands-scale, token-override). The optional extras (`stickyFooter={false}`, rejected-paste,
  locked-column) are **dropped** to keep the set small and curated.
- **Where the gallery lives** → a dedicated **`docs/gallery.md`**, linked from the README.
- **CHANGELOG.md** → **introduce now**, with a v0.2.0 entry (Stage 2).
- **Light CSS touch-up** → **strictly a follow-up** — not in Epic 8; any polish is a separate reviewed change.

## Risks

- **Binary PNGs bloat the repo / diffs** — mitigate by keeping the set small (~7) and curated;
  regeneration overwrites in place, it doesn't accrete.
- **System-font rendering varies by machine** — regenerated PNGs may differ local vs CI. Fine for
  documentation; it's exactly why we don't gate on them.
- **happy-dom can't verify any of this** — the gallery *is* the visual-QA surface; the maintainer
  still eyeballs the PNGs (sticky, dark mode, hairlines) before release.

## Done when

The repo has a committed, regenerable screenshot gallery across the documented configs, embedded in
the README; the docs truthfully describe the shipping v0.2.0 `edit` + `bulk` surface with
virtualization deferred (no stale v0.1.0 / "virtualization follows" claims); the version reads
`0.2.0` in `package.json` and `src/index.ts` **in sync**; RELEASING.md covers v0.2.0; every gate is
green; and the maintainer has published **`finsheet@0.2.0`**.
