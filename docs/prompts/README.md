# Completion Prompt Package: OMEGA Relay

- Status: working
- Owner scope: repo, gameplay, content, art, audio, release
- Created: 2026-09-09, after a full read of the runtime, docs, tests, artifacts and screenshots

## What this is

Five prompts that take the current playable prototype to a finished, shippable game with a real storyline. They are written to be pasted into a strong coding agent (Codex / ChatGPT) that has this repository open. Each prompt is a complete work order: entry conditions, personas, step-by-step tasks with the exact files involved, evals with pass thresholds, STOP points for Craig's review, and a handoff file that the next prompt reads as its input.

| Order | File | Lane | Sessions |
| --- | --- | --- | --- |
| start | `START.md` | The three prompts you paste: kickoff, STOP reply, resume. | n/a |
| 0 | `00-orchestrator-charter.md` | Rules, ground truth, seats, working loop, handoff and ledger contracts. Paste first in every session. | n/a |
| 1 | `01-foundation-and-story.md` | Green baseline, CI, one input source, classic campaign mode with working upgrades, identity, story bible v2 and full script, narrative runtime surfaces, pause menu with weapon grid and sub tanks, autosave, options, death economy | 3 (01a, 01b, 01c) |
| 2 | `02-levels-and-gameplay.md` | Level format v2 with walls and vertical segments, eight full-length stages, tutorial rewrite, three-act Omega Fortress, stage mechanics, mini-bosses, difficulty | 5 to 7 (02a to 02d) |
| 3 | `03-art-animation-bosses.md` | Style sheet, biome tilesets and backgrounds, original boss sheets, hero sprite, twelve portraits, VFX, UI art, boss readability | 2 to 3 (03a to 03c) |
| 4 | `04-presentation-audio-release.md` | Music and SFX, stage intro / boss door and warning / weapon-get / campaign record beats, gamepad, fullscreen, options, public build and deploy, full-campaign automation, v1.0 | 2 (04a, 04b) |

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
