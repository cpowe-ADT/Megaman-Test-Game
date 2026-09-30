import type { EnemyLevelMarker } from '../../enemy/types'
import type { StageHazardDefinition } from '../../mechanics/hazards'
import type { RoomLockDefinition, VerticalSegmentDefinition } from '../../mechanics/roomLock'
import type { BreakableWallDefinition } from '../../mechanics/breakableWall'
import type { LaneSwapDefinition, LaneSwapTiming } from '../../mechanics/laneSwap'
import type { WindZoneDefinition } from '../../mechanics/windZone'
import type { FloorGap } from '../../stage/stageGeometry'
import type { StagePlatformDefinition, LocationAnchors, StageExtensionPatch } from '../campaign'

/**
 * Weather District (`gale_vixen`), rebuilt to the Heat Works standard (prompt 12 part 12d, EVAL-P6-010;
 * brief in `docs/design/stage-briefs.md`). Thirteen 448px screens before the unchanged boss room:
 *
 *   0 intro       0-448      safe landing, an idle gust over flat deck (it pushes, nothing to fall into), two
 *                            cable spikes, a crate to jump from
 *   1-2 teach     448-1344   the gust alone: the first gap (272px, x 560) over the open sky, which a running
 *                            jump only clears riding the gust (a dash jump clears it too: the safe first
 *                            instance); then the carrier ferry alone over a 272px gap (x 1056; a dash jump too)
 *   3-5 escalate  1344-2688  checkpoint 2 and the radio, the wide gap (352px, x 1456: a dash jump falls short, a
 *                            running jump the gust carries lands), then the dock under the heart room (x 1792,
 *                            two screens tall): the heart ledge 440px from the launch ledge, high over the dock,
 *                            reached only by a dash jump the high gust carries (a running jump in it falls
 *                            short to the dock; a back stop catches an overshoot); shock hoppers on the dock,
 *                            a laser eye on a vane
 *   6 midboss     2688-3136  the sentry twins (Gale skin) in the wind: the room locks on entry (callout), a gust
 *                            over the floor carries the jumping hero past the charging twin; the gate opens
 *                            once they fall
 *   7 secret      3136-3584  checkpoint 3; the route runs over the dock office's roof; a charged shot (or
 *                            three cuts) breaks its wall; the sub tank inside
 *   8-10 master   3584-4928  the relay mast (x 3584-4480, two screens tall) on the mast beat (3.6s: the
 *                            carriers slide 1.8s in the calm, the streaks build in the slide's last 0.5s, the
 *                            gusts blow 1.8s while the carriers hold): carrier 1 lifts the hero to ledge A, the
 *                            widest gap (320px, rising 56: a dash jump alone falls short) back to ledge B on the
 *                            gust, carrier 2 (or kicks up the left wall face over B) to ledge C, the capsule
 *                            alcove over it, the second gust to ledge D (a dash jump clears it too) and over
 *                            the right wall; then the cable run: a landing wide enough for a dash jump the
 *                            gust over-carried, a carrier ferry over a 304px gap, a laser eye on a vane
 *   11-12 preboss 4928-5824  the breather (bonus pickup), the spike lane, the last pit, checkpoint 4 on the
 *                            landing before the boss door
 *
 * Measured on this build (`output/gale-probe`, 2026-09-30, this stage's floor, under the actor ceiling): a held
 * running jump rises 124px and covers 224px in 60 frames; a held dash jump covers 325px; run speed 220px/s. In
 * a gust blowing the whole flight a running jump went 421px and a dash jump 529px (the stage gust, 1200px/s^2
 * to 200px/s), 373 and 478 (the 12b default, 900 to 150, the heart's). `windDriftPx` (`windZone.ts`) models the
 * drift from a standing start. In the tall rooms a jump is not capped by the ceiling and flies further: from
 * the launch ledge a dash jump in the heart gust came down at +546px, a running jump at +406. On the ground the
 * push is halved. Each gust over a gap starts 8px past the take-off rim, so a hero waiting on the edge is never
 * blown off it, and the floor after each gap holds a dash jump the gust carried. The main ground's top is y 236;
 * the actor ceiling is y 90 outside the two tall rooms. The route never needs the air dash.
 */

const FLOOR = 236
const BOTTOM = 252
const DECK = 0x3b5670
const CATWALK = 0x6d93b5
const MAST = 0x27394d
const VANE = 0x7a8fa3
const CARRIER = 0x9ec6e6
const OFFICE_WALL = 0x5d7fa0

/** A raised block standing on the ground (its faces run down into the pit walls). */
function block(id: string, left: number, right: number, top: number, color = DECK): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'solid', color }
}

