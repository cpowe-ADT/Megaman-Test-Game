# 13. Polish from the playtest

Active seats:
- Orchestrator.
- Principal Game Engineer: one writer per file set; lanes run from task cards.
- Game Director, Art Director, Narrative Designer, Audio Director, QA / Eval Lead.

Craig played the build on 2026-09-30 and listed what is left (D-023, his words verbatim in `docs/prompts/DECISIONS.md`). He asked for each note to be analysed, broken down step by step, and turned into this prompt. Every note below was reproduced or traced first (part 13a). The findings, with file:line, are in `output/notes/13a/`, and the probes and captures in `output/probes/13a/`.

Design choices take the recommended default under D-018's delegation and are marked **Decision**; Craig can overrule any of them at a STOP. This prompt also absorbs what is left of prompt 12 (part 13h), so it is the one plan to v1.0.

| Part | Craig's note | What changes for the player | Evals |
| --- | --- | --- | --- |
| 13a | "analyse them each" | nothing; the findings | P13-001 |
| 13b | no music on the first level; graphics disappear at the top; shots broken in boss fights | music plays; no voids; shots leave the gun and fly true | P13-002 to P13-005, P6-015 |
| 13c | the first boss a bit easier | Rook is a fair first fight; difficulty settings mean something | P13-006, P6-012 |
| 13d | charge the boss weapons; they finish too fast | every weapon charges with its own animation; shots cross the screen; bars last | P13-007, P13-008 |
| 13e | cans, hearts, lives art and placement | new pickup art; pickups sit on a surface or float by design | P13-009, P13-010, P6-014 (pickups) |
| 13f | correct graphics for each | every stage checked where it was never captured | P13-011 |
| 13g | lines when you get back; an animation for each weapon; a boss intro on entering | the classic beats | P13-012 to P13-014 |
| 13h | polish, testing, documentation, playtest | automation, the campaign smoke, docs, v1.0 | P6-013, P8-008 to P8-010, P6-019, P12-005 |

## Entry conditions

- `npm run agents:check` passes. The tree is committed.
- The full verify is green on the head the lanes branch from.
- Read this file, `progress.md` Now, and the 13a note for your part. Nothing else until the task needs it.

## How the parts run

- At most three implementation lanes at once. One writer per file set. `Game.ts` gains calls only and shrinks.
- Waves:
  - Wave 1: 13b fixes, 13c balance, 13e pickups.
  - Wave 2: 13d weapons, after 13b's shot contract lands, because both touch `src/projectiles/`. Then 13g beats, after 13d, so the weapon demo shows the charged form.
  - Wave 3: 13h.
- Art comes from Higgsfield `gpt_image_2`, is cut by the scripts in `scripts/sprites/`, and is credited before runtime use (AGENTS.md rule 11). Sound is procedural (`scripts/audio/`) with recorded seeds; Higgsfield audio is barred.
- Every lane ends with its gates pasted, its captures opened and described, and a result card. The orchestrator verifies on the shared tree, writes the ledger rows and pushes.

## Part 13a: Reproduce and find the cause (done)

Four investigations on 102b003:
- music and backdrop: `13a-music-backdrop.md`
- combat: `13a-combat.md`
- pickups and beats: `13a-pickups-beats.md`
- art audit: `13a-art-audit.md`

`EVAL-P13-001`.

## Part 13b: The bugs Craig hit

1. **Music on the first level.** It did not reproduce. On a fresh production build the tutorial track decodes and plays about 50 ms after entry, with the intro on or off (`13a-music-backdrop.md`).
   - The likely cause is the process, not the game:
     - Port 4180 served the main checkout's `dist/` live, and every gate rebuilt it while Craig played.
     - A stage track fetched mid-rebuild fails to decode, and it retries only on a key press (`MusicTrackLoader.ts:48`, `PlaceholderAudioService.ts:517`).
   - Done by the orchestrator: Craig now plays a snapshot (`output/play-build`, the `omega-relay-dist` launch config), refreshed only after a green verify.
   - In the game, retry a failed music load after 2 s instead of waiting for a key.
   - Every track is Ogg only. Check Safari's decode; if it fails, add an AAC copy chosen by `canPlayType`, with a footprint row if it grows `dist/`.
   - Add a smoke assertion on the production build (`SMOKE_SERVER=preview`): stage music is playing within 1 s of READY ending, in the tutorial and in Heat Works, with the stage intro on and off.
   - `EVAL-P13-002`.
