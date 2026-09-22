# Plan v2: from "playable prototype with good art" to a finished game

- Status: canonical (supersedes the order and scope of prompts 02, 03 and 04; the charter `00` still rules)
- Written: 2026-09-22 by a consultant pass: four independent read-only audits (feel and camera; levels and enemies; audio and presentation; bosses, weapons, progression and story) against the code as of commit `ca9f149`
- Audience: Craig, and the worker model that executes prompts 05 to 08

## 1. Where the game is

Prompt 01 is complete and green. Since it closed, three things changed the picture:

- Art has a working pipeline. Every boss is original art generated with Higgsfield gpt_image_2 and cut by `scripts/sprites/hf_sheet_to_atlas.py`; the ripped Mega Man X boss skins are retired. The hero is still the ripped dev-only skin (repaired, but not ours).
- Bosses stand on the floor. `src/bosses/bossBodyAlignment.ts` aligns the body with the drawn feet; the sweep and smoke `39` guard it.
- Text is HD at any window size. `src/config/hdRender.ts` renders at device resolution with a top-left camera; smoke `40` guards it.

So the game now *looks* like it is further along than it *plays*. The audits agree on why. In order of damage:

| # | Finding | Evidence | Fixed by |
| --- | --- | --- | --- |
| 1 | Every stage is a two-screen corridor on one unbroken floor: no pits, no interior walls, no vertical, no mini-boss, no secret, no biome mechanic, checkpoints 150 to 250px apart. The stage vocabulary has four nouns (rectangle, floor spike, x-tween, checkpoint x). | `src/content/campaign.ts` `CAMPAIGN_STAGES` + `STAGE_EXTENSION_PATCHES`; `Game.ts` single ground rect; no `src/content/levels/`, no `src/mechanics/` | 06 |
| 2 | Movement fights itself. Arcade drag 900 runs against the motor every step: top speed about 205 not 220, air acceleration about 150 not 1050, the wall-jump push decays 240 to about 114 during the lockout. Jump is refused during a dash, so the series' core move (dash-jump) does not exist. No jump cut, no wall-kick grace, no ledge forgiveness, no camera look-ahead, death is an instant blink. | `Game.ts` `setDragX(900)`; `PlayerMotor.ts` jump gate and wall-jump branch; `Game.ts` `startFollow` and `killPlayer` | 05 |
| 3 | Boss fights are one template: two attacks plus one unlocked at 55% HP, weighted random, tell = tint and 4% squash, twelve authored hazard ids collapse to one floor-spike spawner, four "spread" ids are the same 3-fan, a watchdog fires an untelegraphed bullet if 1.5s pass without a spawn. No weakness reaction beyond 1.75x, no intro pose, boss destroyed the frame it dies. | `src/boss/framework/BossProjectileController.ts`, `bossDefinitionMapper.ts`, `BossController.ts` | 07 |
| 4 | Weapons are three straight shots, two lobs, a wave, a boomerang and a pierce; none charges or has an on-hit effect. Classic mode blocks every non-weakness special (0 damage, "BLOCKED"); Rook and Omega have no weakness profile so all eight specials are blocked on the final boss. | `src/content/weapons.ts`, `src/progression/seed.ts`, `progression/state.ts` `resolveBossDamageMultiplier` | 07 |
| 5 | Sound is three CC0 tracks over six cues (game over plays the stage-select track), loop seams up to 18.8dB, no crossfade, Kenney UI blips for combat, seven uncredited wavs, no per-weapon shot, no death, no jingle. Presentation is flat rectangles in system fonts: no logo, no READY, no WARNING, no weapon-get, no results, no beam-in, no boss explosion. | `src/audio/`, `assets/audio/`, `src/scenes/Title.ts`, `VictoryModal.ts`, `menuTheme.ts` | 08 |
| 6 | Enemies: twelve families sliced from CC0 packs, one animation template for all twelve (so `hover`, `spawn`, `turn`, `stunned` keys point at frames that do not exist), `charge` and `beam` fall through to melee, spawn triggers sit 56 to 180px ahead so enemies pop in on screen, retired markers never respawn, ledge probe tests screen width. | `src/enemy/` | 06 |
| 7 | Story is well-structured and validated (62 sequences, order-independent evidence rule, Iona's turn) but three authored beats never play: the Omega Core `finale_phase` lines (the offer, the refusal, WREN's only self-line), the eight `miniboss_callout` lines, and the three-act fortress. Stakes are told, never shown; every warden beat has the same two-line shape. | `src/scenes/game/StoryDirector.ts`, `docs/story/story-bible.md` | 06, 07 |
| 8 | Hero art is the ripped Mega Man X sheet (dev only). The public hero atlas is placeholder. | `assets/private/`, `assets/sprites/player/main/` | 05 |
| 9 | Save is one slot with no name. Craig asked for slots, a pilot name that feeds `{hero}`, and export/import. | `src/systems/Save.ts` | 05 |

