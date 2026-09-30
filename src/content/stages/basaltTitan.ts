import type { EnemyLevelMarker } from '../../enemy/types'
import type { StageHazardDefinition } from '../../mechanics/hazards'
import type { RoomLockDefinition, VerticalSegmentDefinition } from '../../mechanics/roomLock'
import type { CrumbleGroupDefinition, CrumblePlatformDefinition } from '../../mechanics/crumbleGroup'
import type { RockfallDefinition } from '../../mechanics/rockfall'
import type { BreakableWallDefinition } from '../../mechanics/breakableWall'
import type { FloorGap } from '../../stage/stageGeometry'
import type { StagePlatformDefinition, LocationAnchors, StageExtensionPatch } from '../campaign'
import type { BossRoomFeatures } from '../../boss/bossRoomLayout'

/**
 * Structural Works (`basalt_titan`), rebuilt to the Heat Works standard (prompt 12 part 12d, EVAL-P6-010;
 * brief in `docs/design/stage-briefs.md`). Twelve 448px screens before the unchanged boss room:
 *
 *   0 intro       0-448      safe landing, a load-lined step and one idle crumble slab beside it
 *   1-2 teach     448-1344   crumble footing alone: a pit with a crumble stone, a load-lined deck, a crumble
 *                            bridge over the second pit; then rockfall alone under the collapsed gallery (its
 *                            roof holds jumps down): the first drop lands before a running hero arrives
 *   3-4 escalate  1344-2240  checkpoint 2 and the radio, a rubble pit with a stone and a drop past it, a laser
 *                            eye on support A; then support pad A, a wave room: two shock hoppers and a hauler,
 *                            then a compactor and a hopper dropping in; the gate opens on the last
 *   5 secret      2240-2688  the route runs over the crew hut: a charged shot breaks its wall (heart tank);
 *                            the capsule alcove over the roof (armor, before the mid-boss); an eye on the bulkhead
 *   6 midboss     2688-3136  the shaft head, locked until the custodian walker (Basalt skin) falls: it walks
 *                            the load-lined pad, and its stomp shakes the slabs on the side it faces (they hold
 *                            the hero otherwise) over spiked trenches
 *   7-9 master    3136-4480  checkpoint 3, the headframe climb (two screens tall, wall faces, load-lined ledges,
 *                            two crumbles, a rockfall on the top left ledge); the shaft descent (two screens
 *                            tall): load-lined ledges and crumbling ledges down to the floor under rain from
 *                            above; across the open chasm, the sub tank side shaft (one-way ledges, no face a
 *                            wall kick could climb) that only a dash jump off a crumbling ledge reaches; then
 *                            support pad B, a wave room
 *   10-11 preboss 4480-5376  the breather (bonus pickup, a hauler), a pit with a stone, the full-speed lane
 *                            (spikes, drops a running hero outpaces), the last pit, checkpoint 4 before the door
 *
 * Measured on this build (2026-09-24, Heat Works): a held running jump rises about 124px and covers about
 * 246px; a dash jump covers about 336px. Every pit is under 180px. A crumble shakes 350ms after the hero lands
 * and returns 2.5s after it falls (02 §2.2). The main ground's top is y 236; the actor ceiling is y 90 outside
 * the two tall rooms (the gallery roof hangs under the HUD band and is not a ledge).
 */

const FLOOR = 236
const BOTTOM = 252
const QUARRY = 0x4b3c29
const CATWALK = 0x6b5236
const CASING = 0x3a2e22
const SHAKE_MS = 350
const RESPAWN_MS = 2500

/** A raised block standing on the ground (its faces run down into the pit walls). */
function block(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + BOTTOM) / 2, width: right - left, height: BOTTOM - top, type: 'solid', color: QUARRY }
}

/** A one-way catwalk whose walking surface is `top`. */
function ledge(id: string, left: number, right: number, top: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left, type: 'oneWay', color: CATWALK }
}

/** A floating solid slab (a roof, the casing, the sub tank shelf): walked on from above, a lid from below. */
function slab(id: string, left: number, right: number, top: number, bottom: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, type: 'solid', color: CASING }
}