2. **Graphics disappearing at the top of the stage.**
   - The tutorial's wall-kick shaft has walls to y -30 but no `verticalSegments` entry, so `stageVerticalTop()` is 0 and `StageBackdrop` never extends the sky and parallax upward (`campaign.ts:578`, `StageBackdrop.ts:70-88`). Wire the segment.
   - In every other tall room, a flat band shows at world y 0 to about 60 when the camera rises.
     - Cause: the upward copy of each parallax layer stops at y 0, while the first-screen copy starts at `layer.y` (60 for far, 108 for mid), and the accent band restarts at 58 (`StageBackdrop.ts:78-88`). Reproduced in `output/probes/13a/backdrop-pyro_maw-top.png` and `backdrop-gale_vixen-mid.png`.
     - Fix, leaving the first screen unchanged: `height: Math.min(layer.y, GAMEPLAY_VIEWPORT_TOP) - top`, and the band drawn to `GAMEPLAY_VIEWPORT_TOP`.
   - Then prove every other tall room. The sweep only ever captured ground level. Capture the top of every vertical segment in every stage, plus the Gale boss shaft and the Mire and Glacier boss rooms. Open the captures and fix any gap in the backdrop, tiles or walls.
   - Add a pure test: for every stage, the backdrop's covered range contains the camera's vertical bounds.
   - `EVAL-P13-003`.
3. **The shot contract.** Craig: shots should "come from the character's gun and follow a line and interact properly". The findings in `13a-combat.md` list what breaks today.
   1. One muzzle point per pose (stand, run, jump, fall, dash, wall slide), shared by the flash and the shot. `MUZZLE_ANCHORS` (`heroCombatVisuals.ts:80`) is the source, and `WeaponRuntime.ts:155` spawns there.
      - Test: each pose's shot spawn equals its flash anchor.
   2. The pellet outruns the dash: at least 360 px/s (the dash is about 320).
   3. Charged shots survive their own size. Hitboxes are fitted to the art; lv4 is 112 px tall today. A player shot is removed only when it leaves the view sideways, never because its box touches the world's top or bottom edge (`Game.ts:684-692`). A lv3 and a lv4 fired from the floor reach the boss and deal their damage.
   4. Hit-stop pauses shot age with the world (`ProjectileSystem.ts:207`).
   5. Hit-stop fires only when damage lands.
   6. On the boss:
      - a hit shows an impact spark at the contact point;
      - a shot the boss is immune to deflects (a tink and a bounce up and back) instead of vanishing;
      - find and fix the pellet that touched the boss and did no damage.
   7. Straight shots fly until they leave the view. Lobs and boomerangs finish their arcs.
   8. The hit contract of prompt 06 phase 6.0 (`EVAL-P6-015`): one `resolveHurtbox` for sword, shots and the debug overlay.
   9. Smoke `65-shot-contract` captures a boss room with a shot fired standing, jumping, dashing, lv3 and lv4. It asserts:
      - each shot starts within 2 px of its flash;
      - a straight shot's y holds within 1 px;
      - every hit deals damage and shows a spark.
   - `EVAL-P13-004`.
4. **The Glacier route flake.** `58-glacier-route` failed alone twice on the release lane with different errors, one a TypeError, and flaked once on the enemy lane. Find the cause, in the game or the script, and fix it. It must pass five runs in a row. `EVAL-P13-005`.

## Part 13c: The first boss, and difficulty

