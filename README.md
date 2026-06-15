# Mahjong Tracker

Multi-variant mahjong score tracker. Static, client-side, offline-capable PWA —
no backend, no accounts, no analytics. Built for use on a phone at a physical table.

**Variants:** Hong Kong Old Style (fan) · Riichi (han + fu). Adding a variant is
one config file — see below.

## Use

Record each completed hand: winner → self-draw or discarder → hand value → confirm.
The app computes payments, rotates seat/round winds, tracks dealer repeats,
honba and riichi sticks, and detects game end. Undo (↩) reverts the last entry
fully. Sessions persist in localStorage and survive reloads; the summary screen
exports final standings as text or a PNG for the group chat.

Manual dealer/round override is under the ⋯ menu.

## Develop

```sh
npm install        # typescript + vite only; tests use node:test (zero deps)
npm run dev        # local dev server
npm test           # engine + variant unit tests (node --test)
npm run typecheck
npm run build      # tsc + vite → dist/
```

`ui-smoke.mjs` is an optional headless UI walkthrough:
`npm i --no-save jsdom && node --experimental-strip-types ui-smoke.mjs`

## Deploy (static files only)

- **Cloudflare Pages:** connect the repo; build command `npm run build`,
  output directory `dist`. Done.
- **GitHub Pages:** push to `main`; `.github/workflows/deploy.yml` builds,
  tests and deploys. Set repo → Settings → Pages → Source: *GitHub Actions*.
  The build uses a relative base, so project-site subpaths work.

## Architecture

```
src/engine/types.ts    VariantConfig contract + core types
src/engine/engine.ts   deterministic core: rotation, ledger, undo, persistence
src/variants/*.ts      one config per variant + registry (index.ts)
src/ui/                variant-blind UI rendered from the configs
```

The engine owns universal state (seats, winds, dealer rotation and repeats,
scores, ledger). A variant is a set of pure functions consulted per hand:
`parseValue → settle → dealerRepeats → nextState → gameEnd`, plus UI specs
(`valueFields`, `handInputs`, `drawTypes`, `settings`, `statusText`,
`finalStandings`).

**Adding a variant:** copy `src/variants/hongkong.ts`, implement the
`VariantConfig`, add one line to `src/variants/index.ts`. No engine or UI
changes. **Calculator seam:** the UI feeds `parseValue` a
`Record<string, number>` (fan, or han+fu); a future tile-pattern calculator
only needs to produce the same record.

## Rule notes (house rules are settings, set per session)

- **HK:** base = 2^min(fan, cap); half-shooter (default): discarder 2×, others
  1×, self-draw 2× each; full-shooter: discarder alone pays the 6× self-draw
  total. Min fan (default 3), cap (8/10/13), draw dealer-repeat, 1 or 4 rounds.
- **Riichi:** standard point tables with mangan→yakuman limits (stacked
  yakuman supported), honba (+300 ron / +100 per payer tsumo), riichi-stick pot
  with carryover, noten penalties, tobi, hanchan/tonpuusen, optional kiriage
  mangan, atamahane, uma (5-10 / 10-20) and oka. Multi-ron: pot and honba go to
  the winner nearest the discarder's right. Out of scope v1: nagashi mangan,
  agariyame, enchousen, pao.
