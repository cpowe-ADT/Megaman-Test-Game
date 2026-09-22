# 05. Feel, Hero, and Camera

Active seats: Orchestrator, Game Director (feel owner), Principal Game Engineer, Art Director (hero), QA / Eval Lead.

Three sessions: `05a` (5.1 and 5.2), `05b` (5.3 and 5.4), `05c` (5.5 and 5.6).

| Part | Phase | Lead | Player-facing result | Evals | STOP asks Craig for |
| --- | --- | --- | --- | --- | --- |
| 05a | 5.1 Motor truth | Engineer | the motor owns velocity; dash-jump exists; wall kicks forgive | P5-001, P5-002 | play the tutorial: does it move like X? |
| 05a | 5.2 Combat feel | Director | hit-stop on contact, hurt lock, charge shot fires on press, death sequence | P5-003 | approve the death and hurt reads |
| 05b | 5.3 Camera | Engineer | deadzone, look-ahead, time-based lerp, vertical follow ready for 06 | P5-004 | approve |
| 05b | 5.4 Hero design | Art | an original hero turnaround, approved | P5-005 | pick the hero |
| 05c | 5.5 Hero sheets and the end of the ripped skin | Art, Engineer | the hero in game, every animation family, private pack deleted | P5-006, P5-007 | approve the hero in motion |
| 05c | 5.6 Profiles | Engineer | three save slots, pilot name, export and import | P5-008 | approve the flow |

## Entry conditions

- Charter pasted and its 2026-09-22 amendments read. `docs/prompts/handoff/01-foundation-and-story.md` is `COMPLETE`; `EVAL-ART-001` to `EVAL-ART-004` are `PASS` in the ledger. `docs/prompts/PLAN_v2.md` read.
- Read in full: `src/player/config.ts`, `src/player/PlayerMotor.ts`, `src/player/PlayerCombat.ts`, `src/player/NewPlayerRuntime.ts`, `src/player/PlayerStateMachine.ts`, `src/player/VfxSfxRouter.ts`, `src/player/PlayerBodyProfiles.ts`, `src/player/PlayerAtlasBindings.ts`, `src/player/AnimationManifest.ts`, `tests/player-motor.test.ts`, `tests/player-combat.test.ts`, the camera, hit-stop, `killPlayer` and `playerDeathAndRespawn` code in `src/scenes/Game.ts`, `src/config/hdRender.ts` (the camera is an `HdCamera`; `startFollow` and `setFollowOffset` keep their meaning), `src/config/renderPolicy.ts`, `src/systems/Save.ts`, `src/scenes/NewCampaignScene.ts`, `src/scenes/Title.ts`, `scripts/sprites/hf_sheet_to_atlas.py`, `scripts/sprites/build_private_megaman_override_pack.py` (the group list is the animation inventory), `scripts/sprites/private_megaman_override_spec.json`, `docs/content/sprite-imagegen.md`, `docs/architecture/rendering.md`.
- Run and paste: `npm run test` (256), `SMOKE_ONLY=13d-movement-feel,13c-unified-player-damage,9-checkpoint-respawn,24-ground-sword-enemy,40-hd-render npm run test:smoke`.

## Outcome of this prompt

The hero moves like an X-series hero: dash-jumps carry, wall kicks forgive, jumps cut, landings and deaths read, hits stop the world only when they connect, the camera leads. The hero is original art generated through Higgsfield, in every animation family the runtime names, and the ripped skin is gone from the repository. The player can name their pilot and keep three saves.

## Ground truth for this prompt (from the 2026-09-22 feel audit)

- Constants: run 220, accel 1700, decel 2100, airAccel 1050, gravity 800, terminal 550, jump -420 with 0.55 gravity while held, coyote 100ms, buffer 100ms, dash 320 for 140ms with a 420ms cooldown, wall slide cap 95, wall jump (240, -355) x1.28 with dash held, lockout 140ms. Hit: hp 8, i-frames 650ms, hitstun 170/280ms, knockback (165,-170) ground and (135,-130) air.
- Defects: `Game.ts` sets `setDragX(900)` on the player body while the motor only ever writes acceleration 0, so Arcade drag strips 15px/s per step (top speed about 205, air accel about 150, the wall-jump push halves during the lockout). `PlayerMotor` refuses a jump while dashing. Wall jump needs a raw press while already sliding. No jump cut. `hitstopRemainingFrames` in `PlayerCombat` is never assigned. A charge released inside the 120ms fire-rate window is dropped. `chargeCancelOnSlash` is only read inside `fireProjectile`. Slash activation fires hit-stop and a medium shake on every swing, contact or not. Knockback is overwritten the next frame because the motor never sees hitstun. Hit-stop counts render frames. `killPlayer` hides the body and respawns 600ms later; `player_death` exists in the manifest and never plays. Camera: `startFollow(player, false, 0.1, 0.1)`, no deadzone, no look-ahead. The 30/60fps motor tests do not model drag, which is why they cannot see the drag defect.