/** A kickable wall face. */
function wall(id: string, left: number, right: number, top: number, bottom: number): StagePlatformDefinition {
  return { id, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, type: 'wall', color: CASING }
}

/** A crumble platform whose top is `top` (8px thick). */
function crumble(id: string, left: number, right: number, top: number): CrumblePlatformDefinition {
  return { id, x: (left + right) / 2, y: top + 4, width: right - left }
}

/** A floor spike strip (28x10, 1 HP) on `surfaceTop`. */
function spike(id: string, x: number, surfaceTop = FLOOR): StageHazardDefinition {
  return { id, x, y: surfaceTop - 6 }
}

const ROCK_SIZE = 22
/** A boulder that lands on `surfaceTop` (its centre rests 11px above it) from `topY`. */
function rock(id: string, x: number, topY: number, surfaceTop: number, drop: { triggerX: number } | { intervalMs: number; room: [number, number] }): RockfallDefinition {
  const base = { id, x, topY, floorY: surfaceTop - ROCK_SIZE / 2, size: ROCK_SIZE }
  if ('triggerX' in drop) return { ...base, triggerX: drop.triggerX }
  return { ...base, intervalMs: drop.intervalMs, activeFromX: drop.room[0], activeToX: drop.room[1] }
}
/** Open-sky drops start just under the HUD band (y 58), so the dust puff shows before the boulder. */
const SKY_TOP = 70

/** Ground enemies spawn 51px above what they stand on and settle; fliers and turrets use their own y. */
const standingOn = (top: number) => top - 51
/** Brief and prompt 02: every placement spawns at least 448px before its x (camera-relative). */
const SPAWN_AHEAD = 452

function enemy(id: string, typeKey: EnemyLevelMarker['typeKey'], x: number, y: number, extra: { retireTriggerX?: number; patrol?: [number, number] } = {}): EnemyLevelMarker {
  return {
    id,
    typeKey,
    x,
    y,
    ...(extra.patrol ? { patrolMinX: extra.patrol[0], patrolMaxX: extra.patrol[1] } : {}),
    spawnTriggerX: x - SPAWN_AHEAD,
    retireTriggerX: extra.retireTriggerX ?? x + 200
  }
}

/** A later wave of a support pad: it spawns inside the locked room (dropping in from under the HUD band). */
function waveEnemy(id: string, typeKey: EnemyLevelMarker['typeKey'], x: number, room: RoomLockDefinition['room'], gateX: number): EnemyLevelMarker {
  return { id, typeKey, x, y: 80, spawnTriggerX: room.x, retireTriggerX: gateX + 120 }
}

const checkpoint = (id: string, x: number, triggerX: number, radioSequenceId?: string) => ({
  id,
  x,
  y: 40,
  triggerX,
  ...(radioSequenceId ? { radioSequenceId } : {})
})

export const BASALT_TITAN_ROUTE_WIDTH = 12 * 448
/** The mini-boss (`custodian_walker` in its Basalt skin, EVAL-P6-005 / 12c): the shaft head's gate opens once it falls. */
export const BASALT_TITAN_MIDBOSS_MARKERS = ['basalt_mid_custodian']
/** Ceilings the hero never stands on (the gallery roof under the HUD band): out of the actor-ceiling rule. */
export const BASALT_TITAN_CEILINGS = ['basalt_gallery_roof']

export const BASALT_TITAN_CHECKPOINTS = [
  checkpoint('basalt_start', 44, 0),
  checkpoint('basalt_mid_a', 1392, 1376, 'basalt_titan_radio'),
  checkpoint('basalt_mid_b', 3184, 3168),
  checkpoint('basalt_boss_gate', 5296, 5264)
]

export const BASALT_TITAN_FLOOR_GAPS: FloorGap[] = [
  { x: 544, width: 96 },
  { x: 800, width: 112 },
  { x: 1488, width: 128 },
  { x: 4768, width: 112 },
  { x: 5184, width: 64 }
]

