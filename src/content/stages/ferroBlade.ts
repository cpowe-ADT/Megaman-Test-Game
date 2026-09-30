import type { EnemyLevelMarker } from '../../enemy/types'
import type { StageHazardDefinition, HazardTiming } from '../../mechanics/hazards'
import type { RoomLockDefinition, VerticalSegmentDefinition } from '../../mechanics/roomLock'
import type { BreakableWallDefinition } from '../../mechanics/breakableWall'
import type { ConveyorDefinition } from '../../mechanics/conveyor'
import type { TimedRailGroupDefinition } from '../../mechanics/timedRailGroup'
import type { WindZoneDefinition } from '../../mechanics/windZone'
import type { FloorGap } from '../../stage/stageGeometry'
import type { StagePlatformDefinition, LocationAnchors, StageExtensionPatch } from '../campaign'
import type { BossRoomFeatures } from '../../boss/bossRoomLayout'

/**
 * Transit Security (`ferro_blade`), rebuilt to the Heat Works standard (prompt 12 part 12d, EVAL-P6-010;
 * brief in `docs/design/stage-briefs.md`). Thirteen 448px screens before the unchanged boss room:
 *
 *   0 intro       0-448      safe landing, a crate to watch from, one slow belt carrying the hero's way
 *   1-2 teach     448-1344   the belts alone: one with the hero into a crate, the first pit, one carrying him
 *                            into a blade strip at its end (jump it); then the magnet lift alone: a column
 *                            over a feed belt beside the press housing (112px tall; the lift is the easy way up)
 *   3-5 escalate  1344-2688  checkpoint 2 and the radio, a belt against the hero with blades at its end, a pit,
 *                            a coolant nozzle on a housing, a fast belt into the shear housing, whose magnet
 *                            lift raises the hero onto it and the catwalk over a bladed belt; the heart room (two screens tall): a crate step up to the
 *                            wrong-way belt (a shelf 140px over the floor running back toward the step), and the
 *                            heart ledge 292px past its end: only a dash jump against the belt reaches it
 *   6 midboss     2688-3136  the locked inspection station: the relay turret nest (Ferro skin) on its housing,
 *                            the floor belt carrying a hero who stands still into its lane; the gate opens once
 *                            the nest falls
 *   7 secret      3136-3584  checkpoint 3, the route over the inspection office; a charged shot breaks its wall
 *                            (sub tank); the capsule (arm parts) on the bulkhead past it
 *   8-10 master   3584-4928  the trimming hall: four machine housings (walls) and three bays; in each, the upper
 *                            belt runs with the hero and a cutter lane sweeps along it (torches firing left to
 *                            right), the floor belt under it runs back into blades, and a magnet lift against
 *                            the next housing lifts a hero off the floor belt onto it; the gap before the lift
 *                            is the drop
 *   11-12 preboss 4928-5824  the breather (bonus pickup), the last full-speed lane (a pit, a fast belt into
 *                            blades, a floor torch), the last pit, checkpoint 4 on the landing before the boss door
 *
 * Measured on this build (2026-09-24, Heat Works): a held running jump rises about 124px and covers about
 * 246px; a dash jump covers about 336px. The belt carry counts only on the ground, except that a dash jump
 * off a belt keeps the belt's speed on top of the dash speed (`src/player/PlayerMotor.ts`): off the wrong-way
 * belt (20px/s against) a dash jump covers about 308px (smoke 59), a plain jump its usual 246: short of the
 * ledge even from the 100ms coyote window past the belt's edge. Every pit is under 180px
 * and shows the sealed rail lines at its floor (rails with no damage box: the fall is what kills). Outside
 * the heart room the actor ceiling is y 90, so no standing surface there is higher than y 112.
 */

const FLOOR = 236
const BOTTOM = 252
const STEEL = 0x3d4659
const CATWALK = 0x55617a
const HOUSING = 0x262c3a

