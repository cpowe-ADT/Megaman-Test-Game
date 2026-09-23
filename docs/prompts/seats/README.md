# Seats: the personas that build and review this game

One file per seat, shared by every tool. The charter (`docs/prompts/00-orchestrator-charter.md` section 3) says which seats a prompt activates; these files say what each seat owns, never does, reads first, and scores. One seat writes code (the Principal Game Engineer); every other seat reviews.

| Seat file | Persona | Claude subagent | Typical slices |
| --- | --- | --- | --- |
| `orchestrator.md` | Orchestrator / Producer | (the main session) | every slice |
| `principal-engineer.md` | Principal Game Engineer; reviews others' diffs | `game-code-reviewer` | every code slice |
| `game-director.md` | Game Director, incl. combat | `game-director` | feel, camera, combat, UI |
| `level-designer.md` | Level Designer | `game-level-designer` | prompt 06 stages |
| `narrative-designer.md` | Narrative Designer (Narrative Lead) | `game-narrative-designer` | dialogue, story surfaces |
| `art-director.md` | Art Director / Animator | `game-art-director` | sheets, portraits, render look |
| `audio-director.md` | Audio Director | `game-audio-director` | cues, SFX, music memory |
| `qa-eval.md` | QA / Eval Lead | `game-qa-eval` | every STOP |
| `release-engineer.md` | Release Engineer | `game-release-engineer` | build, CI, deploy |
| `performance-engineer.md` | Performance Engineer | `game-performance-engineer` | loading, audio, render loop |
| `docs-steward.md` | Docs Steward / Context Engineer | `game-docs-steward` | any doc, log or prompt change |

## Running a blind seat review

The orchestrator sets the slice's risk tier, builds one packet per seat (`npm run agents:packet`, at most 20K tokens), gives each seat the same scope line and its packet, and saves each answer, with the `Tokens:` line from the tool's usage, to `docs/prompts/reviews/<YYYY-MM-DD>-<slice>/<seat>.md`.

| Tier | When | Seats |
| --- | --- | --- |
| R0 | docs, logs, comments, formatting; no behaviour change | none; `npm run agents:check` and `npm run test` |
| R1 | one narrow code or content change with a test that proves it | `qa-eval` (standard model) |
| R2 | a player-facing change, a new module, or anything a gate cannot see | `qa-eval` and the owner of what changed |
| R3 | a phase exit, a STOP, a release, a save or data format, or anything irreversible | `qa-eval`, the owner, and `game-code-reviewer` (strong model) |

A reviewer that finds a BLOCK raises the tier for the fix's re-review. Then:

```
npm run agents:reviews -- docs/prompts/reviews/<YYYY-MM-DD>-<slice>
```

That rejects any finding without evidence, writes `MERGED.md` (most severe first, AGREED when two seats found the same file), and appends each seat's scores to `docs/prompts/reviews/SCORES.md`. The orchestrator acts on every BLOCK and MAJOR, or records why not in the handoff; a STOP verdict becomes a row in `docs/prompts/DECISIONS.md`.

- **Claude Code**: launch the `game-*` subagents in one message so they run in parallel and blind (`.claude/agents/`). Each reads only its seat file and the scope.
- **Codex**: `scripts/agents/run-seats.sh <slice> "<scope>" qa-eval game-director ...` runs one `codex exec` per seat in a read-only sandbox, in parallel, into the reviews folder.
- **ChatGPT without the repo**: paste `npm run agents:context -- --part <part>` output, the seat file and `REVIEW_FORMAT.md` into a fresh chat per seat.

## Decision panels

When Craig delegates a decision, the row in `docs/prompts/DECISIONS.md` names its panel. Each panel seat answers in `DECISION_FORMAT.md` (one verdict per decision, with evidence) into `docs/prompts/reviews/<YYYY-MM-DD>-decisions/<seat>.md`; `npm run agents:decisions -- <that folder>` validates the files and tallies the verdicts per decision. A REJECT is work: fix, reshoot the evidence, and send it back to the same seat, as D-001 was on 2026-09-22.

## Which tool runs the seats

Claude Code subagents are the default and the only proven runner (the 10a review and the 2026-09-22 panels). `scripts/agents/run-seats.sh` runs the same briefs through Codex (`--format decision` for panels) once `npm i -g @openai/codex` has fixed the CLI and one run has merged green (`D-012`).

## Token rules for seats

A seat reads its packet, and nothing else unless a finding needs it; without a packet, its seat file, the format, the scope and its "Reads first" line. It answers in at most 600 words (400 on a panel), reading the packet in its first call and using at most 5 tool calls in all (10 for `game-code-reviewer`): each call re-sends everything read so far. Reviews are cheap because they are narrow: a seat that reads the whole repo is a bug in the scope line, not diligence.

## Model tiers

| Tier | Claude Code | Codex / ChatGPT | Used for |
| --- | --- | --- | --- |
| fast | `haiku` (`game-runner`) | the smallest current model (`codex exec -m <fast model>`) | gates, smoke, footprint, evidence snapshots, log rotation: work with a command that says pass or fail |
| standard | `sonnet` (`game-implementer`, every seat but one) | the default model | settled slices, R1 and R2 reviews, decision panels |
| strong | `opus` (`game-code-reviewer`, the main session) | the strongest model with high reasoning | design, STOPs, R3 reviews, fixing what a cheaper tier got wrong |

The tier is set in each `.claude/agents/*.md` `model:` line. The main session plans and checks; it hands mechanical and well-specified work down with a task card (`BRIEF_FORMAT.md`) and reviews the result card, not the worker's transcript.
