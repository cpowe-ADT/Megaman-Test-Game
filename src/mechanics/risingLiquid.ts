/**
 * `rising_liquid` (prompt 02 §2.2; Heat Works' slag climb). A kill plane whose surface rises from
 * `floorY` to `topY` over `riseMs` once the hero reaches `triggerX`, then holds at the top. It holds
 * while the hero is dying and restarts from the floor (dormant) on the checkpoint respawn. Pure; the
 * Phaser edge (tinted body with a bright surface line, contact kill through the damage path) is
 * `adapters/StageMechanicsAdapter.ts`.
 */
export type RisingLiquidDefinition = {
  id: string
  /** Left edge and width of the liquid, world px. */
  x: number
  width: number
  /** Surface y at rest and at full rise, world px (y grows down, so `topY < floorY`). */
  floorY: number
  topY: number
  /** Floor to top, ms (Heat Works: 14000). */
  riseMs: number
  /** The rise starts when the hero crosses this x going right (a respawn past it does not restart the rise). */
  triggerX: number
  color?: number
}

export type RisingLiquidPhase = 'dormant' | 'rising' | 'full'

export type RisingLiquidState = {
  id: string
  phase: RisingLiquidPhase
  elapsedMs: number
  surfaceY: number
}

/** How far the hero's feet sink under the surface before it counts as contact (a grazing hop survives). */
export const LIQUID_CONTACT_DEPTH_PX = 4

export function createRisingLiquidState(definition: RisingLiquidDefinition): RisingLiquidState {
  return { id: definition.id, phase: 'dormant', elapsedMs: 0, surfaceY: definition.floorY }
}

export function risingLiquidSurfaceY(definition: RisingLiquidDefinition, elapsedMs: number): number {
  const progress = definition.riseMs > 0 ? Math.min(1, Math.max(0, elapsedMs / definition.riseMs)) : 1
  return definition.floorY - (definition.floorY - definition.topY) * progress
}

/**
 * One frame: dormant until the hero crosses the trigger (`prevHeroX` left of it, `heroX` at or past it),
 * then rising, then full. The adapter skips frames while paused or dying.
 */
export function stepRisingLiquid(
  definition: RisingLiquidDefinition,
  state: RisingLiquidState,
  input: { heroX: number; prevHeroX: number; deltaMs: number }
): RisingLiquidState {
  if (state.phase === 'dormant') {
    if (!(input.prevHeroX < definition.triggerX && input.heroX >= definition.triggerX)) return state
    return { ...state, phase: 'rising', elapsedMs: 0, surfaceY: definition.floorY }
  }
  if (state.phase === 'full') return state
  const elapsedMs = state.elapsedMs + Math.max(0, input.deltaMs)
  const surfaceY = risingLiquidSurfaceY(definition, elapsedMs)
  return { ...state, elapsedMs, surfaceY, phase: elapsedMs >= definition.riseMs ? 'full' : 'rising' }
}

/** The checkpoint respawn: back to the floor, waiting for the trigger again. */
export function resetRisingLiquid(definition: RisingLiquidDefinition): RisingLiquidState {
  return createRisingLiquidState(definition)
}

export function isInsideLiquid(
  definition: RisingLiquidDefinition,
  surfaceY: number,
  hero: { left: number; right: number; bottom: number },
  depthPx = LIQUID_CONTACT_DEPTH_PX
): boolean {
  const overlapsX = hero.right > definition.x && hero.left < definition.x + definition.width
  return overlapsX && hero.bottom > surfaceY + depthPx
}