/** A raised block standing on the ground. */
function block(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'solid', color: STEEL }
}

/** A one-way catwalk whose walking surface is `top`. */
function ledge(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left, type: 'oneWay', color: CATWALK }
}

/** A machine housing: a kickable wall face standing on the ground. */
function housing(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'wall', color: HOUSING }
}

/** A blade strip (the stage atlas's `spike` cell: trimming blades; 28x10, 1 HP) on `surfaceTop`. */
function blades(id: string, x: number, surfaceTop = FLOOR): StageHazardDefinition {
  return { id, x, y: surfaceTop - 6 }
}

/** A belt whose surface is `top` (the floor by default); positive speed carries right. */
function belt(id: string, left: number, right: number, speed: number, top = FLOOR): ConveyorDefinition {
  return { id, x: (left + right) / 2, y: top + 6, width: right - left, speed }
}

/** A cutting torch: an upward jet 40px tall from a nozzle on `surfaceTop`, on the stage clock. */
function torch(id: string, x: number, surfaceTop: number, timing: HazardTiming, height = 40): StageHazardDefinition {
  return { id, kind: 'vent', x, y: surfaceTop - height / 2, width: 16, height, timing, direction: 'up' }
}

/**
 * Ferro's magnet lift (`wind_zone`, kind `lift`, style `magnet`): a column from the floor up to `top`. Each
 * stands against the face the hero is walked or carried into, so he is held in it while it lifts him (a
 * hero running through a free-standing 40px column rises only about 20px).
 */
function magnetLift(id: string, left: number, top: number, width = 40): WindZoneDefinition {
  return { id, kind: 'lift', style: 'magnet', x: left, y: top, width, height: FLOOR - top }
}

/** The cutter lane: each torch fires 500ms of a 2.4s cycle, 250ms after the one to its left. */
export const FERRO_SWEEP_CYCLE_MS = 2400
export const FERRO_SWEEP_STEP_MS = 250
const SWEEP_ON_MS = 500
const sweepTiming = (index: number): HazardTiming => ({
  onMs: SWEEP_ON_MS,
  offMs: FERRO_SWEEP_CYCLE_MS - SWEEP_ON_MS,
  phaseMs: FERRO_SWEEP_CYCLE_MS - index * FERRO_SWEEP_STEP_MS
})
const FULL_SPEED: HazardTiming = { onMs: 800, offMs: 1000 }

/** Ground enemies spawn 51px above what they stand on and settle; fliers and turrets use their own y. */
const standingOn = (top: number) => top - 51
/** Brief and prompt 02: every placement spawns at least 448px before its x (camera-relative). */
const SPAWN_AHEAD = 452

function enemy(id: string, typeKey: EnemyLevelMarker['typeKey'], x: number, y: number, retireAfter = 200, patrol?: [number, number]): EnemyLevelMarker {
  return { id, typeKey, x, y, patrolMinX: patrol?.[0], patrolMaxX: patrol?.[1], spawnTriggerX: x - SPAWN_AHEAD, retireTriggerX: x + retireAfter }
}

const checkpoint = (id: string, x: number, triggerX: number, radioSequenceId?: string) => ({
  id,
  x,
  y: 40,
  triggerX,
  ...(radioSequenceId ? { radioSequenceId } : {})
})

export const FERRO_BLADE_ROUTE_WIDTH = 13 * 448
/** The mini-boss (`relay_turret_nest`, Ferro skin, EVAL-P6-005): the inspection station's gate opens once it falls. */
export const FERRO_BLADE_MIDBOSS_MARKERS = ['ferro_mid_nest']

export const FERRO_BLADE_CHECKPOINTS = [
  checkpoint('ferro_start', 44, 0),
  checkpoint('ferro_mid_a', 1392, 1376, 'ferro_blade_radio'),
  checkpoint('ferro_mid_b', 3184, 3168),
  checkpoint('ferro_boss_gate', 5744, 5712)
]

