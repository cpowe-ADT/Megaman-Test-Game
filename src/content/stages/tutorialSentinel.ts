import type { EnemyLevelMarker } from '../../enemy/types'
import type { RoomLockDefinition, RoomLockInput } from '../../mechanics/roomLock'
import type { CrumbleGroupDefinition } from '../../mechanics/crumbleGroup'
import type { BreakableWallDefinition } from '../../mechanics/breakableWall'
import type { LocationAnchors, StageExtensionPatch, StagePlatformDefinition } from '../campaign'

/**
 * Tutorial: Sentinel Drill (`tutorial_sentinel`), moved out of `campaign.ts`'s `INLINE_STAGE_PATCHES`
 * (13h.3a, `EVAL-P6-019`), the last stage to make that move (prompt 12 part 12d's lineage; see the other
 * eight files in this folder). Six screens (2688px) before the unchanged boss room: move and jump, dash,
 * the two-screen wall-kick shaft, charge, saber, then the approach. Each teach screen ends at a room_lock
 * gate (prompt 05 §5.7).
 *
 * 13h.3a also lands the two carry-overs from 05b/06.P (the brief above, `docs/design/stage-briefs.md`):
 * one `crumble_group` "on the last screen so the player has met it before Pyro" (`tutorial_crumble_step`,
 * the approach, on open floor: the tutorial has no pits, `allowFallOff: false`, so a first-time fall is a
 * 16px drop back to the same ground, not a hazard), and the secret the brief calls "1 (`capsule`, saber
 * wall)": a one-way shelf above the main floor in the saber room, jump-reachable from the ground, with a
 * breakable wall on top of it needing three slashes (or a charged shot) the way the scrap gate does. The
 * `capsule` location (`hp_refill_large` in Classic) moves off its default position (part 13e,
 * `src/content/pickupPlacementRule.ts`) to rest on the shelf behind the wall; `pickup_bonus` stays on the
 * route at its default, per the brief.
 *
 * The shelf and its wall sit in the dead space between the saber room's own gate (x1792, already open by
 * the time the player is here) and the existing `tutorial_mid_5` platform (x1972-2028): nothing else is
 * placed there, and smoke 49 warps past it on the way to the scrap gate, so this cannot change any
 * existing assertion. The crumble sits in the approach's own dead space, right past its own gate (x2240)
 * and before `tutorial_shield`'s spawn trigger (x2240) and `tutorial_check_ledge_a` (x2336-2400).
 */

const TEACH_SCREEN = 448

function checkpoint(id: string, x: number, y: number, triggerX: number) {
  return { id, x, y, triggerX }
}

function marker(
  id: string,
  typeKey: EnemyLevelMarker['typeKey'],
  x: number,
  y: number,
  patrolMinX?: number,
  patrolMaxX?: number,
  runtime?: Partial<Pick<EnemyLevelMarker, 'spawnTriggerX' | 'spawnLeadX' | 'retireTriggerX' | 'persistent'>>
): EnemyLevelMarker {
  return { id, typeKey, x, y, patrolMinX, patrolMaxX, ...runtime }
}

/** One tutorial screen whose exit gate opens on `requiredInput`; the shaft passes a taller room. */
function teachRoom(
  index: number,
  requiredInput: RoomLockInput,
  extra: { hitsRequired?: number; room?: { y: number; height: number } } = {}
): RoomLockDefinition {
  return {
    id: `tutorial_lock_${requiredInput}`,
    room: { x: index * TEACH_SCREEN, y: extra.room?.y ?? 0, width: TEACH_SCREEN, height: extra.room?.height ?? 252 },
    gateX: (index + 1) * TEACH_SCREEN,
    requiredInput,
    ...(extra.hitsRequired ? { hitsRequired: extra.hitsRequired } : {})
  }
}

const TUTORIAL_MID_PLATFORMS: StagePlatformDefinition[] = [
  { id: 'tutorial_step', x: 360, y: 224, width: 40, height: 24, type: 'solid', color: 0x2a3a52 },
  // The dash teach (06.P): a launch deck and a landing ledge at one height over a 216px bay with a
  // flat, spike-free floor. A plain running jump covers about 168px and lands in the bay (one hop
  // back up the deck face); a dash jump covers about 244px and lands on ledge B.
  { id: 'tutorial_dash_ledge_a', x: 544, y: 216, width: 112, height: 40, type: 'solid', color: 0x2a3a52 },
  { id: 'tutorial_dash_ledge_b', x: 848, y: 216, width: 64, height: 40, type: 'solid', color: 0x2a3a52 },
  { id: 'tutorial_shaft_wall_left', x: 1040, y: -30, width: 16, height: 424, type: 'wall', color: 0x3b4f6e },
  { id: 'tutorial_shaft_wall_right', x: 1120, y: 50, width: 16, height: 372, type: 'wall', color: 0x3b4f6e },
  // 13h.3a: a one-way shelf above open floor (no pit under it), jump-reachable from the ground; a
  // breakable wall on top of it seals the right half as the secret's vault (see `arena.breakableWalls`).
  { id: 'tutorial_secret_shelf', x: 1900, y: 200, width: 90, height: 8, type: 'oneWay', color: 0x2a3a52 },
  { id: 'tutorial_mid_5', x: 2000, y: 176, width: 56, type: 'oneWay', color: 0x304a6d },
  // The dash check on the approach: loading deck, a 212px bay, the landing ledge before the boss door.
  { id: 'tutorial_check_ledge_a', x: 2368, y: 216, width: 64, height: 40, type: 'solid', color: 0x2a3a52 },
  { id: 'tutorial_check_ledge_b', x: 2640, y: 216, width: 56, height: 40, type: 'solid', color: 0x2a3a52 }
]

