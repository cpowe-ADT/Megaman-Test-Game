import type { EnemyLevelMarker } from '../../enemy/types'
import type { StageHazardDefinition, HazardTiming } from '../../mechanics/hazards'
import type { RoomLockDefinition, VerticalSegmentDefinition } from '../../mechanics/roomLock'
import type { BreakableWallDefinition } from '../../mechanics/breakableWall'
import type { ConveyorDefinition } from '../../mechanics/conveyor'
import type { LaneSwapDefinition, LaneSwapTiming } from '../../mechanics/laneSwap'
import type { TimedRailDefinition, TimedRailGroupDefinition } from '../../mechanics/timedRailGroup'
import type { FloorGap } from '../../stage/stageGeometry'
import type { StagePlatformDefinition, LocationAnchors, StageExtensionPatch } from '../campaign'
import type { BossRoomFeatures } from '../../boss/bossRoomLayout'

/**
 * Power District (`volt_hopper`), rebuilt to the Heat Works standard (prompt 12 part 12d, EVAL-P6-010;
 * brief in `docs/design/stage-briefs.md`). Thirteen 448px screens before the unchanged boss room:
 *
 *   0 intro       0-448      safe landing, a step to watch from, one idle rail on a slow cycle
 *   1-2 teach     448-1344   the rails alone: two rail bays with insulated sockets between, a pit over pit
 *                            rails; then the swap pair alone: a ferry over the widest pit (a plain jump
 *                            clears it too, so the first ride is safe)
 *   3-5 escalate  1344-2688  checkpoint 2 and the radio, a walled bay (pylons, rails, a swap pair, a courier
 *                            and a laser eye); the switching yard: conveyor strips, bouncers, a pit, the heart
 *                            room (two screens tall: a chimney of two wall faces 48px apart capped by the
 *                            heart ledge 176px over the floor, so only wall kicks reach it); rocket loaders at
 *                            the yard exit
 *   6 midboss     2688-3136  the locked rail room: the sentry twins over two rail pairs and a socket; the gate
 *                            opens once they fall
 *   7 secret      3136-3584  checkpoint 3, the route over a sealed chamber; a charged shot breaks its wall
 *                            (sub tank); the capsule (air dash) on the bulkhead past it
 *   8-10 master   3584-4928  the walled corridor: four insulated pylons, three 264px rail bays, one swap pair
 *                            per bay, all on the stage beat: the platforms slide while the rails arc, so the
 *                            hero boards in the quiet and rides the arc (low lane, high lane, low lane); then
 *                            the exit floor
 *   11-12 preboss 4928-5824  the breather (bonus pickup), the full-speed rail lane, the last pit,
 *                            checkpoint 4 on the landing before the boss door
 *
 * Measured on this build (2026-09-24, Heat Works): a held running jump rises about 124px and covers about
 * 246px; a dash jump covers about 336px. Every pit is under 180px. Outside the heart room the actor ceiling
 * is y 90, so a jump from a pylon top (y 200) rises at most 88px: a dash jump from one pylon falls short of
 * the next (264px of live floor between them; smoke 56 measures x 4184 against the pylon at 4240) and at best
 * lands on the far station's platform. The stage beat is 3s: rails quiet 1.4s (arming the last 0.3s) and arc
 * 1.6s; the swap platforms hold 1.4s and slide 1.6s on the same clock.
 */

const FLOOR = 236
const BOTTOM = 252
const CONDUIT = 0x24345c
const CATWALK = 0x314b86
const PYLON = 0x1b2442

/** A raised block standing on the ground. */
function block(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'solid', color: CONDUIT }
}

/** A one-way catwalk whose walking surface is `top`. */
function ledge(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left, type: 'oneWay', color: CATWALK }
}

/** A kickable wall face (an insulated pylon when it stands on the ground). */
function wall(id: string, left: number, right: number, top: number, bottom = BOTTOM): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, type: 'wall', color: PYLON }
}

/** A floor spike strip (28x10, 1 HP) on `surfaceTop`. */
function spike(id: string, x: number, surfaceTop = FLOOR): StageHazardDefinition {
  return { id, x, y: surfaceTop - 6 }
}

/** A belt flush with the floor. */
function belt(id: string, left: number, right: number, speed: number): ConveyorDefinition {
  return { id, x: (left + right) / 2, y: FLOOR + 6, width: right - left, speed }
}

