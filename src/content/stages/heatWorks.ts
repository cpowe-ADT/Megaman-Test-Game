import type { EnemyLevelMarker } from '../../enemy/types'
import type { StageHazardDefinition, HazardTiming } from '../../mechanics/hazards'
import type { RoomLockDefinition, VerticalSegmentDefinition } from '../../mechanics/roomLock'
import type { RisingLiquidDefinition } from '../../mechanics/risingLiquid'
import type { CrumbleGroupDefinition } from '../../mechanics/crumbleGroup'
import type { BreakableWallDefinition } from '../../mechanics/breakableWall'
import type { FloorGap } from '../../stage/stageGeometry'
import type { StagePlatformDefinition, LocationAnchors } from '../campaign'

/**
 * Heat Works (`pyro_maw`), the pilot stage (EVAL-P6-009; brief in `docs/design/stage-briefs.md`, segment
 * plan in prompt 02 §2.4). Twelve 448px screens before the unchanged boss room:
 *
 *   0 intro       0-448      safe landing, one slow vent, the first mine on a step
 *   1-2 teach     448-1344   first pit, a slow vent pair, then the heart room (two screens tall): the
 *                            heart tank sits on a ledge 296px from the launch ledge, so only a dash jump
 *                            reaches it; a missed jump lands on the safe floor below
 *   3-4 escalate  1344-2240  checkpoint 2 and the radio, sorting lanes with faster vents, slicers, rocket
 *                            loaders on ledges, two pits
 *   5 secret      2240-2688  the route runs over a sealed chamber; a charged shot breaks its wall (sub tank)
 *   6 midboss     2688-3648  the ante-room, then the locked catwalk room (opens once its stand-ins fall)
 *   7-9 master    3648-4544  checkpoint 3, the two-screen slag climb between two wall faces (one-way
 *                            ledges, two crumbles, vents on ledges, wall kicks the fast line, capsule
 *                            alcove at the top), then the works floor with a crumble stone over a pit
 *   10-11 preboss 4544-5376  the breather (bonus pickup, armored guard), the full-speed vent lane, the
 *                            last pit, checkpoint 4 on the landing before the boss door
 *
 * Measured on this build (2026-09-24, flat floor): a held running jump rises about 124px and covers
 * about 246px; a held dash jump covers about 336px. Every pit is under 180px; the heart gap is 296px.
 * The main ground's top is y 236; the actor ceiling is y 90 outside the two tall rooms.
 */

const FLOOR = 236
const BOTTOM = 252
const BRICK = 0x6c3520
const CATWALK = 0x8a4a26
const IRON = 0x4a2a1c

/** A raised block standing on the ground (its faces run down into the pit walls). */
function block(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'solid', color: BRICK }
}

/** A one-way catwalk whose walking surface is `top`. */
function ledge(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left, type: 'oneWay', color: CATWALK }
}

/** A kickable wall face. */
function wall(id: string, left: number, right: number, top: number, bottom: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, type: 'wall', color: IRON }
}

const SLOW: HazardTiming = { onMs: 1000, offMs: 2200 }
const FAST: HazardTiming = { onMs: 1000, offMs: 1400 }
const CLIMB: HazardTiming = { onMs: 1000, offMs: 1600 }
const FULL_SPEED: HazardTiming = { onMs: 800, offMs: 1000 }

/** A floor or ledge vent: the 16x48 flame column stands on `surfaceTop`. */
function vent(id: string, x: number, surfaceTop: number, timing: HazardTiming): StageHazardDefinition {
  return { id, kind: 'vent', x, y: surfaceTop - 24, width: 16, height: 48, damage: 2, timing }
}

/** Ground enemies spawn 51px above what they stand on and settle; fliers use their own y. */
const standingOn = (top: number) => top - 51

function enemy(
  id: string,
  typeKey: EnemyLevelMarker['typeKey'],
  x: number,
  y: number,
  spawnTriggerX: number,
  retireTriggerX: number,
  patrol?: [number, number]
): EnemyLevelMarker {
  return { id, typeKey, x, y, patrolMinX: patrol?.[0], patrolMaxX: patrol?.[1], spawnTriggerX, retireTriggerX }
}

const checkpoint = (id: string, x: number, triggerX: number, radioSequenceId?: string) => ({
  id,
  x,
  y: 40,
  triggerX,
  ...(radioSequenceId ? { radioSequenceId } : {})
})

