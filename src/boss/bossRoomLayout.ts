/**
 * The warden boss rooms (prompt 12 part 12f wave 6, EVAL-P7-005). A stage's boss room is the last 448px of its
 * world (`buildDefaultBossRoom`), appended after the route, and the route budget check in `content/campaign.ts`
 * rejects route content inside it. A stage file authors its room as data here (`BossRoomFeatures`, absolute world
 * px inside the room span) and `applyBossRoomFeatures` adds it to the finished arena after that check.
 *
 * Rules (`tests/boss-room-layout.test.ts`): every feature sits inside the room span; a channel is a dip of at most
 * `BOSS_ROOM_CHANNEL_MAX_DEPTH` with a solid bed, never a pit, and narrower than any warden's floor body, so a boss
 * always stands on a bank across it (walkers step over, divers land on the banks) while the hero can drop in; the
 * boss's anchors (`room.anchorFractions` of its combat profile) and its spawn stand on solid floor. Pure.
 */
import type { StageArenaDefinition, StagePlatformDefinition } from '../content/campaign'
import type { StageHazardDefinition } from '../mechanics/hazards'
import { MAIN_GROUND_HEIGHT, type FloorGap } from '../stage/stageGeometry'

/** The brief's room shapes (`docs/design/stage-briefs.md`, each stage's "Boss room" line). */
export type BossRoomLayout = 'flat' | 'pillars' | 'channels' | 'rails' | 'belts' | 'shaft' | 'ice_floor'

/** The room's floor line (the main ground's top), game px. */
export const BOSS_ROOM_FLOOR_Y = 252 - MAIN_GROUND_HEIGHT
/** A channel is a dip, never a pit. */
export const BOSS_ROOM_CHANNEL_MAX_DEPTH = 16
/** A channel's bed: a solid strip under the dip (it reaches below the screen, so only its top shows). */
export const BOSS_ROOM_CHANNEL_BED_HEIGHT = 12

export type BossRoomChannel = {
  id: string
  /** Left edge and width, world px. */
  x: number
  width: number
  /** How far the bed sits under the floor line, px (1 to `BOSS_ROOM_CHANNEL_MAX_DEPTH`). */
  depth: number
  /** The bed's colour. */
  color?: number
}

/** The stage mechanics a boss room can stand in its span (12b mechanics as data). */
export type BossRoomMechanics = Pick<StageArenaDefinition, 'conveyors' | 'iceFloors' | 'timedRailGroups' | 'waterLevelGates' | 'verticalSegments'>

export type BossRoomFeatures = {
  layout: BossRoomLayout
  channels?: BossRoomChannel[]
  platforms?: StagePlatformDefinition[]
  hazards?: StageHazardDefinition[]
  mechanics?: BossRoomMechanics
}

type BossRoomArena = Pick<StageArenaDefinition, 'floorGaps' | 'midPlatforms' | 'hazards'> & BossRoomMechanics

/** The bed under a channel: solid, `depth` under the floor line, as wide as the cut. */
export function channelBed(channel: BossRoomChannel): StagePlatformDefinition {
  const top = BOSS_ROOM_FLOOR_Y + channel.depth
  return {
    id: `${channel.id}_bed`,
    x: channel.x + channel.width / 2,
    y: top + BOSS_ROOM_CHANNEL_BED_HEIGHT / 2,
    width: channel.width,
    height: BOSS_ROOM_CHANNEL_BED_HEIGHT,
    type: 'solid',
    color: channel.color ?? 0x2a3140
  }
}

/** The cut a channel makes in the main ground. */
export function channelGap(channel: BossRoomChannel): FloorGap {
  return { x: channel.x, width: channel.width }
}

const joined = <T>(base: readonly T[] | undefined, added: readonly T[] | undefined): T[] | undefined =>
  added && added.length > 0 ? [...(base ?? []), ...added] : base ? [...base] : undefined

