import Phaser from 'phaser'
import { AUTOMATION } from '../config/automation'
import { DigitalButtonPad, type DigitalButtonName } from '../input/DigitalButtonPad'

type TouchButtonConfig = {
  key?: DigitalButtonName
  x: number
  y: number
  width: number
  height: number
  label: string
  alpha?: number
  radius?: number
  onPress?: () => void
}

type GameplayTouchControlsOptions = {
  onPause: () => void
}

function resolveTouchMode(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const query = new URLSearchParams(window.location.search)
  if (AUTOMATION.enabled && query.get('touchControls') === '1') {
    return true
  }

  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) {
    return true
  }

  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
}

export class GameplayTouchControls {
  private readonly root: Phaser.GameObjects.Container
  private readonly cleanupHandlers: Array<() => void> = []
  private readonly pointerBindings = new Map<number, DigitalButtonName>()
  private readonly buttonPointerIds = new Map<DigitalButtonName, Set<number>>()
  private readonly visualPressers = new Map<DigitalButtonName, () => void>()
  private readonly visualResetters = new Map<DigitalButtonName, () => void>()
  private pauseVisualPress?: () => void
  private pauseVisualReset?: () => void
  private visible = false

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly buttons: DigitalButtonPad,
    private readonly options: GameplayTouchControlsOptions
  ) {
    this.root = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1800)
    this.root.setVisible(false)
    this.build()
    this.layout()

    const resizeHandler = () => this.layout()
    this.scene.scale.on('resize', resizeHandler)
    this.cleanupHandlers.push(() => this.scene.scale.off('resize', resizeHandler))

    const pointerUpHandler = (pointer: Phaser.Input.Pointer) => {
      this.releasePointer(pointer.id)
    }
    this.scene.input.on('pointerup', pointerUpHandler)
    this.scene.input.on('gameout', pointerUpHandler)
    this.cleanupHandlers.push(() => {
      this.scene.input.off('pointerup', pointerUpHandler)
      this.scene.input.off('gameout', pointerUpHandler)
    })
  }

  static shouldEnable(): boolean {
    return resolveTouchMode()
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.root.setVisible(visible)
    if (!visible) {
      this.pointerBindings.clear()
      this.buttonPointerIds.clear()
      this.buttons.reset()
    }
  }

  isVisible(): boolean {
    return this.visible
  }

  setButtonHeld(name: DigitalButtonName, held: boolean): void {
    this.buttons.setHeld(name, held)
    if (held) {
      this.visualPressers.get(name)?.()
      return
    }
    this.buttonPointerIds.delete(name)
    this.visualResetters.get(name)?.()
  }

  triggerPause(): void {
    this.pauseVisualPress?.()
    this.options.onPause()
    this.scene.time.delayedCall(120, () => this.pauseVisualReset?.())
  }

  destroy(): void {
    this.cleanupHandlers.forEach((cleanup) => cleanup())
    this.cleanupHandlers.length = 0
    this.pointerBindings.clear()
    this.buttonPointerIds.clear()
    this.visualPressers.clear()
    this.visualResetters.clear()
    this.buttons.reset()
    this.root.destroy(true)
  }

  private build(): void {
    const configs: TouchButtonConfig[] = [
      { key: 'left', x: 66, y: -4, width: 56, height: 44, label: 'L' },
      { key: 'right', x: 134, y: -4, width: 56, height: 44, label: 'R' },
      { key: 'up', x: 100, y: -46, width: 52, height: 40, label: 'U', alpha: 0.24 },
      { key: 'down', x: 100, y: 38, width: 52, height: 40, label: 'D', alpha: 0.24 },
      { key: 'jump', x: -168, y: -18, width: 64, height: 64, label: 'JUMP', radius: 18 },
      { key: 'dash', x: -102, y: 22, width: 60, height: 60, label: 'DASH', radius: 18 },
      { key: 'shoot', x: -34, y: -18, width: 70, height: 70, label: 'SHOT', radius: 20 },
      { key: 'saber', x: 42, y: 22, width: 62, height: 62, label: 'SABER', radius: 18 },
      { x: -16, y: -98, width: 44, height: 28, label: 'II', alpha: 0.34, onPress: this.options.onPause }
    ]

    configs.forEach((config) => this.root.add(this.createButton(config)))
  }

  private createButton(config: TouchButtonConfig): Phaser.GameObjects.Container {
    const alpha = config.alpha ?? 0.18
    const container = this.scene.add.container(0, 0)
    const circular = Boolean(config.radius)
    const shape = circular
      ? this.scene.add
          .ellipse(0, 0, config.width, config.height, 0x08172a, alpha)
          .setStrokeStyle(2, 0xccecff, 0.3)
          .setInteractive(
            new Phaser.Geom.Circle(0, 0, Math.min(config.width, config.height) / 2),
            Phaser.Geom.Circle.Contains
          )
      : this.scene.add
          .rectangle(0, 0, config.width, config.height, 0x08172a, alpha)
          .setStrokeStyle(2, 0xccecff, 0.3)
          .setInteractive(
            new Phaser.Geom.Rectangle(-config.width / 2, -config.height / 2, config.width, config.height),
            Phaser.Geom.Rectangle.Contains
          )

    const glow = circular
      ? this.scene.add.ellipse(0, 0, config.width - 6, config.height - 6, 0x1b88ff, 0.08).setVisible(false)
      : this.scene.add.rectangle(0, 0, config.width - 6, config.height - 6, 0x1b88ff, 0.08).setVisible(false)

    const label = this.scene.add
      .text(0, 0, config.label, {
        fontFamily: '"Trebuchet MS", monospace',
        fontSize: config.label.length > 2 ? '12px' : '14px',
        fontStyle: 'bold',
        color: '#ecf7ff',
        align: 'center'
      })
      .setOrigin(0.5)

    shape.setDataEnabled()
    shape.data?.set('restAlpha', alpha)
    shape.data?.set('pressedAlpha', Math.min(0.5, alpha + 0.18))

    const setPressedVisual = () => {
      shape.setFillStyle(0x10355a, Number(shape.data?.get('pressedAlpha') ?? 0.34))
      glow.setVisible(true)
    }

    const release = () => {
      shape.setFillStyle(0x08172a, Number(shape.data?.get('restAlpha') ?? alpha))
      glow.setVisible(false)
    }

    const press = (pointerId: number) => {
      if (config.key && this.pointerBindings.get(pointerId) === config.key) {
        setPressedVisual()
        return
      }
      if (config.key) {
        const previousKey = this.pointerBindings.get(pointerId)
        if (previousKey && previousKey !== config.key) {
          this.releasePointer(pointerId)
        }
      }
      if (config.key) {
        const ids = this.buttonPointerIds.get(config.key) ?? new Set<number>()
        ids.add(pointerId)
        this.buttonPointerIds.set(config.key, ids)
        this.pointerBindings.set(pointerId, config.key)
        this.buttons.setHeld(config.key, true)
      }
      setPressedVisual()
      config.onPress?.()
    }

    if (config.key) {
      this.visualPressers.set(config.key, setPressedVisual)
      this.visualResetters.set(config.key, release)
    } else if (config.onPress) {
      this.pauseVisualPress = setPressedVisual
      this.pauseVisualReset = release
    }

    shape.on('pointerdown', (pointer: Phaser.Input.Pointer) => press(pointer.id))
    if (config.key) {
      shape.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        if (pointer.isDown) {
          press(pointer.id)
        }
      })
      shape.on('pointerup', (pointer: Phaser.Input.Pointer) => this.releasePointer(pointer.id))
      shape.on('pointerout', (pointer: Phaser.Input.Pointer) => this.releasePointer(pointer.id))
    } else {
      shape.on('pointerup', () => release())
      shape.on('pointerout', () => release())
    }

    container.add([shape, glow, label])
    container.setDataEnabled()
    container.data?.set('layout', config)
    return container
  }

  private releasePointer(pointerId: number): void {
    const key = this.pointerBindings.get(pointerId)
    if (!key) {
      return
    }

    this.pointerBindings.delete(pointerId)
    const ids = this.buttonPointerIds.get(key)
    if (ids) {
      ids.delete(pointerId)
      this.buttons.setHeld(key, ids.size > 0)
      if (ids.size === 0) {
        this.buttonPointerIds.delete(key)
        this.visualResetters.get(key)?.()
      } else {
        this.visualPressers.get(key)?.()
      }
    } else {
      this.buttons.setHeld(key, false)
      this.visualResetters.get(key)?.()
    }
  }

  private layout(): void {
    const width = this.scene.scale.width
    const height = this.scene.scale.height
    const leftAnchor = { x: 24, y: height - 66 }
    const rightAnchor = { x: width - 92, y: height - 70 }

    this.root.iterate((child: Phaser.GameObjects.GameObject) => {
      const node = child as Phaser.GameObjects.Container
      const config = node.data?.get('layout') as TouchButtonConfig | undefined
      if (!config) {
        return
      }

      const anchor = config.key && ['left', 'right', 'up', 'down'].includes(config.key) ? leftAnchor : rightAnchor
      if (!config.key && config.label === 'II') {
        node.setPosition(width - 32, 28)
        return
      }
      node.setPosition(anchor.x + config.x, anchor.y + config.y)
    })
  }
}
