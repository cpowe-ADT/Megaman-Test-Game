import type { EnemyLevelMarker } from '../../enemy/types'
import type { StageHazardDefinition } from '../../mechanics/hazards'
import type { RoomLockDefinition, VerticalSegmentDefinition } from '../../mechanics/roomLock'
import type { CrumbleGroupDefinition } from '../../mechanics/crumbleGroup'
import type { BreakableWallDefinition } from '../../mechanics/breakableWall'
import type { IceFloorDefinition } from '../../mechanics/iceFloor'
import type { IcicleDefinition, IcicleRhythm } from '../../mechanics/icicle'
import type { FloorGap } from '../../stage/stageGeometry'
import type { StagePlatformDefinition, LocationAnchors, StageExtensionPatch } from '../campaign'
import type { BossRoomFeatures } from '../../boss/bossRoomLayout'

/**
 * Public Archives (`glacier_ronin`), rebuilt to the Heat Works standard (prompt 12 part 12d, EVAL-P6-010;
 * brief in `docs/design/stage-briefs.md`). Twelve 448px screens before the unchanged boss room:
 *
 *   0 intro       0-448      safe landing, one ice patch on flat ground (the idle mechanic), a frost spike
 *   1-2 teach     448-1344   the first frozen pit, an ice run with a scraper that ends 16px short of the
 *                            second pit, the first cracked ceiling (two icicles that drop once the hero
 *                            passes under; a running hero is clear before they land), then the ice shelves
 *                            (a crumble group at floor height over a 164px frozen pit: walk it at a run)
 *   3-4 escalate  1344-2240  checkpoint 2 and the radio, ice under a cracked ceiling with a scraper, the
 *                            capsule in the dip between two record crates (on the route), then the cold
 *                            store (two screens tall): the step and the ice launch ledge, the sub tank ledge
 *                            296px across over a frozen pit (only a dash jump started on the ice clears it;
 *                            a short jump falls toward the pit), a frost turret on the floor lane
 *   5 secret      2240-2688  the route runs over the ice vault's roof; a charged shot (or three cuts)
 *                            breaks its ice wall; the heart tank inside
 *   6 midboss     2688-3136  the custodian walker (Glacier skin) on an ice floor: locks on entry (callout),
 *                            opens once it falls
 *   7-9 master    3136-4480  checkpoint 3, then the record gallery (x 3232-4400): a low ceiling, four record
 *                            stacks hang from it to 18px over the floor (walls: only a slide passes under),
 *                            three bays of ice with grip patches between the icicle lanes, the icicles drop
 *                            on a 2.4s rhythm (a floor shadow while they shake and fall), a frost turret on
 *                            each bay's far stack covers its lane
 *   10-11 preboss 4480-5376  the breather (bonus pickup), the full-speed ice lane with its spikes, the last
 *                            frozen pit, checkpoint 4 on the landing before the boss door
 *
 * Measured on this build (Heat Works, 2026-09-24, flat floor): a held running jump rises about 124px and
 * covers about 246px; a held dash jump covers about 336px; run speed 220px/s. On ice a grounded dash lasts
 * 40% longer (about 125px) and a released run slides about 33px (friction x0.35). The dash body is 14px
 * tall, the crouch 18 and the stand 22: an 18px slot under a stack takes only a slide. Every pit is under
 * 180px; the sub tank gap is 296px. The main ground's top is y 236; the actor ceiling is y 90 outside the
 * cold store, and the ceilings and stacks start at y 88 (nothing stands on them).
 */

const FLOOR = 236
const BOTTOM = 252
const CRATE = 0x4e79a6
const SHELF = 0x6f9cc8
const STACK = 0x2f4a66
const CEILING = 0x233a52
const ICE_SHELF = 0xa8dcff
const ICE_WALL = 0xbfe8ff

/** The ceiling slab's bottom: icicles hang from it, under the HUD band (as the mechanics lab's does). */
const CEILING_LINE = 104
const CEILING_TOP = 88
/** A record stack hangs to here: an 18px slot over the floor, under the stand (22) and crouch (18) bodies. */
const STACK_FOOT = 218

/** A raised block standing on the ground (its faces run down into the pit walls). */
function block(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'solid', color: CRATE }
}

/** A one-way shelf whose walking surface is `top`. */
function ledge(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left, type: 'oneWay', color: SHELF }
}

/** A block between two lines: `wall` faces take slides and kicks, `solid` faces do not. */
function column(id: string, left: number, right: number, top: number, bottom: number, type: 'wall' | 'solid', color = STACK): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, type, color }
}

/** A cracked ceiling slab (y 88-104) the icicles hang from. */
const ceiling = (id: string, left: number, right: number) => column(id, left, right, CEILING_TOP, CEILING_LINE, 'solid', CEILING)

