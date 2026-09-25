import type Phaser from 'phaser'
import type { RisingLiquidDefinition, RisingLiquidPhase } from '../risingLiquid'

const ARMED = 0xffc24a
const TRIPPED = 0xff3b30
const PRESSED = 0x3a4a3a
const HOUSING = 0x1d2b22
const LAMP_BLINK_MS = 400

/** The filter switch's drawing, synced from the liquid's phase each frame. */
export type FilterSwitchVisual = { sync(phase: RisingLiquidPhase, clockMs: number): void }

/**
 * The Medicine District's filter switch (12d): a plate on the floor of its box and a lamp housing over
 * its top. Armed, the plate is raised and amber and the lamp blinks; tripped, the plate is pressed flat
 * and the lamp holds red. The trip itself is `isRisingLiquidTripped` (pure); this only shows it.
 */
export function createFilterSwitchVisual(scene: Phaser.Scene, box: NonNullable<RisingLiquidDefinition['switchBox']>): FilterSwitchVisual {
  const top = box.y - box.height / 2
  const bottom = box.y + box.height / 2
  const plate = scene.add.rectangle(box.x, bottom, box.width, 4, ARMED, 1).setOrigin(0.5, 1).setDepth(4)
  scene.add.rectangle(box.x, top, box.width, 10, HOUSING, 1).setOrigin(0.5, 1).setDepth(4)
  const lamp = scene.add.rectangle(box.x, top - 3, 6, 4, ARMED, 1).setOrigin(0.5, 1).setDepth(4)
  return {
    sync(phase, clockMs) {
      const tripped = phase !== 'dormant'
      plate.setFillStyle(tripped ? PRESSED : ARMED, 1).setScale(1, tripped ? 0.5 : 1)
      lamp.setFillStyle(tripped ? TRIPPED : ARMED, 1).setAlpha(tripped || Math.floor(clockMs / LAMP_BLINK_MS) % 2 === 0 ? 1 : 0.35)
    }
  }
}

export type LiquidColors = { fill: number; surface: number }

/**
 * A stage whose rising liquid has a colour (Mire's acid) draws its pits in the same colours; undefined keeps
 * the slag art. Flat shapes, not a tint: the tinted slag art still drew orange in the smoke captures.
 */
export function pitLiquidColors(liquids: readonly RisingLiquidDefinition[] | undefined): LiquidColors | undefined {
  const liquid = liquids?.find((entry) => typeof entry.color === 'number')
  return typeof liquid?.color === 'number' ? { fill: liquid.color, surface: liquid.surfaceColor ?? liquid.color } : undefined
}

/** One pit's liquid over the backdrop's strip: `depthPx` of fill up from `bottom`, a 2px surface line on top. */
export function createPitLiquid(scene: Phaser.Scene, gap: { x: number; width: number }, bottom: number, depthPx: number, colors: LiquidColors): void {
  scene.add.rectangle(gap.x, bottom - depthPx, gap.width, depthPx, colors.fill, 0.9).setOrigin(0, 0).setDepth(3)
  scene.add.rectangle(gap.x, bottom - depthPx, gap.width, 2, colors.surface, 1).setOrigin(0, 0).setDepth(3)
}
