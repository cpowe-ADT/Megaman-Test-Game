# START: the prompts you actually paste

Pick the block that matches where you are. Agents with the repo open (Codex, Claude Code) already have `AGENTS.md` loaded; the blocks below only add the session's job. A chat-only model uses block F.

---

## A. Kick off a build prompt (05, 06, 07, 08, 09, 10)

Replace `N` (for example `5`), `NN` (`05`) and the part (`05a`). Paste as one message.

```
You are the Orchestrator for finishing the game in this repository. Work only inside this repo. Follow AGENTS.md.

Step 1. Run these and paste their result lines:
  npm run agents:check -- --entry N
  npm run agents:context -- --part NNx
If the entry check fails, stop and tell me which condition is unmet and what would fix it.

Step 2. Read output/context/NNx.md in full. It holds the hard rules, the charter's working loop, STOP protocol and amendments, this part's phases, the prompt's ledger rows, the previous handoff's inputs, the open decisions and the last progress entries. Open any other file only when a slice touches it, and read big files by section.

Step 3. Prove you read it. Reply with, in this order, and nothing else:
  - the mission of this part in two sentences, in your own words
  - the seats it activates, which one writes code, and which seats will review each slice
  - the entry conditions and whether each is met now (result lines)
  - the phases in this part with their STOP points
  - the first STOP you will reach and what you will show me there
  - any fact in the pack that you found to be wrong (fix it in your first commit)

Step 4. Begin the first phase. For every slice follow the working loop: understand, design memo, failing check first, implement narrowly, focused gates then full gates, open the artifacts, blind seat review (docs/prompts/seats/README.md), ledger row, progress.md entry, npm run agents:check, commit.

Rules that override anything else you believe:
  - Stop at every STOP block and wait for my reply. Add its question to docs/prompts/DECISIONS.md with your recommendation. Do not fill the wait with work.
  - One writer. Review seats read; the Principal Game Engineer writes.
  - Never claim a gate passed without pasting its result line and the artifact path. Open the screenshots you produce and say what you saw.
  - No new @ts-nocheck. src/scenes/Game.ts does not grow.
  - Nothing ripped from Capcom in the public build. Public names come from src/content/identity.ts.
  - If a task needs a decision the prompt did not make, recommend an answer at the next STOP; do not stall and do not pick silently.
  - One progress.md entry per session, in its template, naming yourself and your model.

When the Exit Gate is green, write docs/prompts/handoff/NN-<name>.md per charter section 6, run npm run agents:check, then print STOP N.EXIT.
```

Name the part at the end of the paste, for example: `This session is part 05a: phases 5.0, 5.1 and 5.2. Stop after STOP 5.2.` Each prompt's top table lists its parts.

---

## B. Reply at a STOP

```
continue
```

```
continue, but <one correction>
```

```
no. <what you want instead>. Update the design memo and show me again before implementing.
```

```
take your recommendation, continue
```

To answer the decisions log in one go: `D-001 approved all. D-004 no difference. D-006 run it.` The agent pastes each reply verbatim into `docs/prompts/DECISIONS.md`.

---

## C. Resume after a session died mid-prompt

```
You are the Orchestrator resuming prompt NN in this repository. Follow AGENTS.md. Run npm run agents:check and npm run agents:context -- --part NNx, then read output/context/NNx.md, `git log --oneline -15` and `git status --short`.

Reply with: the last ledger row that is PASS, the phase you are in, uncommitted work you found and whether it looks complete, and the next slice. Then continue from there. Do not redo a PASS row. Stop at the next STOP block.
```

---

## D. Between prompts (what you check before starting the next one)

1. `npm run agents:check -- --entry <next N>` passes. It checks the previous handoff is `COMPLETE` and its ledger rows are `PASS` or `SKIPPED`.
2. `docs/prompts/DECISIONS.md` has no OPEN row the next prompt depends on.
3. Open the last six screenshots the handoff lists.
4. New session, block A with the next prompt.

---

## E. Order and expected sessions (v2, 2026-09-22)

| Prompt | File | Sessions |
| --- | --- | --- |
| 1 | `01-foundation-and-story.md` | done |
| 5 | `05-feel-hero-and-camera.md` | 3 to 4: 05a (5.0, 5.1, 5.2), 05b (5.3, 5.4, 5.7), 05c (5.5, 5.6); you play the tutorial at STOP 5.2 and again after 5.7 |
| 6 | `06-levels-mechanics-and-enemies.md` | 6 to 8: 06a to 06h; you play Pyro Maw at STOP 6.5 and one stage per batch |
| 7 | `07-bosses-weapons-and-story.md` | 4: 07a to 07d; you fight Pyro and Tide at STOP 7.2, the Core at 7.4, and read the script at 7.6 |
| 8 | `08-audio-presentation-and-release.md` | 4: 08a to 08d; you play the whole game at STOP 8.6 |
| 9 | `09-footprint-and-performance.md` | done 2026-09-22 (09a, 09b, 09c, exit); `npm run perf:footprint` is a standing gate; Craig's look is `D-004` |
| 10 | `10-agent-system.md` | done 2026-09-22 (10a seat-reviewed; 10b: CI check, evidence snapshots, pack test, retro script) |
| 11 | `11-token-efficiency.md` | 11a done 2026-09-22; 11b rides inside prompt 05 (measure the first packet review, quiet gates, Codex tier, retro) |

Prompts 02, 03 and 04 are not run; the new prompts cite their sections. The reasoning is in `PLAN_v2.md` (read once, not every session).

---

## F. A chat-only model (ChatGPT or Claude without the repo)

On the Mac, run `npm run agents:context -- --part NNx --with-files` and attach or paste `output/context/NNx.md`. Then paste block A from Step 2 on, replacing "Run these" with "I have run these; here are the results". The model cannot run gates: ask it for a design memo, a review or a patch, and have a repo agent apply and verify it. Its output still goes through a seat review and the ledger.

---

## G. One blind seat review (any tool)

```
You are the <seat> review seat for this repository. Read output/packets/<name>-<seat>.md first and only: it holds your seat brief, the format, the scope, the diff and the excerpts. Open another file only when a finding needs it. Never edit files. At most 5 tool calls in all. Reply with the review only, in that format, at most 600 words.
```

Build the packet first (`npm run agents:packet -- --seat <seat> --scope "<one line>" --diff <a..b> [--paths ...] [--images ...]`; it fails over 20K tokens). The risk tier picks the seats (`docs/prompts/seats/README.md`). Save each answer, with its `Tokens:` line, to `docs/prompts/reviews/<YYYY-MM-DD>-<slice>/<seat>.md`, then `npm run agents:reviews -- <that folder>`. A tool without the repo gets the packet file pasted instead.