export const FERRO_BLADE_FLOOR_GAPS: FloorGap[] = [
  { x: 720, width: 80 },
  { x: 1648, width: 112 },
  { x: 5120, width: 96 },
  { x: 5600, width: 64 }
]

/** The trimming hall: four machine housings 32px wide (world x of each left face), three bays between. */
export const FERRO_HALL_HOUSINGS = [3584, 4032, 4480, 4864]
const HOUSING_WIDTH = 32
const HOUSING_TOP = 168
/** The gap between each upper belt's end and the next housing; the magnet lift stands in it. */
const HALL_GAP = 112
export const FERRO_HALL_BAYS = FERRO_HALL_HOUSINGS.slice(0, -1).map((left, index) => ({
  index,
  left: left + HOUSING_WIDTH,
  right: FERRO_HALL_HOUSINGS[index + 1],
  shelfRight: FERRO_HALL_HOUSINGS[index + 1] - HALL_GAP
}))
/** Upper belts run with the hero, floor belts under them run back into the blades. */
export const FERRO_HALL_UPPER_SPEED = 70
export const FERRO_HALL_FLOOR_SPEED = -60
/** The wrong-way belt: the heart sits past its far end, 292px out. */
export const FERRO_HEART_BELT_SPEED = -20

export const FERRO_BLADE_HAZARDS: StageHazardDefinition[] = [
  blades('ferro_blades_teach', 978),
  blades('ferro_blades_escalate_1', 1470),
  blades('ferro_blades_escalate_2', 2030),
  ...FERRO_HALL_BAYS.map((bay) => blades(`ferro_blades_hall_${bay.index + 1}`, bay.left + 14)),
  blades('ferro_blades_lane', 5426),
  // The cutter lane: torches along each upper belt, firing left to right (a sweep every 2.4s).
  ...FERRO_HALL_BAYS.flatMap((bay) => {
    const count = Math.floor((bay.shelfRight - bay.left - 48) / 64)
    return Array.from({ length: count }, (_, index) => torch(`ferro_torch_hall_${bay.index + 1}_${index + 1}`, bay.left + 56 + index * 64, HOUSING_TOP, sweepTiming(index)))
  }),
  torch('ferro_torch_lane', 5504, FLOOR, FULL_SPEED, 48)
]

export const FERRO_BLADE_PLATFORMS: StagePlatformDefinition[] = [
  // Intro and teach: the watching crate, the crate a belt carries the hero into, the press housing.
  block('ferro_intro_crate', 192, 240, 212),
  block('ferro_teach_crate', 640, 688, 212),
  block('ferro_teach_press', 1176, 1240, 124),
  // Escalate: the coolant nozzle's housing, the shear housing the fast belt ends at, the catwalk over the
  // blades past it, the heart room's step.
  block('ferro_escalate_housing', 1808, 1856, 196),
  block('ferro_escalate_shear', 1984, 2016, 148),
  ledge('ferro_escalate_catwalk', 2016, 2096, 148),
  block('ferro_heart_step', 2248, 2288, 180),
  ledge('ferro_heart_ledge', 2660, 2688, 96),
  // Mid-boss: the nest's housing at the end of the inspection belt.
  block('ferro_mid_housing', 3008, 3088, 204),
  // Secret: the route runs on the office roof; the breakable wall is its left side, the bulkhead its right.
  { id: 'ferro_office_roof', x: 3384, y: 174, width: 208, height: 12, type: 'solid', color: STEEL },
  block('ferro_office_bulkhead', 3488, 3584, 168),
  // Master: the machine housings.
  ...FERRO_HALL_HOUSINGS.map((left, index) => housing(`ferro_hall_housing_${index}`, left, left + HOUSING_WIDTH, HOUSING_TOP))
]

