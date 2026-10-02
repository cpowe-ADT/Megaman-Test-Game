# docs/next: the work backlog for the next model

OMEGA Relay is v1.0-complete on `main` (prompts 01 to 13; the last merge 2026-10-01). Craig paused work until a markedly stronger model arrives. This folder is everything that model needs to pick up improvement work cheaply: 24 briefs from three blind seat reviews, grouped into three ready-to-run prompts.

## Read order (stop as soon as you have what you need)

1. `AGENTS.md`: the rules, the gates and the token discipline.
2. `progress.md`: the **Now** block only.
3. `docs/MAP.md`: every source file with a one-line purpose (`npm run agents:map` regenerates it).
4. This file, then the one prompt you are running and only the briefs it names.

## The prompts (run one at a time; each ends at a STOP for Craig)

| Prompt | Theme | Briefs | Needs from Craig |
| --- | --- | --- | --- |
| `prompt-A-feel-and-challenge.md` | combat pacing, stakes, enemies, weapon routes, difficulty | gameplay 1 to 8, story-ux 4 and 5 | play two fights and one stage; pick the death rule |
| `prompt-B-look-and-sound.md` | music, HUD, window fill, boss presence, backdrops, animation, SFX | look-and-sound 1 to 8 | look at four screens; listen |
| `prompt-C-first-five-minutes.md` | device-aware hints, tutorial, menus, the WREN beat, secrets, the first-boot check | story-ux 1, 2, 3, 6, 7, 8 | read the beat; tick the checklist |

Recommended order: C first (cheapest, and what a new player meets), then A, then B (B spends the most Higgsfield credits).

## The briefs

- `briefs-gameplay.md`: mechanics, combat and challenge (game-director seat).
- `briefs-look-and-sound.md`: graphics, animation, audio, presentation (art-director seat).
- `briefs-story-ux.md`: story, menus, onboarding (narrative-designer seat).

Each brief has Why (with evidence), Where (the files to open first), Done when (the test, smoke or capture that proves it), Size and Needs. Line numbers drift: grep the named symbol.

## Also open (from the ledger, not new work)

- Review halves waiting on Craig's play: `grep -n "PENDING" docs/prompts/EVAL_LEDGER.md`.
- `EVAL-P6-001` (the level v2 parity snapshot) is proposed for dropping; the route-data trim of `EVAL-P12-005` (JS 550 KB budget) waits for v1.1.
- The v1.1 backlog in `docs/prompts/handoff/13-polish-from-playtest.md` ("Inputs for v1.1"): character select, boss rush and time attack, New Game+, rumble, a string table, an attract demo.

## How to run a prompt cheaply

- One orchestrator merges and verifies; implementation goes to `game-implementer` lanes from task cards in `output/notes/` (a card names the files a lane owns, its gates and a result card of at most 400 words). Clear cards run well on a standard-tier model.
- Gates: `npm run -s gate -- agents:check test build`, then the smoke scenarios a card names; the full `npm run verify`, `npm run test:visual-sweep` and `npm run perf:footprint` once per merge wave. Rerun a timing failure alone before calling it real; a wait loop checks load with `pgrep -f '[n]ode scripts/smoke-test.mjs|[m]ission-visual-sweep|[p]erf/footprint.mjs'` (the brackets stop it matching itself).
- Craig plays a snapshot in `output/play-build` on port 4180 (`omega-relay-dist`, served to his home network); refresh it only after a green verify.