Nothing here is a rewrite. The architecture (motor, boss framework, dialogue contract, automation hooks, HD renderer, art pipeline) holds. The work is content and feel, executed in the order that compounds: feel and hero first because the hero is on screen every second, then levels because they are the game, then boss depth and weapons because they are the reward, then sound and presentation because they are the wrapper.

## 2. The plan

Four prompts replace 02, 03 and 04. The charter `00-orchestrator-charter.md` is unchanged in its rules; its ground-truth table has an amendments block dated 2026-09-22.

| Prompt | File | Lane | Sessions | Craig plays |
| --- | --- | --- | --- | --- |
| 05 | `05-feel-hero-and-camera.md` | Movement and combat feel, camera, death and respawn, charge shot; original hero sheet through Higgsfield replacing the ripped skin; save slots with a pilot name | 3 | the tutorial with the new hero |
| 06 | `06-levels-mechanics-and-enemies.md` | Level format v2, pits, walls, vertical segments, mechanics library, mini-bosses, enemy behaviour and respawn, biome tilesets and backgrounds through Higgsfield, enemy re-skins, all ten stages to the route budget, Omega in three acts, content audit and lint, sweep v2 | 6 to 8 | Pyro Maw, then each batch |
| 07 | `07-bosses-weapons-and-story.md` | Per-hazard spawners, drawn telegraphs, phase kits, weakness reactions, intro and death presentation, weapon identities and the weakness table fix, portraits, dialogue presentation, the unplayed story beats | 3 to 4 | two pilot fights, then the Core |
| 08 | `08-audio-presentation-and-release.md` | Music per screen with clean loops, SFX set, crossfade and ducking, pixel font, title and Stage Select art, READY / WARNING / weapon-get / results / beam-in / boss explosion, gamepad and remap, public build, full-campaign automation, v1.0 | 3 | the whole game |

Prompt 02, 03 and 04 files stay on disk as specification appendices; each new prompt names the sections it reuses verbatim so nothing already reviewed is retyped.

## 3. Rules that changed since the charter was written

- Image generation is Higgsfield, not the OpenAI imagegen skill. Model `gpt_image_2`, 4:3, 1k, medium; sheets on `#FF00FF`; prompts and job ids recorded next to the source PNG; `docs/content/sprite-imagegen.md` section 2 is the runbook. About one credit per sheet.
- Boss atlases are 64x64 cells with feet on row 60; the body is aligned to the drawn feet at runtime, so a new sheet needs no hand-tuned offsets. Any new character family follows the same contract (`docs/architecture/boss-framework.md`, grounding section).
- Rendering is at device resolution. Never read `scene.scale.width/height` for layout; use `GAME_WIDTH`/`GAME_HEIGHT`. Text objects get HD resolution automatically through the patched factories. `docs/architecture/rendering.md`.
- Gates today: `npm run test` 256, `npm run build`, `npm run sprites:validate`, full smoke 51 scenarios, sweep 10 missions. `SMOKE_PORT` isolates parallel runs; never run two smoke suites against one `output/web-game-smoke`.
- The hero dev skin (ripped) exists only until prompt 05 lands the generated hero; then the private pack is deleted, not merely stripped.

## 4. How Craig runs it

Paste `START.md` section A with `N = 5` and file `05-feel-hero-and-camera.md`. Reply at STOPs as before. Between prompts, the section D checklist. Expected total: 15 to 18 sessions.