export const HEAT_WORKS_ROUTE_WIDTH = 12 * 448
/** Mid-boss stand-ins until `custodian_walker` exists (EVAL-P6-005): the catwalk gate opens once all fall. */
export const HEAT_WORKS_MIDBOSS_MARKERS = ['pyro_mid_armored', 'pyro_mid_mine_a', 'pyro_mid_mine_b']

export const HEAT_WORKS_CHECKPOINTS = [
  checkpoint('pyro_start', 44, 0),
  checkpoint('pyro_mid_a', 1392, 1376, 'pyro_maw_radio'),
  checkpoint('pyro_mid_b', 3680, 3664),
  checkpoint('pyro_boss_gate', 5296, 5264)
]

export const HEAT_WORKS_FLOOR_GAPS: FloorGap[] = [
  { x: 512, width: 64 },
  { x: 1440, width: 80 },
  { x: 1760, width: 96 },
  { x: 4224, width: 176 },
  { x: 5184, width: 64 }
]

export const HEAT_WORKS_HAZARDS: StageHazardDefinition[] = [
  vent('pyro_vent_intro', 320, FLOOR, SLOW),
  vent('pyro_vent_teach_1', 656, FLOOR, SLOW),
  vent('pyro_vent_teach_2', 736, FLOOR, SLOW),
  vent('pyro_vent_sort_1', 1632, FLOOR, FAST),
  vent('pyro_vent_sort_2', 1936, 204, FAST),
  vent('pyro_vent_sort_3', 2032, FLOOR, FAST),
  vent('pyro_vent_sort_4', 2096, FLOOR, FAST),
  vent('pyro_vent_climb_1', 3936, 152, CLIMB),
  vent('pyro_vent_climb_2', 4048, -68, CLIMB),
  vent('pyro_vent_lane_1', 4864, FLOOR, FULL_SPEED),
  vent('pyro_vent_lane_2', 4944, FLOOR, FULL_SPEED),
  vent('pyro_vent_lane_3', 5024, FLOOR, FULL_SPEED),
  vent('pyro_vent_lane_4', 5104, FLOOR, FULL_SPEED)
]

export const HEAT_WORKS_PLATFORMS: StagePlatformDefinition[] = [
  // Intro and teach.
  block('pyro_intro_step', 352, 512, 204),
  block('pyro_teach_deck', 784, 960, 196),
  // The heart: a step and a launch ledge 296px short of the heart ledge. Both ledges sit 152px over the
  // floor (a held jump rises about 127), so from below the heart is seen, never reached.
  ledge('pyro_heart_step', 840, 896, 140),
  ledge('pyro_heart_launch', 904, 960, 84),
  ledge('pyro_heart_ledge', 1256, 1312, 84),
  // Escalate: sorting lanes between loader ledges.
  block('pyro_sort_ledge_a', 1664, 1760, 188),
  block('pyro_sort_ledge_b', 1856, 1952, 204),
  block('pyro_sort_ledge_c', 2176, 2240, 180),
  // Secret: the route runs on the chamber roof; the breakable wall is its left side.
  { id: 'pyro_secret_roof', x: 2424, y: 174, width: 272, height: 12, type: 'solid', color: BRICK },
  block('pyro_secret_bulkhead', 2560, 2640, 168),
  // Mid-boss ante-room and the catwalk room.
  block('pyro_ante_deck', 2720, 2864, 204),
  ledge('pyro_ante_catwalk', 2760, 2840, 156),
  block('pyro_catwalk_step', 3280, 3344, 204),
  ledge('pyro_catwalk_a', 3424, 3504, 180),
  ledge('pyro_catwalk_b', 3560, 3640, 180),
  // Master: the climb (walls, one-way ledges, the capsule alcove), then the works floor.
  wall('pyro_climb_wall_left', 3736, 3752, -252, 140),
  wall('pyro_climb_wall_right', 4080, 4096, -150, BOTTOM),
  ledge('pyro_climb_1', 3768, 3832, 196),
  ledge('pyro_climb_2', 3872, 3952, 152),
  ledge('pyro_climb_3', 3984, 4064, 108),
  ledge('pyro_climb_4', 3872, 3936, 64),
  ledge('pyro_climb_7', 3984, 4064, -68),
  ledge('pyro_climb_8', 3872, 3936, -112),
  ledge('pyro_climb_9', 3984, 4064, -150),
  ledge('pyro_climb_alcove', 3752, 3800, -196),
  block('pyro_works_landing', 4096, 4224, 188),
  block('pyro_works_deck', 4448, 4608, 196)
]

