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

/** v2 (Craig's playtest note): the shared tap rule for every menu list (Title, Profiles, NewCampaign,
 * StageSelect tiles, Options, Controls, SystemMenu, GameOver, the dialogue box). Pure; a scene passes
 * its own items' hit rectangles (top-left bounds, game pixels) and the currently selected id. */
export type TapListItem = Readonly<{ id: string; x: number; y: number; width: number; height: number }>
export type TapListResult = Readonly<{ index: number; confirmed: boolean }>

/** The first tap on an item selects it (`confirmed: false`); a tap on the item already selected
 * confirms it (`confirmed: true`). A tap outside every item hits nothing (`index: -1`). */
export function routeListTap(items: readonly TapListItem[], point: Readonly<{ x: number; y: number }>, selectedId: string | null): TapListResult {
  const index = menuRowAt(items, point.x, point.y)
  if (index === -1) return { index: -1, confirmed: false }
  return { index, confirmed: items[index]!.id === selectedId }
}
