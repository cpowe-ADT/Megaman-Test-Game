# Stage Design Briefs

- Status: working; the blueprint prompt 06 builds from (prompt 02 is superseded). Approved by the level-designer panel with conditions on 2026-09-22 (`D-001`, `docs/prompts/reviews/2026-09-22-decisions/level-designer.md`), revised per stage at the prompt-06 batch STOPs.
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
- Enemies (8 placements, 5 types): `enemy_gunner_bot` (2, first threat, one at a time), `enemy_shock_hopper` (2), `enemy_drone` (2, only after the wall-jump segment), `enemy_shield_drone` (1) and `enemy_rocket_bot` (1) on the approach.
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
- Built (12d, EVAL-P6-010; layout table in `src/content/stages/tideReaver.ts`, rules in `tests/tide-reaver-stage.test.ts`, route smoke `55-tide-route`): 12 screens in the order above; checkpoints at the start, after the teach lock (the radio), past the intake room's gate, and before the boss door. Five pits (64 to 160px), each with a still pool; ten spike strips. Currents: with the hero over the first pit, against it everywhere after (toward the intake). Water-level gates (`src/mechanics/waterLevelGate.ts`): the teach sluice, the float basin, the shaft (exit sluice on the right wall, open only while the water holds low) and the lower lock. Carry belts over the widest pit and a belt feeding the intake housing. 19 placements: drone 5, gunner 4, fly trap 3, shock hopper 3, mine 3, and the nest.
- Changed from this brief, and why:
  - The water is not `rising_liquid` (a kill plane) run backwards but its own mechanic: the level cycles on the stage clock (hold high, fall, hold low, rise) and under the surface the hero floats up like a lift. That is what makes "swim up" work, and a water line that kills would read wrong in a reservoir.
  - The current's jump penalty applies to wall kicks as well as jumps (the launch speed scales by the square root of 0.8, so the rise is 80%); a kick is a jump, and the shaft's current sits on the climb.
  - The sub tank room has no second gate: its ledge is 148px over the floor and only the high-water float reaches it. A gate that shut when the water fell would trap the hero inside until the next high.
  - The heart room and the float basin are two screens tall, as Heat Works' heart room is: outside a tall room the actor ceiling is y 90, and the heart ledge (y 60) and the sub tank ledge (y 88) stand above it. Each high water line sits 28-30px over the ledge it floats the hero onto, since a floating hero bobs about 6px round the line.
  - The shaft is entered through the intake opening under its left wall, and that wall's bottom hangs over a floor jump's head, so its outer face cannot start a wall-kick climb to the sub tank.
  - Not built in this lane: the nest's Tide skin (the rotating shield is `src/enemy/` work) and the `pits` boss room with water channels; both keep their current forms, as Heat Works kept its boss room.

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
- Built (12d, EVAL-P6-010; layout table in `src/content/stages/voltHopper.ts`, rules in `tests/volt-hopper-stage.test.ts`, route smoke `56-volt-route`): 13 screens in the order above; checkpoints at the start, at the escalate's start (the radio), past the rail room's gate, and before the boss door. The stage beat is 3s: rails quiet 1.4s (arming the last 0.3s), arcing 1.6s; the swap platforms hold 1.4s and slide 1.6s on the same clock. Rails: an idle one in the intro, two teach bays with insulated sockets, the escalate bay, two pairs in the rail room, the master, the full-speed lane. Swap pairs (`src/mechanics/laneSwap.ts`): the ferry over the widest pit (a plain jump clears it too), one in the walled escalate bay, one per master bay. Three yard belts (two against the hero, one with him). Four pits (64 to 160px), each over pit rails; five spike strips. 20 placements: shock hopper 5, shield drone 4, laser eye 4 (three over pylons), bouncer 3, rocket bot 3, and the twins.
- Master as built: four insulated pylons (walls, tops at y 200) and three 264px bays of rails between them, one swap pair per bay (low lane level with the pylon tops, high lane 36px above). A platform waits beside each pylon at every hold; the one by the near pylon slides to the far one while the rails arc, so the hero boards in the quiet and rides the arc (low, high, low lane). Outside a tall room the actor ceiling (y 90) caps a jump from a pylon top at 88px: a dash jump from a pylon falls short of the next pylon (smoke 56: x 4184 against the pylon face at 4240) and lands on the far station's platform only while one waits there. So the master is possible without the air dash: the ride, or a dash jump onto the far platform.
- Changed from this brief, and why:
  - The swap platforms are their own mechanic (`laneSwap.ts`, a typed module with unit tests), not the tweened `motion` platforms: a tween runs on its own time and does not carry the hero, and the master's rule (the platforms slide exactly while the rails arc) needs both on the stage clock. A rider inherits the slide speed as a belt carry through the motor environment; the pair blinks through the rails' 300ms arming tell.
  - Pit floors carry rails with no damage box (`live: false` on a rail group): a live rail there would knock a falling hero back up out of the pit, and the fall is what kills.
  - The capsule stands on the secret chamber's bulkhead, on the route past the mid-boss gate, rather than in a separate alcove.
  - "Easier with the air dash" is not shown on the pylons: an air dash at a dash jump's apex ends the dash jump's carry, so it does not carry the jump further (smoke 56 records both jumps in `evidence.pylonJumps`); it lengthens a plain running jump and helps a rider who fell off recover. Open for the play STOP.
  - Not built in this lane: the `rails` boss room (two floor rails on the boss's phase) keeps its current form, as Heat Works and the Water District kept theirs.

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
- Built (12d, EVAL-P6-010; layout table in `src/content/stages/basaltTitan.ts`, rules in `tests/basalt-titan-stage.test.ts`, route smoke `57-basalt-route`): 12 screens in the order above; checkpoints at the start, after the gallery (the radio), past the shaft head's gate, and before the boss door. Five pits (64 to 128px); eight spike strips; ten rockfall spawners (a shadow grows on the landing through the 400ms dust puff and the fall). Crumbles shake 350ms and return in 2.5s; load lines (an amber rail with ticks) mark the ledges that hold. Pads A (escalate) and B (after the shaft) are wave rooms: hoppers and a hauler, then a compactor and one more dropping in. 20 streamed placements (mine 5, hopper 5, bouncer 3, laser eye 3, hauler 3, the walker) and 4 in the pads' second waves.
- Changed from this brief, and why:
  - The master's three screens are a climb and a descent: a descent needs height, and outside a tall room the ceiling is y 90, so the headframe (Heat Works' measured climb, without the slag) takes the hero up and the shaft brings it down, each two screens tall.
  - The side shaft has no solid face: the motor takes a wall kick off any solid face (`body.blocked`), so a casing would let a kick climb skip the dash jump. It is one-way ledges across an open chasm; no plain jump reaches it, and a dash jump only from a ledge that crumbles under the take-off (the launch beside the landing, or the first crumbling ledge). The outer wall over it hangs above every jump's head.
  - The walker's stomp crumbles only the shaft head's slabs (a `stomp` crumble group; the hero standing on them does not): the side it faces within 176px on its floor. Other crumble groups ignore stomps, so Heat Works is unchanged.
  - `room_lock` waves are new in `src/mechanics/roomLock.ts`: the first wave is the room's `defeatMarkers`, later waves spawn inside the locked room when the one before is gone, and a wave room plays no mini-boss callout. Timer-mode rockfall counts only while the hero is in its room (`activeFromX`, `activeToX`), so the shaft's rain neither falls nor sounds elsewhere.
  - Not built in this lane: the walker's Basalt skin is the 12c palette swap as it stands, and the `pits` boss room keeps its current form, as Heat Works and the Water District kept theirs.

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
- Built (12d, EVAL-P6-010; layout table in `src/content/stages/ferroBlade.ts`, rules in `tests/ferro-blade-stage.test.ts`, route smoke `59-ferro-route`): 13 screens in the order above; checkpoints at the start, at the escalate's start (the radio), past the inspection station's gate, and before the boss door. Sixteen belts (both directions; a blade strip at the downstream end of seven, so a hero who stands still is carried into it), five magnet lifts, four pits (64 to 112px) over the sealed rail lines, seven blade strips and twelve cutting torches. The wrong-way belt is a shelf 140px over the heart room's floor running back toward its step (20px/s); the heart ledge is 292px past its far end, level with it. A dash jump against the belt (the belt's speed rides the whole flight) covers about 308px and lands from a takeoff in the belt's last 24px or its coyote window (smoke 59: 10px to spare from 14px before the end); a plain jump covers about 246 and falls short even from the coyote window (`tests/ferro-blade-stage.test.ts`). The inspection station is the mid-boss room: the Ferro nest on its housing at the end of a belt that feeds it; the office wall past it hides the sub tank, and the capsule stands on the office bulkhead. 20 placements: slicer bot 5, laser eye 3 (two over the hall's housings), gunner bot 3, shield drone 3, bouncer 3, coolant nozzle (`enemy_frost_turret`) 2, and the nest.
- Master as built: four machine housings (walls, tops at y 168) and three bays. In each bay the upper belt leaves the housing top and runs with the hero (70px/s) over a floor belt running back (60px/s) into blades at the bay's left wall; past the upper belt's end is a drop gap, then a magnet lift against the next housing's face. The cutter lane: torches on each upper belt fire in turn left to right (500ms each, 250ms apart, every 2.4s), so a rider goes just behind the sweep or drops to the floor belt, walks back into the lift and is lifted onto the next housing (smoke 59 does both, unhurt).
- Changed from this brief, and why:
  - Belts carry shots on every stage (`conveyorShotCarryAt` in `src/mechanics/conveyor.ts`, moved in `MotionMechanicsAdapter`): a shot whose centre is over a belt and at most 32px above its surface moves with the belt on top of its own velocity (a buster shot fired from a belt, smoke 59: exactly the belt's 1px per frame). The Water and Power District belts carry low shots too.
  - The disc lane is a cutter lane of timed cutting torches (`vent` hazards on staggered phases): there is no saw-disc art and no moving-hazard mechanic. The saw blades are the stage atlas's blade strips (always on, 1 HP). A moving disc is open for the art pass.
  - Each magnet lift stands against the face the hero is walked or carried into (the press housing, the shear housing, each hall housing): a hero running through a free-standing 40px column rose only about 20px (smoke 59's first run).
  - The heart room is two screens tall: outside a tall room the actor ceiling (y 90) would put any ledge a floor jump cannot reach out of the hero's standing room too.
  - Pits show the sealed rail lines at their floors (rails with `live: false`, as in the Power District; a live one would knock a falling hero back out of the pit).
  - Not built in this lane: the `rails` boss room (two conveyor strips) keeps its current form, as the other rebuilt stages kept theirs.

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
- Built (12d, `EVAL-P6-010`, `src/content/stages/mireWraith.ts`, layout table in its header; `tests/mire-wraith-stage.test.ts`, smoke `54-mire-route`). What changed from this brief, and why:
  - The filter switch is a floor plate in the hatch between the tower's pre-chamber and its shaft, and the hatch wall runs to the tower's top, so every way up trips it and the rise cannot be skipped. `rising_liquid` gained `switchBox` (the rise starts when the hero's body touches it, not at `triggerX`; the respawn re-arms it).
  - "Before the acid rises" means before the trip: the sub tank ledge is in the pre-chamber, left of the switch, 296px from the launch ledge and 152px over the floor (a dash jump; a miss lands on the safe floor). The acid floods the pre-chamber too and covers that ledge about 6s after the trip. The tower is therefore 760px wide (pre-chamber and shaft) and two screens tall; the camera scrolls both ways inside it. The shaft keeps Heat Works' measured ledges with two turned to crumbles, plus two more crumbles; its hatch face and right wall take wall kicks, the pre-chamber's faces do not.
  - "Acid pools" are the six acid pits (drawn flat in the acid's chartreuse, as is the rising acid; tinting the slag art left it orange) and eight spore-thorn patches (the Mire atlas's spike cell, 2 HP). There are no vents: their art is flame.
  - The `crumble_group` walkways are planks at floor height over three of the pits: walkable at a run (a plank is underfoot about 330ms of its 400ms shake), or jump the pit.
  - Enemies: 18 placements (mine bot 5, drone 4, fly trap 3, shield drone 3, bouncer 3) plus the serpent. Each spawns a full screen (448px) ahead, per the shared convention (Heat Works used 260px).
  - Checkpoint 3 is at the start of the secret screen: this brief puts the secret between the mid-boss and the tower, so a death in the tower walks back one screen. The serpent's room has a flat floor (it tunnels anywhere on it) and the serpent stands 360px in, so it wakes as the hero enters and not before.
  - The boss room is unchanged here: the `pits` arena with acid channels belongs to the boss lane.

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
- Boss room: `shaft`, the wall-jumping boss room Craig asked for (06 §6.1, 07 §7.4): Gale's dive and gusts use the height, and the two moving platforms from the combat profile become wall-side ledges.
- Difficulty rating: 3.
- Built (12d, `EVAL-P6-010`, `src/content/stages/galeVixen.ts`, layout table in its header; `tests/gale-vixen-stage.test.ts`, smoke `60-gale-route`): 13 screens in the order above; checkpoints at the start, at 1392 (the radio), at the office door right after the mid-boss (3184), and before the boss door (5744). Five gaps over the open sky: two gust gaps (272 and 352px), two carrier ferries (272 and 304px), one plain pit (96px); eight cable spikes, seven gusts, four carrier pairs. 19 placements (drone 5, shock hopper 4, shield drone 3, laser eye 3, gunner 2, rocket 2) and the twins in their Gale skin, in the wind. What changed from this brief, and why:
  - The gusts are sized on this build's measured jumps (a running jump 224px, a dash jump 325px, on the floor under the actor ceiling): the stage gust builds to 200px/s (the 12b default is 150), so a running jump it carries crosses a 352px gap that a dash jump misses. `windDriftPx` (`src/mechanics/windZone.ts`) models the carry and the smoke measures the real crossing. Every gust over a gap starts 8px past the take-off rim, so a hero waiting on the edge is never blown off it, and the floor after it holds a dash jump the gust over-carried.
  - The mast runs on one 3.6s beat: the carriers slide in the calm and the gusts blow exactly while they hold (the streaks build in the slide's last half second), so the hero rides, then crosses. The widest gap (320px, rising 56) runs back toward the mast's left wall on the gust; the second gust leads to the exit over the right wall. The mast is two screens wide as well as two tall, to fit a gap wider than a dash jump. Its wall face is the left wall above ledge B (kicks are a second way up to carrier 2); the right wall is plain, so no kick line runs from the base straight to the exit.
  - The heart: a dash jump the high gust carries lands on the heart ledge 440px from the launch ledge; a running jump in the same gust falls short to the dock, so a miss is never a death. The high gust is the lighter 12b default so the two jumps land apart; a back stop catches an overshoot. The heart room is two screens tall because its ledges stand above the actor ceiling.
  - The carriers are lane-swap pairs (`src/mechanics/laneSwap.ts`, the Power District's `carry` platforms) on the Gale beat. The capsule sits in an alcove over ledge C, on the mast's route.
  - The pits draw as the storm below: a stage with sideways gusts takes `stormPitColors` (`src/mechanics/windZone.ts`, one line in `StageMechanicsAdapter.ts`).
  - The mid-boss room's gust is a band over the floor (y 140 down), so the twins stay in view; a jumping hero is pushed through the low half of the jump.
  - Not built in this lane: the drones banking with the gust and attacking in the lull, and the gunner waiting for a safe lane, are enemy-brain work in `src/enemy/`, so they keep their current brains; the twins get no wind reaction for the same reason. The `shaft` boss room belongs to the boss lane and keeps its current form. The shared gust art fills its whole zone at 0.9 alpha, which is heavy over the wide gaps, and the backdrop leaves a dark band at the top of the two tall rooms (shared rendering).

## Public Archives (`glacier_ronin`)

- Fiction: the cryo keep, the cold store of every record the city keeps, sealed with the verdict already inside. Scrapers deice the access lanes; pressure nozzles vent frost.
- Route: 12 screens. `intro` 1, `teach` 2, `escalate` 2, `secret` 1, `midboss` 1, `master` 3, `preboss` 2.
- Mechanics: `ice_floor` (friction x0.35, dash +40%) and `icicle` hazards from cracked ceilings with a shadow telegraph; `crumble_group` ice shelves; precise jumps over frozen pits.
- Master segment: a walled ice gallery (`walls` are the record stacks) where the floor is ice, the ceiling drops icicles on a rhythm, and the frost turrets cover fixed lanes; the player slides between safe patches.
- Enemies (18, 7 types): signature `enemy_armored_bot` (ice scraper: one controlled skid, braking recovery), familiar `enemy_frost_turret` (pressure nozzle: fixed two-shot pattern), `enemy_gunner_bot`, `enemy_drone`, `enemy_laser_eye`, `enemy_bouncer`, `enemy_mine_bot`.
- Mini-boss: `custodian_walker`, Glacier skin, on the ice; it slides further than it means to.
- Secrets: `heart_tank` behind a `breakable_wall` of ice in the secret room; `sub_tank` (real Sub Tank) across a frozen pit that only a `dash_jump` on ice clears.
- `capsule` (`armor_helmet`) on the route before the mid-boss.
- Radio beat: checkpoint 2.
- Boss room: `flat` ice floor (Glacier's shard volleys and the player's slide are the fight).
- Difficulty rating: 3.
- Built (12d, `EVAL-P6-010`, `src/content/stages/glacierRonin.ts`, layout table in its header; `tests/glacier-ronin-stage.test.ts`, smoke `58-glacier-route`): 12 screens in the order above; checkpoints at the start, at 1400 (the radio), at the gallery door right after the mid-boss, and before the boss door. Five frozen pits (80 to 164px), eight frost spikes, eleven icicles, fifteen ice floors. 20 placements (armored bot 4, frost turret 4, drone 3, gunner 3, laser eye 2, bouncer 2, mine bot 2) and the custodian in its Glacier skin, on an ice floor. What changed from this brief, and why:
  - The gallery's walls are four record stacks hanging from its low ceiling to an 18px slot over the floor: the dash body (14px) passes under, the crouch (18) and stand (22) bodies do not, so the player literally slides from bay to bay. Each bay is ice lanes under the icicles with grip patches (plain floor) between them to stop on; a dash started on the ice before a stack runs 40% further. The gallery is walled, not tall (the brief gives the master no `verticalScreens`).
  - The icicles on a rhythm are a new icicle mode (`rhythm` in `src/mechanics/icicle.ts`): each drops on the stage clock every 2.4s whoever is under it, offset 400 to 800ms along its bay, and grows back 600ms after it shatters. Every icicle now casts a floor shadow while it shakes and falls (the telegraph). The teach and escalate icicles keep the 12b rule (they drop once the hero passes under, and a running hero is clear): the safe first instances.
  - The sub tank: a dash on ice runs 40% longer, but a dash jump carries the same speed in the air on any floor, so "only a dash jump on ice clears" is a 296px gap from a one-way ice launch ledge (a running jump covers about 246px, a dash jump about 336px), with a frozen pit under the gap and a back wall that stops the landing slide. Those ledges stand above the actor ceiling, so the cold store (escalate, x 1792-2240) is two screens tall: the route's vertical segment.
  - The frozen pits draw as ice water, not slag: a stage with ice floors takes `frozenPitColors` (`src/mechanics/iceFloor.ts`, one line in `StageMechanicsAdapter.ts`).
  - The `crumble_group` ice shelves are three planks at floor height over a 164px frozen pit: walk them at a run, or jump the pit (the Medicine District's walkway rule).
  - Not built in this lane: the custodian's slide on the ice ("slides further than it means to") is enemy-motor work in `src/enemy/`, so it walks the ice at ground friction; the frost turret keeps its three-shot burst (the two-shot pattern is enemy tuning); the ice wall and the ice shelves draw with the shared breakable-wall and crumble art; the `flat` ice boss room belongs to the boss lane and keeps its current form.

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
- Built (12e, EVAL-P6-011 and EVAL-P2-007; layout table in `src/content/stages/omegaFortress.ts`, archive rules in `src/content/omegaArchive.ts`, rematch config in `src/content/omegaRematch.ts`, scene adapter `src/scenes/game/OmegaActs.ts`, rules in `tests/omega-fortress-stage.test.ts` and `tests/omega-archive.test.ts`, smoke `61-omega-three-acts`): one 7168px route. Act 1 (10 screens) teaches belts, then rails, then a headwind gust over a pit, then rising coolant in the Heat Works climb (two screens tall), then the Structural Works shaft down (two screens tall, a crosswind), and combines them: rails into a headwind pit, a 288px chasm with two carriers, and the flood run (coolant fills the floor, a live rail on the middle block). Checkpoints: the start, checkpoint 2 with the radio, the archive door (act 2), past the archive exit (act 3), the Core's door. The archive (2 screens) has eight doors labelled by element; Up at a door re-enters `Game` as that warden's rematch in the Core's room (full profile, phase two's kit from the first frame, maxHp x0.7; on the reference Normal player of `src/boss/phaseKit.ts` every rematch is 49 to 58 s (maxHp 78 to 92) and the archive 8.0 minutes with 8 s of walking per door); a clear returns to its door with a large HP refill and a full weapon-energy refill; clears 2, 4, 6 and 8 are checkpoints that save the run (`activeRun.omegaAct`, `activeRun.rematchCleared`, save v6); the sub tanks need no checkpoint, since every fill and drink is written to the save when it happens. A game over from act 2 on keeps the run at its checkpoint for the continue on Assist and Normal; on Veteran the continue is the stage start, so the run is not kept and nothing past act 1 survives, as on every stage. A saved run in act 3 without all eight clears loads at the archive; a run saved inside the old stub route (save v5) restarts at the fortress start. Act 3 (4 screens): rails and gusts over two pits with a carrier, a compactor, a trimmer and a scraper before the step to the Core's door. The three `finale_phase` lines play on the Core's transitions (62%, 30%, desperation at 20%). 30 placements of eight types, 12 spike strips, seven pits, four carriers, no secrets.
- Not built in this lane: OMEGA intrusions at the act boundaries (the script has one radio pair, at checkpoint 2; the archive door and the Core's approach want a line each, listed for the narrative pass); the visual sweep's own act-2 capture (a line in `scripts/mission-visual-sweep.mjs`; smoke 61 captures every act); the climb's and the shaft's casing draws dark on the Core backdrop.

## Open questions for STOP 1.6 (answered by the level-designer panel, 2026-09-22, `D-001`)

1. Tide's `sub_tank` room is reachable only while the water is high. **Answer:** not as written (there is no swim move and the lint checks fixed geometry). A `carry` float rides the cycling water line up to the gate, and the lint checks reach from the float's highest position; if the lint cannot model that, the room goes behind a `breakable_wall`.
2. Volt's `armor_legs` capsule sits before the master segment so the air dash helps there. **Answer:** keep it on the main route (capsules are progression; only `heart_tank` and `sub_tank` count as secrets). Stages play in any order, so the lint checks every master segment, Volt's included, with base movement and no capsule.
3. Ferro uses `enemy_frost_turret` as a coolant nozzle. **Answer:** yes, as a palette variant (a quench nozzle with steam instead of frost, the same fixed two-shot pattern); a Ferro row goes into the ecology plan so 6.4 generates it. Optional: Ferro has five families without it.

Conditions carried into prompt 06: Tide's cycling water and Ferro's vertical magnet lift need `rising_liquid` to cycle and `wind_zone` to push vertically; 6.2 adds both (lab-tested) before 06e, or these briefs drop those mechanics. In 06 §6.5, `lane_vents` means the library's timed `vent`.
