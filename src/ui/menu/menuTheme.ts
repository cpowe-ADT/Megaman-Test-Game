import Phaser from 'phaser'
import { GAME_SIZE } from '../../config/renderPolicy'

export { PIXEL_FONT, PIXEL_FONT_FAMILY, PIXEL_FONT_PX, pixelFont, pixelFontSize, pixelScaleFor, type PixelFontScale } from '../pixelFont'

export const MENU_COLORS = {
  ink: 0x030711,
  navy: 0x071a34,
  panel: 0x0a2345,
  panelBright: 0x103665,
  blue: 0x4a8cff,
  cyan: 0x5de1ff,
  white: 0xf5f8ff,
  muted: 0x8faed8,
  warning: 0xffc857,
  danger: 0xff6b77
} as const

export function addMenuBackdrop(scene: Phaser.Scene, dimAlpha = 1): Phaser.GameObjects.Graphics {
  const { width, height } = GAME_SIZE
  const graphics = scene.add.graphics()
  graphics.fillStyle(MENU_COLORS.ink, dimAlpha)
  graphics.fillRect(0, 0, width, height)
  graphics.fillStyle(0x0b2b55, 0.72 * dimAlpha)
  graphics.fillTriangle(0, 0, width * 0.64, 0, 0, height * 0.82)
  graphics.fillStyle(0x07152b, 0.9 * dimAlpha)
  graphics.fillTriangle(width, height, width * 0.38, height, width, height * 0.18)
  graphics.lineStyle(1, MENU_COLORS.blue, 0.08 * dimAlpha)
  for (let y = 4; y < height; y += 5) {
    graphics.lineBetween(0, y, width, y)
  }
  for (let x = -height; x < width; x += 28) {
    graphics.lineBetween(x, height, x + height, 0)
  }
  graphics.fillStyle(MENU_COLORS.cyan, 0.85 * dimAlpha)
  graphics.fillRect(0, 0, width, 2)
  graphics.fillStyle(MENU_COLORS.blue, 0.65 * dimAlpha)
  graphics.fillRect(0, height - 3, width, 3)
  return graphics
}

export function addMenuPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 0.97
): Phaser.GameObjects.Rectangle {
  scene.add.rectangle(x + 3, y + 4, width, height, 0x000000, 0.46)
  const panel = scene.add.rectangle(x, y, width, height, MENU_COLORS.panel, alpha)
    .setStrokeStyle(1, MENU_COLORS.blue, 0.95)
  scene.add.rectangle(x, y - height / 2 + 2, width - 2, 3, MENU_COLORS.cyan, 0.9)
  scene.add.rectangle(x - width / 2 + 2, y, 3, height - 4, MENU_COLORS.blue, 0.6)
  return panel
}

export function styleMenuHeading(text: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  // Unblurred, so the shadow is pixels too.
  return text.setShadow(0, 2, '#000814', 0, true, true)
}
