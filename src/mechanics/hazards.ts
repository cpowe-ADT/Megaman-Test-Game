/**
 * Typed stage hazards (06 §6.1 "hazards are typed and timed", pulled forward for Heat Works). Pure:
 * the damage box and damage come from the definition (spikes keep the old 28x10 for 1 as their
 * defaults), and every timed `vent` on a stage reads one shared stage clock, so vents with the same
 * `phaseMs` fire together and the stage has one rhythm. The Phaser edge is `adapters/StageMechanicsAdapter.ts`.
 */
export type StageHazardKind = 'spikes' | 'vent'

export type HazardTiming = {
  /** Firing time per cycle, ms. */
  onMs: number
  /** Quiet time per cycle, ms; its last `VENT_ARM_MS` is the arming flash. */
  offMs: number
  /** Offset into the shared stage clock, ms (default 0); equal offsets fire together. */
  phaseMs?: number
}

export type StageHazardDefinition = {
  id: string
  /** Centre of the damage box, world px. */
  x: number
  y: number
  /** Default `spikes` (always on). */
  kind?: StageHazardKind
  /** Damage box, game px (spikes default 28x10, vents 16x48). */
  width?: number
  height?: number
  /** HP per contact (spikes default 1, vents 2); 2 or more reads as a heavy hit. */
  damage?: number
  /** Vent only (default on 1000ms, off 1600ms, phase 0). */
  timing?: HazardTiming
  /** Vent only: the flame column points up from a floor nozzle (default) or down from a ceiling one. */
  direction?: 'up' | 'down'
}

export type ResolvedHazard = {
  id: string
  kind: StageHazardKind
  x: number
  y: number
  width: number
  height: number
  damage: number
  direction: 'up' | 'down'
  /** Null for always-on hazards. */
  timing: Required<HazardTiming> | null
}

export type VentPhase = 'idle' | 'arming' | 'firing'

export const VENT_ARM_MS = 300
export const SPIKE_DEFAULTS = { width: 28, height: 10, damage: 1 } as const
export const VENT_DEFAULTS = { width: 16, height: 48, damage: 2, timing: { onMs: 1000, offMs: 1600, phaseMs: 0 } } as const

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

export function resolveHazard(definition: StageHazardDefinition): ResolvedHazard {
  const kind = definition.kind ?? 'spikes'
  const defaults = kind === 'vent' ? VENT_DEFAULTS : SPIKE_DEFAULTS
  const timing =
    kind === 'vent'
      ? {
          onMs: positive(definition.timing?.onMs, VENT_DEFAULTS.timing.onMs),
          offMs: positive(definition.timing?.offMs, VENT_DEFAULTS.timing.offMs),
          phaseMs: Number(definition.timing?.phaseMs ?? 0) || 0
        }
      : null
  return {
    id: definition.id,
    kind,
    x: definition.x,
    y: definition.y,
    width: positive(definition.width, defaults.width),
    height: positive(definition.height, defaults.height),
    damage: Math.max(1, Math.round(positive(definition.damage, defaults.damage))),
    direction: definition.direction ?? 'up',
    timing
  }
}

/** Cycle position: quiet, then the arming flash (the last `armMs` of quiet), then firing. */
export function ventPhaseAt(timing: Required<HazardTiming>, clockMs: number, armMs = VENT_ARM_MS): VentPhase {
  return ventCycleAt(timing, clockMs, armMs).phase
}

/** Phase plus the time until the vent next fires (0 while firing). */
export function ventCycleAt(
  timing: Required<HazardTiming>,
  clockMs: number,
  armMs = VENT_ARM_MS
): { phase: VentPhase; untilFireMs: number } {
  const period = Math.max(1, timing.onMs + timing.offMs)
  const t = (((clockMs + timing.phaseMs) % period) + period) % period
  if (t >= timing.offMs) return { phase: 'firing', untilFireMs: 0 }
  const untilFireMs = timing.offMs - t
  return { phase: untilFireMs <= Math.min(armMs, timing.offMs) ? 'arming' : 'idle', untilFireMs }
}

/** Damage only while firing; spikes always. */
export function isHazardLive(hazard: ResolvedHazard, clockMs: number): boolean {
  return hazard.timing === null || ventPhaseAt(hazard.timing, clockMs) === 'firing'
}

/** The shared stage clock runs only while the world does: pause and dialogue hold every vent in step. */
export function advanceStageClock(clockMs: number, deltaMs: number, paused: boolean): number {
  if (paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return clockMs
  return clockMs + Math.min(deltaMs, 100)
}
