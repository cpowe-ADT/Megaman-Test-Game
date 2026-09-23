@AGENTS.md

# Claude Code specifics (everything else is in AGENTS.md above)

- Review seats are project subagents in `.claude/agents/game-*.md`. Launch the ones a slice needs in a single message so they run in parallel and blind; each reads only its packet (`npm run agents:packet`), or its seat file in `docs/prompts/seats/` when there is no diff. The user-level agents on this machine (`coder`, `measurement`, `documentation` and the report seats) belong to another project: do not use them here.
- At a STOP, print the STOP block, add the `docs/prompts/DECISIONS.md` row, and end the turn. Do not fill the wait with work.
- Never Read a file over about 20KB whole (the progress archive, `Game.ts`, `scripts/smoke-test.mjs`): Grep, then Read with offset and limit.
- Browser pane: `preview_start` with `omega-relay-dist` (the production build on port 4180, run `npm run build` first) or `omega-relay-dev`. The pane pauses Phaser while hidden, so read state through `render_game_to_text` rather than waiting on frames.
- Delegate broad searches and reviews to subagents and keep their conclusions, not their file dumps; ask for at most 600 words back.
- Commit when the working loop says so or Craig asks, with the attribution trailer the harness gives you.
