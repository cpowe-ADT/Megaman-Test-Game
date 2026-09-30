import type { EnemyLevelMarker } from '../../enemy/types'
import type { StageHazardDefinition } from '../../mechanics/hazards'
import type { VerticalSegmentDefinition } from '../../mechanics/roomLock'
import type { RisingLiquidDefinition } from '../../mechanics/risingLiquid'
import type { ConveyorDefinition } from '../../mechanics/conveyor'
import type { WindZoneDefinition } from '../../mechanics/windZone'
import type { TimedRailGroupDefinition } from '../../mechanics/timedRailGroup'
import type { FloorGap } from '../../stage/stageGeometry'
import type { StagePlatformDefinition, StageExtensionPatch } from '../campaign'

/**
 * The Central Core (`omega_fortress`) in three acts (prompt 02 phase 2.6, prompt 12 part 12e, EVAL-P6-011; brief in
 * `docs/design/stage-briefs.md`). One route, three segments with a checkpoint at each act boundary:
 *
 *   Act 1, the Relay Spire (10 screens, 0-4480), four district mechanics remixed in ascending difficulty:
 *   0 intro      0-448      a safe landing and a step
 *   1 belts      448-896    a belt carrying right with a spike strip on it, then a 96px pit (conveyors alone)
 *   2 rails      896-1344   two floor rails with an insulated block between, a belt pushing back (rails alone)
 *   3 combine    1344-1792  a belt into a 128px pit with a carrier over it, a compactor on the far side
 *   4 gusts      1792-2240  checkpoint 2 and the OMEGA radio, a headwind over a 128px pit (cross in the lull)
 *   5 climb      2240-2688  vertical segment 1: the Heat Works climb (two screens, wall faces) over rising coolant
 *   6 shaft      2688-3136  vertical segment 2: the relay shaft down from the climb's top, a gust across it
 *   7 master     3136-3584  rails into a headwind pit, one rail on the landing
 *   8 master     3584-4032  a 288px chasm: two carriers (or a dash jump), a drone over it
 *   9 flood      4032-4480  the flood run: coolant fills the floor; three blocks, a live rail on the middle one
 *   Act 2, the Warden Archive (2 screens, 4480-5376): checkpoint 3 at its door; eight doors labelled by element
 *   (`src/content/omegaArchive.ts`, drawn by `src/scenes/game/OmegaActs.ts`); the exit seals until all eight
 *   rematches are cleared. Rematches re-enter the scene in the Core's room (`omegaArchive.ts`).
 *   Act 3, the Core (4 screens, 5376-7168): checkpoint 4 past the archive's exit; rails and gusts over two pits
 *   with a carrier, a compactor, a trimmer and a scraper before the step to checkpoint 5 at the Core's door (none
 *   is alive there, where rematches start). Omega's room follows unchanged.
 *
 * Measured on this build (2026-09-24, Heat Works): a held running jump rises about 124px and covers about 246px;
 * a dash jump covers about 336px; the run is 220px/s. The main ground's top is y 236; the actor ceiling is y 90
 * outside the two tall rooms. The climb and the shaft reuse the Heat Works and Structural Works geometry, proven by
 * their route smokes.
 */

const FLOOR = 236
const BOTTOM = 252
const SCREEN = 448
const CORE = 0x4b3868
const CATWALK = 0x5c4a86
const CASING = 0x2c2242
const COOLANT = 0x1f6f8b
const COOLANT_SURFACE = 0x7fe7ff

/** Act boundaries, world px. */
export const OMEGA_ACT1_END = 10 * SCREEN
export const OMEGA_HUB = { x: OMEGA_ACT1_END, width: 2 * SCREEN } as const
export const OMEGA_ACT3_START = OMEGA_HUB.x + OMEGA_HUB.width
export const OMEGA_ROUTE_WIDTH = OMEGA_ACT3_START + 4 * SCREEN
/** The archive's sealed exit: a wall face at the hub's right end until the eighth rematch is cleared. */
export const OMEGA_HUB_GATE = { x: OMEGA_ACT3_START - 24, width: 16 } as const
/** Doors in the hub, left to right (one per warden, in `ROBOT_MASTER_STAGE_IDS` order). */
export const OMEGA_DOOR_XS = [4600, 4696, 4792, 4888, 4984, 5080, 5176, 5272] as const

/** A raised block standing on the ground (its faces run down into the pit walls). */
function block(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'solid', color: CORE }
}

/** A one-way catwalk whose walking surface is `top`. */
function ledge(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left, type: 'oneWay', color: CATWALK }
}

/** A kickable wall face. */
function wall(id: string, left: number, right: number, top: number, bottom: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, type: 'wall', color: CASING }
}

