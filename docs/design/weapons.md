# Weapons that last, charge and demo themselves

Part 13d (`EVAL-P13-007`, `EVAL-P13-008`, `EVAL-P13-013`). Craig, 2026-09-30: "you should also be able to
charge the boss weapons you get and different animation comes out, and also they should last a bit longer
they finish too fast", and "an animation explaining the new weapon for each that you got." The facts this
lane started from (every weapon's old max, cost, shots and range) are in
`output/notes/13a/13a-combat.md` items 2 and 3.

## Energy and range (`EVAL-P13-007`)

Every special's bar is 28 units, like the classic Mega Man reference (7 to 28 shots per bar at 1 to 4 a
shot). A straight shot (`projectile.style: 'standard'`) flies until it leaves the camera view
(`ProjectileSystem.ts`'s existing 13b.3 check) instead of a fixed timer, so `lifetimeMs` is a generous
backstop (2000 ms, the Buster's own) for those five; a lob, boomerang or wave (Flame Serpent's stream)
finishes its own motion and keeps its authored timer. Arc Slash keeps its own cost, forced to 0 in
`firePlayerShot.ts` -- the tutorial saber has no cycling slot or bar to spend from.

| Weapon | Tier | Cost | Shots/bar | Lifetime / range | Reason |
| --- | --- | --- | --- | --- | --- |
| Arc Slash | -- | 0 (forced) | unlimited | 600 ms, own motion | The tutorial dash-saber, not a cycled special; no bar. |
| Aero Darts | Light | 1 | 28 | to view edge | Three weak (2 dmg) darts per trigger; a full bar spams 28 triggers, matching its harassment role. |
| Magcut Disc | Light | 1 | 28 | 1400 ms, own motion | Hits going out and coming back (two contacts) and pulls drops; the double hit and utility balance the low cost. |
| Hydro Lance | Medium | 2 | 14 | to view edge | Pierces two foes and aims up or down; the extra pierce and tilt earn the middle cost. |
| Acid Glob | Medium | 2 | 14 | 1200 ms, own motion | Sticks and ticks three more hits over time (6 total); delayed damage costs more than one hit. |
| Flame Serpent | Medium | 2 (tap); sustain 1/flame | 14 taps, or one tap plus stream | 520 ms, own motion | A DOT weapon meant to be held; the tap sits in the middle so the stream (its real spend) carries the cost. |
| Thunder Spike | Heavy | 4 | 7 | to view edge | A bolt that already arcs to one foe; the highest single-target threat of the uncharged specials. |
| Quake Knuckle | Heavy | 4 | 7 | 1400 ms, own motion | An area floor quake that can hit several grounded foes at once. |
| Frost Shatter | Heavy | 4 | 7 | to view edge | Freezes a foe solid for 1.5 s; crowd control costs the top tier. |

A save holding an old (pre-rebalance) energy value loads clamped to the weapon's new max
(`clampWeaponEnergySnapshot`, `src/content/weapons.ts`, called from `RunState.applyActiveRunSnapshot`) --
Flame Serpent's bar was 40, so a save with 38 banked now loads at 28, not over-full.

## Charged specials (`EVAL-P13-008`)

Every special but Flame Serpent gets `allowCharge: true` and shares the Buster's own charge timer
(`PLAYER_GAMEPLAY_CONFIG.blaster.chargeThresholdsMs`, already generic across weapons via
`Game.ts`'s `canChargeProjectile`) -- "two charge levels like the Buster" reads as *not yet full* versus
*full*: releasing before chargeLevel 4 (1020 ms held, the Buster's own top level) fires the plain shot
(levels 1 to 3 still show the charge aura, tinted to the weapon's colour, but pay off nothing extra yet);
releasing at chargeLevel 4 fires the charged form, its own move with its own `ProjectileDefinition`, not
the plain shot rescaled. It costs twice the plain shot and deals triple on a boss instead of double
(`bossDamageScale`, `src/scenes/game/combatRules.ts`). Flame Serpent streams while held (its own hold
mechanic, `WeaponRuntime.updateStream`), so it keeps `allowCharge: false` to avoid racing the generic
timer; holding the stream past `WEAPON_TUNING.flameStream.chargeReadyFrames` (60, about 1 s) and releasing
fires Inferno Coil instead of just stopping. Arc Slash does not charge: it has no energy bank (cost forced
to 0) and is not a cycled weapon, so there is nothing to spend twice.

The hero's release pose (`player_charge_release_lv<N>`) is already generic across every weapon --
`PlayerCombat`'s `chargeReleased`/`chargeLevel` never check which weapon is equipped, so it plays for a
charged special exactly as it does for the Buster, with no change needed there.

| Weapon | Charged form | Cost | Damage | Boss scale | Art | From the plain shot |
| --- | --- | --- | --- | --- | --- | --- |
| Flame Serpent | Inferno Coil | 4 (2x2) | 6 | x3 | `flame_serpent_charged` | A released fireball (`standard`, not `wave`): one big burst instead of a stream, a bigger burn puddle (dmg 2, 10 pierce, 1.4 s). |
| Hydro Lance | Tidal Surge | 4 (2x2) | 5 | x3 | `hydro_lance_charged` | Same aim tilt, pierce 2 -> 6: punches through a room instead of two foes. |
| Thunder Spike | Storm Burst | 8 (2x4) | 6 | x3 | `thunder_spike_charged` | Chain jumps 1 -> 5, radius 104 -> 150px: an area chain instead of one arc. |
| Quake Knuckle | Fault Line | 8 (2x4) | 6 | x3 | `quake_knuckle_charged` | Two lobs, forward and back, instead of one (`bothWays`). |
| Magcut Disc | Twin Cutter | 2 (2x1) | 5 | x3 | `magcut_disc_charged` | Pierce 1 -> 3, flies farther before returning (340/320ms vs 260/290). |
| Acid Glob | Corrosive Burst | 4 (2x2) | 5 | x3 | `acid_glob_charged` | Corrode ticks 3 -> 5, each for 2 instead of 1 (6 -> 10 total). |
| Aero Darts | Cyclone Volley | 2 (2x1) | 3/dart | x3 | `aero_darts_charged` | Five darts in a wider spread instead of three, two bounces instead of one. |
| Frost Shatter | Glacial Ram | 8 (2x4) | 6 | x3 | `frost_shatter_charged` | Pierce 0 -> 2, freeze 1.5s -> 2.5s: hits and locks down more than one foe. |

Art: nine 4-frame sheets were planned (per-weapon charged flight art, plus a shared charged-impact burst);
built as eight (`weapons_charged_v1`, one per weapon above) after checking `impactFxKey` has no renderer
anywhere in the codebase today (`grep` found no consumer outside its own type), so a ninth, unused asset
was dropped rather than generated for its own sake. Generated with Higgsfield `gpt_image_2` on flat
magenta, two sheets of four groups (`charged_a.png`, `charged_b.png`), cut with
`scripts/sprites/cut_vfx_sheet.py --spec scripts/sprites/weapons_charged_v1.json`; credited in
`assets/sprites/source/free-source-attribution.v1.json`, `assets/sprites/manifest.v1.json` and
`assets/sprites/source/vfx/hf_v1/vfx_hf_v1.prompts.md`.

## Weapon demo (`EVAL-P13-013`)

After the WEAPON GET card (for a warden special only -- an item or upgrade goes straight to the results),
a third `StageClearCards` card plays: a plain band, the hero fires the weapon at a target dummy, then its
charged form, while the name and a one-line use type out (the dialogue typewriter,
`src/ui/dialogueTypewriter.ts`). 4.6 s total (inside the 4 to 5 s band), Enter skips at any point, and it
auto-advances to the results on its own timer otherwise. The script (`src/ui/beats/weaponDemo.ts`) calls
the real `resolvePlayerShot` with scripted input (chargeLevel 0, then 4) so the demo can never drift from
actual play; it is sandboxed by construction -- a pure call that never reaches the live `ProjectileSystem`,
spends real energy or grants anything (rule 8). Automation reads its phase through
`render_game_to_text().victory.weaponDemo` (and, as the task named it, the same object at the top level,
`render_game_to_text().weaponDemo`): `{weaponId, name, phase, elapsedMs, chargedMoveName}`. The sting is a
new procedural `weapon_get` (seed 12305, `assets/audio/sfx/generated/sfx-params.json`), replacing the
borrowed `pickup_bonus`.
