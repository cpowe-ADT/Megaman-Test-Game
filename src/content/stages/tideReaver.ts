import type { EnemyLevelMarker } from '../../enemy/types'
import type { StageHazardDefinition } from '../../mechanics/hazards'
import type { RoomLockDefinition, VerticalSegmentDefinition } from '../../mechanics/roomLock'
import type { ConveyorDefinition } from '../../mechanics/conveyor'
import type { CurrentZoneDefinition } from '../../mechanics/currentZone'
import type { WaterLevelGateDefinition } from '../../mechanics/waterLevelGate'
import type { FloorGap } from '../../stage/stageGeometry'
import type { StagePlatformDefinition, LocationAnchors, StageExtensionPatch } from '../campaign'

/**
 * Water District (`tide_reaver`), rebuilt to the Heat Works standard (prompt 12 part 12d, EVAL-P6-010;
 * brief in `docs/design/stage-briefs.md`). Twelve 448px screens before the unchanged boss room:
 *
 *   0 intro       0-448      safe landing, an idle intake belt on the floor, one step
 *   1-2 teach     448-1344   a current with the hero over the first pit (a jump inside rises 20% less), a
 *                            deck and the first valve attendant; then the first water-level gate: the
 *                            sluice opens only while the water behind it holds low
 *   3-4 escalate  1344-2240  checkpoint 2 and the radio, carry belts over the widest pit, the valve deck,
 *                            a headwind current over a pit, the heart room (two screens tall): a chimney
 *                            of two wall faces 48px apart capped by the heart ledge 176px over the floor,
 *                            so only wall kicks reach it; the dry catwalk
 *   5 midboss     2240-2688  the locked intake room: the relay turret nest on the intake housing, a belt
 *                            feeding it; the gate opens once the nest falls
 *   6 secret      2688-3136  checkpoint 3, the float basin (two screens tall): its water climbs to y 60
 *                            and drains; at high water the hero floats to the sub tank ledge (148px up)
 *   7-9 master    3136-4480  the flooded shaft (two screens tall, wall faces both sides, one-way ledges;
 *                            entered through the intake opening under the left wall): the water cycles, the
 *                            current pushes toward the intake at the bottom and across the middle, and the
 *                            exit sluice over the right wall opens only at low water (capsule alcove at the
 *                            top left); then the flooded works (a safe landing, a headwind pit) and the
 *                            lower lock (a sluice with a current against the waiting hero)
 *   10-11 preboss 4480-5376  the breather (bonus pickup), the full-speed spike lane, the last pit,
 *                            checkpoint 4 on the landing before the boss door
 *
 * Measured on this build (2026-09-24, Heat Works): a held running jump rises about 124px and covers about
 * 246px; a dash jump covers about 336px. In a current the launch speed is scaled so the rise is 80% (about
 * 100px) and the push (80px/s airborne) shortens a jump against it to about 150px. Every pit is under 180px
 * and a still pool sits in each. The main ground's top is y 236; the actor ceiling is y 90 outside the three
 * tall rooms. A floating hero bobs about 6px round the water line, so each high line sits 28-30px over the
 * ledge it floats the hero onto.
 */

const FLOOR = 236
const BOTTOM = 252
const CONCRETE = 0x2c4c5f
const CATWALK = 0x3f7896
const STEEL = 0x22384a

/** A raised block standing on the ground. */
function block(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'solid', color: CONCRETE }
}

/** A one-way catwalk whose walking surface is `top`. */
function ledge(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left, type: 'oneWay', color: CATWALK }
}

/** A kickable wall face. */
function wall(id: string, left: number, right: number, top: number, bottom: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, type: 'wall', color: STEEL }
}

/** A floor spike strip (28x10, 1 HP) on `surfaceTop`. */
function spike(id: string, x: number, surfaceTop = FLOOR): StageHazardDefinition {
  return { id, x, y: surfaceTop - 6 }
}

/** A belt whose top is `top` (flush with the floor when `top` is the floor). */
function belt(id: string, left: number, width: number, top: number, speed: number, type: 'solid' | 'oneWay' = 'solid'): ConveyorDefinition {
  return { id, x: left + width / 2, y: top + 6, width, speed, type }
}

