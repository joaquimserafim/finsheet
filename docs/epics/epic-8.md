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

- [ ] **Screenshot harness** — a `pnpm screenshots` script + config that renders a `<Grid>` in real
  Chromium and writes a PNG to a **committed, non-ignored** dir (`docs/screenshots/`), proven with
  one config end-to-end. Must **not** write into the git-ignored `__screenshots__/` / `test-results/`.
- [ ] **Config fixtures captured** — the documented config set, each a small fixture model → one PNG:
  read-only P&L (light), the same (dark), `mode="edit"` with an active cell + focus ring, `mode="bulk"`
  with a selection band, a balance sheet, a "shown in thousands" scale, and a `--fs-*` token-override
  that demonstrates theming to a host app.
- [ ] **Gallery embed** — a README "Gallery" section (and/or `docs/gallery.md`) referencing every PNG,
  with the regeneration command documented so the images stay reproducible.

## Stage 2 — Docs truthing (v0.1.0 → v0.2.0)

The status blurbs were written for v0.1.0 (read-only). Editing + bulk shipped; virtualization is
deferred (Epic 7). Make the docs describe the **shipping** surface.

- [ ] **README truthing** — the status callout (v0.2.0 ships `edit` + `bulk`), the "virtualization
  follows" line (→ **deferred**, per Epic 7), and the Notes & limitations section (editing has
  *shipped* — it is no longer "on the roadmap"); sweep any remaining v0.1.0-era phrasing.
- [ ] **Examples audit** — confirm all five `examples/*.tsx` + `examples/README.md` match the shipping
  API (they're CI-typechecked; verify they also represent the current feature set), fixing any drift.

## Stage 3 — Release prep (v0.2.0)

- [ ] **Version bump** — `0.1.0 → 0.2.0` in `package.json` **and** the `VERSION` constant in
  [src/index.ts](../../src/index.ts); verify they **match** (drift between the two is the classic
  release footgun the RELEASING.md checklist calls out).
- [ ] **RELEASING.md v0.2.0 pass** — generalize the v0.1.0-hardcoded release notes + `git tag v0.1.0`,
  and add the v0.2.0 release-notes text (editing + bulk + the screenshot gallery).
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

## Founder gates (decide before building)

- **The config list** — is the ~7-shot set above right, or add/drop configs (e.g. a
  `stickyFooter={false}` variant, a rejected-paste state, a locked-column example)?
- **Where the gallery lives** — a README "Gallery" section, a dedicated `docs/gallery.md`, or both?
- **CHANGELOG.md** — introduce one now with a v0.2.0 entry, or defer to the v1.0 milestone?
- **Light CSS touch-up** — if the gallery exposes a weak-looking config, is a *small* fix in-scope for
  this epic, or strictly a follow-up?

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