export const HEAT_WORKS_CRUMBLES: CrumbleGroupDefinition[] = [
  {
    id: 'pyro_climb_crumble',
    platforms: [
      { id: 'pyro_crumble_1', x: 3800, y: 24, width: 64 },
      { id: 'pyro_crumble_2', x: 3908, y: -20, width: 56 }
    ]
  },
  { id: 'pyro_works_crumble', platforms: [{ id: 'pyro_crumble_3', x: 4312, y: 204, width: 48 }] }
]

export const HEAT_WORKS_BREAKABLE_WALLS: BreakableWallDefinition[] = [
  { id: 'pyro_secret_wall', x: 2296, y: 208, width: 16, height: 56, hitsRequired: 3, minChargeLevel: 1 }
]

export const HEAT_WORKS_VERTICAL_SEGMENTS: VerticalSegmentDefinition[] = [
  { id: 'pyro_heart_room', x: 896, width: 448, verticalScreens: 2 },
  { id: 'pyro_climb', x: 3648, width: 448, verticalScreens: 2 }
]

/** Starts 40px under the floor (about 1.4s to cover it), 14s to 20px under the exit ledge. */
export const HEAT_WORKS_SLAG: RisingLiquidDefinition[] = [
  { id: 'pyro_slag', x: 3752, width: 328, floorY: FLOOR + 40, topY: -130, riseMs: 14000, triggerX: 3776 }
]

export const HEAT_WORKS_ROOM_LOCKS: RoomLockDefinition[] = [
  { id: 'pyro_midboss_lock', room: { x: 3200, y: 0, width: 448, height: 252 }, gateX: 3648, defeatMarkers: HEAT_WORKS_MIDBOSS_MARKERS }
]

export const HEAT_WORKS_LOCATION_ANCHORS: LocationAnchors = {
  heart_tank: { x: 1284, y: 68 },
  sub_tank: { x: 2500, y: 218 },
  capsule: { x: 3776, y: -212 },
  pickup_bonus: { x: 4680, y: 218 }
}

/** 20 placements, the brief's five types; each spawns at least 260px ahead of the hero and retires behind. */
export const HEAT_WORKS_ENEMIES: EnemyLevelMarker[] = [
  enemy('pyro_intro_mine', 'enemy_mine_bot', 440, standingOn(204), 170, 620),
  enemy('pyro_teach_slicer', 'enemy_slicer_bot', 620, standingOn(FLOOR), 360, 760, [596, 636]),
  enemy('pyro_teach_rocket', 'enemy_rocket_bot', 880, standingOn(196), 600, 1000),
  enemy('pyro_heart_drone', 'enemy_drone', 1120, 150, 860, 1300),
  enemy('pyro_heart_mine', 'enemy_mine_bot', 1200, standingOn(FLOOR), 940, 1330),
  enemy('pyro_sort_slicer_a', 'enemy_slicer_bot', 1600, standingOn(FLOOR), 1340, 1720, [1540, 1650]),
  enemy('pyro_sort_rocket_a', 'enemy_rocket_bot', 1720, standingOn(188), 1460, 1800),
  enemy('pyro_sort_slicer_b', 'enemy_slicer_bot', 2000, standingOn(FLOOR), 1740, 2090, [1964, 2016]),
  enemy('pyro_sort_mine', 'enemy_mine_bot', 2136, standingOn(FLOOR), 1876, 2200),
  enemy('pyro_sort_rocket_b', 'enemy_rocket_bot', 2212, standingOn(180), 1952, 2300),
  enemy('pyro_secret_drone', 'enemy_drone', 2480, 120, 2220, 2600),
  enemy('pyro_ante_slicer', 'enemy_slicer_bot', 2790, standingOn(204), 2530, 2900, [2736, 2848]),
  enemy('pyro_mid_armored', 'enemy_armored_bot', 3560, standingOn(FLOOR), 3300, 3760, [3470, 3620]),
  enemy('pyro_mid_mine_a', 'enemy_mine_bot', 3464, standingOn(180), 3204, 3760),
  enemy('pyro_mid_mine_b', 'enemy_mine_bot', 3600, standingOn(180), 3340, 3760),
  enemy('pyro_climb_drone', 'enemy_drone', 3920, -40, 3660, 4200),
  enemy('pyro_climb_mine', 'enemy_mine_bot', 4000, standingOn(-68), 3740, 4200),
  enemy('pyro_works_drone', 'enemy_drone', 4320, 150, 4060, 4440),
  enemy('pyro_works_rocket', 'enemy_rocket_bot', 4560, standingOn(196), 4300, 4660),
  enemy('pyro_pre_armored', 'enemy_armored_bot', 4760, standingOn(FLOOR), 4500, 4880, [4700, 4800])
]