/** The arena with the room's features added: channels cut the ground and lay their beds; the rest is appended. */
export function applyBossRoomFeatures<A extends BossRoomArena>(arena: A, features: BossRoomFeatures): A {
  const channels = features.channels ?? []
  const mechanics = features.mechanics ?? {}
  const next: A = {
    ...arena,
    midPlatforms: [...arena.midPlatforms, ...channels.map(channelBed), ...(features.platforms ?? [])],
    hazards: [...arena.hazards, ...(features.hazards ?? [])]
  }
  const gaps = joined(arena.floorGaps, channels.map(channelGap))
  if (gaps) next.floorGaps = gaps
  for (const key of ['conveyors', 'iceFloors', 'timedRailGroups', 'waterLevelGates', 'verticalSegments'] as const) {
    const merged = joined<unknown>(arena[key], mechanics[key])
    if (merged) (next as Record<string, unknown>)[key] = merged
  }
  return next
}

/** Anchor x's as the boss resolves them: fractions of its safe movement bounds (the room less its insets and 4px). */
export function bossRoomAnchorXs(
  room: { x: number; width: number; leftInset: number; rightInset: number },
  fractions: readonly number[]
): number[] {
  const minX = room.x + room.leftInset + 4
  const maxX = room.x + room.width - room.rightInset - 4
  return fractions.map((fraction) => minX + Math.max(0, Math.min(1, fraction)) * (maxX - minX))
}

/** True when `x` stands on the floor line: not over a channel or any other cut in the ground. */
export function isOnRoomFloor(x: number, gaps: readonly FloorGap[]): boolean {
  return !gaps.some((gap) => x >= gap.x && x <= gap.x + gap.width)
}

/**
 * The floor gaps that are pits (a fall ends the life), for the kill-plane strip: a cut with a solid bed at most
 * `BOSS_ROOM_CHANNEL_MAX_DEPTH` under the floor line across its whole width is a channel and is left out.
 */
export function killPitGaps(arena: Pick<StageArenaDefinition, 'floorGaps' | 'midPlatforms'>): FloorGap[] {
  const beds = arena.midPlatforms.filter((platform) => (platform.type ?? 'oneWay') === 'solid')
  const bedded = (gap: FloorGap) =>
    beds.some((bed) => {
      const top = bed.y - (bed.height ?? 8) / 2
      return top > BOSS_ROOM_FLOOR_Y && top <= BOSS_ROOM_FLOOR_Y + BOSS_ROOM_CHANNEL_MAX_DEPTH && bed.x - bed.width / 2 <= gap.x && bed.x + bed.width / 2 >= gap.x + gap.width
    })
  return (arena.floorGaps ?? []).filter((gap) => !bedded(gap))
}

/** Every x a feature spans (left and right edge), for the inside-the-span rule. */
export function bossRoomFeatureSpans(features: BossRoomFeatures): Array<{ id: string; left: number; right: number }> {
  const box = (id: string, centreX: number, width: number) => ({ id, left: centreX - width / 2, right: centreX + width / 2 })
  const mechanics = features.mechanics ?? {}
  return [
    ...(features.channels ?? []).map((channel) => ({ id: channel.id, left: channel.x, right: channel.x + channel.width })),
    ...(features.platforms ?? []).map((platform) => box(platform.id, platform.x, platform.width)),
    ...(features.hazards ?? []).map((hazard) => box(hazard.id, hazard.x, hazard.width ?? 16)),
    ...(mechanics.conveyors ?? []).map((belt) => box(belt.id, belt.x, belt.width)),
    ...(mechanics.iceFloors ?? []).map((ice) => box(ice.id, ice.x, ice.width)),
    ...(mechanics.timedRailGroups ?? []).flatMap((group) => group.rails.map((rail) => box(rail.id, rail.x, rail.width ?? 56))),
    ...(mechanics.waterLevelGates ?? []).map((water) => ({ id: water.id, left: water.x, right: water.x + water.width })),
    ...(mechanics.verticalSegments ?? []).map((segment) => ({ id: segment.id, left: segment.x, right: segment.x + segment.width }))
  ]
}
