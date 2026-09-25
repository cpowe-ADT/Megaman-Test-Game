/**
 * Water-level gate (prompt 12 part 12d; the Water District's second mechanic, brief in
 * `docs/design/stage-briefs.md`). A body of water whose surface cycles on the stage clock (hold high,
 * fall, hold low, rise), with an optional sluice gate that stands closed except while the level holds
 * low (`openWhen: 'high'` flips it). It is `rising_liquid` run in reverse, a falling water line that
 * opens a passage on a timer: the `room_lock` variant whose exit opens on time, not on a verb or a
 * defeat. The water is no kill plane: under its surface it floats the hero up (the swim) through the
 * motor environment, as a lift does. A definition without `timing` holds still at `highY` (the pools
 * in the pits). Pure; the Phaser edge is `adapters/WaterLevelGateAdapter.ts`.
 */
import type { Box } from './crumbleGroup'
import { heroInZone, type ZonePush } from './forceZone'

export type WaterLevelTiming = {
  /** Hold at the high line, ms. */
  highMs: number
  /** High to low, ms. */
  fallMs: number
  /** Hold at the low line, ms. */
  lowMs: number
  /** Low to high, ms. */
  riseMs: number
  /** Shifts the cycle on the stage clock, ms (default 0: the high hold starts at clock 0). */
  phaseMs?: number
}

export type WaterGateDefinition = {
  /** Centre x of the sluice column, and its top and bottom, world px. */
  x: number
  top: number
  bottom: number
  /** Default `WATER_GATE_WIDTH`. */
  width?: number
  /** The level it opens at (default `low`: the exit that opens once the water has fallen). */
  openWhen?: 'low' | 'high'
}

export type WaterLevelGateDefinition = {
  id: string
  /** Left edge and width of the water, world px. */
  x: number
  width: number
  /** Surface y at high and low water; y grows down, so `highY < lowY`. */
  highY: number
  lowY: number
  /** The basin's floor: the water fills from the surface down to it. */
  bottomY: number
  /** No timing: still water at `highY`. */
  timing?: WaterLevelTiming
  gate?: WaterGateDefinition
  /** Upward push under the surface, px/s^2 (default `WATER_BUOYANCY_DEFAULTS.force`; 0: no float). */
  buoyancy?: number
  /** The float speed it builds to, px/s (default `WATER_BUOYANCY_DEFAULTS.cap`). */
  buoyancyCap?: number
}

export type WaterLevelPhase = 'still' | 'high' | 'falling' | 'low' | 'rising'

export type WaterLevelState = {
  id: string
  phase: WaterLevelPhase
  surfaceY: number
  /** Until the next phase change, ms (0 for still water). */
  untilChangeMs: number
  /** The sluice stands open (false with no gate). */
  gateOpen: boolean
}

export const WATER_GATE_WIDTH = 16
/** Against gravity 1050 the hero floats up at about the cap, the same pace as a lift. */
export const WATER_BUOYANCY_DEFAULTS = { force: 1800, cap: 120 } as const

function nonNegative(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

export function waterCycleMs(timing: WaterLevelTiming): number {
  return Math.max(1, nonNegative(timing.highMs) + nonNegative(timing.fallMs) + nonNegative(timing.lowMs) + nonNegative(timing.riseMs))
}

function gateOpenAt(definition: WaterLevelGateDefinition, phase: WaterLevelPhase): boolean {
  if (!definition.gate) return false
  const at = definition.gate.openWhen ?? 'low'
  return at === 'high' ? phase === 'high' || phase === 'still' : phase === 'low'
}

/** The level at a stage-clock time: phase, surface and the gate. */
export function waterLevelAt(definition: WaterLevelGateDefinition, clockMs: number): WaterLevelState {
  const state = (phase: WaterLevelPhase, surfaceY: number, untilChangeMs: number): WaterLevelState => ({
    id: definition.id,
    phase,
    surfaceY,
    untilChangeMs,
    gateOpen: gateOpenAt(definition, phase)
  })
  const timing = definition.timing
  if (!timing) return state('still', definition.highY, 0)
  const cycle = waterCycleMs(timing)
  const local = ((((clockMs + nonNegative(timing.phaseMs)) % cycle) + cycle) % cycle)
  const high = nonNegative(timing.highMs)
  const fall = nonNegative(timing.fallMs)
  const low = nonNegative(timing.lowMs)
  const drop = definition.lowY - definition.highY
  if (local < high) return state('high', definition.highY, high - local)
  if (local < high + fall) return state('falling', definition.highY + (drop * (local - high)) / fall, high + fall - local)
  if (local < high + fall + low) return state('low', definition.lowY, high + fall + low - local)
  const rise = cycle - high - fall - low
  return state('rising', definition.lowY - (drop * (local - high - fall - low)) / Math.max(1, rise), cycle - local)
}

/** The sluice column, or null with no gate. */
export function waterGateBox(definition: WaterLevelGateDefinition): Box | null {
  const gate = definition.gate
  if (!gate) return null
  const half = (gate.width ?? WATER_GATE_WIDTH) / 2
  return { left: gate.x - half, right: gate.x + half, top: gate.top, bottom: gate.bottom }
}

/** Under the water when the centre of the hero's body is below the surface, inside the basin. */
export function isHeroUnderwater(definition: WaterLevelGateDefinition, surfaceY: number, hero: Box): boolean {
  return heroInZone({ x: definition.x, y: surfaceY, width: definition.width, height: definition.bottomY - surfaceY }, hero)
}

/** The float under the surface (an upward push, like a lift), or null above it or with no buoyancy. */
export function waterBuoyancyOn(definition: WaterLevelGateDefinition, surfaceY: number, hero: Box): ZonePush | null {
  const force = definition.buoyancy ?? WATER_BUOYANCY_DEFAULTS.force
  if (!(force > 0) || !isHeroUnderwater(definition, surfaceY, hero)) return null
  return { id: definition.id, forceX: 0, forceY: -force, cap: Math.max(0, definition.buoyancyCap ?? WATER_BUOYANCY_DEFAULTS.cap) }
}
