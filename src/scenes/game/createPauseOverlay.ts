import type Phaser from 'phaser'
import { PIXEL_FONT, pixelFontSize } from '../../ui/pixelFont'
export function createPauseOverlay(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Container {
  const overlay = scene.add.container(0, 0).setScrollFactor(0).setDepth(900)
  const dim = scene.add.rectangle(width / 2, height / 2, width, height, 0, .55).setScrollFactor(0)
  const label = scene.add.text(width / 2, height / 2, 'Paused', { fontFamily: PIXEL_FONT, fontSize: pixelFontSize(3), color: '#ffffff', backgroundColor: 'rgba(8, 12, 20, 0.75)', padding: { x: 12, y: 8 }, align: 'center' }).setOrigin(.5).setScrollFactor(0).setShadow(2, 2, '#000000', 0, true, true)
  overlay.add([dim, label]).setVisible(false)
  scene.events.once('shutdown', () => overlay.destroy(true))
  return overlay
}
