# Testing

## Testing Strategy
This repo uses a practical game-focused pyramid:
- Pure logic and contract tests first.
- Scene/system behavior tests second.
- Browser smoke and visual sweep checks last.
- Build/typecheck remains a required integration gate for runtime work.

The goal is fast feedback from deterministic tests, with browser automation reserved for scene flow, rendering, and interaction-risk areas.

## Commands
| Command | Purpose | Run when |
| --- | --- | --- |
| `npm run test` | Logic, content-contract, boss-framework, save-system, and scene/system regression tests | Any change to gameplay rules, scene flow, UI flow, schemas, save logic, or runtime modules |
| `npm run build` | TypeScript validation plus production bundle build | Any TypeScript, runtime wiring, loader, manifest, or bundling-impacting change |
| `npm run test:smoke` | Automated browser smoke pass with screenshots, state capture, and console checks | Gameplay flow, stage flow, input, UI, pause/victory/game-over flow, automation-hook-sensitive changes |
| `npm run test:visual-sweep` | Cross-mission visual sweep and artifact capture | Sprite pipeline, atlas changes, boss/enemy presentation, mission-wide visual changes |
| `npm run verify` | Combined validation gate | Required before merge for substantive gameplay, tooling, content, or asset-pipeline work |

## Current Test Surface
- `tests/`
  - Logic, contracts, scene flow, save systems, render policy, platform rules, sprite validation, debug-state helpers
- `src/boss/__tests__/`
  - Boss-framework logic and controller behavior
- `scripts/smoke-test.mjs`
  - Browser smoke validation and artifact capture
  - Includes player sword coverage for grounded slash, air slash, boss slash, and moving-slash alignment
- `scripts/mission-visual-sweep.mjs`
  - Mission-wide visual verification pass

## Required Gate Selection
- Docs-only changes: `npm run test` and `npm run build` by default
- Pure logic or schema changes: `npm run test`
- Runtime or integration changes: `npm run test` and `npm run build`
- Gameplay flow, scene flow, input, or UI changes: add `npm run test:smoke`
- Visual, sprite, atlas, or mission-presentation changes: add `npm run test:visual-sweep`
- Broad gameplay/tools/content work: finish with `npm run verify`

## Bug-Fix Workflow
1. Reproduce the bug.
2. Add or adjust the narrowest truthful test.
3. Implement the fix.
4. Re-run the affected gates.
5. Update docs and `progress.md` if behavior, tooling, or workflow changed.

## Deterministic Automation Contracts
Do not break these without updating scripts and docs together:
- `window.render_game_to_text`
- deterministic step hooks such as `window.advanceTime`
- smoke harness expectations in `scripts/smoke-test.mjs`
- visual-sweep expectations in `scripts/mission-visual-sweep.mjs`

When changing these contracts:
- update the relevant script,
- update this file and `docs/testing/quality-gates.md`,
- mention the change in `progress.md`.

## Handling Flaky Browser Validation
- Fix the smallest reproducible issue first.
- Prefer deterministic stepping over timing sleeps.
- Use screenshots and text-state output together; neither is sufficient alone for gameplay assertions.
- If a smoke or visual test is intentionally updated, document the new expected behavior in the same change.

## Merge Expectations
A change is not ready if the relevant gate for its risk profile was skipped. When in doubt, escalate to the next stronger command rather than documenting exceptions.
