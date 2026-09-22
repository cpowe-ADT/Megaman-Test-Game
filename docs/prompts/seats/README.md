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

The orchestrator picks two to four seats for the slice (always `qa-eval`; add the owners of what changed), gives each the same scope line, and saves each answer to `docs/prompts/reviews/<YYYY-MM-DD>-<slice>/<seat>.md`. Then:

```
npm run agents:reviews -- docs/prompts/reviews/<YYYY-MM-DD>-<slice>
```

That rejects any finding without evidence, writes `MERGED.md` (most severe first, AGREED when two seats found the same file), and appends each seat's scores to `docs/prompts/reviews/SCORES.md`. The orchestrator acts on every BLOCK and MAJOR, or records why not in the handoff; a STOP verdict becomes a row in `docs/prompts/DECISIONS.md`.

- **Claude Code**: launch the `game-*` subagents in one message so they run in parallel and blind (`.claude/agents/`). Each reads only its seat file and the scope.
- **Codex**: `scripts/agents/run-seats.sh <slice> "<scope>" qa-eval game-director ...` runs one `codex exec` per seat in a read-only sandbox, in parallel, into the reviews folder.
- **ChatGPT without the repo**: paste `npm run agents:context -- --part <part>` output, the seat file and `REVIEW_FORMAT.md` into a fresh chat per seat.

## Token rules for seats

A seat reads its seat file, the format, the scope and what its "Reads first" line names; nothing else unless a finding needs it. It answers in at most 600 words. Reviews are cheap because they are narrow: a seat that reads the whole repo is a bug in the scope line, not diligence.
