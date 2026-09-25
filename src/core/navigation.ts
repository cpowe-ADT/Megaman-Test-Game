import Phaser from 'phaser'
import { PIXEL_FONT, pixelFontSize } from '../ui/pixelFont'
import { GAME_WIDTH } from '../config/renderPolicy'
import InputActions from '../input/InputActions'

type ReturnToStageSelectOptions = {
  reason?: string
  toastMessage?: string
  focusBossId?: string | null
  requireConfirmRelease?: boolean
}

function safeResetInput(scene: Phaser.Scene): void {
  InputActions.flushTransientState(scene)
  try {
    scene.input.keyboard?.resetKeys()
  } catch {
    // Keyboard plugin may be unavailable during teardown.
  }

  const pads = scene.input.gamepad?.gamepads ?? []
  pads.forEach((pad) => {
    try {
      ;(pad as any)?.reset?.()
    } catch {
      // Gamepad may disconnect between frames.
    }
  })
}

function safeCleanupScene(scene: Phaser.Scene): void {
  scene.time.timeScale = 1
  scene.tweens.killAll()
  scene.time.removeAllEvents()
  scene.physics?.world?.resume()
  safeResetInput(scene)
}

function safePrepareSceneTransition(scene: Phaser.Scene): void {
  scene.time.timeScale = 1
  scene.physics?.world?.resume()
  safeResetInput(scene)
}

export function showToast(scene: Phaser.Scene, message: string, durationMs = 1800): Phaser.GameObjects.Container {
  const width = GAME_WIDTH
  const y = scene.scene.key === 'StageSelect' ? 80 : scene.scene.key === 'Title' ? 58 : 20
  const container = scene.add.container(width / 2, y)
  container.setDepth(3000)
  container.setScrollFactor(0)

  const metrics = scene.add.text(0, 0, message, {
    fontFamily: PIXEL_FONT,
    fontSize: pixelFontSize(1),
    color: '#dbeafe',
    align: 'center'
  })
  metrics.setOrigin(0.5, 0.5)

  const bgWidth = Math.max(120, Math.ceil(metrics.width + 22))
  const bg = scene.add
    .rectangle(0, 0, bgWidth, 30, 0x101827, 0.92)
    .setStrokeStyle(1, 0xffffff, 0.12)

  container.add([bg, metrics])
  container.setAlpha(0)

  scene.tweens.add({
    targets: container,
    alpha: 1,
    y: y + 6,
    duration: 120,
    ease: 'Sine.Out'
  })

  scene.time.delayedCall(durationMs, () => {
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: y - 6,
      duration: 140,
      ease: 'Sine.In',
      onComplete: () => container.destroy(true)
    })
  })

  return container
}

export function returnToStageSelect(scene: Phaser.Scene, options: ReturnToStageSelectOptions = {}): void {
  const { reason = 'manual', toastMessage, focusBossId = null, requireConfirmRelease = false } = options

  if (toastMessage) {
    scene.registry.set('ui.stageSelect.toast', toastMessage)
  }
  scene.registry.set('ui.stageSelect.focusBossId', focusBossId)
  scene.registry.set('ui.stageSelect.returnReason', reason)
  scene.registry.set('ui.stageSelect.requireConfirmRelease', requireConfirmRelease)

  const siblingScenes = scene.game.scene.getScenes(true).filter((candidate) => candidate !== scene && candidate.scene.key !== 'StageSelect')
  safePrepareSceneTransition(scene)
  scene.scene.start('StageSelect')
  siblingScenes.forEach((candidate) => {
    safeCleanupScene(candidate)
    candidate.scene.stop(candidate.scene.key)
  })
}