/** A current rect from `top` down to the floor unless `bottom` is given. */
function current(id: string, left: number, right: number, top: number, forceX: number, maxSpeed: number, bottom = FLOOR): CurrentZoneDefinition {
  return { id, x: left, y: top, width: right - left, height: bottom - top, forceX, maxSpeed }
}

/** Still water in a pit (no float: a fall still ends the life). */
function pool(gap: FloorGap): WaterLevelGateDefinition {
  return { id: `tide_pool_${gap.x}`, x: gap.x, width: gap.width, highY: FLOOR + 6, lowY: FLOOR + 6, bottomY: BOTTOM + 8, buoyancy: 0 }
}

/** Ground enemies spawn 51px above what they stand on and settle; fliers and turrets use their own y. */
const standingOn = (top: number) => top - 51
/** Brief and prompt 02: every placement spawns at least 448px before its x (camera-relative). */
const SPAWN_AHEAD = 452

function enemy(id: string, typeKey: EnemyLevelMarker['typeKey'], x: number, y: number, retireAfter = 200): EnemyLevelMarker {
  return { id, typeKey, x, y, spawnTriggerX: x - SPAWN_AHEAD, retireTriggerX: x + retireAfter }
}

const checkpoint = (id: string, x: number, triggerX: number, radioSequenceId?: string) => ({
  id,
  x,
  y: 40,
  triggerX,
  ...(radioSequenceId ? { radioSequenceId } : {})
})

export const TIDE_REAVER_ROUTE_WIDTH = 12 * 448
/** The mini-boss (`relay_turret_nest`, EVAL-P6-005): the intake room's gate opens once it falls. */
export const TIDE_REAVER_MIDBOSS_MARKERS = ['tide_mid_nest']

export const TIDE_REAVER_CHECKPOINTS = [
  checkpoint('tide_start', 44, 0),
  checkpoint('tide_mid_a', 1392, 1376, 'tide_reaver_radio'),
  checkpoint('tide_mid_b', 2736, 2720),
  checkpoint('tide_boss_gate', 5296, 5264)
]

export const TIDE_REAVER_FLOOR_GAPS: FloorGap[] = [
  { x: 640, width: 64 },
  { x: 1472, width: 160 },
  { x: 1824, width: 80 },
  { x: 3840, width: 80 },
  { x: 5120, width: 64 }
]

export const TIDE_REAVER_HAZARDS: StageHazardDefinition[] = [
  spike('tide_spike_valve', 1648),
  spike('tide_spike_chimney', 2112),
  spike('tide_spike_basin', 3072),
  spike('tide_spike_shaft', 3528),
  spike('tide_spike_intake', 3248),
  spike('tide_spike_lower', 4448),
  spike('tide_spike_lane_1', 4704),
  spike('tide_spike_lane_2', 4784),
  spike('tide_spike_lane_3', 4896),
  spike('tide_spike_lane_4', 4976)
]

