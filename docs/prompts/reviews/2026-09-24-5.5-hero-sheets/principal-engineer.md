Seat: principal-engineer
Commit: 63b1449
Scope: 5.5 diff 48a85d7..63b1449 (hero cutter player path, PNG decoder and frame audit, coverage validator, Preload dev check, removal of the developer skin, dist check, smoke 4 and 40)
Artifacts opened: output/packets/2026-09-241949-principal-engineer.md, src/assets/pngDecode.ts, src/assets/playerFrameAudit.ts, scripts/sprites/audit-player-frames.mjs, src/assets/coverageRequirements.ts, scripts/sprites/hf_sheet_to_atlas.py:491-572, src/player/PlayerAtlasBindings.ts, git show 63b1449
Tokens: 65032

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| MINOR | Minimum frame counts are copied by hand and the drift guard compares group names only; raising a binding's `end` would let a short atlas pass coverage and the Preload check. | `src/assets/coverageRequirements.ts:12`, `:62` | Derive `minCount` from each binding's `end + 1` and delete the table. |
| MINOR | `--append` merges by name and never clears a group: re-cutting `death` with fewer frames keeps the old tail frames. Today's cut script swaps one for one, so the atlas is not affected. | `scripts/sprites/hf_sheet_to_atlas.py:529-535` | Drop every existing frame of the groups the new `--anims` names. |
| MINOR | Provenance names only the last sheet (atlas `meta.source`, manifest note say E1); the attribution file lists all five. | `assets/sprites/manifest.json:205` | Keep all sheets in `meta.source` when appending. |
| MINOR | `decodePng` does not check the inflated length; a truncated IDAT decodes as transparent rows and the audit reports "empty" frames. | `src/assets/pngDecode.ts:113-114` | Throw when the length is not height * (width * 4 + 1). |
| MINOR | The Python tests (`sprites:test`) are not in `test`, `sprites:validate` or `verify`. | `package.json:36` | Chain `sprites:test` into `sprites:validate`. |
| MINOR | 63b1449 removes three `render_game_to_text` fields without touching TESTING.md; stale if TESTING.md named them. | `src/main.ts:243` | Grep TESTING.md for them and drop any hits. |
| MINOR | The dev-only Preload throw has no test for its failure branch. | `src/scenes/Preload.ts:148` | Move the filter into a pure function with a unit test. |

Checked and correct: Paeth and Average filters and the RGBA8 guards; the audit exemptions and the edge rule (feet on row 46 leave row 47 empty); 96 frames in 46 groups; the dist exclusion and check; smoke 4; Game.ts one line changed; `keepHeld` exists and is documented.

| Rubric | Score |
| --- | --- |
| Correctness: no path produces a wrong result or crash | 4 |
| Tests: each new branch has a failing-first test or smoke assertion | 3 |
| Contracts: automation hooks, save format and scene flow unchanged or updated with docs | 4 |
| Size: Game.ts shrinks or holds; logic in typed modules | 5 |

Verdict: SHIP (no wrong behaviour in the shipped atlas or runtime; the MINORs harden the pipeline and its gates)
