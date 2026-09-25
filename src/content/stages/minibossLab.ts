import type { CampaignStageDefinition } from '../campaign'
import type { EnemyLevelMarker } from '../../enemy/types'
import type { RoomLockDefinition } from '../../mechanics/roomLock'
import { BOSS_ROOM_VIEWPORT_WIDTH, buildDefaultBossRoom } from '../stageArenaLayout'

/**
 * `miniboss_lab` (12c, EVAL-P6-005): a developer-only stage with one defeat-locked room per mini-boss
 * archetype and stage skin, for the matrix in smoke `43-miniboss-custodian`. Not in `CAMPAIGN_STAGES`, so
 * stage select, saves and the campaign never list it; like `mechanics_lab` it borrows Heat Works' boss,
 * background and colours. After a start screen, each cell is a 224px corridor (a checkpoint; the
 * mini-boss spawns off camera as the hero crosses it) and a 448px room whose gate opens once its
 * mini-boss falls. The warden stages get their rooms in 12d.
 */
export const MINIBOSS_LAB_STAGE_ID = 'miniboss_lab'

const SCREEN = 448
const FLOOR = 236
const CORRIDOR = 224
const CELL = CORRIDOR + SCREEN
const START = SCREEN
const HERO_Y = 214
/** Ground enemies spawn 51px above what they stand on and settle; the twins hover at their perch. */
const standingOn = (top: number) => top - 51
const TWIN_PERCH_Y = 136

export type MinibossLabRoom = {
  id: string
  typeKey: string
  markerId: string
  roomX: number
  gateX: number
}

const ROOM_ORDER: ReadonlyArray<readonly [string, string]> = [
  ['walker', 'custodian_walker'],
  ['walker_basalt', 'custodian_walker_basalt'],
  ['walker_glacier', 'custodian_walker_glacier'],
  ['nest', 'relay_turret_nest'],
  ['nest_ferro', 'relay_turret_nest_ferro'],
  ['twins', 'sentry_twin'],
  ['twins_gale', 'sentry_twin_gale'],
  ['serpent', 'drill_serpent']
]

export const MINIBOSS_LAB_ROOMS: MinibossLabRoom[] = ROOM_ORDER.map(([id, typeKey], index) => {
  const roomX = START + index * CELL + CORRIDOR
  return { id, typeKey, markerId: `mb_lab_${id}`, roomX, gateX: roomX + SCREEN }
})

/** The last room, a closing corridor, then the borrowed boss room. */
export const MINIBOSS_LAB_ROUTE_WIDTH = START + ROOM_ORDER.length * CELL + CORRIDOR

/** Where each archetype stands in its room, and the span its brain keeps to. */
function placement(room: MinibossLabRoom): Pick<EnemyLevelMarker, 'x' | 'y' | 'patrolMinX' | 'patrolMaxX'> {
  const { roomX, typeKey } = room
  if (typeKey.startsWith('relay_turret_nest')) {
    // Home at 320, shuffling a little either side.
    return { x: roomX + 320, y: standingOn(FLOOR), patrolMinX: roomX + 300, patrolMaxX: roomX + 340 }
  }
  if (typeKey.startsWith('sentry_twin')) {
    // Twin 0 perches over the left of the room, twin 1 over the right.
    return { x: roomX + 96, y: TWIN_PERCH_Y, patrolMinX: roomX + 96, patrolMaxX: roomX + 352 }
  }
  if (typeKey.startsWith('drill_serpent')) {
    // It tunnels and lunges anywhere on the room's floor.
    return { x: roomX + 320, y: standingOn(FLOOR), patrolMinX: roomX + 40, patrolMaxX: roomX + 408 }
  }
  // The walker patrols like Heat Works' catwalk room (its waves stop short of the gate).
  return { x: roomX + 360, y: standingOn(FLOOR), patrolMinX: roomX + 172, patrolMaxX: roomX + 424 }
}

export const MINIBOSS_LAB_ENEMIES: EnemyLevelMarker[] = MINIBOSS_LAB_ROOMS.map((room) => ({
  id: room.markerId,
  typeKey: room.typeKey,
  ...placement(room),
  spawnTriggerX: room.roomX - 200,
  retireTriggerX: room.gateX + 112
}))

export const MINIBOSS_LAB_ROOM_LOCKS: RoomLockDefinition[] = MINIBOSS_LAB_ROOMS.map((room) => ({
  id: `${room.markerId}_lock`,
  room: { x: room.roomX, y: 0, width: SCREEN, height: 252 },
  gateX: room.gateX,
  defeatMarkers: [room.markerId]
}))

const checkpoint = (id: string, x: number, triggerX: number) => ({ id, x, y: HERO_Y, triggerX })

function buildMinibossLabStage(base: CampaignStageDefinition): CampaignStageDefinition {
  const worldWidth = MINIBOSS_LAB_ROUTE_WIDTH + BOSS_ROOM_VIEWPORT_WIDTH
  const bossRoom = buildDefaultBossRoom(worldWidth, { bossSpawnX: MINIBOSS_LAB_ROUTE_WIDTH + 360 })
  return {
    ...base,
    id: MINIBOSS_LAB_STAGE_ID,
    district: 'Mini-boss Lab',
    title: 'Mini-boss Lab',
    selectLabel: 'LAB',
    introCallout: 'Mini-boss lab',
    description: 'Developer lab: one locked room per mini-boss and skin.',
    arenaLabel: 'Mini-boss Lab',
    rewardEnabled: false,
    enemyMarkers: MINIBOSS_LAB_ENEMIES,
    arena: {
      ...base.arena,
      // Heat Works' route stays out of the lab: flat floor, no hazards, no mechanics, no pickups.
      allowFallOff: false,
      floorGaps: undefined,
      locationAnchors: undefined,
      verticalSegments: undefined,
      risingLiquids: undefined,
      crumbleGroups: undefined,
      breakableWalls: undefined,
      conveyors: undefined,
      iceFloors: undefined,
      currentZones: undefined,
      windZones: undefined,
      timedRailGroups: undefined,
      rockfalls: undefined,
      icicles: undefined,
      hazards: [],
      midPlatforms: [],
      roomLocks: MINIBOSS_LAB_ROOM_LOCKS,
      width: worldWidth,
      bossRoom,
      bossSpawn: { x: bossRoom.bossSpawnX, y: base.arena.bossSpawn.y },
      spawn: { x: 44, y: HERO_Y },
      checkpoints: [
        checkpoint('mb_lab_start', 44, 0),
        ...MINIBOSS_LAB_ROOMS.map((room) => checkpoint(`${room.markerId}_corridor`, room.roomX - CORRIDOR + 32, room.roomX - CORRIDOR + 16)),
        checkpoint('mb_lab_boss_gate', MINIBOSS_LAB_ROUTE_WIDTH - 32, MINIBOSS_LAB_ROUTE_WIDTH - 52)
      ]
    }
  }
}

let built: CampaignStageDefinition | undefined

/** The lab on Heat Works' base (campaign.ts passes it), built once. */
export function minibossLabStage(base: CampaignStageDefinition): CampaignStageDefinition {
  built ??= buildMinibossLabStage(base)
  return built
}
