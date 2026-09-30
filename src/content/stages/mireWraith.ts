import type { EnemyLevelMarker } from '../../enemy/types'
import type { StageHazardDefinition } from '../../mechanics/hazards'
import type { RoomLockDefinition, VerticalSegmentDefinition } from '../../mechanics/roomLock'
import type { RisingLiquidDefinition } from '../../mechanics/risingLiquid'
import type { CrumbleGroupDefinition } from '../../mechanics/crumbleGroup'
import type { BreakableWallDefinition } from '../../mechanics/breakableWall'
import type { FloorGap } from '../../stage/stageGeometry'
import type { StagePlatformDefinition, LocationAnchors, StageExtensionPatch } from '../campaign'
import type { BossRoomChannel, BossRoomFeatures } from '../../boss/bossRoomLayout'

/**
 * Medicine District (`mire_wraith`), rebuilt to the Heat Works standard (prompt 12 part 12d, EVAL-P6-010;
 * brief in `docs/design/stage-briefs.md`). Twelve 448px screens before the unchanged boss room:
 *
 *   0 intro       0-448      safe landing, a quarantine crate step, one thorn patch (always on)
 *   1-2 teach     448-1344   the first acid pit, a crate with a spore forager, the crumble walkway over
 *                            a 176px acid pit (walkable at a run, or jump it), thorns under a drone
 *   3-4 escalate  1344-2240  checkpoint 2 and the radio, a crumble walkway over acid, fly trap on a crate,
 *                            the capsule in the dip between two crate stacks (on the route), an acid pit
 *   5 midboss     2240-2688  the drill serpent's room: locks on entry (callout), opens once it falls
 *   6 secret      2688-3136  checkpoint 3; the route runs over the crate room's roof; a charged shot (or
 *                            three cuts) breaks its wall; the heart tank inside
 *   7-9 master    3136-4480  the filter tower (x 3136-3896, two screens tall): the pre-chamber, where the
 *                            sub tank ledge sits 296px from the launch ledge (a dash jump; a miss lands on
 *                            the floor), then the hatch whose floor plate is the filter switch (every way
 *                            up passes it): tripping it starts the acid in the tower and the pre-chamber
 *                            (the sub tank goes under); the climb (crumble walkways, the kickable hatch
 *                            face and right wall, Heat Works' measured ledges); then the works floor with
 *                            a crumble walkway over an acid pit
 *   10-11 preboss 4480-5376  the breather (bonus pickup), the full-speed thorn lane, the last pit,
 *                            checkpoint 4 on the landing before the boss door
 *
 * Measured on this build (Heat Works, 2026-09-24, flat floor): a held running jump rises about 124px and
 * covers about 246px; a held dash jump covers about 336px; run speed 220px/s, so a 56px crumble plank is
 * underfoot about 330ms (it falls 400ms after the first step). Every pit is under 180px; the sub tank gap
 * is 296px. The main ground's top is y 236; the actor ceiling is y 90 outside the tower.
 */

const FLOOR = 236
const BOTTOM = 252
const CRATE = 0x3d5a3a
const WALKWAY = 0x4f7a45
const FILTER = 0x2a3b30
/** Chartreuse acid, apart from the district's green tiles: the rising acid and the pits (`filterSwitch.ts`). */
const ACID = 0x9be22d
const ACID_SURFACE = 0xf1ffa6

/** A raised block standing on the ground (its faces run down into the pit walls). */
function block(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'solid', color: CRATE }
}

/** A one-way walkway whose walking surface is `top`. */
function ledge(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left, type: 'oneWay', color: WALKWAY }
}

/** A tall block: `wall` faces take slides and kicks, `solid` faces do not. */
function column(id: string, left: number, right: number, top: number, bottom: number, type: 'wall' | 'solid'): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, type, color: FILTER }
}

/** Spore thorns on the floor (the Mire atlas's spike cell): always on, 2 HP a touch. */
function thorns(id: string, x: number): StageHazardDefinition {
  return { id, x, y: FLOOR - 5, width: 28, height: 10, damage: 2 }
}

