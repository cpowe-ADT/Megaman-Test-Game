/**
 * `timed_rail_group` (prompt 12 part 12b; 02 §2.2; Volt): electrified floor rails that share one timer
 * on the stage clock, like vents: off, then arming sparks for the last `VENT_ARM_MS` of the quiet time,
 * then arcing (the only phase whose damage box is live). Rails stand on a line (`y`, where the posts
 * meet the floor) and the arc box rises `arcHeight` above it, so a jump clears it. Pure; the Phaser edge
 * is `adapters/HazardMechanicsAdapter.ts`, which puts the arc boxes in the stage hazard group.
 */
import { VENT_ARM_MS, ventCycleAt, type HazardTiming } from './hazards'

export type TimedRailDefinition = {
  id: string
  /** Centre x, and the line the posts stand on (usually the floor top), world px. */
  x: number
  y: number
  /** Default 56 (one rail frame). */
  width?: number
}

export type TimedRailGroupDefinition = {
  id: string
  rails: TimedRailDefinition[]
  /** Arcing time and quiet time per cycle, ms (default on 1200, off 1800, phase 0); every rail of the group shares it. */
  timing?: HazardTiming
  /** HP per contact (default 2, a heavy hit). */
  damage?: number
  /** Arc box height above the rail line, px (default 26). */
  arcHeight?: number
}

export type RailPhase = 'off' | 'arming' | 'arcing'

/** A rail's damage box (centre and size, like a hazard) and the line it stands on. */
export type ResolvedRail = { id: string; x: number; y: number; width: number; height: number; floorY: number }

export type ResolvedRailGroup = { id: string; damage: number; timing: Required<HazardTiming>; rails: ResolvedRail[] }

export const RAIL_DEFAULTS = { width: 56, arcHeight: 26, damage: 2, timing: { onMs: 1200, offMs: 1800, phaseMs: 0 } } as const

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

export function resolveRailGroup(definition: TimedRailGroupDefinition): ResolvedRailGroup {
  const arcHeight = positive(definition.arcHeight, RAIL_DEFAULTS.arcHeight)
  return {
    id: definition.id,
    damage: Math.max(1, Math.round(positive(definition.damage, RAIL_DEFAULTS.damage))),
    timing: {
      onMs: positive(definition.timing?.onMs, RAIL_DEFAULTS.timing.onMs),
      offMs: positive(definition.timing?.offMs, RAIL_DEFAULTS.timing.offMs),
      phaseMs: Number(definition.timing?.phaseMs ?? 0) || 0
    },
    rails: definition.rails.map((rail) => ({
      id: rail.id,
      x: rail.x,
      y: rail.y - arcHeight / 2,
      width: positive(rail.width, RAIL_DEFAULTS.width),
      height: arcHeight,
      floorY: rail.y
    }))
  }
}

/** Off, arming (the last `armMs` of quiet), arcing; `untilArcMs` is 0 while arcing. */
export function railCycleAt(
  timing: Required<HazardTiming>,
  clockMs: number,
  armMs = VENT_ARM_MS
): { phase: RailPhase; untilArcMs: number } {
  const cycle = ventCycleAt(timing, clockMs, armMs)
  const phase: RailPhase = cycle.phase === 'firing' ? 'arcing' : cycle.phase === 'arming' ? 'arming' : 'off'
  return { phase, untilArcMs: cycle.untilFireMs }
}
