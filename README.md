# columnar

A headless-leaning React grid for **financial statements** — sticky headers, tabular numerics,
subtotal/total rows, and three edit modes — without the row-model abstraction tax of a general
table library.

> **Status:** pre-release (`v0.0.0`). The read-only grid ships in `v0.1.0`; editing in `v0.2.0`.
> See [docs/ROADMAP.md](docs/ROADMAP.md).

## Requirements

- **Node.js ≥ 24**
- **React ≥ 18** (peer dependency)
- **ESM-only** — no CommonJS build

## Install

```sh
pnpm add columnar react
```

## Quick start

```tsx
import { VERSION } from "columnar"
// The Grid component lands in v0.1.0.
```

## Development

```sh
pnpm install     # installs deps and sets up husky hooks via `prepare`
pnpm dev         # Vite playground
pnpm test        # Vitest (watch)
pnpm build       # tsup → dist (ESM + .d.ts)
pnpm lint        # Biome check
pnpm typecheck   # tsc --noEmit
```

## License

[MIT](LICENSE) © columnar contributors