/** A one-way catwalk whose walking surface is `top`. */
function ledge(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left, type: 'oneWay', color: CATWALK }
}

/** A block between two lines: `wall` faces take slides and kicks, `solid` faces do not. */
function column(id: string, left: number, right: number, top: number, bottom: number, type: 'wall' | 'solid'): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, type, color: MAST }
}

/** A wind vane's post (16px, top y 180): a laser eye watches from over it. */
const vane = (id: string, left: number) => block(id, left, left + 16, 180, VANE)

/** A cable spike strip (28x10, 1 HP) on the floor or on `surfaceTop`. */
function spike(id: string, x: number, surfaceTop = FLOOR): StageHazardDefinition {
  return { id, x, y: surfaceTop - 6 }
}

/** The stage beat, 3.6s: 1.8s calm (the streaks show for the last 0.5s of it), then 1.8s of gust. */
export const GALE_VIXEN_BEAT = { onMs: 1800, offMs: 1800 } as const
/** The carriers on the same 3.6s swap: hold 1.8s, slide 1.8s. */
export const GALE_VIXEN_CARRIER_BEAT: LaneSwapTiming = { holdMs: 1800, moveMs: 1800, phaseMs: 0 }
/** The mast's gusts are offset half a beat, so they blow exactly while the carriers hold. */
export const GALE_VIXEN_MAST_GUST_PHASE_MS = 1800
/** The stage's gust: stronger than the 12b default, so it carries a running jump about 209px further. */
export const GALE_VIXEN_GUST = { force: 1200, maxSpeed: 200 } as const

/** A gust from `left` to `right`, `top` to `bottom`, on the stage beat unless `phaseMs` shifts it. */
function gust(id: string, left: number, right: number, top: number, bottom: number, direction: 1 | -1, options: { phaseMs?: number; strength?: { force: number; maxSpeed: number } } = {}): WindZoneDefinition {
  const strength = options.strength ?? GALE_VIXEN_GUST
  return {
    id,
    kind: 'gust',
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    direction,
    force: strength.force,
    maxSpeed: strength.maxSpeed,
    timing: { ...GALE_VIXEN_BEAT, phaseMs: options.phaseMs ?? 0 }
  }
}

/** A carrier pair spanning a gap `left`-`right` (stations 8px in from each end) or given stations. */
function carriers(id: string, stations: readonly [number, number], lowTop: number, highTop: number): LaneSwapDefinition {
  return {
    id,
    stations,
    lanes: [{ id: `${id}_low`, top: lowTop }, { id: `${id}_high`, top: highTop }],
    width: 56,
    timing: GALE_VIXEN_CARRIER_BEAT,
    color: CARRIER
  }
}

/** Ground enemies spawn 51px above what they stand on and settle; fliers and turrets use their own y. */
const standingOn = (top: number) => top - 51
/** Brief and prompt 02: every placement spawns at least 448px before its x (camera-relative). */
const SPAWN_AHEAD = 452

function enemy(id: string, typeKey: EnemyLevelMarker['typeKey'], x: number, y: number, patrol?: [number, number], retireAfter = 200): EnemyLevelMarker {
  return { id, typeKey, x, y, patrolMinX: patrol?.[0], patrolMaxX: patrol?.[1], spawnTriggerX: x - SPAWN_AHEAD, retireTriggerX: x + retireAfter }
}

const checkpoint = (id: string, x: number, triggerX: number, radioSequenceId?: string) => ({
  id,
  x,
  y: 40,
  triggerX,
  ...(radioSequenceId ? { radioSequenceId } : {})
})

export const GALE_VIXEN_ROUTE_WIDTH = 13 * 448
/** The mini-boss (`sentry_twins` in its Gale skin, 12c): the room's gate opens once they fall. */
export const GALE_VIXEN_MIDBOSS_MARKERS = ['gale_mid_twins']
/** The relay mast (the master), two screens tall: its walls and the ledges of the ascent. */
export const GALE_VIXEN_MAST = { left: 3584, right: 4480 }

export const GALE_VIXEN_CHECKPOINTS = [
  checkpoint('gale_start', 44, 0),
  checkpoint('gale_mid_a', 1392, 1376, 'gale_vixen_radio'),
  checkpoint('gale_mid_b', 3184, 3168),
  checkpoint('gale_boss_gate', 5744, 5712)
]

/** Open sky: the ground splits around each gap and a fall ends the life (the storm below). */
export const GALE_VIXEN_FLOOR_GAPS: FloorGap[] = [
  { x: 560, width: 272 },
  { x: 1056, width: 272 },
  { x: 1456, width: 352 },
  { x: 4752, width: 304 },
  { x: 5504, width: 96 }
]