/** Crumble planks laid edge to edge over a pit at floor height (`top` 236), 2px apart. */
function walkway(id: string, left: number, count: number, width: number) {
  return {
    id,
    platforms: Array.from({ length: count }, (_, index) => ({
      id: `${id}_${index + 1}`,
      x: left + 2 + index * (width + 2) + width / 2,
      y: FLOOR + 4,
      width
    }))
  }
}

/** Ground enemies spawn 51px above what they stand on and settle; fliers and the fly traps use their own y. */
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

export const MIRE_WRAITH_ROUTE_WIDTH = 12 * 448
/** The mini-boss (`drill_serpent`, 12c): the room's gate opens once it falls. */
export const MIRE_WRAITH_MIDBOSS_MARKERS = ['mire_mid_serpent']

export const MIRE_WRAITH_CHECKPOINTS = [
  checkpoint('mire_start', 44, 0),
  checkpoint('mire_mid_a', 1392, 1376, 'mire_wraith_radio'),
  checkpoint('mire_mid_b', 2736, 2720),
  checkpoint('mire_boss_gate', 5296, 5264)
]

/** Acid pits: the ground splits around them and the acid strip at the bottom kills. */
export const MIRE_WRAITH_FLOOR_GAPS: FloorGap[] = [
  { x: 480, width: 80 },
  { x: 832, width: 176 },
  { x: 1472, width: 144 },
  { x: 2112, width: 80 },
  { x: 4024, width: 176 },
  { x: 5152, width: 80 }
]

export const MIRE_WRAITH_HAZARDS: StageHazardDefinition[] = [
  thorns('mire_thorns_intro', 360),
  thorns('mire_thorns_teach', 1264),
  thorns('mire_thorns_esc', 1912),
  thorns('mire_thorns_works_1', 4344),
  thorns('mire_thorns_works_2', 4440),
  thorns('mire_thorns_lane_1', 4816),
  thorns('mire_thorns_lane_2', 4912),
  thorns('mire_thorns_lane_3', 5008)
]

export const MIRE_WRAITH_PLATFORMS: StagePlatformDefinition[] = [
  // Intro, teach, escalate: quarantine crates; the capsule dip between the two stacks.
  block('mire_intro_crates', 208, 288, 204),
  block('mire_teach_crates', 640, 736, 196),
  block('mire_teach_crate_b', 1120, 1200, 204),
  block('mire_esc_crates', 1792, 1888, 196),
  block('mire_capsule_crate_a', 1936, 2000, 196),
  block('mire_capsule_crate_b', 2048, 2112, 196),
  // Secret: the route runs on the crate room's roof; the breakable wall is its left side.
  { id: 'mire_crate_roof', x: 2936, y: 174, width: 208, height: 12, type: 'solid', color: CRATE },
  block('mire_crate_bulkhead', 3040, 3104, 168),
  // The filter tower's pre-chamber: its entrance wall, the step and launch ledge, the sub tank ledge
  // (both ledges 152px over the floor, a held jump rises about 127), then the hatch over the switch.
  column('mire_tower_wall_left', 3136, 3152, -252, 140, 'solid'),
  ledge('mire_tower_launch', 3152, 3200, 84),
  ledge('mire_tower_step', 3208, 3264, 144),
  ledge('mire_tower_subtank', 3496, 3536, 84),
  column('mire_tower_hatch', 3536, 3544, -252, 140, 'solid'),
  column('mire_tower_hatch_face', 3544, 3552, -252, 140, 'wall'),
  // The climb: Heat Works' ledge pattern (x offset -200) with two of its ledges turned to crumbles.
  column('mire_tower_wall_right', 3880, 3896, -150, BOTTOM, 'wall'),
  ledge('mire_climb_1', 3568, 3632, 196),
  ledge('mire_climb_4', 3672, 3736, 64),
  ledge('mire_climb_7', 3784, 3864, -68),
  ledge('mire_climb_8', 3672, 3736, -112),
  ledge('mire_climb_9', 3784, 3864, -150),
  block('mire_works_landing', 3896, 4024, 188)
]