/** A one-way carrier (top `top`) shuttling its centre from `fromX` to `toX` and back. */
function carrier(id: string, fromX: number, toX: number, top: number, width: number, duration: number): StagePlatformDefinition {
  return { id, x: fromX, y: top + 4, width, type: 'oneWay', color: CATWALK, motion: { toX, duration } }
}

/** A floor spike strip (28x10, 1 HP) on `surfaceTop`. */
function spike(id: string, x: number, surfaceTop = FLOOR): StageHazardDefinition {
  return { id, x, y: surfaceTop - 6 }
}

/** A belt lying flush on the floor (its top on it): positive speed carries right. */
function belt(id: string, left: number, right: number, speed: number): ConveyorDefinition {
  return { id, x: (left + right) / 2, y: FLOOR + 6, width: right - left, speed }
}

/** A gust over `left`-`right` from the floor up `height` px, on its cycle; -1 blows left (a headwind). */
function gust(id: string, left: number, right: number, direction: 1 | -1, height = 150, top = FLOOR - height): WindZoneDefinition {
  return { id, kind: 'gust', direction, x: left, y: top, width: right - left, height, timing: { onMs: 1400, offMs: 1800 } }
}

/** Ground enemies spawn 51px above what they stand on and settle; fliers and turrets use their own y. */
const standingOn = (top: number) => top - 51
/** Every placement spawns 452px before its x (off camera) and retires 200px behind. */
const SPAWN_AHEAD = 452

function enemy(id: string, typeKey: EnemyLevelMarker['typeKey'], x: number, y: number, patrol?: [number, number]): EnemyLevelMarker {
  return {
    id,
    typeKey,
    x,
    y,
    ...(patrol ? { patrolMinX: patrol[0], patrolMaxX: patrol[1] } : {}),
    spawnTriggerX: x - SPAWN_AHEAD,
    retireTriggerX: x + 200
  }
}

const checkpoint = (id: string, x: number, triggerX: number, radioSequenceId?: string) => ({
  id,
  x,
  y: 40,
  triggerX,
  ...(radioSequenceId ? { radioSequenceId } : {})
})

export type OmegaAct = 1 | 2 | 3

export const OMEGA_CHECKPOINTS = [
  checkpoint('omega_start', 44, 0),
  checkpoint('omega_spire_mid', 1840, 1816, 'omega_fortress_radio'),
  checkpoint('omega_archive', 4520, 4496),
  checkpoint('omega_core', 5424, 5400),
  checkpoint('omega_core_gate', 7088, 7060)
]

/** The act each checkpoint belongs to: the archive's door opens act 2, the Core's approach act 3. */
export const OMEGA_CHECKPOINT_ACTS: Readonly<Record<string, OmegaAct>> = {
  omega_start: 1,
  omega_spire_mid: 1,
  omega_archive: 2,
  omega_core: 3,
  omega_core_gate: 3
}
export const OMEGA_ARCHIVE_CHECKPOINT_ID = 'omega_archive'
export const OMEGA_CORE_GATE_CHECKPOINT_ID = 'omega_core_gate'

export const OMEGA_FLOOR_GAPS: FloorGap[] = [
  { x: 720, width: 96 },
  { x: 1552, width: 128 },
  { x: 1968, width: 128 },
  { x: 3328, width: 128 },
  { x: 3664, width: 288 },
  { x: 6000, width: 112 },
  { x: 6400, width: 192 }
]

export const OMEGA_HAZARDS: StageHazardDefinition[] = [
  // Act 1: a spike to hop at the start, spikes riding the belts, one on the gust pylon's top, one on the shaft floor.
  spike('omega_spike_intro', 180),
  spike('omega_spike_belt', 640),
  spike('omega_spike_pushback', 1300),
  spike('omega_spike_feed', 1440),
  spike('omega_spike_pylon', 2188, 180),
  spike('omega_spike_shaft', 2960),
  // Act 3: on the deck, between the rails (both rails and the spike in one lull), in the corridor, by the pits.
  spike('omega_core_spike_deck', 5480, 196),
  spike('omega_core_spike_rails', 5620),
  spike('omega_core_spike_corridor', 5920),
  spike('omega_core_spike_landing', 6260),
  spike('omega_core_spike_pit', 6320),
  spike('omega_core_spike_door', 6880)
]

const CLIMB: [number, number] = [2240, 2688]
const SHAFT: [number, number] = [2688, 3136]

