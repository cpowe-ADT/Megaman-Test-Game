# Stage Design Briefs

- Status: working; the blueprint prompt 02 builds from. Approved at STOP 1.6, revised per stage at the prompt-02 batch STOPs.
- Owner: Game Director and Narrative Designer; Level Designer executes; Engineer builds mechanics.
- Sources: `docs/story/story-bible.md` (fiction), `docs/story/script.md` (the exact lines each beat plays), `docs/working/enemy-ecology-and-variant-plan.md` (resident enemy pairs), `docs/prompts/02-levels-and-gameplay.md` (route budget, mechanics library, mini-boss archetypes, level format v2).
- Every warden stage meets the route budget: floor 10 screens of route before the boss room, target 12 to 14; 4 checkpoints; 1 mini-boss; 2 secrets (`heart_tank` and `sub_tank` locations behind a gate); 2 or more biome mechanics; at least one vertical or walled segment; 18 or more enemy placements across 5 or more types; 8 or more hazards; 3 or more pits where falling is allowed; obstacle density 60% or more.
- Enemy names below are runtime `typeKey`s with the `enemy_` prefix. "Signature" and "familiar" follow the enemy plan; the rest of a palette is ordinary families.
- `difficultyRating` values match `src/content/campaign.ts` today (1, 1, 2, 2, 2, 2, 3, 3, 3, 3); no change needed.

## Shared conventions

- Segment kinds and rhythm: `intro` (safe landing, one idle mechanic) -> `teach` (the mechanic alone) -> `escalate` (mechanic plus enemies; checkpoint 2 and the radio beat) -> `secret` (optional room) -> `midboss` (locked room; checkpoint 3 after) -> `master` (both mechanics together; the vertical or walled segment) -> `preboss` (breather, last full-speed lane, checkpoint 4, gate) -> boss room.
- Checkpoint 1 is the start; checkpoint 2 carries `radioSequenceId` for the stage's `radio` sequence; the mini-boss gate lock plays the `miniboss_callout`.
- Secrets are visible before they are reachable. The `capsule` location sits on the main route in a small alcove; `heart_tank` and `sub_tank` are the two audited secrets.
- First encounters get a safe observation pocket; no blind drop lands on a hazard; every hazard telegraphs or has a safe first instance.
- Enemy placements are camera-relative (spawn trigger at least 448px before the enemy) and obey the respawn rule in prompt 02.

## Tutorial: Drill Hangar (`tutorial_sentinel`)

