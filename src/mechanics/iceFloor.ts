/**
 * `ice_floor` (prompt 12 part 12b; 02 §2.2): ice-tile platforms. Standing on one sets the motor's
 * surface to `ice` (ground friction x0.35, a grounded dash +40% distance: `src/player/environment.ts`).
 * A stage with ice floors has frozen pits: its pits draw as ice water, not slag (`frozenPitColors`, 12d).
 * Pure; the Phaser edge is `adapters/MotionMechanicsAdapter.ts`.
 */
import { isStandingOn, type Box } from './crumbleGroup'

export type IceFloorDefinition = {
  id: string
  /** Centre, world px (like `midPlatforms`). */
  x: number
  y: number
  width: number
  /** Default 16 (one ice tile). */
  height?: number
  /** Default `solid`. */
  type?: 'solid' | 'oneWay'
  color?: number
}

export const ICE_FLOOR_DEFAULT_HEIGHT = 16

export function iceFloorBox(definition: IceFloorDefinition): Box {
  const height = definition.height ?? ICE_FLOOR_DEFAULT_HEIGHT
  return {
    left: definition.x - definition.width / 2,
    right: definition.x + definition.width / 2,
    top: definition.y - height / 2,
    bottom: definition.y + height / 2
  }
}

/** The ice platform under a grounded hero's feet, or null. */
export function iceFloorUnder(definitions: readonly IceFloorDefinition[], hero: Box, grounded: boolean): string | null {
  if (!grounded) return null
  return definitions.find((definition) => isStandingOn(hero, iceFloorBox(definition), true))?.id ?? null
}

/** Frozen pit water: a deep ice blue under a pale crust line (the pits of a stage with ice floors, 12d). */
export const FROZEN_PIT_COLORS = Object.freeze({ fill: 0x2f6f9f, surface: 0xd8f4ff })

/** The pit colours of a stage with ice floors, or undefined (its pits keep the default slag). */
export function frozenPitColors(iceFloors: readonly IceFloorDefinition[] | undefined): { fill: number; surface: number } | undefined {
  return iceFloors && iceFloors.length > 0 ? { ...FROZEN_PIT_COLORS } : undefined
}
