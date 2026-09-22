# Contributing

Agents: the rules, gate table and logging protocol are in `AGENTS.md`; this file adds nothing that overrides it. `npm run verify` now starts with `npm run agents:check`.

## Working Style
- Keep changes small, reviewable, and scoped to the request.
- Prefer typed, testable modules over expanding scene-local logic.
- Keep Phaser-specific code at the edges when practical.
- Do not spread `@ts-nocheck`; reduce the existing `src/scenes/Game.ts` hotspot when you must work there.
- Update docs when workflows, architecture boundaries, commands, content contracts, or automation hooks change.
- Append a concise note to `progress.md` after meaningful work.

## Working Safely In This Repo
- Read `progress.md` before making changes.
- Expect a dirty worktree. Preserve unrelated edits.
- Never revert user changes unless explicitly requested.
- Avoid repo-wide formatting or structure churn unless required by the task.
- If you encounter new unexpected changes while working, stop and ask how to proceed.

## Change Methodology
### Bug fixes
1. Reproduce the issue.
2. Add or adjust the narrowest truthful test.
3. Implement the fix.
4. Re-run the affected validation commands.
5. Update docs and `progress.md` if behavior or workflow changed.

### Feature work
1. Confirm the owning runtime area and current canonical docs.
2. Prefer pure-logic extraction before adding more scene-local branching.
3. Keep new content/contracts documented alongside the implementation.
4. Verify the smallest relevant gate first, then escalate as needed.

## Validation Expectations
- `npm run test`
  - Required for logic, gameplay-rule, scene, save, schema, and UI-flow changes.
- `npm run build`
  - Required for any runtime, loading, TypeScript, or integration change.
- `npm run test:smoke`
  - Required for gameplay flow, stage flow, input, UI, or automation-hook-sensitive changes.
- `npm run test:visual-sweep`
  - Required for mission-wide visuals, sprite atlases, content presentation, and art-pipeline changes.
- `npm run verify`
  - Required before merge for substantive gameplay, tooling, content, or asset-pipeline work.

## Merge Blockers
Do not consider a change merge-ready if any of these are true:
- Required validation commands failed.
- Relevant docs were left stale.
- `progress.md` does not mention the change or its risks.
- A runtime change broke `render_game_to_text`, animation-frame waiting hooks (`advanceTime`), smoke flows, or sprite validation without coordinated updates.
- The change adds new technical debt without a recorded follow-up or justification.

## Debt Tracking Rules
- Track known debt in the nearest canonical doc plus `progress.md` when it affects current work.
- Current repo-wide debt to respect:
  - `src/scenes/Game.ts` complexity and `@ts-nocheck`
  - production bundle-size warning
  - mixed legacy/new architecture during refactor
  - historical planning docs that can drift from runtime reality

## Before Opening a PR
1. Re-read the relevant canonical docs in `docs/README.md`.
2. Run the required validation commands.
3. Check that command descriptions in docs still match reality.
4. Update `progress.md` with what changed, validation run, and follow-ups.
5. Call out remaining risks explicitly in your summary.
