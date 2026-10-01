# Merged review: 2026-09-24-5.5-hero-sheets

Seats: art-director (FIX, mean 4.5), principal-engineer (SHIP, mean 4.0), qa-eval (FIX, mean 3.8)

| Severity | Seat | Finding | Evidence | Fix | Agreed |
| --- | --- | --- | --- | --- | --- |
| MAJOR | art-director | A stray red or magenta pixel recurs at a joint in unrelated frames (shoot_ground frame 1, hurt_heavy, getup), consistent with a key-colour remnant the defringe pass missed. | `output/art-review/hero.png` rows shoot_ground, hurt_heavy, getup | Clear it in the cut and confirm with a test that no magenta survives. |  |
| MAJOR | qa-eval | The note attributes scenario 24's failure to load on one isolated pass; a later run the note does not cite fails it again, and the slice touched the sword VFX, so pure load is not yet proven. | `output/smoke-runs/2026-09-24T19-35-48-431Z/summary.json` 24 pass; `output/smoke-runs/2026-09-24T19-42-14-177Z/summary.json` 24 fail | Rerun 24 isolated two or three times on a quiet machine; if it fails isolated, check the amber trail against the sword-VFX diff. |  |
| MINOR | art-director | The fin tip is plain armour blue; the brief puts the amber accent on the fin tip too. | `docs/art/hero-brief.md:29`, `assets/sprites/source/player/hero_turnaround_v1_2026-09-24_c2.png` | Add a 1 to 2px amber tip on the next regeneration. |  |
| MINOR | art-director | The in-game slash capture overlaps the parked enemy block, so the full arc cannot be judged clean. | `output/art-review/hero-motion.png` panel 4 | Capture one slash with nothing behind it. |  |
| MINOR | principal-engineer | Minimum frame counts are copied by hand and the drift guard compares group names only; raising a binding's `end` would let a short atlas pass coverage and the Preload check. | `src/assets/coverageRequirements.ts:12`, `:62` | Derive `minCount` from each binding's `end + 1` and delete the table. |  |
| MINOR | principal-engineer | `--append` merges by name and never clears a group: re-cutting `death` with fewer frames keeps the old tail frames. Today's cut script swaps one for one, so the atlas is not affected. | `scripts/sprites/hf_sheet_to_atlas.py:529-535` | Drop every existing frame of the groups the new `--anims` names. |  |
| MINOR | principal-engineer | Provenance names only the last sheet (atlas `meta.source`, manifest note say E1); the attribution file lists all five. | `assets/sprites/manifest.json:205` | Keep all sheets in `meta.source` when appending. |  |
| MINOR | principal-engineer | `decodePng` does not check the inflated length; a truncated IDAT decodes as transparent rows and the audit reports "empty" frames. | `src/assets/pngDecode.ts:113-114` | Throw when the length is not height * (width * 4 + 1). |  |
| MINOR | principal-engineer | The Python tests (`sprites:test`) are not in `test`, `sprites:validate` or `verify`. | `package.json:36` | Chain `sprites:test` into `sprites:validate`. |  |
| MINOR | principal-engineer | 63b1449 removes three `render_game_to_text` fields without touching TESTING.md; stale if TESTING.md named them. | `src/main.ts:243` | Grep TESTING.md for them and drop any hits. |  |
| MINOR | principal-engineer | The dev-only Preload throw has no test for its failure branch. | `src/scenes/Preload.ts:148` | Move the filter into a pure function with a unit test. |  |
| MINOR | qa-eval | Scenario 40 is red in the newest capture as well (0 for 3 across 19:28, 19:35, 19:42), so "not yet rerun green" understates it. | `output/smoke-runs/2026-09-24T19-42-14-177Z/summary.json` 40 fail | State the third run before the STOP. |  |

All reviews valid.

## Second pass (orchestrator, 2026-09-24, fixes in 4263bb2)

- art-director MAJOR (joint pixels): the specks were the grey undersuit rings pulled purple by the key (`(106, 88, 111)`, `(48, 31, 70)`, `(20, 0, 30)`), not raw magenta (a scan found no magenta). The cut maps purple-cast pixels onto the brief's undersuit greys or the outline (`has_magenta_cast`, `decast`, tested), and keeps the brief's amber and undersuit tones as fixed palette entries in both quantize passes: the median cut had merged the chest stripe and lamps into the blues. Result: 0 purple-cast pixels in the atlas; amber stripe, visor glint and joint lamps visible (`output/art-review/fringe-check.png`).
- art-director MINOR (fin tip): the C2 turnaround has no amber tip; carried to the next hero regeneration. MINOR (slash capture): the next capture pass takes one slash with nothing behind it.
- principal-engineer MINORs: minimum counts derived from the bindings (`getRequiredPlayerGroups`), `findMissingPlayerGroups` pure and tested and used by Preload, `--append` replaces whole groups, `meta.sources` lists all five sheets, the PNG decoder rejects truncated data, `sprites:validate` runs `sprites:test` (36 tests). TESTING.md never named the removed fields (grep: no hits).
- qa-eval MAJOR (scenario 24) and MINOR (scenario 40): the 19:42 run (load average 278) timed out both; they are rerun isolated on a quiet machine before the STOP and the result is in the ledger row.