export const TIDE_REAVER_PLATFORMS: StagePlatformDefinition[] = [
  // Intro and teach.
  block('tide_intro_step', 320, 416, 204),
  // The pit jump lands about 200px on (x 780-810): the deck's face stands 70px past that, room to jump it.
  block('tide_teach_deck', 880, 976, 196),
  // Escalate: the valve deck past the carry belts, the grate by the chimney, the dry catwalk.
  block('tide_valve_deck', 1664, 1760, 196),
  block('tide_grate_block', 1952, 1984, 212),
  // The heart chimney: two wall faces hanging to 64px over the floor (walk under, jump in, kick up);
  // the heart ledge caps the gap 176px over the floor (a held jump rises about 127). Both tops sit at
  // y 56, out of a jump's reach from the catwalk, so no plain jump lands on a wall top beside the heart.
  wall('tide_heart_wall_left', 1984, 2000, 56, 172),
  wall('tide_heart_wall_right', 2048, 2064, 56, 172),
  ledge('tide_heart_ledge', 2000, 2048, 60),
  block('tide_catwalk', 2144, 2240, 204),
  // Mid-boss: the intake housing the nest stands on.
  block('tide_intake_housing', 2560, 2656, 196),
  // Secret: the sub tank ledge over the float basin's right edge, 148px over the floor.
  ledge('tide_subtank_ledge', 2960, 3040, 88),
  // Master: the flooded shaft (walls, one-way ledges, the top ledge by the sluice, the capsule alcove). The
  // intake opening under the left wall is 164px tall: its bottom sits over a floor jump's head (y 87), so
  // its outer face cannot start a wall-kick climb toward the sub tank.
  wall('tide_shaft_wall_left', 3168, 3184, -252, 72),
  wall('tide_shaft_wall_right', 3568, 3584, -150, BOTTOM),
  ledge('tide_shaft_2', 3296, 3376, 152),
  ledge('tide_shaft_3', 3408, 3488, 108),
  ledge('tide_shaft_4', 3296, 3360, 64),
  ledge('tide_shaft_5', 3200, 3264, 20),
  ledge('tide_shaft_6', 3296, 3376, -24),
  ledge('tide_shaft_7', 3408, 3488, -68),
  ledge('tide_shaft_8', 3296, 3360, -112),
  ledge('tide_shaft_top', 3488, 3568, -150),
  ledge('tide_shaft_alcove', 3184, 3232, -196),
  // The flooded works and the lower lock.
  // The drop off the shaft's exit lands on 256px of open floor (3584-3840) before the headwind pit.
  block('tide_works_deck', 3968, 4032, 196),
  block('tide_lower_grate', 4144, 4176, 212)
]

export const TIDE_REAVER_CONVEYORS: ConveyorDefinition[] = [
  belt('tide_intake_belt_intro', 144, 112, FLOOR, 40),
  belt('tide_carry_belt_1', 1488, 56, 194, 50, 'oneWay'),
  belt('tide_carry_belt_2', 1568, 56, 178, 50, 'oneWay'),
  belt('tide_intake_belt', 2360, 168, FLOOR, 45)
]

export const TIDE_REAVER_CURRENTS: CurrentZoneDefinition[] = [
  // With the hero over the first pit (the safe first instance), then against it everywhere after.
  current('tide_current_teach', 480, 800, 116, 360, 70),
  current('tide_current_escalate', 1776, 1952, 120, -420, 80),
  current('tide_current_intake', 3184, 3568, 150, -420, 80),
  current('tide_current_shaft', 3184, 3568, -90, -360, 70, -20),
  current('tide_current_works', 3776, 3968, 120, -420, 80),
  current('tide_current_lower', 4096, 4216, 136, -300, 60)
]

export const TIDE_REAVER_WATER: WaterLevelGateDefinition[] = [
  // Teach: the water behind the first sluice falls, holds low for 3s (the gate is open), and rises.
  {
    id: 'tide_lock_teach',
    x: 1112,
    width: 152,
    highY: 140,
    lowY: 232,
    bottomY: FLOOR,
    timing: { highMs: 1500, fallMs: 2000, lowMs: 3000, riseMs: 2000 },
    gate: { x: 1104, top: 0, bottom: FLOOR }
  },
  // Secret: the float basin climbs to 28px over the sub tank ledge's top, then drains below the floor.
  { id: 'tide_float_basin', x: 2848, width: 128, highY: 60, lowY: 240, bottomY: FLOOR, timing: { highMs: 3000, fallMs: 2000, lowMs: 3500, riseMs: 2500 } },
  // Master: the shaft fills to 30px over the top ledge, drains to a puddle; the exit sluice sits on the right wall.
  {
    id: 'tide_shaft_water',
    x: 3184,
    width: 384,
    highY: -180,
    lowY: 230,
    bottomY: FLOOR,
    timing: { highMs: 2500, fallMs: 3500, lowMs: 3500, riseMs: 3500 },
    gate: { x: 3576, top: -252, bottom: -150 }
  },
  {
    id: 'tide_lock_lower',
    x: 4232,
    width: 168,
    highY: 132,
    lowY: 230,
    bottomY: FLOOR,
    timing: { highMs: 1500, fallMs: 1500, lowMs: 2500, riseMs: 1500, phaseMs: 3000 },
    gate: { x: 4224, top: 0, bottom: FLOOR }
  },
  ...TIDE_REAVER_FLOOR_GAPS.map(pool)
]

