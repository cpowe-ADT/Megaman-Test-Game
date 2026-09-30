# ADR: Bundle Size Strategy During Runtime Refactor

- Status: accepted
- Date: 2026-03-06
- Owners: repo maintainers, gameplay/tools contributors

## Context
`npm run build` currently succeeds, but Vite warns that the production bundle is larger than the default chunk-size threshold. The game is mid-refactor and still mixes legacy scene-owned runtime logic with newer modular subsystems. Immediate aggressive code-splitting could reduce bundle size, but it could also destabilize scene loading, automation flows, and asset/runtime assumptions while higher-priority architecture and gameplay work is still underway.

## Decision
The repo will treat the large-bundle warning as tracked debt rather than a release blocker for routine development. The current strategy is:

- keep the warning visible in docs and build output,
- do not hide it by raising the warning threshold,
- avoid risky chunking changes unless they are deliberate and validated,
- prefer incremental cleanup that naturally reduces bundle weight as runtime responsibilities leave `Game.ts`,
- introduce explicit code-splitting or manual chunking only as a dedicated follow-up with targeted validation.

Update 2026-09-22: a folder-based `manualChunks` split (boss, content, gameplay) was tried and made chunks import each other in a cycle; the production build threw at boot and nothing caught it because smoke runs on the dev server. Phaser (its Arcade-only build) is now the only manual chunk and `npm run perf:footprint` boots `dist/` on every run. Split game code only by scene with dynamic `import()`.

## Consequences
- Contributors should not “fix” bundle size opportunistically in unrelated changes.
- Any future bundle-splitting work must validate scene flow, smoke automation, and asset loading behavior.
- Docs should continue to call this out as current debt so future agents do not assume the warning is accidental or already resolved.

## v1.0 bundle budget (part 12i, prompt 08 8.5 / prompt 04 4.4)
Chunk sizes from `npm run build:public` at the part-12i commit, recorded here as the budget
`scripts/check-dist-runtime-assets.mjs` enforces (fails only past 15% over the total; lower it with a
new row here when a slice earns it, never raise it without one, charter rule 14):

| Chunk | Raw bytes | Gzip KB |
| --- | --- | --- |
| `phaser-*.js` (manual chunk, `phaser-arcade-physics.min.js`) | 1,085,692 | 295.92 |
| `index-*.js` (everything else, incl. the part-12i `perfDebug`/runtime-leak hooks) | 812,442 | 236.91 |
| **Total (the budget)** | **1,898,134** | **532.83** |

No CSS chunk exists. `dist/` total is 10MB (`assets/sprites`, `assets/audio`, etc. are copied runtime
folders, not Rollup output, and are governed by `tests/perf-budget.json`'s `distTotalMB`/`jsGzipKB`
instead of this ADR). JS gzip (532.83KB) is under prompt 08 8.5's 600KB ceiling. `npm run build:public`
(`VITE_PUBLIC_BUILD=1`) runs about 90 bytes above this table: nothing in the source reads that flag
(05c already retired the only thing it gated, the developer skin), but Vite's injected `import.meta.env`
object gains the one extra key regardless, since other modules already reference `import.meta.env`.
Comfortably inside the 15% ceiling either way.

## Alternatives Considered
### Raise `chunkSizeWarningLimit`
Rejected because it hides the signal without reducing bundle size.

### Immediate broad code-splitting pass
Rejected for now because the runtime is still structurally in flux and the regression surface is wider than the current payoff.
