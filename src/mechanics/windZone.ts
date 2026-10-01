/**
 * `wind_zone` (prompt 12 part 12b; 02 §2.2; D-001 asked for a vertical axis): a `gust` pushes sideways on
 * a cycle of the shared stage clock (calm, then `building` streaks for `WIND_BUILD_MS`, then blowing); a
 * `lift` pushes up, always on unless it has a timing. `style: 'magnet'` is Ferro's magnet lift: the same
 * pull with the magnet art. The push is capped and halved on the ground (`src/player/environment.ts`).
 * 12d (Weather District): `windDriftPx` is how far a gust carries an airborne hero over one flight (the
 * stage's widest gaps are sized with it), and a stage with gusts draws its pits as the storm below.
 * Pure; the Phaser edge is `adapters/MotionMechanicsAdapter.ts`.
 */
import { stepPushVelocity } from '../player/environment'
import type { Box } from './crumbleGroup'
import { heroInZone, type ZonePush, type ZoneRect } from './forceZone'
import { ventCycleAt, type HazardTiming } from './hazards'

export type WindZoneKind = 'gust' | 'lift'
export type WindZoneStyle = 'wind' | 'magnet'

export type WindZoneDefinition = ZoneRect & {
  id: string
  /** Default `gust`. */
  kind?: WindZoneKind
  /** Default `wind`; `magnet` draws Ferro's magnet lift. */
  style?: WindZoneStyle
  /** Gust only: 1 blows right (default), -1 left. */
  direction?: 1 | -1
  /** Push, px/s^2 (gust default 900; lift default 2100, which beats the hero's 1050 gravity). */
  force?: number
  /** The push speed it builds to, px/s (gust default 150, lift default 170). */
  maxSpeed?: number
  /** Cycle on the stage clock (gust default on 1400ms, off 1800ms); a lift without one is always on. */
  timing?: HazardTiming
}

export type WindPhase = 'calm' | 'building' | 'blowing'

export type ResolvedWindZone = {
  id: string
  kind: WindZoneKind
  style: WindZoneStyle
  rect: ZoneRect
  direction: 1 | -1
  force: number
  maxSpeed: number
  /** Null: always blowing. */
  timing: Required<HazardTiming> | null
}

/** The streaks show this long before a gust blows (the tell). */
export const WIND_BUILD_MS = 500
export const WIND_GUST_DEFAULTS = { force: 900, maxSpeed: 150, timing: { onMs: 1400, offMs: 1800, phaseMs: 0 } } as const
export const WIND_LIFT_DEFAULTS = { force: 2100, maxSpeed: 170 } as const

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

export function resolveWindZone(definition: WindZoneDefinition): ResolvedWindZone {
  const kind = definition.kind ?? 'gust'
  const defaults = kind === 'lift' ? WIND_LIFT_DEFAULTS : WIND_GUST_DEFAULTS
  const timing = definition.timing ?? (kind === 'gust' ? WIND_GUST_DEFAULTS.timing : undefined)
  return {
    id: definition.id,
    kind,
    style: definition.style ?? 'wind',
    rect: { x: definition.x, y: definition.y, width: definition.width, height: definition.height },
    direction: definition.direction === -1 ? -1 : 1,
    force: positive(definition.force, defaults.force),
    maxSpeed: positive(definition.maxSpeed, defaults.maxSpeed),
    timing: timing
      ? {
          onMs: positive(timing.onMs, WIND_GUST_DEFAULTS.timing.onMs),
          offMs: positive(timing.offMs, WIND_GUST_DEFAULTS.timing.offMs),
          phaseMs: Number(timing.phaseMs ?? 0) || 0
        }
      : null
  }
}

/** Calm, then building for the last `WIND_BUILD_MS` of calm, then blowing; `untilBlowMs` is 0 while blowing. */
export function windCycleAt(zone: ResolvedWindZone, clockMs: number): { phase: WindPhase; untilBlowMs: number } {
  if (!zone.timing) return { phase: 'blowing', untilBlowMs: 0 }
  const cycle = ventCycleAt(zone.timing, clockMs, WIND_BUILD_MS)
  const phase: WindPhase = cycle.phase === 'firing' ? 'blowing' : cycle.phase === 'arming' ? 'building' : 'calm'
  return { phase, untilBlowMs: cycle.untilFireMs }
}

/** The zone's push on the hero: only while blowing and with the hero inside. A lift pushes up (negative y). */
export function windPushOn(zone: ResolvedWindZone, phase: WindPhase, hero: Box): ZonePush | null {
  if (phase !== 'blowing' || !heroInZone(zone.rect, hero)) return null
  return zone.kind === 'lift'
    ? { id: zone.id, forceX: 0, forceY: -zone.force, cap: zone.maxSpeed }
    : { id: zone.id, forceX: zone.force * zone.direction, forceY: 0, cap: zone.maxSpeed }
}

/**
 * How far a gust carries an airborne hero over one flight, px along its direction: the push builds from
 * `startPush` toward the cap while it blows and fades once it stops (`stepPushVelocity`, the motor's own
 * rule), stepped at 60fps. `blowMs` is how long it keeps blowing after take-off (default: the whole
 * flight), so a hero who jumps late in a blow gets less. A lift carries no one sideways (0).
 */
export function windDriftPx(
  zone: ResolvedWindZone,
  flightMs: number,
  options: { startPush?: number; blowMs?: number; stepMs?: number } = {}
): number {
  if (zone.kind !== 'gust' || !(flightMs > 0)) return 0
  const stepMs = options.stepMs && options.stepMs > 0 ? options.stepMs : 1000 / 60
  const blowMs = options.blowMs ?? flightMs
  let push = options.startPush ?? 0
  let drift = 0
  for (let elapsed = 0; elapsed < flightMs; elapsed += stepMs) {
    const force = elapsed < blowMs ? zone.force * zone.direction : 0
    push = stepPushVelocity(push, force, zone.maxSpeed, stepMs / 1000)
    drift += (push * Math.min(stepMs, flightMs - elapsed)) / 1000
  }
  return Math.abs(drift)
}

/** The storm under the sky dock (12d, Weather District): a stage with gusts draws its pits as open air over it. */
export const STORM_PIT_COLORS = Object.freeze({ fill: 0x1c2a3d, surface: 0x9cc3e6 })

/** The pit colours of a stage with sideways gusts (lifts and the magnet do not count), or undefined. */
export function stormPitColors(windZones: readonly WindZoneDefinition[] | undefined): { fill: number; surface: number } | undefined {
  return windZones?.some((zone) => (zone.kind ?? 'gust') === 'gust' && (zone.style ?? 'wind') === 'wind') ? { ...STORM_PIT_COLORS } : undefined
}