export const FERRO_BLADE_CONVEYORS: ConveyorDefinition[] = [
  belt('ferro_intro_belt', 288, 416, 40),
  belt('ferro_teach_belt_with', 480, 624, 60),
  belt('ferro_teach_belt_blades', 832, 992, 50),
  belt('ferro_teach_lift_feed', 1056, 1176, 40),
  belt('ferro_escalate_belt_against', 1456, 1616, -70),
  belt('ferro_escalate_belt_fast', 1872, 1984, 70),
  belt('ferro_escalate_belt_under', 2016, 2112, -50),
  // The wrong-way belt: a shelf 140px over the floor, running back toward the step.
  belt('ferro_heart_belt', 2288, 2368, FERRO_HEART_BELT_SPEED, 96),
  belt('ferro_mid_belt', 2720, 3008, 45),
  ...FERRO_HALL_BAYS.flatMap((bay) => [
    belt(`ferro_hall_upper_${bay.index + 1}`, bay.left, bay.shelfRight, FERRO_HALL_UPPER_SPEED, HOUSING_TOP),
    belt(`ferro_hall_floor_${bay.index + 1}`, bay.left, bay.right, FERRO_HALL_FLOOR_SPEED)
  ]),
  belt('ferro_lane_belt', 5248, 5440, 90)
]

export const FERRO_BLADE_LIFTS: WindZoneDefinition[] = [
  magnetLift('ferro_lift_teach', 1136, 108),
  magnetLift('ferro_lift_escalate', 1944, 120),
  ...FERRO_HALL_BAYS.map((bay) => magnetLift(`ferro_lift_hall_${bay.index + 1}`, bay.right - 40, 124))
]

/** The sealed rail lines under the catwalks: rails on each pit floor spark now and then, with no damage box. */
export const FERRO_BLADE_RAILS: TimedRailGroupDefinition[] = [
  {
    id: 'ferro_pit_rails',
    rails: FERRO_BLADE_FLOOR_GAPS.map((gap) => ({ id: `ferro_rail_pit_${gap.x}`, x: gap.x + gap.width / 2, y: BOTTOM, width: gap.width })),
    timing: { onMs: 600, offMs: 3000 },
    live: false
  }
]

export const FERRO_BLADE_BREAKABLE_WALLS: BreakableWallDefinition[] = [
  { id: 'ferro_office_wall', x: 3288, y: 208, width: 16, height: 56, hitsRequired: 3, minChargeLevel: 1 }
]

export const FERRO_BLADE_VERTICAL_SEGMENTS: VerticalSegmentDefinition[] = [{ id: 'ferro_heart_room', x: 2240, width: 448, verticalScreens: 2 }]

export const FERRO_BLADE_ROOM_LOCKS: RoomLockDefinition[] = [
  { id: 'ferro_midboss_lock', room: { x: 2688, y: 0, width: 448, height: 252 }, gateX: 3136, defeatMarkers: FERRO_BLADE_MIDBOSS_MARKERS }
]

export const FERRO_BLADE_LOCATION_ANCHORS: LocationAnchors = {
  heart_tank: { x: 2674, y: 80 },
  sub_tank: { x: 3400, y: 218 },
  capsule: { x: 3536, y: 152 },
  pickup_bonus: { x: 5008, y: 218 }
}

/**
 * 20 placements: the brief's six families (19) and the mini-boss. Each spawns 452px before its x (off
 * camera) and retires behind. The nest spawns while the hero is still in the heart room and fights from its
 * housing inside the locked station. Walkers on a belt ride it like the hero does.
 */