export const OMEGA_PLATFORMS: StagePlatformDefinition[] = [
  // Act 1. Intro step; the rail yard's insulated block and the pylon the inspector hangs on.
  block('omega_intro_step', 224, 320, 204),
  block('omega_rail_block', 1036, 1068, 204),
  block('omega_rail_pylon', 1164, 1204, 172),
  carrier('omega_carrier_s3', 1580, 1652, 204, 48, 2000),
  block('omega_gust_pylon', 2168, 2208, 180),
  // The climb (Heat Works' climb at +88 to +448: walls, one-way ledges, coolant rising between the walls).
  wall('omega_climb_wall_left', 2328, 2344, -252, 140),
  wall('omega_climb_wall_right', 2672, 2688, -150, BOTTOM),
  ledge('omega_climb_1', 2360, 2424, 196),
  ledge('omega_climb_2', 2464, 2544, 152),
  ledge('omega_climb_3', 2576, 2656, 108),
  ledge('omega_climb_4', 2464, 2528, 64),
  ledge('omega_climb_5', 2360, 2424, 20),
  ledge('omega_climb_6', 2472, 2528, -24),
  ledge('omega_climb_7', 2576, 2656, -68),
  ledge('omega_climb_8', 2464, 2528, -112),
  ledge('omega_climb_9', 2576, 2656, -150),
  // The shaft (Structural Works' shaft at +0 to +376): the landing under the climb's wall, ledges down to the floor.
  ledge('omega_shaft_landing', 2688, 2720, -60),
  ledge('omega_shaft_1', 2792, 2872, 20),
  ledge('omega_shaft_2', 2920, 2984, 100),
  ledge('omega_shaft_3', 3008, 3064, 170),
  ledge('omega_shaft_4', 2704, 2784, 190),
  // The chasm's two carriers: the low one shuttles across, the high one is the step for a rider who misses it.
  carrier('omega_carrier_chasm', 3700, 3916, 204, 56, 3000),
  carrier('omega_carrier_chasm_high', 3780, 3844, 150, 48, 1800),
  // The flood run: three blocks over the coolant; the rail arcs on the middle one.
  block('omega_flood_block_1', 4112, 4176, 188),
  block('omega_flood_block_2', 4224, 4288, 164),
  block('omega_flood_block_3', 4336, 4400, 188),
  // Act 3. A raised deck with a spike, the carrier over the second pit, the Core's door step.
  block('omega_core_deck', 5456, 5504, 196),
  carrier('omega_core_carrier', 6436, 6556, 204, 48, 2200),
  block('omega_core_step', 6960, 7008, 212)
]

export const OMEGA_CONVEYORS: ConveyorDefinition[] = [
  belt('omega_belt_teach', 464, 688, 60),
  belt('omega_belt_pushback', 1240, 1336, -60),
  belt('omega_belt_feed', 1360, 1528, 60)
]

export const OMEGA_TIMED_RAILS: TimedRailGroupDefinition[] = [
  { id: 'omega_rails_yard', rails: [{ id: 'omega_rail_yard_1', x: 1004, y: FLOOR }, { id: 'omega_rail_yard_2', x: 1100, y: FLOOR }], timing: { onMs: 1200, offMs: 1800 } },
  { id: 'omega_rails_master', rails: [{ id: 'omega_rail_master_1', x: 3200, y: FLOOR }, { id: 'omega_rail_master_2', x: 3256, y: FLOOR }, { id: 'omega_rail_master_3', x: 3540, y: FLOOR }], timing: { onMs: 1000, offMs: 1600 } },
  { id: 'omega_rails_flood', rails: [{ id: 'omega_rail_flood', x: 4256, y: 164 }], timing: { onMs: 1000, offMs: 1600 } },
  {
    id: 'omega_rails_core',
    rails: [{ id: 'omega_rail_core_1', x: 5560, y: FLOOR }, { id: 'omega_rail_core_2', x: 5680, y: FLOOR }, { id: 'omega_rail_core_3', x: 6660, y: FLOOR }],
    timing: { onMs: 900, offMs: 1500 }
  }
]

export const OMEGA_WIND_ZONES: WindZoneDefinition[] = [
  gust('omega_gust_teach', 1920, 2144, -1),
  // The shaft: a crosswind through its middle band pushes a falling hero toward the exit side.
  gust('omega_gust_shaft', 2736, 3104, 1, 160, -40),
  gust('omega_gust_master', 3296, 3488, -1),
  gust('omega_core_gust_corridor', 5840, 6240, -1),
  gust('omega_core_gust_pit', 6368, 6624, -1)
]

export const OMEGA_RISING_LIQUIDS: RisingLiquidDefinition[] = [
  // Heat Works' climb numbers: 40px under the floor, 14s to the top of the climb.
  { id: 'omega_coolant_climb', x: 2344, width: 328, floorY: FLOOR + 40, topY: -130, riseMs: 14000, triggerX: 2368, color: COOLANT, surfaceColor: COOLANT_SURFACE },
  // The flood run: about 1.7s after the trigger it covers the floor; it stops 16px under the lowest block.
  { id: 'omega_coolant_flood', x: 4064, width: 336, floorY: FLOOR + 40, topY: 204, riseMs: 3000, triggerX: 4080, color: COOLANT, surfaceColor: COOLANT_SURFACE }
]