/** A record stack: hangs from the ceiling to 18px over the floor; its faces are walls. */
const stack = (id: string, left: number, right: number) => column(id, left, right, CEILING_TOP, STACK_FOOT, 'wall')

/** Ice flush with the floor (its top on `top`), or a one-way ice ledge. */
function ice(id: string, left: number, right: number, top = FLOOR, type: 'solid' | 'oneWay' = 'solid'): IceFloorDefinition {
  const height = type === 'oneWay' ? 8 : 16
  return { id, x: (left + right) / 2, y: top + height / 2, width: right - left, height, type }
}

/** A frost spike strip (28x10, 1 HP) on the floor or on `surfaceTop`. */
function spike(id: string, x: number, surfaceTop = FLOOR): StageHazardDefinition {
  return { id, x, y: surfaceTop - 6 }
}

/** An icicle under a ceiling slab: it drops when the hero passes under, or on the gallery's rhythm. */
function icicle(id: string, x: number, rhythm?: IcicleRhythm): IcicleDefinition {
  return { id, x, y: CEILING_LINE, floorY: FLOOR, ...(rhythm ? { rhythm } : {}) }
}

/** The gallery's beat: one drop per 2.4s of stage clock; the offsets make a wave along each bay. */
export const GLACIER_RONIN_ICICLE_PERIOD_MS = 2400
const beat = (offsetMs: number): IcicleRhythm => ({ periodMs: GLACIER_RONIN_ICICLE_PERIOD_MS, offsetMs })

