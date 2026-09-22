# Completion Prompt Package: OMEGA Relay

- Status: working
- Owner scope: repo, gameplay, content, art, audio, release
- Created: 2026-09-09, after a full read of the runtime, docs, tests, artifacts and screenshots

## What this is

The prompt package that takes the current playable prototype to a finished, shippable game with a real storyline. They are written to be pasted into a strong coding agent (Codex / ChatGPT) that has this repository open. Each prompt is a complete work order: entry conditions, personas, step-by-step tasks with the exact files involved, evals with pass thresholds, STOP points for Craig's review, and a handoff file that the next prompt reads as its input.

| Order | File | Lane | Sessions |
| --- | --- | --- | --- |
| start | `START.md` | The three prompts you paste: kickoff, STOP reply, resume. | n/a |
| plan | `PLAN_v2.md` | The 2026-09-22 consultant assessment and the roadmap that replaced prompts 02 to 04 with 05 to 08. Read it once. | n/a |
| 0 | `00-orchestrator-charter.md` | Rules, ground truth (with the 2026-09-22 amendments), seats, working loop, handoff and ledger contracts. Paste first in every session. | n/a |
| 1 | `01-foundation-and-story.md` | COMPLETE 2026-09-10. Green baseline, CI, classic campaign, identity, story bible and script, narrative surfaces, pause menu, autosave, options, death economy. | done |
| 5 | `05-feel-hero-and-camera.md` | Harness and health, motor truth (drag, dash-jump, wall kick, jump cut), combat feel, death, camera, original hero through Higgsfield, ripped skin deleted, save slots with a pilot name, the tutorial that teaches | 3 to 4 |
| 6 | `06-levels-mechanics-and-enemies.md` | Level format v2 with pits, walls and vertical, mechanics, mini-bosses, enemy behaviour and respawn, biome tiles and backgrounds and enemy re-skins through Higgsfield, all ten stages to the route budget, Omega in three acts, audit, lint, sweep v2 | 6 to 8 |
| 7 | `07-bosses-weapons-and-story.md` | Real hazards and drawn telegraphs, phase kits, desperation, weakness reactions, intro and death, weapon identities and the weakness table, portraits and dialogue presentation, the story a player will feel (seven new triggers) | 4 |
| 8 | `08-audio-presentation-and-release.md` | Music per screen, SFX set, pixel font, title and Stage Select art, the beats, first-time-player fixes, gamepad, public build and deploy, perf budget, full-campaign automation, v1.0 | 4 |
| 9 | `09-footprint-and-performance.md` | Footprint and performance: harness and budget (`npm run perf:footprint`), the production build boots, music and backgrounds on demand, Arcade-only Phaser, render-scale cap, per-frame waste, pools, text and HUD cost, disk. 09a done 2026-09-22; runs beside the v2 order. Carries the Performance Engineer persona. | 09a done; 09b, 09c: 1 each |
| ref | `02-levels-and-gameplay.md`, `03-art-animation-bosses.md`, `04-presentation-audio-release.md` | Superseded as work orders; kept as specification appendices that 06, 07 and 08 cite by section. Do not run them. | n/a |

`EVAL_LEDGER.md` is the scoreboard. `handoff/` holds one file per completed prompt.

## How to run it

The exact text to paste is in `START.md` (kickoff, reply at a STOP, resume, and the between-prompt checklist). The steps below are the same thing in prose.

1. Start a fresh agent session in the repo root.
2. Paste `00-orchestrator-charter.md`, then paste the prompt for the phase you are on.
3. The agent works until a `STOP` block. Read what it presents: files, screenshots, ledger rows. Reply `continue`, or give corrections.
4. When the prompt's Exit Gate is green the agent writes `docs/prompts/handoff/0N-<name>.md`. Only then start the next prompt, in a new session, pasting `00` again first.
5. Never start prompt N+1 while prompt N's handoff is missing or its exit gate has a red row in the ledger.

## Between sessions

- Keep the branch name the agent reports. Do not rebase mid-prompt.
- Open the screenshots the agent names. A green summary line is not evidence; the picture is.
- If a session dies mid-prompt, start a new session, paste `00` and the same prompt, and say `resume from the ledger`. The agent must read `EVAL_LEDGER.md`, `progress.md`, and `git log` before touching anything.

## Assumptions baked into the package

- The public build is the original-IP game `OMEGA Relay`. The private Mega Man X sprite override stays as a local developer skin and is stripped from public builds. Craig can reverse this in prompt 01 section 1.2, but every later prompt assumes it.
- Prompts run sequentially on one branch, in parts (01a, 01b, ...). 02 and 03 could run in parallel on two branches, but both touch `src/scenes/Game.ts` and `scripts/mission-visual-sweep.mjs`; merging costs more than waiting.
- CI runs tests and build on every push; the Playwright smoke and the sweep run on manual dispatch and before a tagged deploy, not on push.
- Reviewed 2026-09-10 by three independent read-only reviewers (repo fact-check, executor dry run, game-director completeness); their accepted findings are folded in. About twelve to fifteen sessions in total.
- No engine change. Phaser 3 Arcade, 448x252, the fixed 58px HUD, and the automation hooks stay.
- The agent is the only writer. Craig reviews at STOPs and plays the pilot stage in 02.

## Relationship to older plans

- `docs/working/supervised-game-completion-plan.md`: Steps 1 to 9 are done. Steps 10 and 11 are absorbed into prompts 03 and 04.
- `docs/working/boss-animation-and-fight-rebuild-plan.md`: absorbed into prompt 03.
- `docs/working/narrative-story-bible.md`: input to prompt 01, superseded by `docs/story/` when 01 completes.
- `docs/working/orchestrated-completion-audit.md`: historical.
- `docs/working/zero-character-select-backlog.md`: deferred past v1.0.