export const MIRE_WRAITH_CRUMBLES: CrumbleGroupDefinition[] = [
  walkway('mire_teach_walkway', 832, 3, 56),
  walkway('mire_esc_walkway', 1472, 3, 46),
  {
    id: 'mire_climb_crumble',
    platforms: [
      { id: 'mire_climb_crumble_a', x: 3712, y: 156, width: 80 },
      { id: 'mire_climb_crumble_b', x: 3824, y: 112, width: 80 },
      { id: 'mire_climb_crumble_c', x: 3600, y: 24, width: 64 },
      { id: 'mire_climb_crumble_d', x: 3708, y: -20, width: 56 }
    ]
  },
  walkway('mire_works_walkway', 4024, 3, 56)
]

export const MIRE_WRAITH_BREAKABLE_WALLS: BreakableWallDefinition[] = [
  { id: 'mire_crate_wall', x: 2840, y: 208, width: 16, height: 56, hitsRequired: 3, minChargeLevel: 1 }
]

/** The tower is wider than a screen (pre-chamber and shaft): the camera scrolls both ways inside it. */
export const MIRE_WRAITH_VERTICAL_SEGMENTS: VerticalSegmentDefinition[] = [
  { id: 'mire_filter_tower', x: 3136, width: 760, verticalScreens: 2 }
]

/**
 * The filter tower's acid: dormant until the hero's body touches the hatch plate (the switch), then from
 * 40px under the floor (about 1.4s to cover it) to 20px under the exit ledge over 14s. It covers the sub
 * tank ledge about 6s after the trip; the checkpoint-3 respawn resets it and re-arms the switch.
 */
export const MIRE_WRAITH_ACID: RisingLiquidDefinition[] = [
  {
    id: 'mire_acid',
    x: 3152,
    width: 728,
    floorY: FLOOR + 40,
    topY: -130,
    riseMs: 14000,
    triggerX: 3544,
    switchBox: { x: 3544, y: 188, width: 16, height: 96 },
    color: ACID,
    surfaceColor: ACID_SURFACE
  }
]

export const MIRE_WRAITH_ROOM_LOCKS: RoomLockDefinition[] = [
  { id: 'mire_midboss_lock', room: { x: 2240, y: 0, width: 448, height: 252 }, gateX: 2688, defeatMarkers: MIRE_WRAITH_MIDBOSS_MARKERS }
]

export const MIRE_WRAITH_LOCATION_ANCHORS: LocationAnchors = {
  capsule: { x: 2024, y: 218 },
  heart_tank: { x: 2944, y: 218 },
  sub_tank: { x: 3516, y: 68 },
  pickup_bonus: { x: 4600, y: 218 }
}

/**
 * 18 placements of the brief's five types (mine bot 5, drone 4, fly trap 3, shield drone 3, bouncer 3)
 * and the mini-boss; each spawns once the hero is 448px short of it (off camera) and retires behind. The
 * serpent spawns while the hero is still on the escalate floor, wakes as the hero enters (its reach is
 * 360px), and tunnels and lunges between the room's walls.
 */