## Phase 5.1: Motor truth

Engineer leads; Director sets the targets; QA writes the failing tests first.

1. **Drag.** Remove the player body drag (or `setAllowDrag(false)`); the motor owns X. Test: a motor test whose mock applies Arcade drag after each update proves the old defect (red), then the fix (green): steady grounded vx at or above 219, airborne reaches 200 within 250ms. Smoke `13d-movement-feel` asserts `body.drag.x === 0`.
2. **Dash-jump.** Allow jump during dash; a `dashJumpCarry` flag holds |vx| at dash speed until landing, wall contact, or opposite input. Test: jump on dash frame 3 leaves the ground at 320 and holds at or above 300 at apex. `13d` gains a dash-jump trace.
3. **Dash shape.** `dashDurationMs` 140 to 280, cooldown 420 to 60, air dash zeroes vy and suspends gravity for its window. Tests: about 17 active frames at 60fps with equal distance at 30fps; air dash holds y within 2px.
4. **Wall kick.** `wallKickGraceMs` 80 and `wallStickMs` 60 in the movement config; keep `lastWallSide` plus a grace timer; wall jumps consume the jump buffer instead of the raw press; neutral and away input are allowed. Tests: release toward-wall input then jump 50ms later gives `jumpSource 'wall'` away from the wall; a jump buffered 60ms before wall contact fires.
5. **Jump cut and arc.** On release with vy below -140 set vy to -140; retune to jump -400 and gravity 1050 (full hop about 130px, short about 60px on the 252px view). Tests updated for the new thresholds plus "release at 80ms caps apex at 70px".
6. **Ledge forgiveness.** Ceiling corner nudge up to 3px, step-up over 1 to 3px lips, headroom check when the dash body returns to the stand body. Tests in `player-motor`.
7. **Crouch** slows to 0 when `crouchHeld` on the ground (today only the hitbox changes).
8. Frame-rate independence: hit-stop and camera lerp become time-based (fixed 60Hz physics already is). Test at 30/60/144.

Ledger: `EVAL-P5-001` (motor tests, including the drag red/green pair), `EVAL-P5-002` (`13d-movement-feel` extended: dash-jump trace, drag 0, second dash inside 100ms).

## Phase 5.2: Combat feel

Director leads; Engineer implements.

1. **Hit-stop on contact only.** Delete the per-swing hit-stop and shake in `PlayerCombat`; emit hit-stop 5/4 frames plus shake from the sword-hit path in `Game.ts` when a target is hit; 2 frames on pellet impact; boss weakness hits 8. Test: no hit-stop event on a whiff; `24-ground-sword-enemy` asserts hit-stop only after `recentHit`.
2. **Hurt lock and blink.** Pass `hitstunRemainingMs` into `motor.update`; skip run/jump/dash while stunned; alpha toggles every 4 frames while i-frames remain. Test: knockback holds vx for 170ms against opposite input; `13c-unified-player-damage` asserts |dx| at least 20px after a hit.
3. **Charge shot.** Fire the pellet on press and start charging in the same frame; release fires only at level 1 or above; a release inside the fire-rate window is deferred to `nextFireAt`, not dropped; the charge clock is accumulated `deltaMs` so it stops in hit-stop and dialogue; `chargeCancelOnSlash` honoured on the slash press. Tests in `player-combat`; smoke `3-enter-then-charge-shot`.
4. **Landing.** Squash 6 frames on a landing over 400px/s, dust puff, 80ms lag on a hard landing; light landings keep control.
5. **Death.** `killPlayer` plays `player_death`, freezes the world 250ms, bursts 8 orbs from the effects atlas with heavy shake, `player_death` sfx, fades, respawns at 900ms with a beam-in tween and a 600ms READY; the kill plane routes through it. Smoke `9-checkpoint-respawn` and `23-boss-room-respawn` assert a `player_death` sample and a respawn delay of at least 900ms.
6. **Shake budget.** Heavy 0.025 x 300ms is about 11px on a 448 view; cap heavy at 0.016, and never stack two shakes.