export const TIDE_REAVER_VERTICAL_SEGMENTS: VerticalSegmentDefinition[] = [
  { id: 'tide_heart_room', x: 1792, width: 448, verticalScreens: 2 },
  { id: 'tide_basin_room', x: 2688, width: 448, verticalScreens: 2 },
  { id: 'tide_shaft', x: 3136, width: 448, verticalScreens: 2 }
]

export const TIDE_REAVER_ROOM_LOCKS: RoomLockDefinition[] = [
  { id: 'tide_midboss_lock', room: { x: 2240, y: 0, width: 448, height: 252 }, gateX: 2688, defeatMarkers: TIDE_REAVER_MIDBOSS_MARKERS }
]

export const TIDE_REAVER_LOCATION_ANCHORS: LocationAnchors = {
  heart_tank: { x: 2024, y: 44 },
  sub_tank: { x: 3008, y: 72 },
  capsule: { x: 3208, y: -212 },
  pickup_bonus: { x: 4560, y: 218 }
}

/**
 * 19 placements: the brief's five families and the mini-boss. Each spawns 452px before its x (off
 * camera) and retires behind. The nest spawns while the hero is still in the escalate segment and
 * fights from the intake housing, inside the locked room.
 */
export const TIDE_REAVER_ENEMIES: EnemyLevelMarker[] = [
  enemy('tide_teach_gunner', 'enemy_gunner_bot', 940, standingOn(196)),
  enemy('tide_lock_mine', 'enemy_mine_bot', 1216, standingOn(FLOOR)),
  enemy('tide_lock_drone', 'enemy_drone', 1320, 124),
  enemy('tide_valve_gunner', 'enemy_gunner_bot', 1712, standingOn(196)),
  enemy('tide_escalate_drone', 'enemy_drone', 1880, 116),
  enemy('tide_grate_trap', 'enemy_fly_trap', 1968, 200),
  enemy('tide_catwalk_hopper', 'enemy_shock_hopper', 2192, standingOn(204)),
  enemy('tide_mid_nest', 'relay_turret_nest', 2608, standingOn(196)),
  enemy('tide_shallows_mine', 'enemy_mine_bot', 2912, standingOn(FLOOR)),
  enemy('tide_secret_drone', 'enemy_drone', 3080, 128),
  enemy('tide_shaft_trap', 'enemy_fly_trap', 3232, 8),
  enemy('tide_shaft_mine', 'enemy_mine_bot', 3448, standingOn(108)),
  enemy('tide_shaft_drone', 'enemy_drone', 3440, -48),
  enemy('tide_works_gunner', 'enemy_gunner_bot', 4000, standingOn(196)),
  enemy('tide_works_hopper', 'enemy_shock_hopper', 4072, standingOn(FLOOR)),
  enemy('tide_lower_trap', 'enemy_fly_trap', 4160, 200),
  enemy('tide_pre_gunner', 'enemy_gunner_bot', 4832, standingOn(FLOOR)),
  enemy('tide_pre_hopper', 'enemy_shock_hopper', 5040, standingOn(FLOOR)),
  enemy('tide_pre_drone', 'enemy_drone', 5150, 120)
]

/** The whole Water District route as one patch, registered in `src/content/stages/index.ts`. */
export const TIDE_REAVER_PATCH: StageExtensionPatch = {
  width: TIDE_REAVER_ROUTE_WIDTH,
  bossSpawnX: TIDE_REAVER_ROUTE_WIDTH - 84,
  checkpoints: TIDE_REAVER_CHECKPOINTS,
  hazards: TIDE_REAVER_HAZARDS,
  midPlatforms: TIDE_REAVER_PLATFORMS,
  enemyMarkers: TIDE_REAVER_ENEMIES,
  roomLocks: TIDE_REAVER_ROOM_LOCKS,
  arena: {
    floorGaps: TIDE_REAVER_FLOOR_GAPS,
    locationAnchors: TIDE_REAVER_LOCATION_ANCHORS,
    verticalSegments: TIDE_REAVER_VERTICAL_SEGMENTS,
    conveyors: TIDE_REAVER_CONVEYORS,
    currentZones: TIDE_REAVER_CURRENTS,
    waterLevelGates: TIDE_REAVER_WATER
  }
}