export const BASALT_TITAN_HAZARDS: StageHazardDefinition[] = [
  spike('basalt_spike_pad_a', 2192),
  spike('basalt_spike_roof', 2528, 168),
  spike('basalt_spike_trench_l', 2800),
  spike('basalt_spike_trench_r', 3056),
  spike('basalt_spike_pad_b', 4112),
  spike('basalt_spike_lane_1', 4944),
  spike('basalt_spike_lane_2', 5040),
  spike('basalt_spike_lane_3', 5136)
]

export const BASALT_TITAN_PLATFORMS: StagePlatformDefinition[] = [
  // Intro and teach: the load-lined step, the deck before the crumble bridge, the deck after it.
  block('basalt_intro_step', 224, 320, 204),
  block('basalt_teach_deck', 704, 800, 196),
  block('basalt_teach_deck_b', 912, 976, 196),
  // The collapsed gallery: its roof hangs from under the HUD band to y 96, so a jump under it is cut short.
  slab('basalt_gallery_roof', 1024, 1280, 64, 96),
  // Escalate: support A (an eye on its face; a jump launched 70px+ before it clears it), pad A.
  block('basalt_support_a', 1728, 1776, 140),
  block('basalt_pad_a', 1888, 2144, 212),
  // Secret: the route runs on the crew hut's roof; the breakable wall is its left side; the capsule alcove.
  slab('basalt_secret_roof', 2320, 2592, 168, 180),
  block('basalt_secret_bulkhead', 2592, 2656, 168),
  ledge('basalt_capsule_ledge', 2424, 2472, 120),
  // Mid-boss: the shaft head. Steps and the pad hold; the slabs between them are the stomp crumbles.
  block('basalt_head_step_l', 2688, 2752, 204),
  block('basalt_head_pad', 2848, 3008, 204),
  block('basalt_head_step_r', 3104, 3136, 204),
  // Master, the headframe climb (Heat Works' climb, measured and smoke-proven, without the slag).
  wall('basalt_climb_wall_left', 3224, 3240, -252, 140),
  wall('basalt_climb_wall_right', 3568, 3584, -150, BOTTOM),
  ledge('basalt_climb_1', 3256, 3320, 196),
  ledge('basalt_climb_2', 3360, 3440, 152),
  ledge('basalt_climb_3', 3472, 3552, 108),
  ledge('basalt_climb_4', 3360, 3424, 64),
  ledge('basalt_climb_7', 3472, 3552, -68),
  ledge('basalt_climb_8', 3360, 3424, -112),
  ledge('basalt_climb_9', 3472, 3552, -150),
  // Master, the shaft: the landing under the climb's right wall, the load-lined ledges, the sub tank shelf at
  // the foot of the side shaft (one-way like every ledge there: any solid face is a wall a kick climbs, so the
  // side shaft has none), and the outer wall over it, which hangs too high for any jump from below to touch.
  ledge('basalt_shaft_landing', 3584, 3616, -60),
  ledge('basalt_shaft_s1', 3816, 3880, 100),
  ledge('basalt_shaft_s2', 3600, 3680, 190),
  ledge('basalt_subtank_shelf', 3984, 4032, -40),
  wall('basalt_shaft_wall_right', 4016, 4032, -252, -150),
  // Master, pad B; preboss has no raised platforms (the breather and the lane are floor).
  block('basalt_pad_b', 4160, 4352, 212)
]