export const MIRE_WRAITH_ENEMIES: EnemyLevelMarker[] = [
  enemy('mire_teach_mine', 'enemy_mine_bot', 688, standingOn(196), 240, 880),
  enemy('mire_teach_fly', 'enemy_fly_trap', 1160, 194, 712, 1330),
  enemy('mire_teach_drone', 'enemy_drone', 1300, 150, 852, 1480),
  enemy('mire_esc_shield', 'enemy_shield_drone', 1650, 130, 1200, 1820),
  enemy('mire_esc_mine', 'enemy_mine_bot', 1690, standingOn(FLOOR), 1240, 1830),
  enemy('mire_esc_bouncer', 'enemy_bouncer', 1750, standingOn(FLOOR), 1300, 1880),
  enemy('mire_esc_fly', 'enemy_fly_trap', 1840, 186, 1392, 1990),
  enemy('mire_esc_drone', 'enemy_drone', 2040, 140, 1590, 2200),
  enemy('mire_mid_serpent', 'drill_serpent', 2600, standingOn(FLOOR), 2150, 2800, [2280, 2648]),
  enemy('mire_secret_mine', 'enemy_mine_bot', 2960, standingOn(168), 2510, 3100),
  enemy('mire_secret_shield', 'enemy_shield_drone', 3080, 120, 2630, 3180),
  enemy('mire_tower_fly', 'enemy_fly_trap', 3310, 225, 2860, 3480),
  enemy('mire_tower_drone', 'enemy_drone', 3720, -40, 3270, 3980),
  enemy('mire_tower_mine', 'enemy_mine_bot', 3824, standingOn(-68), 3370, 3980),
  enemy('mire_works_bouncer', 'enemy_bouncer', 4280, standingOn(FLOOR), 3830, 4420),
  enemy('mire_works_shield', 'enemy_shield_drone', 4400, 130, 3950, 4560),
  enemy('mire_pre_mine', 'enemy_mine_bot', 4700, standingOn(FLOOR), 4250, 4840),
  enemy('mire_pre_drone', 'enemy_drone', 4960, 140, 4510, 5100),
  enemy('mire_pre_bouncer', 'enemy_bouncer', 5080, standingOn(FLOOR), 4630, 5160)
]

/**
 * The boss room (12f wave 6, EVAL-P7-005; the brief's `pits` with acid): two shallow acid channels (12px on a
 * solid bed; the stage's pit liquid draws the acid in every cut) between the combat profile's anchors (0.2, 0.5,
 * 0.8). The acid hurts as a hazard does (1 HP from a box on the bed). 32px wide, narrower than the Wraith's floor
 * body, so she slides across a channel on its banks while the hero can drop in.
 */
const MIRE_ROOM_X = MIRE_WRAITH_ROUTE_WIDTH
const MIRE_BOSS_CHANNELS: BossRoomChannel[] = [
  { id: 'mire_boss_channel_1', x: MIRE_ROOM_X + 150, width: 32, depth: 12, color: 0x2c3a1e },
  { id: 'mire_boss_channel_2', x: MIRE_ROOM_X + 266, width: 32, depth: 12, color: 0x2c3a1e }
]
export const MIRE_WRAITH_BOSS_ROOM: BossRoomFeatures = {
  layout: 'channels',
  channels: MIRE_BOSS_CHANNELS,
  hazards: MIRE_BOSS_CHANNELS.map((channel) => ({
    id: `${channel.id}_acid`,
    x: channel.x + channel.width / 2,
    y: FLOOR + channel.depth - 3,
    width: channel.width - 4,
    height: 6,
    damage: 1
  }))
}

/** The whole Medicine District route as one patch, registered in `src/content/stages/index.ts`. */
export const MIRE_WRAITH_PATCH: StageExtensionPatch = {
  width: MIRE_WRAITH_ROUTE_WIDTH,
  bossSpawnX: MIRE_WRAITH_ROUTE_WIDTH - 84,
  bossRoom: MIRE_WRAITH_BOSS_ROOM,
  checkpoints: MIRE_WRAITH_CHECKPOINTS,
  hazards: MIRE_WRAITH_HAZARDS,
  midPlatforms: MIRE_WRAITH_PLATFORMS,
  enemyMarkers: MIRE_WRAITH_ENEMIES,
  roomLocks: MIRE_WRAITH_ROOM_LOCKS,
  arena: {
    floorGaps: MIRE_WRAITH_FLOOR_GAPS,
    locationAnchors: MIRE_WRAITH_LOCATION_ANCHORS,
    verticalSegments: MIRE_WRAITH_VERTICAL_SEGMENTS,
    risingLiquids: MIRE_WRAITH_ACID,
    crumbleGroups: MIRE_WRAITH_CRUMBLES,
    breakableWalls: MIRE_WRAITH_BREAKABLE_WALLS
  }
}
