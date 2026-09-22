import Phaser from 'phaser'
import AudioService from '../audio'
import InputActions from '../input/InputActions'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { GAME_SIZE } from '../config/renderPolicy'

export type VictoryModalOptions = {
  bossName: string
  onNext: () => void
}

export class VictoryModal {
  private readonly scene: Phaser.Scene
  private container?: Phaser.GameObjects.Container
  private open = false
  private nextHandler?: () => void
  private cleanupHandlers: Array<() => void> = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  isOpen(): boolean {
    return this.open
  }

  show(options: VictoryModalOptions): void {
    this.destroy()
    const { width, height } = GAME_SIZE
    const panelWidth = Math.min(520, Math.floor(width * 0.86))
    const panelHeight = 196
    const panelX = width / 2
    const panelY = height / 2

    const container = this.scene.add.container(0, 0)
    container.setDepth(4000)
    container.setScrollFactor(0)
    this.container = container
    this.open = true
    this.nextHandler = options.onNext

    const backdrop = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
      .setInteractive({ useHandCursor: false })

    const panel = this.scene.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x101827, 0.96)
      .setStrokeStyle(1, 0xffffff, 0.08)

    const title = this.scene.add
      .text(panelX, panelY - 64, 'Boss Defeated', {
        fontFamily: '"Trebuchet MS", monospace',
        fontSize: '24px',
        color: '#f8fbff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)

    const body = this.scene.add
      .text(panelX, panelY - 18, `You have defeated ${options.bossName}.`, {
        fontFamily: '"Trebuchet MS", monospace',
        fontSize: '16px',
        color: '#e5efff',
        align: 'center'
      })
      .setOrigin(0.5)

    const sub = this.scene.add
      .text(panelX, panelY + 8, 'Select another stage to continue.', {
        fontFamily: '"Trebuchet MS", monospace',
        fontSize: '13px',
        color: '#a8bfde',
        align: 'center'
      })
      .setOrigin(0.5)

    const button = this.scene.add
      .rectangle(panelX, panelY + 58, 120, 42, 0x2463d1, 1)
      .setStrokeStyle(1, 0xffffff, 0.25)
      .setInteractive({ useHandCursor: true })

    const buttonLabel = this.scene.add
      .text(panelX, panelY + 58, 'Next', {
        fontFamily: '"Trebuchet MS", monospace',
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)

    button.on('pointerover', () => button.setFillStyle(0x2f79ff, 1))
    button.on('pointerout', () => button.setFillStyle(0x2463d1, 1))
    button.on('pointerdown', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      this.confirm()
    })

    container.add([backdrop, panel, title, body, sub, button, buttonLabel])
    container.setAlpha(0)
    container.setScale(0.98)

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 140,
      ease: 'Sine.Out'
    })

    const cleanup = bindMenuConfirmCancel(this.scene, {
      onConfirm: () => this.confirm(),
      onCancel: () => this.confirm()
    })
    this.cleanupHandlers.push(cleanup)
  }

  confirm(): void {
    if (!this.open) {
      return
    }
    InputActions.flushTransientState(this.scene)
    const handler = this.nextHandler
    this.destroy()
    handler?.()
  }

  destroy(): void {
    this.cleanupHandlers.forEach((cleanup) => cleanup())
    this.cleanupHandlers = []
    this.nextHandler = undefined
    this.container?.destroy(true)
    this.container = undefined
    this.open = false
  }
}