export const BASALT_TITAN_CRUMBLES: CrumbleGroupDefinition[] = [
  { id: 'basalt_intro_crumble', shakeMs: SHAKE_MS, respawnMs: RESPAWN_MS, platforms: [crumble('basalt_crumble_intro', 320, 368, 204)], loadLines: ['basalt_intro_step'] },
  {
    id: 'basalt_teach_crumble',
    shakeMs: SHAKE_MS,
    respawnMs: RESPAWN_MS,
    platforms: [crumble('basalt_crumble_p1', 572, 612, 212), crumble('basalt_crumble_bridge_1', 808, 856, 196), crumble('basalt_crumble_bridge_2', 856, 904, 196)],
    loadLines: ['basalt_teach_deck', 'basalt_teach_deck_b']
  },
  { id: 'basalt_esc_crumble', shakeMs: SHAKE_MS, respawnMs: RESPAWN_MS, platforms: [crumble('basalt_crumble_p2', 1532, 1572, 212)], loadLines: ['basalt_support_a', 'basalt_pad_a'] },
  {
    id: 'basalt_head_crumble',
    trigger: 'stomp',
    stompReachPx: 176,
    shakeMs: SHAKE_MS,
    respawnMs: RESPAWN_MS,
    platforms: [
      crumble('basalt_head_slab_l1', 2752, 2800, 204),
      crumble('basalt_head_slab_l2', 2800, 2848, 204),
      crumble('basalt_head_slab_r1', 3008, 3056, 204),
      crumble('basalt_head_slab_r2', 3056, 3104, 204)
    ],
    loadLines: ['basalt_head_step_l', 'basalt_head_pad', 'basalt_head_step_r']
  },
  {
    id: 'basalt_climb_crumble',
    shakeMs: SHAKE_MS,
    respawnMs: RESPAWN_MS,
    platforms: [crumble('basalt_climb_c1', 3256, 3320, 20), crumble('basalt_climb_c2', 3368, 3424, -24)],
    loadLines: ['basalt_climb_1', 'basalt_climb_2', 'basalt_climb_3', 'basalt_climb_4', 'basalt_climb_7', 'basalt_climb_8', 'basalt_climb_9']
  },
  {
    id: 'basalt_shaft_crumble',
    shakeMs: SHAKE_MS,
    respawnMs: RESPAWN_MS,
    // The launch (8px past the landing, so a walk carries onto it) is the dash-jump take-off for the side shaft:
    // the hero has 350ms on it. A walk off its end falls onto the first crumbling ledge.
    platforms: [crumble('basalt_shaft_launch', 3624, 3672, -60), crumble('basalt_shaft_d1', 3688, 3768, 20), crumble('basalt_shaft_d2', 3904, 3960, 170)],
    loadLines: ['basalt_shaft_landing', 'basalt_shaft_s1', 'basalt_shaft_s2']
  },
  {
    id: 'basalt_side_crumble',
    shakeMs: SHAKE_MS,
    respawnMs: RESPAWN_MS,
    platforms: [crumble('basalt_side_mouth', 3968, 4032, -100), crumble('basalt_side_mid', 3968, 4032, -70)],
    loadLines: ['basalt_subtank_shelf']
  },
  { id: 'basalt_pre_crumble', shakeMs: SHAKE_MS, respawnMs: RESPAWN_MS, platforms: [crumble('basalt_crumble_p3', 4804, 4844, 212)], loadLines: ['basalt_pad_b'] }
]

const HEADFRAME: [number, number] = [3136, 3584]
const SHAFT: [number, number] = [3584, 4032]

export const BASALT_TITAN_ROCKFALLS: RockfallDefinition[] = [
  // Teach, the gallery: the first drop is triggered 260px ahead (it lands before a running hero arrives); the
  // next two are close enough that a hero who stops under them is hit.
  rock('basalt_rock_gallery_1', 1072, 107, FLOOR, { triggerX: 812 }),
  rock('basalt_rock_gallery_2', 1168, 107, FLOOR, { triggerX: 1088 }),
  rock('basalt_rock_gallery_3', 1248, 107, FLOOR, { triggerX: 1128 }),
  // Escalate: a drop past the rubble pit's far edge, triggered mid-jump.
  rock('basalt_rock_p2', 1648, SKY_TOP, FLOOR, { triggerX: 1520 }),
  // Master: rain on the timer while the hero is in the room, each column clear of every ledge above its landing.
  rock('basalt_rock_climb', 3392, -240, -112, { intervalMs: 2600, room: HEADFRAME }),
  rock('basalt_rock_shaft_1', 3740, -240, 20, { intervalMs: 2400, room: SHAFT }),
  rock('basalt_rock_shaft_2', 3848, -240, 100, { intervalMs: 2800, room: SHAFT }),
  rock('basalt_rock_shaft_3', 3932, -240, 170, { intervalMs: 3200, room: SHAFT }),
  // Preboss, the lane: a running hero passes under during the dust puff; a hesitant one is hit.
  rock('basalt_rock_lane_1', 4992, SKY_TOP, FLOOR, { triggerX: 4930 }),
  rock('basalt_rock_lane_2', 5088, SKY_TOP, FLOOR, { triggerX: 5026 })
]

