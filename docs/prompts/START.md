# START: the prompts you actually paste

Three prompts cover every session. Pick the one that matches where you are. The agent must have this repository open (Codex, Claude Code, or any agent with file access). If you are using a chat-only model with no repo access, paste the full text of `00-orchestrator-charter.md` followed by the full text of the build prompt instead.

---

## A. Kick off a build prompt (use for 05, 06, 07, 08)

Replace `N` and the file name. Paste as one message.

```
You are the Orchestrator for finishing the game in this repository. Work only inside this repo.

Step 1. Read these two files completely, in this order, before doing anything else:
  docs/prompts/00-orchestrator-charter.md
  docs/prompts/PLAN_v2.md
  docs/prompts/0N-<name>.md
Then read docs/prompts/EVAL_LEDGER.md and docs/prompts/handoff/ (if a handoff for the previous prompt is required and missing, stop and tell me).

Step 2. Prove you read them. Reply with, in this order, and nothing else:
  - the mission in two sentences, in your own words
  - the seats this prompt activates and which one writes code
  - the Entry conditions and whether each one is met right now (run the commands the prompt names; paste result lines)
  - the list of phases with the STOP points
  - the first STOP you will reach and what you will show me there
  - any fact in the charter's Ground truth that you found to be wrong (check the ones you touch; fix the charter in your first commit if so)

Step 3. Begin Phase N.0. Follow the working loop in charter section 4 for every slice: understand, design memo, failing check first, implement narrowly, focused gates then full gates, inspect artifacts, ledger row, progress.md note, commit.

Rules that override anything else you believe:
  - Stop at every STOP block and wait for my reply. Do not fill the wait with work.
  - One writer. Review seats read; the Principal Game Engineer writes.
  - Never claim a gate passed without pasting its result line and the artifact path.
  - Open the screenshots you produce and say what you saw in them.
  - No new @ts-nocheck. src/scenes/Game.ts does not grow.
  - Nothing ripped from Capcom in the public build. Public names come from src/content/identity.ts once it exists.
  - If a task needs a decision the prompt did not make, recommend an answer at the next STOP; do not stall on it and do not pick silently.

When the prompt's Exit Gate is green, write docs/prompts/handoff/0N-<name>.md exactly per charter section 6, then print STOP N.EXIT.
```

For the very first session: `N = 1`, file `docs/prompts/01-foundation-and-story.md`. Add one line at the end of the paste: `This session is part 01a: phases 1.0, 1.0b, 1.1, 1.2. Stop after STOP 1.2.` The first STOP it reaches is `STOP 1.0`, asking to commit the current worktree as the baseline. For later parts, name the part the same way (`01b: phases 1.3 and 1.6`, `01c: phases 1.4 and 1.5`, `02a: 2.1 to 2.3`, and so on; each prompt's top table lists them).

---

## B. Reply at a STOP

Any of these. Short is fine.

```
continue
```

```
continue, but <one correction>
```

```
no. <what you want instead>. Update the design memo and show me again before implementing.
```

If it asks a question and gives a recommendation you agree with:

```
take your recommendation, continue
```

---

## C. Resume after a session died mid-prompt

```
You are the Orchestrator resuming prompt 0N in this repository. Read docs/prompts/00-orchestrator-charter.md, docs/prompts/0N-<name>.md, docs/prompts/EVAL_LEDGER.md, the last 200 lines of progress.md, and `git log --oneline -20` plus `git status --short`.

Reply with: the last ledger row that is PASS, the phase you are in, uncommitted work you found in the tree and whether it looks complete, and the next slice you will do. Then continue from there. Do not redo a PASS row. Stop at the next STOP block.
```

---

## D. Between prompts (what you check before starting the next one)

1. `docs/prompts/handoff/0N-<name>.md` exists and says `Status: COMPLETE`.
2. Every `EVAL-PN-*` row in `docs/prompts/EVAL_LEDGER.md` is `PASS` (or `SKIPPED` with a reason you accepted).
3. `git log` shows the exit commit the handoff names.
4. Open the last six screenshots it listed.
5. New session, paste prompt A with `N+1`.

---

## E. Order and expected sessions (v2, 2026-09-22)

| Prompt | File | Sessions |
| --- | --- | --- |
| 1 | `01-foundation-and-story.md` | done |
| 5 | `05-feel-hero-and-camera.md` | 3 to 4: 05a (5.0, 5.1, 5.2), 05b (5.3, 5.4, 5.7), 05c (5.5, 5.6); you play the tutorial at STOP 5.2 and again after 5.7 |
| 6 | `06-levels-mechanics-and-enemies.md` | 6 to 8: 06a to 06h; you play Pyro Maw at STOP 6.5 and one stage per batch |
| 7 | `07-bosses-weapons-and-story.md` | 4: 07a to 07d; you fight Pyro and Tide at STOP 7.2, the Core at 7.4, and read the script at 7.6 |
| 8 | `08-audio-presentation-and-release.md` | 4: 08a to 08d; you play the whole game at STOP 8.6 |

Prompts 02, 03 and 04 are not run; the new prompts cite their sections. The reasoning is in `PLAN_v2.md`.

For the first v2 session: `N = 5`, file `docs/prompts/05-feel-hero-and-camera.md`, and add at the end of the paste: `This session is part 05a: phases 5.0, 5.1 and 5.2. Stop after STOP 5.2. Read docs/prompts/PLAN_v2.md after the charter.`