export const OMEGA_VERTICAL_SEGMENTS: VerticalSegmentDefinition[] = [
  { id: 'omega_climb', x: CLIMB[0], width: CLIMB[1] - CLIMB[0], verticalScreens: 2 },
  { id: 'omega_shaft', x: SHAFT[0], width: SHAFT[1] - SHAFT[0], verticalScreens: 2 }
]

/**
 * 30 placements of eight families (the districts' signature variants as their base types): mine bot (slag
 * scavenger), drone (ballast and split-wing), shock hopper (relay tender), bouncer (compactor), slicer (sheet
 * trimmer), armored bot (ice scraper, hauler), laser eye (inspector), shield drone (courier). None stands within
 * 200px of the Core's door, so a rematch that starts there meets only its warden.
 */
export const OMEGA_ENEMIES: EnemyLevelMarker[] = [
  // Act 1 (22).
  enemy('omega_intro_hauler', 'enemy_armored_bot', 380, standingOn(FLOOR), [350, 440]),
  enemy('omega_belt_drone', 'enemy_drone', 600, 150),
  enemy('omega_belt_trimmer', 'enemy_slicer_bot', 872, standingOn(FLOOR), [840, 890]),
  enemy('omega_yard_mine', 'enemy_mine_bot', 960, standingOn(FLOOR)),
  enemy('omega_yard_eye', 'enemy_laser_eye', 1156, 150),
  enemy('omega_yard_tender', 'enemy_shock_hopper', 1350, standingOn(FLOOR)),
  enemy('omega_feed_drone', 'enemy_drone', 1480, 140),
  enemy('omega_feed_compactor', 'enemy_bouncer', 1760, standingOn(FLOOR)),
  enemy('omega_gust_courier', 'enemy_shield_drone', 2020, 120),
  enemy('omega_gust_eye', 'enemy_laser_eye', 2160, 150),
  enemy('omega_climb_drone', 'enemy_drone', 2512, -40),
  enemy('omega_climb_mine', 'enemy_mine_bot', 2616, standingOn(-68)),
  enemy('omega_shaft_drone', 'enemy_drone', 2900, -100),
  enemy('omega_shaft_mine', 'enemy_mine_bot', 2832, standingOn(20)),
  enemy('omega_shaft_tender', 'enemy_shock_hopper', 3080, standingOn(FLOOR)),
  enemy('omega_master_scraper', 'enemy_armored_bot', 3156, standingOn(FLOOR), [3140, 3170]),
  enemy('omega_master_eye', 'enemy_laser_eye', 3440, 130),
  enemy('omega_master_trimmer', 'enemy_slicer_bot', 3610, standingOn(FLOOR), [3592, 3640]),
  enemy('omega_chasm_drone', 'enemy_drone', 3808, 110),
  enemy('omega_chasm_courier', 'enemy_shield_drone', 3990, 120),
  enemy('omega_flood_eye', 'enemy_laser_eye', 4300, 100),
  enemy('omega_flood_mine', 'enemy_mine_bot', 4368, standingOn(188)),
  // Act 3 (8); the last retires at x 7040, before the Core's door.
  enemy('omega_core_eye', 'enemy_laser_eye', 5760, 150),
  enemy('omega_core_hauler', 'enemy_armored_bot', 5776, standingOn(FLOOR), [5740, 5812]),
  enemy('omega_core_drone', 'enemy_drone', 6050, 120),
  enemy('omega_core_tender', 'enemy_shock_hopper', 6180, standingOn(FLOOR)),
  enemy('omega_core_pit_drone', 'enemy_drone', 6496, 110),
  enemy('omega_core_compactor', 'enemy_bouncer', 6724, standingOn(FLOOR)),
  enemy('omega_core_trimmer', 'enemy_slicer_bot', 6770, standingOn(FLOOR), [6750, 6800]),
  enemy('omega_core_scraper', 'enemy_armored_bot', 6840, standingOn(FLOOR), [6820, 6856])
]

/** The whole Central Core route as one patch, registered in `src/content/stages/index.ts`. */
export const OMEGA_FORTRESS_PATCH: StageExtensionPatch = {
  width: OMEGA_ROUTE_WIDTH,
  bossSpawnX: OMEGA_ROUTE_WIDTH - 84,
  checkpoints: OMEGA_CHECKPOINTS,
  hazards: OMEGA_HAZARDS,
  midPlatforms: OMEGA_PLATFORMS,
  enemyMarkers: OMEGA_ENEMIES,
  arena: {
    floorGaps: OMEGA_FLOOR_GAPS,
    verticalSegments: OMEGA_VERTICAL_SEGMENTS,
    risingLiquids: OMEGA_RISING_LIQUIDS,
    conveyors: OMEGA_CONVEYORS,
    windZones: OMEGA_WIND_ZONES,
    timedRailGroups: OMEGA_TIMED_RAILS
  }
}