export const BASALT_TITAN_BREAKABLE_WALLS: BreakableWallDefinition[] = [
  { id: 'basalt_secret_wall', x: 2328, y: 208, width: 16, height: 56, hitsRequired: 3, minChargeLevel: 1 }
]

export const BASALT_TITAN_VERTICAL_SEGMENTS: VerticalSegmentDefinition[] = [
  { id: 'basalt_headframe', x: HEADFRAME[0], width: HEADFRAME[1] - HEADFRAME[0], verticalScreens: 2 },
  { id: 'basalt_shaft', x: SHAFT[0], width: SHAFT[1] - SHAFT[0], verticalScreens: 2 }
]

const PAD_A_ROOM = { x: 1792, y: 0, width: 448, height: 252 }
const PAD_B_ROOM = { x: 4032, y: 0, width: 448, height: 252 }

export const BASALT_TITAN_ROOM_LOCKS: RoomLockDefinition[] = [
  {
    id: 'basalt_pad_a_lock',
    room: PAD_A_ROOM,
    gateX: 2240,
    defeatMarkers: ['basalt_pad_a_hopper_1', 'basalt_pad_a_hauler', 'basalt_pad_a_hopper_2'],
    waves: [[waveEnemy('basalt_pad_a_wave_bouncer', 'enemy_bouncer', 1840, PAD_A_ROOM, 2240), waveEnemy('basalt_pad_a_wave_hopper', 'enemy_shock_hopper', 2200, PAD_A_ROOM, 2240)]]
  },
  { id: 'basalt_midboss_lock', room: { x: 2688, y: 0, width: 448, height: 252 }, gateX: 3136, defeatMarkers: BASALT_TITAN_MIDBOSS_MARKERS },
  {
    id: 'basalt_pad_b_lock',
    room: PAD_B_ROOM,
    gateX: 4480,
    defeatMarkers: ['basalt_pad_b_hauler', 'basalt_pad_b_hopper'],
    waves: [[waveEnemy('basalt_pad_b_wave_bouncer', 'enemy_bouncer', 4096, PAD_B_ROOM, 4480), waveEnemy('basalt_pad_b_wave_mine', 'enemy_mine_bot', 4440, PAD_B_ROOM, 4480)]]
  }
]

// Part 13e (EVAL-P13-010): y sits the v2 art's frame exactly on the surface under each anchor (heart_tank/
// pickup_bonus top 236, sub_tank top -40, capsule top 120); x is unchanged.
export const BASALT_TITAN_LOCATION_ANCHORS: LocationAnchors = {
  heart_tank: { x: 2472, y: 228.5, rest: 'ground' },
  sub_tank: { x: 4008, y: -49, rest: 'ground' },
  capsule: { x: 2448, y: 111.5, rest: 'ground' },
  pickup_bonus: { x: 4560, y: 227, rest: 'ground' }
}

/**
 * 20 placements of the brief's five families and the mini-boss, plus four more in the pads' second waves.
 * Each spawns 452px before its x (off camera) and retires behind; the pads' first waves and the walker retire
 * only past their gates, so walking deep into a locked room never clears one.
 */
