# Releasing

Releases are **manual** — the maintainer runs `pnpm publish` locally. There is no auto-publish
workflow and no npm provenance (see the deferred decisions in [docs/ROADMAP.md](docs/ROADMAP.md)).
CI validates every push; publishing is a deliberate local act.

## 0. One-time preflight (before the very first publish)

The package is published as **`finsheet`**. The name was free on npm at v0.1.0 prep; re-confirm
nobody claimed it in the meantime:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://registry.npmjs.org/finsheet   # 404 = still free
```

If it's since been taken, pick another free unscoped name (verify the same way) or publish under a
scope (`npm pkg set name="@<you>/finsheet"`; `publishConfig.access` is already `"public"`), and
update the README install command + badges + `import "finsheet/styles.css"` examples to match.

You also need to be logged in (`npm whoami`; otherwise `npm login`).

## 1. Cut the release

From a clean `main` with CI green:

```sh
# 1. Bump the version in BOTH package.json and the VERSION constant in src/index.ts.
#    (v0.1.0 is already set; for later releases bump both — they must match.)

# 2. Full local gate — the same checks CI runs, plus the packaged-tarball smoke test.
pnpm install
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build

# 3. Inspect exactly what will ship (should be dist/ + package.json + README + LICENSE, nothing else).
pnpm pack --dry-run
```

## 2. Publish to npm

```sh
pnpm publish --access public
# add --otp=<code> if your npm account has 2FA enabled
```

`prepublishOnly` rebuilds `dist/` first, so a stale or missing build can't be published.

## 3. Tag and create the GitHub release

```sh
git tag v0.1.0            # match the published version, with a leading "v"
git push origin v0.1.0

gh release create v0.1.0 \
  --title "v0.1.0" \
  --notes "First public release: read-only financial-statement grid — sticky header + label column, subtotal/total rows, pinned grand total, accounting formatters, light/dark theming. Editing lands in v0.2.0." \
  --verify-tag
```

(Or `gh release create v0.1.0 --generate-notes` to draft notes from the commit log.)

## 4. Verify the published package

```sh
pnpm view finsheet    # confirm the new version, files, and exports are live
```

Optionally install it into a scratch app and import `Grid` + `import "finsheet/styles.css"` to
confirm a real consumer install works (CI's install smoke test already does this on every push).
