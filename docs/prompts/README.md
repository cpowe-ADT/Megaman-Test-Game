# Prompt package: OMEGA Relay

- Status: canonical index (details live in the files it points to)
- Owner scope: repo, gameplay, content, art, audio, release, the agent system

The work orders that take the game from playable prototype to v1.0, and the agent system that runs them. Rules for every agent are in `AGENTS.md` (Claude imports it through `CLAUDE.md`). How the pieces fit together (chaining, seats, reviews, checks, context packs, logs) is `docs/prompts/10-agent-system.md`.

| File | What it is |
| --- | --- |
| `docs/prompts/START.md` | What Craig pastes: kickoff, reply at a STOP, resume, between prompts, chat-only models, one seat review |
| `docs/prompts/00-orchestrator-charter.md` | Seats, working loop, STOP protocol, handoff and ledger contracts, hard rules. A session reads the parts it needs through `npm run agents:context -- --part <part>` |
| `docs/prompts/PLAN_v2.md` | Why 05 to 08 replaced 02 to 04, the scope ladder, the Definition of Final. Read once |
| `docs/prompts/05-feel-hero-and-camera.md` to `docs/prompts/08-audio-presentation-and-release.md` | The v2 build prompts, in order |
| `docs/prompts/09-footprint-and-performance.md` | Load, memory, per-frame cost and disk; its budget is a standing gate |
| `docs/prompts/10-agent-system.md` | The agent system and its next work order |
| `docs/prompts/11-token-efficiency.md` | Token efficiency: cards, packets, model and risk tiers, budgets |
| `docs/prompts/12-finish-the-game.md` | The finish work order (2026-09-25): what is left of 05 to 08 in lanes and waves, with the finish audit's additions |
| `docs/prompts/EVAL_LEDGER.md` | One row per eval for live prompts; finished prompts in `docs/prompts/archive/` |
| `docs/prompts/DECISIONS.md` | Every question waiting on Craig, with a recommendation; rows marked `entry <N>` block that prompt |
| `docs/prompts/seats/` | The personas: what each owns, never does, reads and scores |
| `docs/prompts/handoff/` | One file per finished prompt; the next prompt reads its inputs |
| `docs/prompts/reviews/` | Blind seat reviews, merged findings and `SCORES.md` |
| `docs/prompts/01-foundation-and-story.md` | Done 2026-09-10 |
| `docs/prompts/02-levels-and-gameplay.md`, `docs/prompts/03-art-animation-bosses.md`, `docs/prompts/04-presentation-audio-release.md` | Superseded work orders kept as specification appendices that 06 to 08 cite by section. Do not run them |

Order and sessions: `docs/prompts/START.md` section E. Where the project stands right now: `progress.md` (Now) and `npm run agents:facts`.