1. **Rook** (the tutorial's boss, the first fight every player meets) is now 100 HP against an 8 HP hero: about 62 s with the buster, with 2 damage per touch.
   - **Decision:**
     - HP: 100 → 60.
     - Contact and Hop damage: 2 → 1.
     - Guard Shot wind-up / cooldown: 260/480 → 400/700; in phase two, 200/380 → 300/560.
     - Stomp wind-up: 420 → 520.
     - Phase two at 40% with ×1.1 speed.
     - Desperation at 15% with ×1.15 speed.
   - Every wind-up stays at or above 300 ms.
   - Heat Works' Pyro Maw (120 HP, the first warden in campaign order) stays a clear step up.
   - Profile tests. An automated fight records the time to kill with the buster only and with charged shots only; target 30 to 40 s.
   - `EVAL-P13-006`.
2. **Difficulty and death economy.** Prompt 06 phase 6.8 (`EVAL-P6-012`): Assist, Normal and Veteran tables for boss HP and damage and for enemy damage. No setting changes boss numbers today.
   - The warden curve: each warden's time to kill and damage per minute sit on a ramp from Rook, measured, not guessed.
   - Telemetry and heatmaps as 6.8 writes them.
   - Any segment over three deaths per run on Normal is retuned.

## Part 13d: Weapons that last and charge

1. **Energy.** Today specials give 5 to 12 shots per bar. **Decision:**
   - Every special gets a 28-unit bar. Each shot costs 1 (light), 2 (medium) or 4 (heavy), so a bar holds 7 to 28 shots.
   - The per-weapon table is written in `docs/design/` with the reason for each cost.
   - `EVAL-P13-007`, together with range: straight weapon shots cross the view (the buster goes 187 px of a 448 px view today), and lobs, boomerangs and streams finish their own motion.
2. **Charged specials.** Only Thunder Spike charges today, and its charge only scales it. **Decision:** every weapon charges, with one charged form:
   - It is its own move, not a bigger copy.
   - It costs double.
   - It deals ×3 on bosses (plain specials deal ×2).
   - The hero plays a release pose, and the charge aura takes the weapon's colour while charging.
   - Flame Serpent streams while held, so its charge is a release after the stream.
   - The lane writes the table (weapon, charged form, cost, damage, art) from each weapon's element and current behaviour (`src/weapons/`). For example: Frost Shatter's charge is an ice block that slides and breaks into shards; Quake Knuckle's is a floor shockwave both ways.
   - Art: nine 4-frame charged effect sheets from Higgsfield, cut and credited.
   - Tests per weapon (cost, damage, lifetime), and a smoke capture of each charged form.
   - `EVAL-P13-008`.

## Part 13e: Pickups, art and placement

1. **Art.** One pickup atlas today, drawn at 0.6 scale. The sub tank reads as a lantern, the capsule is the colour of weapon energy, the extra life is a dark blob and is never used, and the glow frames jump 10 px in width.
   - A v2 sheet from Higgsfield, at native size:
     - health small and large;
     - weapon energy small and large, a different shape from health;
     - an extra life (the hero's helmet);
     - a heart tank;
     - a sub tank that reads as a lettered can;
     - a capsule that is not cyan;
     - the bonus drop.
   - Glow frames keep the same width.
   - The HUD pips and icons match.
   - `EVAL-P13-009`.
2. **Placement.** All 34 placed pickups float 6 to 10 px above their surface. Two in the tutorial float 30 and 82 px over nothing.
   - Anchors gain `rest: 'ground' | 'float'`. Grounded pickups sit exactly on the surface and do not bob; floating ones are marked and bob.
   - Fix all 34.
   - The probe (`output/probes/13a/placement-audit.ts`) becomes a unit test and a `content:lint` rule.
   - The pickup code leaves `Game.ts` as `PickupSystem` (prompt 06 phase 6.0, `EVAL-P6-014` in part).
   - `EVAL-P13-010`.
3. **Extra lives. Decision:** they exist.
   - One per warden stage, placed on a detour.
   - A 2% enemy drop on Normal, and 4% on Assist.
   - The HUD `LIVES` counter already shows them.

## Part 13f: The right graphics everywhere

The art audit (`13a-art-audit.md`) found every district drawn and distinct, with one BLOCK, the tutorial shaft (13b.2).
- Its unverified list goes through 13b.2's captures.
- At the end, a blind art-director review of the new art (pickups, charged effects, the boss intro) and of the top-of-segment captures.
- Optional: 0 to 2 regenerations if the districts' skylines read too alike. **Decision:** skip unless Craig asks.
- `EVAL-P13-011`.

## Part 13g: The beats Craig asked for

1. **A boss intro on entering a stage.** It plays between the Stage Select confirm and the stage:
   - a band across the middle;
   - the boss's 4-frame `intro` pose at 2x (every atlas has it);
   - the name typed letter by letter with a blip, with the district and element beneath;
   - a new procedural sting, credited.
   
   It lasts about 3 s. Enter skips it, and `?storyIntro=off` skips it. The scene loads only that boss's atlas and evicts it on leave. The door WARNING stays. The automation contract changes with `scripts/` and `TESTING.md`. `EVAL-P13-012`.
2. **A demo for each new weapon.** It follows the WEAPON GET card:
   - The hero, on a plain band, fires the new weapon at a target dummy, then its charged form.
   - The name and a one-line use are typed out.
   - It lasts 4 to 5 s. Enter skips it.
   - It runs the real projectile code from scripted input and grants nothing (rule 8).
   - A real `weapon_get` sting replaces the borrowed `pickup_bonus`.
   
   `EVAL-P13-013`.
3. **Lines on the return.** After every warden clear, a skippable exchange of 2 to 3 lines plays on the way back to Stage Select, about what happened in that district. Iona and WREN speak; the warden's `district_restored` line is extended.
   - It plays before any milestone line. Today only clears 1, 4 and 8 speak.
   - Eight debriefs, written to the story bible and the text-pass rules, added to `docs/story/script.md` and `dialogue.v2.json`.
   - Order-independent: no line assumes which other wardens are down.
   - A narrative seat reviews them.
   - `EVAL-P13-014`.

## Part 13h: Test, document, playtest, release

1. **Automation** (prompt 06 phase 6.9, `EVAL-P6-013`):
   - `SMOKE_TIER=fast` runs in `verify` and on pull requests; `full` runs nightly and on tags.
   - `content:audit` and `content:lint` run in `verify`, with the pickup rest rule and the backdrop cover rule.
   - Sweep v2 assertions, and the top-of-segment captures.
2. **The full-campaign smoke `47-full-campaign`.** It runs twice, once skipping and once reading every line, from New Campaign to the ending (`EVAL-P8-008`).
3. **Leftovers from prompt 12:**
   - the tutorial's secret and crumble group (`EVAL-P6-019`);
   - the camera-relative enemy spawn and respawn tests of prompt 06 phase 6.1 (`EVAL-P6-006`);
   - `StageBuilder` and `EnemyRuntime` out of `Game.ts` (`EVAL-P6-014`);
   - the stage route data out of the JS bundle, lowering `jsGzipKB` (`EVAL-P12-005`).
4. **Documentation.**
   - README: how to play, controls, and the Higgsfield and CC0 disclosure.
   - `ARCHITECTURE.md`: the new modules.
   - `TESTING.md`: tiers and the new scenarios.
   - A `CHANGELOG.md` v1.0 entry.
   - The handoffs for 05 to 08, 12 and 13.
   - `progress.md`.
5. **The playtest sheet** (`EVAL-P8-009`): one line per stage, boss, weapon and beat, for Craig to tick while he plays.

```
### STOP 13: Play the whole game
Show: the campaign smoke, the sweep contact sheets, the boss intro, the weapon demo, the charged weapons, the new pickups.
Question for Craig: play it through with the sheet; ship v1.0 to GitHub Pages and itch.io? Recommended: fix what the sheet reports, then tag v1.0.0.
```

## Exit Gate

- Every `EVAL-P13` row is PASS. Every `EVAL-P5` to `EVAL-P8` and `EVAL-P12` row is PASS or dropped by Craig in `DECISIONS.md`; `EVAL-P6-001` (the level v2 parity snapshot) is proposed for dropping, because the stages were rebuilt through the stage registry instead of converted.
- `npm run verify`, `npm run verify:public`, the sweep and `perf:footprint` are green on the exit commit. `47-full-campaign` plays start to ending.
- Craig has played the whole game with the sheet.
