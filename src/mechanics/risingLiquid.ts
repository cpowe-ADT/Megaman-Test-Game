/**
 * `rising_liquid` (prompt 02 §2.2; Heat Works' slag climb). A kill plane whose surface rises from
 * `floorY` to `topY` over `riseMs` once the hero reaches `triggerX` (or trips its `switchBox`, the
 * Medicine District's filter switch), then holds at the top. It holds while the hero is dying and
 * restarts from the floor (dormant, the switch re-armed) on the checkpoint respawn. Pure; the Phaser
 * edge (tinted body with a bright surface line, contact kill through the damage path, the switch
 * plate and lamp) is `adapters/StageMechanicsAdapter.ts`.
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
  /** The rise starts when the hero crosses this x going right (a respawn past it does not restart the rise); ignored with a `switchBox`. */
  triggerX: number
  /**
   * A filter switch (12d, the Medicine District's tower): the rise starts the frame the hero's body
   * touches this box, from any side, instead of at the `triggerX` crossing. Centre and size, world px.
   */
  switchBox?: { x: number; y: number; width: number; height: number }
  /** A coloured liquid (Mire's acid) draws as a flat fill with a `surfaceColor` line instead of the slag art. */
  color?: number
  surfaceColor?: number
}

/** The hero's body box, world px (y grows down). */
export type RisingLiquidHeroBox = { left: number; right: number; top: number; bottom: number }

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

/** Whether this frame starts the rise: the hero's body touches the switch, or (no switch) crosses `triggerX` going right. */
export function isRisingLiquidTripped(
  definition: RisingLiquidDefinition,
  input: { heroX: number; prevHeroX: number; hero?: RisingLiquidHeroBox }
): boolean {
  const box = definition.switchBox
  if (!box) return input.prevHeroX < definition.triggerX && input.heroX >= definition.triggerX
  const hero = input.hero
  if (!hero) return false
  return (
    hero.right > box.x - box.width / 2 &&
    hero.left < box.x + box.width / 2 &&
    hero.bottom > box.y - box.height / 2 &&
    hero.top < box.y + box.height / 2
  )
}

/**
 * One frame: dormant until tripped (`isRisingLiquidTripped`), then rising, then full. The adapter
 * skips frames while paused or dying.
 */
export function stepRisingLiquid(
  definition: RisingLiquidDefinition,
  state: RisingLiquidState,
  input: { heroX: number; prevHeroX: number; deltaMs: number; hero?: RisingLiquidHeroBox }
): RisingLiquidState {
  if (state.phase === 'dormant') {
    if (!isRisingLiquidTripped(definition, input)) return state
    return { ...state, phase: 'rising', elapsedMs: 0, surfaceY: definition.floorY }
  }
  if (state.phase === 'full') return state
  const elapsedMs = state.elapsedMs + Math.max(0, input.deltaMs)
  const surfaceY = risingLiquidSurfaceY(definition, elapsedMs)
  return { ...state, elapsedMs, surfaceY, phase: elapsedMs >= definition.riseMs ? 'full' : 'rising' }
}

/** The checkpoint respawn: back to the floor, waiting for the trigger (or the switch) again. */
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