/** The gaps a gust blows over (the rest are ridden on a carrier or plainly jumped). */
export const GALE_VIXEN_GUST_GAPS = ['gale_gust_teach', 'gale_gust_esc'] as const

export const GALE_VIXEN_HAZARDS: StageHazardDefinition[] = [
  spike('gale_spike_intro_1', 240),
  spike('gale_spike_intro_2', 380),
  spike('gale_spike_dock', 2640),
  spike('gale_spike_roof_1', 3360, 168),
  spike('gale_spike_roof_2', 3456, 168),
  spike('gale_spike_lane_1', 5232),
  spike('gale_spike_lane_2', 5392),
  spike('gale_spike_last', 5664)
]

export const GALE_VIXEN_PLATFORMS: StagePlatformDefinition[] = [
  block('gale_intro_crate', 400, 448, 204),
  // The heart room: the step and the launch ledge, then the heart ledge 440px across, high over the dock.
  ledge('gale_heart_step', 1856, 1904, 148),
  ledge('gale_heart_launch', 1912, 1960, 84),
  ledge('gale_heart_ledge', 2400, 2496, 84),
  column('gale_heart_back', 2496, 2512, 20, 92, 'solid'),
  vane('gale_vane_dock', 2040),
  // Secret: the route runs on the dock office's roof; the breakable wall is its left side.
  { id: 'gale_office_roof', x: 3392, y: 174, width: 208, height: 12, type: 'solid', color: DECK },
  block('gale_office_bulkhead', 3496, 3560, 168),
  // The relay mast: the left wall is plain up to y 20 and a kickable face above it (over ledge B); the right
  // wall is plain (no kick line from the base to the exit). The entrance runs under the left wall.
  column('gale_mast_wall_left', 3584, 3600, 20, 140, 'solid'),
  column('gale_mast_face_left', 3584, 3600, -252, 20, 'wall'),
  column('gale_mast_wall_right', 4464, 4480, -120, BOTTOM, 'solid'),
  ledge('gale_mast_a', 4048, 4112, 100),
  ledge('gale_mast_b', 3600, 3728, 44),
  ledge('gale_mast_c', 4040, 4104, -96),
  ledge('gale_mast_alcove', 3960, 4008, -180),
  ledge('gale_mast_d', 4368, 4464, -120),
  // The cable run: the landing under the mast's exit, the vane past the ferry.
  block('gale_cable_landing', 4480, 4736, 196),
  vane('gale_vane_cable', 5088)
]

export const GALE_VIXEN_WIND_ZONES: WindZoneDefinition[] = [
  // Intro: idle, over flat deck.
  gust('gale_gust_intro', 128, 320, 100, FLOOR, 1),
  // The two gust gaps: from 8px past the take-off rim to the landing rim, up to the top of a jump's arc.
  gust('gale_gust_teach', 568, 832, 90, BOTTOM, 1),
  gust('gale_gust_esc', 1464, 1808, 90, BOTTOM, 1),
  // The heart gust: high over the dock (under it the floor is still), lighter than the route's.
  gust('gale_gust_heart', 1968, 2400, -60, 90, 1, { strength: { force: 900, maxSpeed: 150 } }),
  // The mid-boss room: a band over the floor (the twins stay in view over it).
  gust('gale_gust_midboss', 2704, 3120, 140, FLOOR, 1),
  // The mast: back across the widest gap (A to B), then out to D; both blow while the carriers hold.
  gust('gale_gust_mast_1', 3728, 4040, -40, 124, -1, { phaseMs: GALE_VIXEN_MAST_GUST_PHASE_MS }),
  gust('gale_gust_mast_2', 4112, 4368, -252, -80, 1, { phaseMs: GALE_VIXEN_MAST_GUST_PHASE_MS })
]

export const GALE_VIXEN_CARRIERS: LaneSwapDefinition[] = [
  carriers('gale_ferry_teach', [1092, 1292], 212, 180),
  carriers('gale_mast_carrier_1', [3656, 4008], 212, 180),
  carriers('gale_mast_carrier_2', [3768, 4000], -36, -68),
  carriers('gale_ferry_cable', [4788, 5020], 212, 180)
]

export const GALE_VIXEN_BREAKABLE_WALLS: BreakableWallDefinition[] = [
  { id: 'gale_office_wall', x: 3296, y: 208, width: 16, height: 56, hitsRequired: 3, minChargeLevel: 1, color: OFFICE_WALL }
]

