/**
 * `conveyor` (prompt 12 part 12b; 02 §2.2): a belt platform whose surface carries whatever stands on it
 * at `speed` px/s. The hero gets it as a carry velocity through the motor environment (a dash-jump off
 * the belt keeps it, `src/player/environment.ts`); enemies and other grounded bodies are moved by
 * `conveyorCarryDeltaX`. Pure; the Phaser edge is `adapters/MotionMechanicsAdapter.ts`.
 */
import { isStandingOn, type Box } from './crumbleGroup'

export type ConveyorDefinition = {
  id: string
  /** Centre, world px (like `midPlatforms`). */
  x: number
  y: number
  /** Belt length, px; the art tiles in 56px segments. */
  width: number
  /** Default 12. */
  height?: number
  /** Surface speed, px/s: positive carries right, negative left (default 60). */
  speed?: number
  /** Default `solid`. */
  type?: 'solid' | 'oneWay'
  color?: number
}

export const CONVEYOR_DEFAULT_HEIGHT = 12
export const CONVEYOR_DEFAULT_SPEED = 60

export function conveyorSpeed(definition: ConveyorDefinition): number {
  const speed = definition.speed ?? CONVEYOR_DEFAULT_SPEED
  return Number.isFinite(speed) ? speed : 0
}

export function conveyorBox(definition: ConveyorDefinition): Box {
  const height = definition.height ?? CONVEYOR_DEFAULT_HEIGHT
  return {
    left: definition.x - definition.width / 2,
    right: definition.x + definition.width / 2,
    top: definition.y - height / 2,
    bottom: definition.y + height / 2
  }
}

/** The belt a grounded actor stands on (the first one listed) and its speed; none gives `{ id: null, speed: 0 }`. */
export function conveyorCarryAt(
  definitions: readonly ConveyorDefinition[],
  actor: Box,
  grounded: boolean
): { id: string | null; speed: number } {
  if (!grounded) return { id: null, speed: 0 }
  const belt = definitions.find((definition) => isStandingOn(actor, conveyorBox(definition), true))
  return belt ? { id: belt.id, speed: conveyorSpeed(belt) } : { id: null, speed: 0 }
}

/** How far a grounded body on the belt moves this frame, px (the adapter moves enemies and loose bodies by it). */
export function conveyorCarryDeltaX(speed: number, deltaMs: number): number {
  return (speed * Math.max(0, deltaMs)) / 1000
}