const TUTORIAL_CRUMBLES: CrumbleGroupDefinition[] = [
  {
    // The brief's "one crumble_group on the last screen so the player has met it before Pyro": the
    // approach, right past its own gate (x2240) and well short of `tutorial_shield` (x2296).
    id: 'tutorial_approach_crumble',
    platforms: [{ id: 'tutorial_crumble_step', x: 2266, y: 224, width: 20 }]
  }
]

const TUTORIAL_BREAKABLE_WALLS: BreakableWallDefinition[] = [
  // Resting on `tutorial_secret_shelf`'s top (196), splitting it into a landing half and the vault half.
  { id: 'tutorial_secret_wall', x: 1900, y: 173, width: 16, height: 46, hitsRequired: 3, minChargeLevel: 1 }
]

const TUTORIAL_LOCATION_ANCHORS: LocationAnchors = {
  // The brief's secret: "1 (capsule, saber wall)". Off the capsule's default (the dash bay) and onto the
  // shelf's vault half, behind `tutorial_secret_wall`; the offset from the shelf's top (196) is the
  // default anchor's own offset from the main floor (236 - 227.5 = 8.5), so it rests the same way.
  capsule: { x: 1925, y: 187.5, rest: 'ground' }
}

export const TUTORIAL_SENTINEL_PATCH: StageExtensionPatch = {
  width: 2688,
  bossSpawnX: 2622,
  checkpoints: [
    checkpoint('tutorial_start', 44, 40, 0),
    checkpoint('tutorial_dash_exit', 928, 40, 912),
    // The radio pair belongs at the shaft exit; the dash exit is checkpoint 2's toast only.
    { ...checkpoint('tutorial_shaft_exit', 1392, 40, 1380), radioSequenceId: 'tutorial_sentinel_radio' },
    // The last checkpoint starts the boss door on every stage; kept at the approach's end, on the
    // landing ledge past the dash check, so a respawn never drops into the spike bay.
    checkpoint('tutorial_boss_gate', 2640, 40, 2624)
  ],
  // 06.P: spikes only after the verb they test. The dash check on the approach: two spikes where a
  // plain jump off the loading deck lands, a spike-free near floor where a walk-off lands.
  hazards: [
    { id: 'tutorial_check_spike_1', x: 2556, y: 230 },
    { id: 'tutorial_check_spike_2', x: 2584, y: 230 }
  ],
  midPlatforms: TUTORIAL_MID_PLATFORMS,
  // Brief roster (8 placements, 5 types) plus the charge target; spawn triggers keep one arrival at a time.
  enemyMarkers: [
    marker('tutorial_armored', 'enemy_armored_bot', 1600, 185, 1540, 1700, {
      spawnTriggerX: 1400,
      retireTriggerX: 1760
    }),
    marker('tutorial_drone_2', 'enemy_drone', 1740, 112, undefined, undefined, {
      spawnTriggerX: 1640,
      retireTriggerX: 1840
    }),
    marker('tutorial_gunner_2', 'enemy_gunner_bot', 2040, 185, 2010, 2080, {
      spawnTriggerX: 1980,
      retireTriggerX: 2150
    }),
    marker('tutorial_hopper_2', 'enemy_shock_hopper', 2150, 185, undefined, undefined, {
      spawnTriggerX: 2080,
      retireTriggerX: 2250
    }),
    marker('tutorial_shield', 'enemy_shield_drone', 2296, 128, undefined, undefined, {
      spawnTriggerX: 2240,
      retireTriggerX: 2420
    }),
    marker('tutorial_rocket', 'enemy_rocket_bot', 2368, 145, undefined, undefined, {
      spawnTriggerX: 2260,
      retireTriggerX: 2440
    })
  ],
  roomLocks: [
    teachRoom(0, 'jump'),
    teachRoom(1, 'dash'),
    teachRoom(2, 'wall_jump', { room: { y: -252, height: 504 } }),
    teachRoom(3, 'charge'),
    teachRoom(4, 'saber', { hitsRequired: 3 })
  ],
  // 13b.2 (EVAL-P13-003): the wall-kick shaft's own teach room (above) is 2 screens tall (y -252,
  // height 504) but had no matching verticalSegments entry, so the backdrop and parallax never
  // extended upward with the camera and the top of the shaft showed void. Same room span.
  arena: {
    verticalSegments: [{ id: 'tutorial_shaft', x: 2 * TEACH_SCREEN, width: TEACH_SCREEN, verticalScreens: 2 }],
    crumbleGroups: TUTORIAL_CRUMBLES,
    breakableWalls: TUTORIAL_BREAKABLE_WALLS,
    locationAnchors: TUTORIAL_LOCATION_ANCHORS
  }
}