/** The heart room and the relay mast: the ledges over the actor ceiling stand in rooms two screens tall. */
export const GALE_VIXEN_VERTICAL_SEGMENTS: VerticalSegmentDefinition[] = [
  { id: 'gale_heart_room', x: 1792, width: 896, verticalScreens: 2 },
  { id: 'gale_mast', x: GALE_VIXEN_MAST.left, width: GALE_VIXEN_MAST.right - GALE_VIXEN_MAST.left, verticalScreens: 2 }
]

export const GALE_VIXEN_ROOM_LOCKS: RoomLockDefinition[] = [
  { id: 'gale_midboss_lock', room: { x: 2688, y: 0, width: 448, height: 252 }, gateX: 3136, defeatMarkers: GALE_VIXEN_MIDBOSS_MARKERS }
]

export const GALE_VIXEN_LOCATION_ANCHORS: LocationAnchors = {
  heart_tank: { x: 2448, y: 68 },
  sub_tank: { x: 3392, y: 218 },
  capsule: { x: 3984, y: -196 },
  pickup_bonus: { x: 5144, y: 218 }
}

/**
 * 19 placements of the brief's six types (drone 5, shock hopper 4, shield drone 3, laser eye 3, gunner 2,
 * rocket 2) and the mini-boss; each spawns once the hero is 452px short of it (off camera) and retires
 * behind; the mast's retire past the mast, where the ascent doubles back. The twins spawn while the hero is
 * still on the dock and fight inside the locked room (twin 0 perches at the marker, twin 1 at the far end).
 */
export const GALE_VIXEN_ENEMIES: EnemyLevelMarker[] = [
  enemy('gale_teach_drone', 'enemy_drone', 700, 140),
  enemy('gale_teach_shield', 'enemy_shield_drone', 1190, 120),
  enemy('gale_esc_drone', 'enemy_drone', 1640, 120),
  enemy('gale_dock_eye', 'enemy_laser_eye', 2048, 150),
  enemy('gale_dock_hopper_1', 'enemy_shock_hopper', 2150, standingOn(FLOOR)),
  enemy('gale_dock_rocket', 'enemy_rocket_bot', 2300, standingOn(FLOOR), [2260, 2340]),
  enemy('gale_dock_gunner', 'enemy_gunner_bot', 2520, standingOn(FLOOR), [2490, 2560]),
  enemy('gale_dock_hopper_2', 'enemy_shock_hopper', 2590, standingOn(FLOOR)),
  enemy('gale_mid_twins', 'sentry_twin_gale', 2808, 136, [2808, 3048], 420),
  enemy('gale_office_hopper', 'enemy_shock_hopper', 3408, standingOn(168)),
  enemy('gale_office_shield', 'enemy_shield_drone', 3530, 112),
  enemy('gale_mast_shield', 'enemy_shield_drone', 3800, -110, undefined, 800),
  enemy('gale_mast_drone', 'enemy_drone', 3860, 110, undefined, 740),
  enemy('gale_mast_eye', 'enemy_laser_eye', 4250, -40, undefined, 350),
  enemy('gale_cable_drone', 'enemy_drone', 4900, 120),
  enemy('gale_cable_eye', 'enemy_laser_eye', 5096, 150),
  enemy('gale_pre_hopper', 'enemy_shock_hopper', 5310, standingOn(FLOOR)),
  enemy('gale_pre_drone', 'enemy_drone', 5440, 130),
  enemy('gale_pre_gunner', 'enemy_gunner_bot', 5460, standingOn(FLOOR), [5430, 5490]),
  enemy('gale_pre_rocket', 'enemy_rocket_bot', 5690, standingOn(FLOOR), [5670, 5710])
]

/** The whole Weather District route as one patch, registered in `src/content/stages/index.ts`. */
export const GALE_VIXEN_PATCH: StageExtensionPatch = {
  width: GALE_VIXEN_ROUTE_WIDTH,
  bossSpawnX: GALE_VIXEN_ROUTE_WIDTH - 84,
  checkpoints: GALE_VIXEN_CHECKPOINTS,
  hazards: GALE_VIXEN_HAZARDS,
  midPlatforms: GALE_VIXEN_PLATFORMS,
  enemyMarkers: GALE_VIXEN_ENEMIES,
  roomLocks: GALE_VIXEN_ROOM_LOCKS,
  arena: {
    floorGaps: GALE_VIXEN_FLOOR_GAPS,
    locationAnchors: GALE_VIXEN_LOCATION_ANCHORS,
    verticalSegments: GALE_VIXEN_VERTICAL_SEGMENTS,
    breakableWalls: GALE_VIXEN_BREAKABLE_WALLS,
    windZones: GALE_VIXEN_WIND_ZONES,
    laneSwaps: GALE_VIXEN_CARRIERS
  }
}