Ledger: `EVAL-P5-003` (combat tests plus `13c`, `24`, `9`, `23`, `3`).

```
### STOP 5.2: Play the tutorial
Show: dash-jump, wall-kick, jump-cut and death captures (6 PNGs) and the 13d trace before and after.
Ask Craig to play the tutorial. Question: does it move like X? Recommended: yes; keep tuning only from his notes.
```

## Phase 5.3: Camera

Engineer leads.

- `startFollow(player, true, 0.12, 0.08)`, `setDeadzone(64, 40)`, facing look-ahead through a tweened `setFollowOffset(-facing*40, 0)`, time-based lerp. `HdCamera` folds the view centre into the follow offset already; do not add a second centre.
- Vertical follow is ready for prompt 06: bounds can be taller than one screen; when they are, y follows with its own lerp and a 24px deadzone; below one screen, y is locked. A pure test on the bounds math.
- Boss room lock unchanged. Screen shake honours `Settings.screenShake` and `reducedFlashing` (which today has no consumer; give it one here for the charge ring).
- Smoke `18-extended-stage-scroll` asserts `camera.midPoint.x - player.x` at least 24 after one second running right and at most 4px vertical drift on flat ground.

Ledger: `EVAL-P5-004`.

## Phase 5.4: Hero design

Art leads. Read `docs/story/story-bible.md` (WREN: Recovery Unit 09, says less than it knows) and `src/content/identity.ts`.

1. Write `docs/art/hero-brief.md`: silhouette (must read at 48px: a helmet crest or fin, a buster arm, a scarf or cable), palette (three tones plus outline; primary from the relay identity, a warm accent), the one-word idea ("recovery", not "war"), what it must not resemble (no X, Zero or Mega Man silhouette: no round helmet gem, no shoulder pads of that shape).
2. Generate three turnarounds through Higgsfield (`gpt_image_2`, 1:1, 1k, medium): front, side, back on `#FF00FF`, "16-bit pixel art, SNES action platformer hero, crisp pixels, no anti-aliasing, dark outline". Save under `assets/sprites/source/player/hero_turnaround_v1_<date>_{a,b,c}.png` with prompts and job ids in a `.prompts.md`.
3. Contact sheet of the three at 4x in `output/art-review/hero-turnarounds.png`.

Ledger: `EVAL-P5-005` (brief plus three turnarounds; review row).

```
### STOP 5.4: Pick the hero
Show: the brief, the three turnarounds side by side.
Question for Craig: which one, and any change? Recommended: the one whose silhouette reads at 48px without the colour.
```

## Phase 5.5: Hero sheets, and the end of the ripped skin

Art and Engineer together.