export const BASALT_TITAN_ENEMIES: EnemyLevelMarker[] = [
  enemy('basalt_teach_mine', 'enemy_mine_bot', 752, standingOn(196)),
  enemy('basalt_teach_bouncer', 'enemy_bouncer', 1000, standingOn(FLOOR)),
  enemy('basalt_esc_mine', 'enemy_mine_bot', 1448, standingOn(FLOOR)),
  enemy('basalt_esc_bouncer', 'enemy_bouncer', 1680, standingOn(FLOOR)),
  enemy('basalt_support_eye_a', 'enemy_laser_eye', 1716, 176),
  enemy('basalt_pad_a_hopper_1', 'enemy_shock_hopper', 1928, standingOn(212), { retireTriggerX: 2360 }),
  enemy('basalt_pad_a_hauler', 'enemy_armored_bot', 2016, standingOn(212), { retireTriggerX: 2360, patrol: [1960, 2080] }),
  enemy('basalt_pad_a_hopper_2', 'enemy_shock_hopper', 2104, standingOn(212), { retireTriggerX: 2360 }),
  enemy('basalt_roof_mine', 'enemy_mine_bot', 2380, standingOn(168)),
  enemy('basalt_bulkhead_eye', 'enemy_laser_eye', 2624, 150),
  enemy('basalt_mid_custodian', 'custodian_walker_basalt', 2960, standingOn(204), { retireTriggerX: 3336, patrol: [2888, 2968] }),
  enemy('basalt_climb_eye', 'enemy_laser_eye', 3512, 60),
  enemy('basalt_climb_mine', 'enemy_mine_bot', 3512, standingOn(-68)),
  enemy('basalt_shaft_mine', 'enemy_mine_bot', 3640, standingOn(190)),
  enemy('basalt_shaft_bouncer', 'enemy_bouncer', 3720, standingOn(FLOOR)),
  enemy('basalt_shaft_hopper', 'enemy_shock_hopper', 3880, standingOn(FLOOR)),
  enemy('basalt_pad_b_hauler', 'enemy_armored_bot', 4256, standingOn(212), { retireTriggerX: 4600, patrol: [4200, 4320] }),
  enemy('basalt_pad_b_hopper', 'enemy_shock_hopper', 4400, standingOn(FLOOR), { retireTriggerX: 4600 }),
  enemy('basalt_pre_hauler', 'enemy_armored_bot', 4680, standingOn(FLOOR), { patrol: [4640, 4720] }),
  enemy('basalt_lane_hopper', 'enemy_shock_hopper', 5090, standingOn(FLOOR))
]

/**
 * The boss room (12f wave 6, EVAL-P7-005; the brief's `pits`): two shallow rubble channels (12px on a solid bed)
 * between the combat profile's pillar lanes (0.25, 0.5, 0.75), which stay solid for desperation's rising pillars.
 * Quake Knuckle's shockwaves run along the floor line and cross them; 32px wide, narrower than the Titan's floor
 * body, so he walks and lands across a channel on its banks while the hero can drop in.
 */
const BASALT_ROOM_X = BASALT_TITAN_ROUTE_WIDTH
export const BASALT_TITAN_BOSS_ROOM: BossRoomFeatures = {
  layout: 'channels',
  channels: [
    { id: 'basalt_boss_channel_1', x: BASALT_ROOM_X + 160, width: 32, depth: 12, color: 0x4a3b30 },
    { id: 'basalt_boss_channel_2', x: BASALT_ROOM_X + 256, width: 32, depth: 12, color: 0x4a3b30 }
  ]
}

/** The whole Structural Works route as one patch, registered in `src/content/stages/index.ts`. */
export const BASALT_TITAN_PATCH: StageExtensionPatch = {
  width: BASALT_TITAN_ROUTE_WIDTH,
  bossSpawnX: BASALT_TITAN_ROUTE_WIDTH - 84,
  bossRoom: BASALT_TITAN_BOSS_ROOM,
  checkpoints: BASALT_TITAN_CHECKPOINTS,
  hazards: BASALT_TITAN_HAZARDS,
  midPlatforms: BASALT_TITAN_PLATFORMS,
  enemyMarkers: BASALT_TITAN_ENEMIES,
  roomLocks: BASALT_TITAN_ROOM_LOCKS,
  arena: {
    floorGaps: BASALT_TITAN_FLOOR_GAPS,
    locationAnchors: BASALT_TITAN_LOCATION_ANCHORS,
    verticalSegments: BASALT_TITAN_VERTICAL_SEGMENTS,
    crumbleGroups: BASALT_TITAN_CRUMBLES,
    breakableWalls: BASALT_TITAN_BREAKABLE_WALLS,
    rockfalls: BASALT_TITAN_ROCKFALLS
  }
}