/** Crumble ice shelves laid edge to edge over a pit at floor height (`top` 236), 2px apart. */
function shelves(id: string, left: number, count: number, width: number): CrumbleGroupDefinition {
  return {
    id,
    color: ICE_SHELF,
    platforms: Array.from({ length: count }, (_, index) => ({
      id: `${id}_${index + 1}`,
      x: left + 2 + index * (width + 2) + width / 2,
      y: FLOOR + 4,
      width
    }))
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

export const GLACIER_RONIN_ROUTE_WIDTH = 12 * 448
/** The mini-boss (`custodian_walker` in its Glacier skin, 12c): the room's gate opens once it falls. */
export const GLACIER_RONIN_MIDBOSS_MARKERS = ['glacier_mid_custodian']
/** The record gallery (the master): ceiling, stacks and bays between these x's. */
export const GLACIER_RONIN_GALLERY = { left: 3232, right: 4400 }

export const GLACIER_RONIN_CHECKPOINTS = [
  checkpoint('glacier_start', 44, 0),
  checkpoint('glacier_mid_a', 1400, 1384, 'glacier_ronin_radio'),
  checkpoint('glacier_mid_b', 3184, 3168),
  checkpoint('glacier_boss_gate', 5296, 5264)
]

/** Frozen pits: the ground splits around them and a fall ends the life (ice water at the bottom). */
export const GLACIER_RONIN_FLOOR_GAPS: FloorGap[] = [
  { x: 480, width: 80 },
  { x: 800, width: 96 },
  { x: 1184, width: 164 },
  { x: 1952, width: 128 },
  { x: 5040, width: 96 }
]

export const GLACIER_RONIN_HAZARDS: StageHazardDefinition[] = [
  spike('glacier_spike_intro', 360),
  spike('glacier_spike_teach', 944),
  spike('glacier_spike_store', 1872),
  spike('glacier_spike_roof', 2496, 168),
  spike('glacier_spike_secret', 2640),
  spike('glacier_spike_lane_1', 4736),
  spike('glacier_spike_lane_2', 4896),
  spike('glacier_spike_last', 5184)
]

export const GLACIER_RONIN_PLATFORMS: StagePlatformDefinition[] = [
  // Teach and escalate: the cracked ceilings, the capsule dip between two record crates.
  ceiling('glacier_teach_ceiling', 1008, 1136),
  ceiling('glacier_esc_ceiling', 1488, 1616),
  block('glacier_capsule_crate_a', 1632, 1680, 196),
  block('glacier_capsule_crate_b', 1728, 1776, 196),
  // The cold store (two screens tall): the step, then the ice launch ledge (an ice floor below); the sub tank
  // ledge 296px across, its back wall stops the landing slide.
  ledge('glacier_store_step', 1824, 1880, 148),
  ledge('glacier_store_subtank', 2152, 2200, 84),
  column('glacier_store_back', 2200, 2216, 20, 92, 'solid'),
  // Secret: the route runs on the ice vault's roof; the breakable ice wall is its left side.
  { id: 'glacier_vault_roof', x: 2440, y: 174, width: 208, height: 12, type: 'solid', color: CRATE },
  block('glacier_vault_bulkhead', 2544, 2608, 168),
  // The record gallery: one low ceiling, four stacks hanging from it (walls), three bays between them.
  ceiling('glacier_gallery_ceiling', GLACIER_RONIN_GALLERY.left, GLACIER_RONIN_GALLERY.right),
  stack('glacier_stack_1', 3232, 3264),
  stack('glacier_stack_2', 3600, 3632),
  stack('glacier_stack_3', 3968, 4000),
  stack('glacier_stack_4', 4368, 4400)
]

/** Ice: flush with the floor, except the cold store's one-way launch ledge (a dash started on it runs 40% longer). */
export const GLACIER_RONIN_ICE: IceFloorDefinition[] = [
  ice('glacier_intro_ice', 112, 208),
  ice('glacier_teach_ice', 608, 784),
  ice('glacier_esc_ice', 1456, 1616),
  ice('glacier_store_launch', 1800, 1856, 84, 'oneWay'),
  ice('glacier_mid_ice', 2752, 3072),
  // The gallery's bays: ice lanes under the icicles, grip patches (plain floor) between them.
  ice('glacier_gallery_ice_1a', 3264, 3360),
  ice('glacier_gallery_ice_1b', 3408, 3504),
  ice('glacier_gallery_ice_1c', 3552, 3600),
  ice('glacier_gallery_ice_2a', 3632, 3728),
  ice('glacier_gallery_ice_2b', 3776, 3872),
  ice('glacier_gallery_ice_2c', 3920, 3968),
  ice('glacier_gallery_ice_3a', 4000, 4096),
  ice('glacier_gallery_ice_3b', 4144, 4240),
  ice('glacier_gallery_ice_3c', 4288, 4368),
  ice('glacier_lane_ice', 4672, 4992)
]

/** The gallery's grip patches: plain floor between the ice lanes, clear of every icicle (the safe stops). */
export const GLACIER_RONIN_SAFE_PATCHES: Array<{ left: number; right: number }> = [
  { left: 3360, right: 3408 },
  { left: 3504, right: 3552 },
  { left: 3728, right: 3776 },
  { left: 3872, right: 3920 },
  { left: 4096, right: 4144 },
  { left: 4240, right: 4288 }
]

export const GLACIER_RONIN_ICICLES: IcicleDefinition[] = [
  // Teach and escalate: they drop when the hero passes under (a running hero is clear before they land).
  icicle('glacier_icicle_teach_1', 1040),
  icicle('glacier_icicle_teach_2', 1104),
  icicle('glacier_icicle_esc_1', 1520),
  icicle('glacier_icicle_esc_2', 1584),
  // The gallery: over the middle of each ice lane, on the rhythm.
  icicle('glacier_icicle_gallery_1a', 3312, beat(0)),
  icicle('glacier_icicle_gallery_1b', 3456, beat(800)),
  icicle('glacier_icicle_gallery_2a', 3680, beat(400)),
  icicle('glacier_icicle_gallery_2b', 3824, beat(1200)),
  icicle('glacier_icicle_gallery_3a', 4048, beat(0)),
  icicle('glacier_icicle_gallery_3b', 4192, beat(800)),
  icicle('glacier_icicle_gallery_3c', 4328, beat(1600))
]

export const GLACIER_RONIN_CRUMBLES: CrumbleGroupDefinition[] = [shelves('glacier_ice_shelves', 1184, 3, 52)]

export const GLACIER_RONIN_BREAKABLE_WALLS: BreakableWallDefinition[] = [
  { id: 'glacier_ice_wall', x: 2344, y: 208, width: 16, height: 56, hitsRequired: 3, minChargeLevel: 1, color: ICE_WALL }
]

/** The cold store: the launch and sub tank ledges stand above the actor ceiling, so the room is two screens tall. */
export const GLACIER_RONIN_VERTICAL_SEGMENTS: VerticalSegmentDefinition[] = [{ id: 'glacier_cold_store', x: 1792, width: 448, verticalScreens: 2 }]

export const GLACIER_RONIN_ROOM_LOCKS: RoomLockDefinition[] = [
  { id: 'glacier_midboss_lock', room: { x: 2688, y: 0, width: 448, height: 252 }, gateX: 3136, defeatMarkers: GLACIER_RONIN_MIDBOSS_MARKERS }
]

export const GLACIER_RONIN_LOCATION_ANCHORS: LocationAnchors = {
  capsule: { x: 1704, y: 218 },
  heart_tank: { x: 2448, y: 218 },
  sub_tank: { x: 2176, y: 68 },
  pickup_bonus: { x: 4560, y: 218 }
}

/**
 * 20 placements of the brief's seven types (armored bot 4, frost turret 4, drone 3, gunner 3, laser eye 2,
 * bouncer 2, mine bot 2) and the mini-boss; each spawns once the hero is 452px short of it (off camera)
 * and retires behind. The gallery's turrets sit on each bay's far stack, one lane each. The custodian stands
 * 368px into its room, so it wakes as the hero enters (its reach is 360px).
 */
export const GLACIER_RONIN_ENEMIES: EnemyLevelMarker[] = [
  enemy('glacier_teach_scraper', 'enemy_armored_bot', 700, standingOn(FLOOR), [632, 768]),
  enemy('glacier_teach_drone', 'enemy_drone', 900, 140),
  enemy('glacier_teach_eye', 'enemy_laser_eye', 1296, 206),
  enemy('glacier_esc_scraper', 'enemy_armored_bot', 1560, standingOn(FLOOR), [1470, 1604]),
  enemy('glacier_esc_mine', 'enemy_mine_bot', 1752, standingOn(196)),
  enemy('glacier_store_drone', 'enemy_drone', 1880, 40, undefined, 300),
  enemy('glacier_store_gunner', 'enemy_gunner_bot', 2150, standingOn(FLOOR), [2096, 2190]),
  enemy('glacier_store_turret', 'enemy_frost_turret', 2228, 180),
  enemy('glacier_secret_bouncer', 'enemy_bouncer', 2470, standingOn(168)),
  enemy('glacier_secret_eye', 'enemy_laser_eye', 2580, 120),
  // 12c: "it slides further than it means to" (the brief's mini-boss line) — the Glacier skin's ice-slide variant.
  { ...enemy('glacier_mid_custodian', 'custodian_walker_glacier', 3056, standingOn(FLOOR), [2768, 3104]), variant: 'glacier_slide' },
  enemy('glacier_gallery_mine', 'enemy_mine_bot', 3440, standingOn(FLOOR)),
  enemy('glacier_gallery_turret_1', 'enemy_frost_turret', 3590, 164),
  enemy('glacier_gallery_scraper', 'enemy_armored_bot', 3850, standingOn(FLOOR), [3790, 3910]),
  enemy('glacier_gallery_turret_2', 'enemy_frost_turret', 3958, 164),
  enemy('glacier_gallery_gunner', 'enemy_gunner_bot', 4200, standingOn(FLOOR), [4150, 4280]),
  enemy('glacier_gallery_turret_3', 'enemy_frost_turret', 4358, 164),
  enemy('glacier_pre_bouncer', 'enemy_bouncer', 4640, standingOn(FLOOR)),
  enemy('glacier_pre_drone', 'enemy_drone', 4900, 140),
  enemy('glacier_pre_gunner', 'enemy_gunner_bot', 5000, standingOn(FLOOR), [4960, 5030]),
  enemy('glacier_pre_armored', 'enemy_armored_bot', 5220, standingOn(FLOOR), [5150, 5240])
]

/**
 * The boss room (12f wave 6, EVAL-P7-005; the brief's `flat` ice floor): one 12b ice floor flush with the ground,
 * wall to wall, so the hero's slide and footing on the ice are the fight against the shard volleys.
 */
export const GLACIER_RONIN_BOSS_ROOM: BossRoomFeatures = {
  layout: 'ice_floor',
  mechanics: { iceFloors: [ice('glacier_boss_ice', GLACIER_RONIN_ROUTE_WIDTH, GLACIER_RONIN_ROUTE_WIDTH + 448)] }
}

/** The whole Public Archives route as one patch, registered in `src/content/stages/index.ts`. */
export const GLACIER_RONIN_PATCH: StageExtensionPatch = {
  width: GLACIER_RONIN_ROUTE_WIDTH,
  bossSpawnX: GLACIER_RONIN_ROUTE_WIDTH - 84,
  bossRoom: GLACIER_RONIN_BOSS_ROOM,
  checkpoints: GLACIER_RONIN_CHECKPOINTS,
  hazards: GLACIER_RONIN_HAZARDS,
  midPlatforms: GLACIER_RONIN_PLATFORMS,
  enemyMarkers: GLACIER_RONIN_ENEMIES,
  roomLocks: GLACIER_RONIN_ROOM_LOCKS,
  arena: {
    floorGaps: GLACIER_RONIN_FLOOR_GAPS,
    locationAnchors: GLACIER_RONIN_LOCATION_ANCHORS,
    verticalSegments: GLACIER_RONIN_VERTICAL_SEGMENTS,
    crumbleGroups: GLACIER_RONIN_CRUMBLES,
    breakableWalls: GLACIER_RONIN_BREAKABLE_WALLS,
    iceFloors: GLACIER_RONIN_ICE,
    icicles: GLACIER_RONIN_ICICLES
  }
}