/** `count` rails of equal width covering `left`-`right` of the floor. */
function railRun(prefix: string, left: number, right: number, count: number, y = FLOOR): TimedRailDefinition[] {
  const width = (right - left) / count
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}_${index + 1}`, x: left + width * (index + 0.5), y, width }))
}

/** The stage beat (3s): rails arc 1.6s after 1.4s quiet; swap platforms hold 1.4s and slide 1.6s. */
export const VOLT_RAIL_BEAT: HazardTiming = { onMs: 1600, offMs: 1400 }
export const VOLT_SWAP_BEAT: LaneSwapTiming = { holdMs: 1400, moveMs: 1600, phaseMs: 0 }
const IDLE: HazardTiming = { onMs: 1000, offMs: 2600 }
const MIDBOSS: HazardTiming = { onMs: 1200, offMs: 2400 }
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

export const VOLT_HOPPER_ROUTE_WIDTH = 13 * 448
/** The mini-boss (`sentry_twins`, Volt skin, EVAL-P6-005): the rail room's gate opens once they fall. */
export const VOLT_HOPPER_MIDBOSS_MARKERS = ['volt_mid_twins']

export const VOLT_HOPPER_CHECKPOINTS = [
  checkpoint('volt_start', 44, 0),
  checkpoint('volt_mid_a', 1392, 1376, 'volt_hopper_radio'),
  checkpoint('volt_mid_b', 3184, 3168),
  checkpoint('volt_boss_gate', 5744, 5712)
]

export const VOLT_HOPPER_FLOOR_GAPS: FloorGap[] = [
  { x: 816, width: 64 },
  { x: 1024, width: 160 },
  { x: 1984, width: 80 },
  { x: 5600, width: 64 }
]

export const VOLT_HOPPER_HAZARDS: StageHazardDefinition[] = [
  spike('volt_spike_yard_1', 1968),
  spike('volt_spike_yard_2', 2224),
  spike('volt_spike_master', 3630),
  spike('volt_spike_exit', 4760),
  spike('volt_spike_lane', 5504)
]

/** The master corridor: four pylons 24px wide with 264px bays between (world x of each pylon's left face). */
export const VOLT_MASTER_PYLONS = [3664, 3952, 4240, 4528]
const PYLON_WIDTH = 24
const PYLON_TOP = 200
const masterBays = VOLT_MASTER_PYLONS.slice(0, -1).map((left, index) => ({ left: left + PYLON_WIDTH, right: VOLT_MASTER_PYLONS[index + 1] }))

export const VOLT_HOPPER_PLATFORMS: StagePlatformDefinition[] = [
  // Intro and teach: the step to watch the idle rail from; insulated sockets between the rail bays.
  block('volt_intro_step', 176, 256, 204),
  block('volt_teach_socket_1', 592, 640, 212),
  block('volt_teach_socket_2', 752, 800, 212),
  // Escalate: the walled bay (two pylons), the yard dock the rocket loaders work from.
  wall('volt_bay_pylon_a', 1440, 1464, PYLON_TOP),
  wall('volt_bay_pylon_b', 1720, 1744, PYLON_TOP),
  // The heart chimney: two wall faces hanging to 64px over the floor (walk under, jump in, kick up); the heart
  // ledge caps the gap 176px over the floor (a held jump rises about 127). Both tops sit at y 56, out of a
  // jump's reach, so no plain jump lands on a wall top beside the heart.
  wall('volt_heart_wall_left', 2304, 2320, 56, 172),
  wall('volt_heart_wall_right', 2368, 2384, 56, 172),
  ledge('volt_heart_ledge', 2320, 2368, 60),
  block('volt_yard_dock', 2560, 2640, 204),
  // Mid-boss: the socket between the rail pairs.
  block('volt_mid_socket', 2904, 2968, 212),
  // Secret: the route runs on the chamber roof; the breakable wall is its left side, the bulkhead its right.
  { id: 'volt_secret_roof', x: 3384, y: 174, width: 208, height: 12, type: 'solid', color: CONDUIT },
  block('volt_secret_bulkhead', 3488, 3552, 168),
  // Master: the insulated pylons.
  ...VOLT_MASTER_PYLONS.map((left, index) => wall(`volt_master_pylon_${index}`, left, left + PYLON_WIDTH, PYLON_TOP)),
  // Preboss: sockets in the full-speed lane.
  block('volt_lane_socket_1', 5280, 5328, 212),
  block('volt_lane_socket_2', 5440, 5488, 212)
]

export const VOLT_HOPPER_CONVEYORS: ConveyorDefinition[] = [
  belt('volt_yard_belt_1', 1808, 1952, -60),
  belt('volt_yard_belt_2', 2080, 2192, 70),
  belt('volt_yard_belt_3', 2400, 2512, -60)
]

export const VOLT_HOPPER_RAILS: TimedRailGroupDefinition[] = [
  { id: 'volt_intro_rail', rails: [{ id: 'volt_rail_intro', x: 316, y: FLOOR }], timing: IDLE },
  { id: 'volt_teach_rails', rails: [...railRun('volt_rail_teach_a', 480, 592, 2), ...railRun('volt_rail_teach_b', 640, 752, 2)], timing: VOLT_RAIL_BEAT },
  { id: 'volt_bay_rails', rails: railRun('volt_rail_bay', 1464, 1720, 4), timing: VOLT_RAIL_BEAT },
  { id: 'volt_midboss_rails', rails: [...railRun('volt_rail_mid_a', 2792, 2904, 2), ...railRun('volt_rail_mid_b', 2968, 3080, 2)], timing: MIDBOSS },
  { id: 'volt_master_rails', rails: masterBays.flatMap((bay, index) => railRun(`volt_rail_master_${index + 1}`, bay.left, bay.right, 4)), timing: VOLT_RAIL_BEAT },
  { id: 'volt_lane_rails', rails: [...railRun('volt_rail_lane_a', 5168, 5280, 2), ...railRun('volt_rail_lane_b', 5328, 5440, 2)], timing: FULL_SPEED },
  // Pits over the biome's hazard: rails on each pit floor cycle with the grid but carry no damage box (the fall kills).
  { id: 'volt_pit_rails', rails: VOLT_HOPPER_FLOOR_GAPS.map((gap) => ({ id: `volt_rail_pit_${gap.x}`, x: gap.x + gap.width / 2, y: BOTTOM, width: gap.width })), timing: VOLT_RAIL_BEAT, live: false }
]

/** A swap pair spanning `left`-`right`: stations 8px in from each end, lanes at `lowTop` and `highTop`. */
function swapPair(id: string, left: number, right: number, lowTop: number, highTop: number): LaneSwapDefinition {
  return {
    id,
    stations: [left + 8 + 28, right - 8 - 28],
    lanes: [{ id: `${id}_low`, top: lowTop }, { id: `${id}_high`, top: highTop }],
    width: 56,
    timing: VOLT_SWAP_BEAT
  }
}

export const VOLT_HOPPER_LANE_SWAPS: LaneSwapDefinition[] = [
  // Teach: a ferry over the widest pit (its stations over the rims), both lanes a hop above the floor.
  { ...swapPair('volt_ferry', 1024, 1184, 212, 180), stations: [1052, 1156] },
  swapPair('volt_bay_swap', 1464, 1720, PYLON_TOP, 164),
  ...masterBays.map((bay, index) => swapPair(`volt_master_swap_${index + 1}`, bay.left, bay.right, PYLON_TOP, 164))
]

export const VOLT_HOPPER_BREAKABLE_WALLS: BreakableWallDefinition[] = [
  { id: 'volt_secret_wall', x: 3288, y: 208, width: 16, height: 56, hitsRequired: 3, minChargeLevel: 1 }
]

export const VOLT_HOPPER_VERTICAL_SEGMENTS: VerticalSegmentDefinition[] = [{ id: 'volt_heart_room', x: 2240, width: 448, verticalScreens: 2 }]

export const VOLT_HOPPER_ROOM_LOCKS: RoomLockDefinition[] = [
  { id: 'volt_midboss_lock', room: { x: 2688, y: 0, width: 448, height: 252 }, gateX: 3136, defeatMarkers: VOLT_HOPPER_MIDBOSS_MARKERS }
]

// Part 13e (EVAL-P13-010): y sits the v2 art's frame exactly on the surface under each anchor (heart_tank
// top 60, sub_tank/pickup_bonus top 236, capsule top 168); x is unchanged.
export const VOLT_HOPPER_LOCATION_ANCHORS: LocationAnchors = {
  heart_tank: { x: 2344, y: 52.5, rest: 'ground' },
  sub_tank: { x: 3400, y: 227, rest: 'ground' },
  capsule: { x: 3520, y: 159.5, rest: 'ground' },
  pickup_bonus: { x: 5040, y: 227, rest: 'ground' }
}

/**
 * 20 placements: the brief's five families (19) and the mini-boss. Each spawns 452px before its x (off
 * camera) and retires behind. The twins spawn while the hero is still in the yard and fight over the rails
 * inside the locked room (twin 0 perches at the marker, twin 1 at the patrol's far end).
 */
export const VOLT_HOPPER_ENEMIES: EnemyLevelMarker[] = [
  enemy('volt_teach_hopper', 'enemy_shock_hopper', 616, standingOn(212)),
  enemy('volt_teach_drone', 'enemy_shield_drone', 960, 132),
  enemy('volt_ferry_eye', 'enemy_laser_eye', 1250, 150),
  enemy('volt_ferry_hopper', 'enemy_shock_hopper', 1310, standingOn(FLOOR)),
  enemy('volt_bay_drone', 'enemy_shield_drone', 1590, 124),
  enemy('volt_bay_eye', 'enemy_laser_eye', 1732, 150),
  enemy('volt_yard_bouncer_a', 'enemy_bouncer', 1880, standingOn(FLOOR)),
  enemy('volt_yard_hopper', 'enemy_shock_hopper', 2140, standingOn(FLOOR)),
  enemy('volt_yard_bouncer_b', 'enemy_bouncer', 2456, standingOn(FLOOR)),
  enemy('volt_yard_rocket_a', 'enemy_rocket_bot', 2600, standingOn(204)),
  enemy('volt_yard_rocket_b', 'enemy_rocket_bot', 2664, standingOn(FLOOR)),
  enemy('volt_mid_twins', 'sentry_twin', 2808, 136, 420, [2808, 3048]),
  enemy('volt_secret_drone', 'enemy_shield_drone', 3330, 120),
  enemy('volt_master_eye_1', 'enemy_laser_eye', 3964, 150),
  enemy('volt_master_drone', 'enemy_shield_drone', 4110, 112),
  enemy('volt_master_eye_2', 'enemy_laser_eye', 4252, 150),
  enemy('volt_master_hopper', 'enemy_shock_hopper', 4820, standingOn(FLOOR)),
  enemy('volt_pre_hopper', 'enemy_shock_hopper', 4990, standingOn(FLOOR)),
  enemy('volt_pre_bouncer', 'enemy_bouncer', 5304, standingOn(212)),
  enemy('volt_pre_rocket', 'enemy_rocket_bot', 5540, standingOn(FLOOR))
]

/**
 * The boss room (12f wave 6, EVAL-P7-005; the brief's `rails`): two floor rails in one timed rail group either
 * side of the middle mine lane, on a slower beat than the route's (1.2s arcing, 2.4s quiet) while the Hopper's
 * static orbs fly; a jump clears an arc. The rails stand on the floor, so every mine lane stays solid.
 */
const VOLT_ROOM_X = VOLT_HOPPER_ROUTE_WIDTH
export const VOLT_HOPPER_BOSS_ROOM: BossRoomFeatures = {
  layout: 'rails',
  mechanics: {
    timedRailGroups: [
      {
        id: 'volt_boss_rails',
        rails: [
          { id: 'volt_boss_rail_1', x: VOLT_ROOM_X + 140, y: FLOOR },
          { id: 'volt_boss_rail_2', x: VOLT_ROOM_X + 308, y: FLOOR }
        ],
        timing: { onMs: 1200, offMs: 2400, phaseMs: 0 }
      }
    ]
  }
}

/** The whole Power District route as one patch, registered in `src/content/stages/index.ts`. */
export const VOLT_HOPPER_PATCH: StageExtensionPatch = {
  width: VOLT_HOPPER_ROUTE_WIDTH,
  bossSpawnX: VOLT_HOPPER_ROUTE_WIDTH - 84,
  bossRoom: VOLT_HOPPER_BOSS_ROOM,
  checkpoints: VOLT_HOPPER_CHECKPOINTS,
  hazards: VOLT_HOPPER_HAZARDS,
  midPlatforms: VOLT_HOPPER_PLATFORMS,
  enemyMarkers: VOLT_HOPPER_ENEMIES,
  roomLocks: VOLT_HOPPER_ROOM_LOCKS,
  arena: {
    floorGaps: VOLT_HOPPER_FLOOR_GAPS,
    locationAnchors: VOLT_HOPPER_LOCATION_ANCHORS,
    verticalSegments: VOLT_HOPPER_VERTICAL_SEGMENTS,
    conveyors: VOLT_HOPPER_CONVEYORS,
    timedRailGroups: VOLT_HOPPER_RAILS,
    laneSwaps: VOLT_HOPPER_LANE_SWAPS,
    breakableWalls: VOLT_HOPPER_BREAKABLE_WALLS
  }
}