export const FERRO_BLADE_ENEMIES: EnemyLevelMarker[] = [
  enemy('ferro_teach_bouncer', 'enemy_bouncer', 880, standingOn(FLOOR)),
  enemy('ferro_teach_slicer', 'enemy_slicer_bot', 1024, standingOn(FLOOR), 200, [1000, 1052]),
  enemy('ferro_teach_gunner', 'enemy_gunner_bot', 1288, standingOn(FLOOR)),
  enemy('ferro_teach_eye', 'enemy_laser_eye', 1320, 150),
  enemy('ferro_escalate_drone', 'enemy_shield_drone', 1704, 124),
  enemy('ferro_escalate_slicer', 'enemy_slicer_bot', 1784, standingOn(FLOOR), 200, [1768, 1800]),
  enemy('ferro_escalate_nozzle', 'enemy_frost_turret', 1832, 150),
  enemy('ferro_escalate_gunner', 'enemy_gunner_bot', 2192, standingOn(FLOOR)),
  enemy('ferro_heart_slicer', 'enemy_slicer_bot', 2464, standingOn(FLOOR), 200, [2420, 2520]),
  enemy('ferro_heart_bouncer', 'enemy_bouncer', 2576, standingOn(FLOOR)),
  enemy('ferro_mid_nest', 'relay_turret_nest_ferro', 3048, standingOn(204), 200, [3028, 3068]),
  enemy('ferro_secret_drone', 'enemy_shield_drone', 3336, 120),
  enemy('ferro_hall_slicer_1', 'enemy_slicer_bot', 3760, standingOn(FLOOR), 200, [3700, 3860]),
  enemy('ferro_hall_eye_1', 'enemy_laser_eye', 4048, 130),
  enemy('ferro_hall_drone', 'enemy_shield_drone', 4288, 112),
  enemy('ferro_hall_eye_2', 'enemy_laser_eye', 4496, 130),
  enemy('ferro_hall_nozzle', 'enemy_frost_turret', 4880, 130),
  enemy('ferro_pre_slicer', 'enemy_slicer_bot', 5072, standingOn(FLOOR), 200, [5040, 5100]),
  enemy('ferro_pre_bouncer', 'enemy_bouncer', 5480, standingOn(FLOOR)),
  enemy('ferro_pre_gunner', 'enemy_gunner_bot', 5560, standingOn(FLOOR))
]

/**
 * The boss room (12f wave 6, EVAL-P7-005; the brief's `rails`, as conveyor strips): two belts flush with the floor
 * running opposite ways, both toward the middle, between the combat profile's teleport anchors (0.16, 0.5, 0.84),
 * so a hero who stands still is carried into the middle lane that Ferro's disc and dash sweep.
 */
const FERRO_ROOM_X = FERRO_BLADE_ROUTE_WIDTH
export const FERRO_BLADE_BOSS_ROOM: BossRoomFeatures = {
  layout: 'belts',
  mechanics: {
    conveyors: [
      belt('ferro_boss_belt_left', FERRO_ROOM_X + 120, FERRO_ROOM_X + 200, 40),
      belt('ferro_boss_belt_right', FERRO_ROOM_X + 248, FERRO_ROOM_X + 328, -40)
    ]
  }
}

/** The whole Transit Security route as one patch, registered in `src/content/stages/index.ts`. */
export const FERRO_BLADE_PATCH: StageExtensionPatch = {
  width: FERRO_BLADE_ROUTE_WIDTH,
  bossSpawnX: FERRO_BLADE_ROUTE_WIDTH - 84,
  bossRoom: FERRO_BLADE_BOSS_ROOM,
  checkpoints: FERRO_BLADE_CHECKPOINTS,
  hazards: FERRO_BLADE_HAZARDS,
  midPlatforms: FERRO_BLADE_PLATFORMS,
  enemyMarkers: FERRO_BLADE_ENEMIES,
  roomLocks: FERRO_BLADE_ROOM_LOCKS,
  arena: {
    floorGaps: FERRO_BLADE_FLOOR_GAPS,
    locationAnchors: FERRO_BLADE_LOCATION_ANCHORS,
    verticalSegments: FERRO_BLADE_VERTICAL_SEGMENTS,
    conveyors: FERRO_BLADE_CONVEYORS,
    windZones: FERRO_BLADE_LIFTS,
    timedRailGroups: FERRO_BLADE_RAILS,
    breakableWalls: FERRO_BLADE_BREAKABLE_WALLS
  }
}