1. **Inventory.** The animation families are the group list in `scripts/sprites/private_megaman_override_spec.json` (45 groups, about 94 frames) plus whatever `src/player/AnimationManifest.ts` and `PlayerAtlasBindings.ts` name. Write `docs/art/hero-sheets.md`: one row per sheet, which groups it holds, frames per group, the pose description per frame.
2. **Sheets.** Six to eight sheets, each a 6x4 grid on `#FF00FF`, generated with the approved turnaround as the reference image so the design holds across sheets (Higgsfield `gpt_image_2` with the turnaround passed as a reference; if the design drifts, Nano Banana Pro with the same reference). Sheet plan: locomotion (idle 4, turn 1, run 6, crouch 3, land 2, jump start/rise/apex/fall 6, wall slide 2, wall jump 1), dash (dash start/loop/end 6, air dash 3, dash shoot 2), shooting and charge (shoot ground/run/air 6, charge start/hold/release 8), hurt (hurt light/heavy, knockdown, getup, death 4, respawn 3), slash ground (5 directions x 4), slash air (5 x 4).
3. **Cutter.** Extend `scripts/sprites/hf_sheet_to_atlas.py`: `--category player`, 48px cells, `--baseline 44`, `--anims` accepting `group=start-end` over a 6x4 grid, output `assets/sprites/player/main/player_main.{png,atlas.json}` with frames `player_main/<group>/<index>`, and an `--append` mode so several sheets build one atlas. Unit-test the pure parts (grid split, baseline placement, name generation).
4. **Coverage.** `src/assets/coverageRequirements.ts` gains the hero groups and minimum counts; `npm run sprites:validate` fails on a missing group. `Preload` throws in dev on a missing group.
5. **Body profiles.** `PlayerBodyProfiles.ts` stand, crouch and dash boxes measured from the new frames (feet on row 44; the aligned-feet rule from the boss contract applies).
6. **Retire the ripped skin.** Delete `assets/private/`, `scripts/sprites/build_private_megaman_override_pack.py`, `private_megaman_override_spec.json`, the private manifest merge in `vite.config.ts`, `types/private-sprite-manifest.d.ts`, `IDENTITY.DEV_SKIN`, and every `MEGA MAN X` label. `git grep -i "mega man\|megaman\|mmx4\|spriters-resource"` prints only history notes in docs. The HUD shows `WREN`.
7. Sweep and smoke: `hero-frames-after.png` style contact sheet in `output/art-review/hero.png`; the full smoke; the sweep. Any frame under 22px tall or with a bounding box touching the cell edge fails a new audit in `sprites:validate`.

Ledger: `EVAL-P5-006` (coverage validator red on a removed group, then green; audit of every frame), `EVAL-P5-007` (full smoke and sweep with the generated hero; `git grep` proof the ripped material is gone).

```
### STOP 5.5: The hero in motion
Show: the hero contact sheet, three gameplay captures (run, dash-jump, slash), the git grep output.
Question for Craig: approve the hero? Recommended: approve; regenerate only sheets he names.
```

## Phase 5.6: Profiles

Engineer leads.

- `Save` gains profiles: `profiles.v1` with three slots, each holding today's `save.v1` shape plus `pilotName` (2 to 10 characters, letters, digits, space), `createdAt`, `lastPlayedAt`, `wardensCleared` (derived), `playTimeMs`. The active slot id is stored beside it. Legacy `save.v1` migrates into slot 1 with the name `WREN`.
- Title: `NEW GAME` opens a slot picker (three cards: name, wardens n/8, play time, difficulty; empty cards say `EMPTY`), then a name entry (on-screen grid navigated with the pad or typed; Enter confirms; default `WREN`), then the existing `NewCampaignScene` flow. `CONTINUE` resumes the active slot. Options gains `Export save` (downloads `omega-relay-<name>.json`) and `Import save` (file picker; validated through the transport code that already exists in `Save`).
- `{hero}` in dialogue resolves to the pilot name through the identity adapter; the HUD label follows it.
- Automation: `stageDebug.setProfile({ slot, pilotName })`; payload `profiles`. Smoke `41-profiles`: create a profile named `AVA`, play the tutorial to the first checkpoint, quit, continue from Title into the same slot, assert the HUD label and a briefing line contain `AVA`, export, clear, import, assert the slot returns.
- Tests: `tests/save-profiles.test.ts` (migration, three slots, name validation, export/import round trip).

Ledger: `EVAL-P5-008`.

```
### STOP 5.6: Profiles
Show: the slot picker, the name entry, a briefing line with the name, the export file.
Question for Craig: approve the flow? Recommended: yes.
```

## Exit Gate

- `EVAL-P5-001` to `EVAL-P5-008` `PASS` (P5-005 is Craig's pick).
- `npm run verify` and `npm run test:visual-sweep` green on the exit commit; result lines and artifact paths pasted.
- `assets/private/` does not exist; `git grep -i "mega man\|mmx4\|spriters-resource" -- src scripts assets` prints nothing.
- `wc -l src/scenes/Game.ts` at or below 3,700 (it is 3,700 now; the death sequence and camera code move to `src/scenes/game/`).
- `docs/prompts/handoff/05-feel-hero-and-camera.md` per the charter, with `Inputs for prompt 06`: the movement constants as tuned (levels are built against them), the hero cell contract, the camera vertical-follow API.

```
### STOP 5.EXIT
Show: the handoff, the ledger rows, the sweep contact sheet.
Question for Craig: start 06? Recommended: yes.
```
