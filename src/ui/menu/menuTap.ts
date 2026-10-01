/** Taps on menu rows (part 12i: the pause menu and Options work by touch). Pure; the scenes pass plate bounds. */
export type MenuTapIntent = 'previous' | 'next' | 'activate'
export type MenuPlateBounds = Readonly<{ x: number; y: number; width: number; height: number }>

/** A cycle row steps back on the left third of its plate and forward on the right third; its middle, and any action row, activates. */
export function menuTapIntent(offsetX: number, plateWidth: number, kind: 'cycle' | 'action'): MenuTapIntent {
  if (kind !== 'cycle' || plateWidth <= 0) return 'activate'
  if (offsetX < plateWidth / 3) return 'previous'
  if (offsetX > (plateWidth * 2) / 3) return 'next'
  return 'activate'
}

/** The row whose plate (top-left bounds, game pixels) holds the point, or -1. */
export function menuRowAt(plates: readonly MenuPlateBounds[], x: number, y: number): number {
  return plates.findIndex((plate) => x >= plate.x && x <= plate.x + plate.width && y >= plate.y && y <= plate.y + plate.height)
}
