/**
 * Lane-swapping `carry` platforms (prompt 12 part 12d, Volt; prompt 02 §2.2 `carry`): two one-way platforms
 * on two lanes (heights) that trade stations on the stage clock. Both hold, the pair blinks for the last
 * `VENT_ARM_MS` of the hold (the same arming tell as a rail), then both slide at once, one lane passing over
 * the other, to the other's station; they hold there and slide back. A grounded hero on a sliding platform
 * inherits its velocity (a belt carry through the motor environment), so it rides across. With `holdMs`
 * equal to a rail group's `offMs` and `moveMs` to its `onMs`, the platforms slide exactly while the rails
 * arc. Pure; the Phaser edge is `adapters/LaneSwapAdapter.ts`.
 */
import type { ConveyorDefinition } from './conveyor'
import type { Box } from './crumbleGroup'
import { VENT_ARM_MS } from './hazards'

export type LaneSwapTiming = { holdMs: number; moveMs: number; phaseMs: number }

/** A platform's lane: its id and walking surface (top), world px. */
export type LaneSwapLane = { id: string; top: number }

export type LaneSwapDefinition = {
  id: string
  /** The two stations' centre x, world px: the first lane's platform starts at the first station. */
  stations: readonly [number, number]
  /** One platform per lane; the lanes differ in height, so one platform passes over the other. */
  lanes: readonly [LaneSwapLane, LaneSwapLane]
  /** Platform width, px (default 56). */
  width?: number
  /** Hold and slide times per swap, ms (default hold 1400, move 1600, phase 0). */
  timing?: Partial<LaneSwapTiming>
  color?: number
}

export type LaneSwapPhase = 'hold' | 'arming' | 'moving'

export type LaneSwapPlatform = { id: string; x: number; top: number; velocityX: number; box: Box }

export type LaneSwapState = {
  phase: LaneSwapPhase
  /** True while the platforms hold at (or slide back from) each other's stations. */
  swapped: boolean
  /** Until the next slide starts, ms (0 while sliding). */
  untilMoveMs: number
  platforms: [LaneSwapPlatform, LaneSwapPlatform]
}

export const LANE_SWAP_DEFAULTS = { width: 56, height: 8, timing: { holdMs: 1400, moveMs: 1600, phaseMs: 0 } } as const

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

export function laneSwapTiming(definition: LaneSwapDefinition): LaneSwapTiming {
  return {
    holdMs: positive(definition.timing?.holdMs, LANE_SWAP_DEFAULTS.timing.holdMs),
    moveMs: positive(definition.timing?.moveMs, LANE_SWAP_DEFAULTS.timing.moveMs),
    phaseMs: Number(definition.timing?.phaseMs ?? 0) || 0
  }
}

export function laneSwapWidth(definition: LaneSwapDefinition): number {
  return positive(definition.width, LANE_SWAP_DEFAULTS.width)
}

function platformAt(definition: LaneSwapDefinition, lane: 0 | 1, x: number, velocityX: number): LaneSwapPlatform {
  const { id, top } = definition.lanes[lane]
  const half = laneSwapWidth(definition) / 2
  return { id, x, top, velocityX, box: { left: x - half, right: x + half, top, bottom: top + LANE_SWAP_DEFAULTS.height } }
}

/**
 * Where both platforms stand at `clockMs`: a swap is a hold then a slide (`holdMs + moveMs`), and two swaps
 * bring the pair home. The slide is linear, so a rider's carry is one constant speed.
 */
export function laneSwapAt(definition: LaneSwapDefinition, clockMs: number): LaneSwapState {
  const timing = laneSwapTiming(definition)
  const swapMs = timing.holdMs + timing.moveMs
  const cycleMs = 2 * swapMs
  const local = ((((clockMs + timing.phaseMs) % cycleMs) + cycleMs) % cycleMs)
  const swapped = local >= swapMs
  const inSwap = local - (swapped ? swapMs : 0)
  const moving = inSwap >= timing.holdMs
  const progress = moving ? (inSwap - timing.holdMs) / timing.moveMs : 0
  const untilMoveMs = moving ? 0 : timing.holdMs - inSwap
  const [first, second] = definition.stations
  const from = swapped ? [second, first] : [first, second]
  const to = swapped ? [first, second] : [second, first]
  const platforms = ([0, 1] as const).map((lane) => {
    const x = from[lane] + (to[lane] - from[lane]) * progress
    const velocityX = moving ? ((to[lane] - from[lane]) * 1000) / timing.moveMs : 0
    return platformAt(definition, lane, x, velocityX)
  }) as [LaneSwapPlatform, LaneSwapPlatform]
  const phase: LaneSwapPhase = moving ? 'moving' : untilMoveMs <= VENT_ARM_MS ? 'arming' : 'hold'
  return { phase, swapped, untilMoveMs, platforms }
}

/**
 * The platforms as belts for `resolveHeroEnvironment`: a hero standing on one gets its velocity as the belt
 * carry (zero while it holds), so a ride moves hero and platform together.
 */
export function laneSwapCarriers(definition: LaneSwapDefinition, state: LaneSwapState): ConveyorDefinition[] {
  const width = laneSwapWidth(definition)
  return state.platforms.map((platform) => ({
    id: platform.id,
    x: platform.x,
    y: platform.top + LANE_SWAP_DEFAULTS.height / 2,
    width,
    height: LANE_SWAP_DEFAULTS.height,
    speed: platform.velocityX,
    type: 'oneWay' as const
  }))
}

/** Both platforms at the clock's start, for the platform list (`stageMechanicPlatforms`); the adapter moves them. */
export function laneSwapPlatformDefinitions(definition: LaneSwapDefinition): Array<{ id: string; x: number; y: number; width: number; height: number }> {
  return laneSwapAt(definition, 0).platforms.map((platform) => ({
    id: platform.id,
    x: platform.x,
    y: platform.top + LANE_SWAP_DEFAULTS.height / 2,
    width: laneSwapWidth(definition),
    height: LANE_SWAP_DEFAULTS.height
  }))
}

/** A blink during the arming tell (the same beat a rail's sparks keep); 1 otherwise. */
export function laneSwapAlpha(phase: LaneSwapPhase, clockMs: number): number {
  return phase === 'arming' && Math.floor(clockMs / 75) % 2 === 0 ? 0.55 : 1
}