- Fiction: Sentinel Rook's intake course, built to teach recovery units their feet. Tonight Rook is running it under a live override; the course still works because nobody told it to stop.
- Route: 6 screens, five teach segments (move and jump share the first), checkpoints at start and mid (the radio checkpoint), one secret, Rook unchanged.
- Verbs in order, one per segment, each with a radio signpost line, a safe target, and a `room_lock` with `requiredInput` that opens when the verb was used: move and jump (a gap and a step); dash (a low gap that only a dash clears); wall jump (two wall faces, `walls`, a 2-screen-tall shaft: the tutorial's vertical segment); charge shot (an `enemy_armored_bot` that only a charged shot breaks, behind a lock); saber (a `breakable_wall` opened with three slashes; the secret `capsule` room with `hp_refill_large` behind it).
- Mechanics: none beyond the teach locks and one `crumble_group` on the last screen so the player has met it before Pyro.
- Enemies (8 placements, 3 to 4 types): `enemy_gunner_bot` (2, first threat, one at a time), `enemy_shock_hopper` (2), `enemy_drone` (2, only after the wall-jump segment), `enemy_shield_drone` (1) and `enemy_rocket_bot` (1) on the approach.
- Mini-boss: none.
- Secrets: 1 (`capsule`, saber wall). `pickup_bonus` on the route.
- Radio beat: after the dash segment (checkpoint 2).
- Boss room: `flat`. Rook's hop, shot and stomp read best on a flat floor.
- Difficulty rating: 1.

## Heat Works (`pyro_maw`) — the pilot stage

- Fiction: the smelter crucible. Furnace vents open onto the residential lines; slag is rising in the lower works because the sorting lanes were shut. Three thousand people in the heat-side towers behind sealed doors.
- Route: 12 screens. `intro` 1, `teach` 2, `escalate` 2, `secret` 1, `midboss` 1, `master` 3 (`verticalScreens: 2`), `preboss` 2. Checkpoints: start, after teach, after mid-boss, before the gate.
- Mechanics: timed flame `vent` hazards on a shared phase (arm flash 300ms; the stage's rhythm) and `rising_liquid` slag in the master climb; `crumble_group` platforms over slag; one `breakable_wall` into the secret room.
- Master segment: a two-screen-tall climb between two wall faces (`walls`) with one-way platforms; slag rises from the floor over 14 seconds after the trigger; vents on the ledges; wall jumps are the fast route.
- Enemies (18 or more, 5 types): signature `enemy_mine_bot` (slag scavenger: retracts feelers when a vent arms, one lobbed shot, long recovery), familiar `enemy_rocket_bot` (slag loader on ledges), `enemy_slicer_bot` patrols on the sorting lanes, `enemy_armored_bot` guarding the pre-boss breather, `enemy_drone` over the climb.
- Mini-boss: `custodian_walker`, Pyro skin (heat-scarred plating), in a locked catwalk room; it stomps before it turns.
- Secrets: `heart_tank` behind a `dash_jump` gap in the teach segment (visible from the platform below); `sub_tank` location (`hp_refill_large` in Classic) in the `secret` room behind a `breakable_wall` off the escalate segment. `capsule` (`chip_buster_plus`) in an alcove at the top of the climb.
- Radio beat: checkpoint 2, top of the escalate segment.
- Boss room: `pillars` with two vent hazards from the combat profile; Pyro's dash-through uses the pillars.
- Difficulty rating: 1. First clear 5 to 6 minutes.

## Water District (`tide_reaver`)

- Fiction: the reservoir lock. A full reservoir above, flooding wards below, every gate shut. Service stations with valve attendants still checking gauges.
- Route: 12 screens. `intro` 1, `teach` 2, `escalate` 2, `midboss` 1, `secret` 1, `master` 3 (`verticalScreens: 2`), `preboss` 2.
- Mechanics: `current_zone` (water pushes; jump height minus 20% inside) and water-level gates: `rising_liquid` used in reverse as a falling water line that opens a passage on a timer (the `room_lock` variant with a timed exit); one-way vertical platforms (existing); `carry` platforms on the intake conveyor.
- Master segment: a flooded shaft two screens tall; the water level cycles, the current pushes toward the intake, and the exit gate only opens when the level is low. Wall faces on both sides.
- Enemies (18, 5 types): signature `enemy_drone` (ballast drone: braces against the current, then one fixed lane), familiar `enemy_gunner_bot` (valve attendant: plants feet, one horizontal lane), `enemy_fly_trap` on the intake grates, `enemy_shock_hopper` on the dry catwalks, `enemy_mine_bot` in the shallows.
- Mini-boss: `relay_turret_nest`, Tide skin (a rotating shield with one gap per beat), over the intake.
- Secrets: `heart_tank` behind a `wall_jump` climb in the escalate segment; `sub_tank` (a real Sub Tank in Classic) in a room only reachable while the water is high (swim up, then the gate).
- `capsule` (`chip_quick_charge`) on the route after the mid-boss.
- Radio beat: checkpoint 2.
- Boss room: `pits` with shallow water channels; Tide's hover-and-lance reads over water.
- Difficulty rating: 2.

## Power District (`volt_hopper`)

- Fiction: the conduit lattice, a switching yard cycling the grid on purpose. Every moving rail is live. Couriers dock batteries at inert sockets between blackouts.
- Route: 13 screens. `intro` 1, `teach` 2, `escalate` 3, `midboss` 1, `secret` 1, `master` 3, `preboss` 2.
- Mechanics: `timed_rail_group` (electrified rails on a shared phase with the arming flash) and lane-swapping `carry` platforms that trade positions on a timer; `conveyor` strips in the yard.
- Master segment: a walled corridor (`walls` as insulated pylons) where the rails and the swapping platforms share one phase, so the player crosses on the beat; the fastest mobility test before Gale.
- Enemies (19, 5 types): signature `enemy_shock_hopper` (relay tender: one announced hop to a marked landing), familiar `enemy_shield_drone` (battery courier: petals open for one shot), `enemy_laser_eye` on the pylons, `enemy_bouncer` in the yard, `enemy_rocket_bot` at the yard exit.
- Mini-boss: `sentry_twins`, Volt skin (paired coil units that alternate), on the rails.
- Secrets: `heart_tank` above the yard behind a `wall_jump`; `sub_tank` location (`hp_refill_large` in Classic) behind a `breakable_wall` in the secret room.
- `capsule` (`armor_legs`, the air dash) on the route after the mid-boss; the master segment is easier with it and possible without.
- Radio beat: checkpoint 2.
- Boss room: `rails` (two floor rails on the boss's phase; Volt's static orbs arc between them).
- Difficulty rating: 2.

## Structural Works (`basalt_titan`)

- Fiction: the quarry shaft holding three towers on temporary supports. Compactors keep tamping rubble; the crews were sealed out.
- Route: 12 screens. `intro` 1, `teach` 2, `escalate` 2, `secret` 1, `midboss` 1, `master` 3 (`verticalScreens: 2`), `preboss` 2.
- Mechanics: `crumble_group` footing (shakes 350ms after landing) and `rockfall` hazards from the ceiling with a shadow telegraph; `room_lock` waves at the support pads.
- Master segment: a two-screen-tall descent down the shaft on crumbling ledges with rockfall; the solid path is marked with load lines. Wall faces are the shaft walls.
- Enemies (18, 5 types): signature `enemy_bouncer` (compactor: one high fixed landing), familiar `enemy_armored_bot` (hauler guarding a flat work pad), `enemy_laser_eye` on the supports, `enemy_mine_bot` in the rubble, `enemy_shock_hopper` on the pads.
- Mini-boss: `custodian_walker`, Basalt skin (quarry plating), in the shaft; it crumbles the side it stomps.
- Secrets: `heart_tank` behind a `breakable_wall` in the secret room; `sub_tank` (real Sub Tank) at the bottom of a crumbling side shaft reached by a `dash_jump` before the ledges fall.
- `capsule` (`armor_body`) on the route before the mid-boss.
- Radio beat: checkpoint 2.
- Boss room: `pits` (two rubble pits Basalt's quake knuckle shockwaves cross).
- Difficulty rating: 2.

## Transit Security (`ferro_blade`)

- Fiction: the forge catwalks over the sealed rail lines. Belts move sheet metal through trimming and inspection; nothing has moved food in two days.
- Route: 13 screens. `intro` 1, `teach` 2, `escalate` 3, `midboss` 1, `secret` 1, `master` 3, `preboss` 2.
- Mechanics: `conveyor` belts (carry actors and projectiles) and magnet lifts (`wind_zone` variant: a vertical force column that lifts the player off a belt); saw-blade `hazards` on the belts; `room_lock` at the inspection station.
- Master segment: belts in opposite directions stacked in a walled trimming hall (`walls` are the machine housings); the player rides, lifts, and drops between lanes while a disc lane sweeps.
- Enemies (19, 6 types): signature `enemy_slicer_bot` (sheet trimmer: a short straight advance, one cut), familiar `enemy_laser_eye` (inspector: one announced lane), `enemy_gunner_bot`, `enemy_shield_drone`, `enemy_bouncer`, `enemy_frost_turret` as a coolant nozzle.
- Mini-boss: `relay_turret_nest`, Ferro skin, over the belts; the belts carry the player into its lane if they stand still.
- Secrets: `heart_tank` at the end of a belt that runs the wrong way (`dash_jump` against the belt); `sub_tank` location (`hp_refill_large` in Classic) behind a `breakable_wall` in the inspection station.
- `capsule` (`armor_arms`, charge tier 4) on the route after the mid-boss.
- Radio beat: checkpoint 2.
- Boss room: `rails` (two conveyor strips on the floor; Ferro's returning disc and dash use them).
- Difficulty rating: 2.

## Medicine District (`mire_wraith`)

- Fiction: the waste labyrinth under the locked clinics. Filters overflow; synthetic growth feeds on the backlog. The antidote is in quarantine crates the player walks past.
- Route: 12 screens. `intro` 1, `teach` 2, `escalate` 2, `midboss` 1, `secret` 1, `master` 3 (`verticalScreens: 2`), `preboss` 2.
- Mechanics: acid pools and `rising_liquid` acid triggered by filter switches, `crumble_group` walkways over acid, and `breakable_wall` secrets. No fog room (cut on review).
- Master segment: a two-screen-tall filter tower; tripping the filter at the bottom starts the acid rising; the player climbs crumbling walkways and wall faces before it arrives.
- Enemies (18, 5 types): signature `enemy_mine_bot` (spore forager: feeding retreat, one lob), familiar `enemy_fly_trap` (filter growth: one snap at a visible reach), `enemy_shield_drone`, `enemy_drone`, `enemy_bouncer`.
- Mini-boss: `drill_serpent`, Mire skin, emerging from the walls; the crack is the tell.
- Secrets: `heart_tank` in a crate room behind a `breakable_wall`; `sub_tank` (real Sub Tank) below the acid line, reached by a `dash_jump` before the acid rises.
- `capsule` (`chip_weapon_plus`) on the route in the escalate segment.
- Radio beat: checkpoint 2.
- Boss room: `pits` with acid channels; Mire's glob puddles pool in them.
- Difficulty rating: 3.

## Weather District (`gale_vixen`)

- Fiction: the sky dock and the wind relays. The storm corridor is over the city; drones perch on wind vanes and inspect cables between gusts.
- Route: 13 screens. `intro` 1, `teach` 2, `escalate` 3, `midboss` 1, `secret` 1, `master` 3 (`verticalScreens: 2`), `preboss` 2.
- Mechanics: timed `wind_zone` gusts (streak telegraph; airborne player pushed hardest) and `carry` moving platforms; long jumps over open air (`allowFallOff`); the hardest mobility test.
- Master segment: a two-screen-tall ascent up the relay mast on carried platforms while gusts fire on a timer; the gust is the way across the widest gaps. Wall faces on the mast.
- Enemies (18, 5 types): signature `enemy_drone` (split-wing: banks with the gust, attacks in the lull), familiar `enemy_gunner_bot` (anchored, waits for a safe lane), `enemy_rocket_bot`, `enemy_laser_eye` on the vanes, `enemy_shield_drone`, `enemy_shock_hopper` on the dock.
- Mini-boss: `sentry_twins`, Gale skin (glider units), in the wind; the gust carries the player past the charging one.
- Secrets: `heart_tank` on a platform only reachable by riding a gust (`dash_jump` timed with the wind); `sub_tank` location (`hp_refill_large` in Classic) behind a `breakable_wall` in the dock office.
- `capsule` (`chip_speedster`) on the route after the mid-boss.
- Radio beat: checkpoint 2.
- Boss room: `flat` with two moving platforms from the combat profile; Gale's dive needs open air.
- Difficulty rating: 3.

## Public Archives (`glacier_ronin`)

- Fiction: the cryo keep, the cold store of every record the city keeps, sealed with the verdict already inside. Scrapers deice the access lanes; pressure nozzles vent frost.
- Route: 12 screens. `intro` 1, `teach` 2, `escalate` 2, `secret` 1, `midboss` 1, `master` 3, `preboss` 2.
- Mechanics: `ice_floor` (friction x0.35, dash +40%) and `icicle` hazards from cracked ceilings with a shadow telegraph; `crumble_group` ice shelves; precise jumps over frozen pits.
- Master segment: a walled ice gallery (`walls` are the record stacks) where the floor is ice, the ceiling drops icicles on a rhythm, and the frost turrets cover fixed lanes; the player slides between safe patches.
- Enemies (18, 6 types): signature `enemy_armored_bot` (ice scraper: one controlled skid, braking recovery), familiar `enemy_frost_turret` (pressure nozzle: fixed two-shot pattern), `enemy_gunner_bot`, `enemy_drone`, `enemy_laser_eye`, `enemy_bouncer`, `enemy_mine_bot`.
- Mini-boss: `custodian_walker`, Glacier skin, on the ice; it slides further than it means to.
- Secrets: `heart_tank` behind a `breakable_wall` of ice in the secret room; `sub_tank` (real Sub Tank) across a frozen pit that only a `dash_jump` on ice clears.
- `capsule` (`armor_helmet`) on the route before the mid-boss.
- Radio beat: checkpoint 2.
- Boss room: `flat` ice floor (Glacier's shard volleys and the player's slide are the fight).
- Difficulty rating: 3.

## Central Core (`omega_fortress`)

- Fiction: the fortress exposed by eight linked relays. OMEGA broadcasts the crisis at the player the whole way up. Repair pods and dispatch lights reuse the work systems recovered across the districts.
- Act 1, Relay Spire (10 screens, `verticalScreens: 2` in two segments): a remix of at least four biome mechanics in ascending difficulty (timed rails, conveyors, wind gusts, rising liquid), the OMEGA radio intrusion at checkpoint 2, checkpoint at the end of the act.
- Act 2, Warden Archive: a hub room with eight doors labeled by element only; each door starts a rematch against that warden's full profile at phase-2 cadence, `maxHp x0.7`, no weakness hint; after each clear the hub spawns a large HP and full weapon-energy refill; doors open in any order; a checkpoint after every second clear saves sub-tank state. Target 90 seconds per rematch, 12 minutes for the act; cut HP again if the full-campaign smoke exceeds 15 minutes.
- Act 3, the Core (4 screens): a short approach with the finale mechanics (rails and gusts), then `omega_core` unchanged in profile with the three `finale_phase` lines on its phase transitions.
- Enemies (30, 8 types): the approved signature variants reused (slag scavenger, ballast drone, relay tender, compactor, sheet trimmer, spore forager, split-wing drone, ice scraper) plus `enemy_armored_bot` haulers and `enemy_laser_eye` inspectors; no new rules.
- Mini-boss: none; the gauntlet is the mini-boss.
- Secrets: none. Pickups: refills at act boundaries.
- Radio beat: Act 1 checkpoint 2 (Iona, then OMEGA).
- Boss room: Omega's authored room from the combat profile.
- Difficulty rating: 3. Whole fortress 15 minutes on Normal.

## Open questions for STOP 1.6

1. Tide's `sub_tank` room is reachable only while the water is high. Confirm a timed-water secret is acceptable, or move it behind a `breakable_wall`.
2. Volt's `armor_legs` capsule sits before the master segment so the air dash helps there. Confirm the capsule stays on the main route (not a secret).
3. Ferro uses `enemy_frost_turret` as a coolant nozzle; confirm reusing a cold-themed family in a forge is fine with a palette variant.
