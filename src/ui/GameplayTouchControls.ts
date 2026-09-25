import Phaser from 'phaser'
import InputActions from '../input/InputActions'
import { AUTOMATION } from '../config/automation'
import { DigitalButtonPad, type DigitalButtonName } from '../input/DigitalButtonPad'
import { Settings } from '../systems/Settings'
import {
  isTouchSystemAction,
  touchControlsLayout,
  touchControlsVisible,
  type TouchButtonId,
  type TouchButtonSpec,
  type TouchSystemAction
} from './touchControlsModel'

type GameplayTouchControlsOptions = {
  onPause: () => void
}

function isTouchScreen(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true
  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
}

function automationForcesTouch(): boolean {
  return typeof window !== 'undefined' && AUTOMATION.enabled && new URLSearchParams(window.location.search).get('touchControls') === '1'
}

/**
 * The on-screen pad, face buttons and system row (weapon previous, weapon next, pause). The layer exists in every
 * browser session but builds its buttons only when first shown; `settings.touchControls` (Options: AUTO, ON, OFF)
 * decides whether it shows, and a change applies at once, even while the pause menu is open.
 */
export class GameplayTouchControls {
  private readonly root: Phaser.GameObjects.Container
  private readonly cleanupHandlers: Array<() => void> = []
  private readonly pointerBindings = new Map<number, DigitalButtonName>()
  private readonly buttonPointerIds = new Map<DigitalButtonName, Set<number>>()
  private readonly visualPressers = new Map<TouchButtonId, () => void>()
  private readonly visualResetters = new Map<TouchButtonId, () => void>()
  private requested = false
  private shown = false
  private built = false

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly buttons: DigitalButtonPad,
    private readonly options: GameplayTouchControlsOptions
  ) {
    this.root = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1800)
    this.root.setVisible(false)

    this.cleanupHandlers.push(InputActions.forScene(scene).onCancelled(() => this.resetInput()))
    this.cleanupHandlers.push(Settings.onChange(() => this.applyVisibility()))

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

  /** Every browser session gets the (lazy) layer, so switching Options to ON mid-stage can show it. */
  static shouldEnable(): boolean {
    return typeof window !== 'undefined'
  }

  /** Whether the current setting, device and automation flag let the layer show. */
  static isAllowed(): boolean {
    return touchControlsVisible({ mode: Settings.get().touchControls, touchScreen: isTouchScreen(), forced: automationForcesTouch() })
  }

  /** The scene's request; the layer shows only when `isAllowed()` agrees. */
  setVisible(visible: boolean): void {
    this.requested = visible
    this.applyVisibility()
  }

  isVisible(): boolean {
    return this.shown
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
    this.pulseSystem('pause')
  }

  /** Automation: button centres and sizes in game pixels, so a smoke can tap them. */
  layoutSnapshot(): Array<{ id: TouchButtonId; x: number; y: number; width: number; height: number }> {
    return touchControlsLayout().map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))
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

  private applyVisibility(): void {
    const shown = this.requested && GameplayTouchControls.isAllowed()
    if (shown && !this.built) {
      this.built = true
      touchControlsLayout().forEach((spec) => this.root.add(this.createButton(spec)))
    }
    this.shown = shown
    this.root.setVisible(shown)
    if (!shown) {
      this.resetInput()
    }
  }

  private pulseSystem(id: TouchSystemAction): void {
    this.visualPressers.get(id)?.()
    if (id === 'pause') {
      this.options.onPause()
    } else {
      InputActions.forScene(this.scene).pulse(id)
    }
    this.scene.time.delayedCall(120, () => this.visualResetters.get(id)?.())
  }

  private resetInput(): void {
    this.pointerBindings.clear()
    this.buttonPointerIds.clear()
    this.buttons.reset()
    this.visualResetters.forEach(reset => reset())
  }

  private createButton(spec: TouchButtonSpec): Phaser.GameObjects.Container {
    const alpha = spec.alpha
    const container = this.scene.add.container(spec.x, spec.y)
    // Hit areas are in the shape's local space, measured from its top-left corner (Phaser adds the display origin
    // before testing): the old centre-based areas covered only the button's upper-left quarter.
    const shape = spec.round
      ? this.scene.add
          .ellipse(0, 0, spec.width, spec.height, 0x08172a, alpha)
          .setStrokeStyle(2, 0xccecff, 0.3)
          .setInteractive(
            new Phaser.Geom.Circle(spec.width / 2, spec.height / 2, Math.min(spec.width, spec.height) / 2),
            Phaser.Geom.Circle.Contains
          )
      : this.scene.add
          .rectangle(0, 0, spec.width, spec.height, 0x08172a, alpha)
          .setStrokeStyle(2, 0xccecff, 0.3)
          .setInteractive(
            new Phaser.Geom.Rectangle(0, 0, spec.width, spec.height),
            Phaser.Geom.Rectangle.Contains
          )

    const glow = spec.round
      ? this.scene.add.ellipse(0, 0, spec.width - 6, spec.height - 6, 0x1b88ff, 0.08).setVisible(false)
      : this.scene.add.rectangle(0, 0, spec.width - 6, spec.height - 6, 0x1b88ff, 0.08).setVisible(false)

    const label = this.scene.add
      .text(0, 0, spec.label, {
        fontFamily: '"Trebuchet MS", monospace',
        fontSize: spec.fontScale === 2 ? '14px' : '9px',
        fontStyle: 'bold',
        color: '#ecf7ff',
        align: 'center'
      })
      .setOrigin(0.5)

    const pressedAlpha = Math.min(0.5, alpha + 0.18)
    const setPressedVisual = () => {
      shape.setFillStyle(0x10355a, pressedAlpha)
      glow.setVisible(true)
    }
    const release = () => {
      shape.setFillStyle(0x08172a, alpha)
      glow.setVisible(false)
    }
    this.visualPressers.set(spec.id, setPressedVisual)
    this.visualResetters.set(spec.id, release)

    const id = spec.id
    if (isTouchSystemAction(id)) {
      shape.on('pointerdown', () => this.pulseSystem(id))
      shape.on('pointerup', release)
      shape.on('pointerout', release)
    } else {
      const press = (pointerId: number) => {
        if (this.pointerBindings.get(pointerId) === id) {
          setPressedVisual()
          return
        }
        const previousKey = this.pointerBindings.get(pointerId)
        if (previousKey && previousKey !== id) {
          this.releasePointer(pointerId)
        }
        const ids = this.buttonPointerIds.get(id) ?? new Set<number>()
        ids.add(pointerId)
        this.buttonPointerIds.set(id, ids)
        this.pointerBindings.set(pointerId, id)
        this.buttons.setHeld(id, true)
        setPressedVisual()
      }
      shape.on('pointerdown', (pointer: Phaser.Input.Pointer) => press(pointer.id))
      shape.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        if (pointer.isDown) {
          press(pointer.id)
        }
      })
      shape.on('pointerup', (pointer: Phaser.Input.Pointer) => this.releasePointer(pointer.id))
      shape.on('pointerout', (pointer: Phaser.Input.Pointer) => this.releasePointer(pointer.id))
    }

    container.add([shape, glow, label])
    // Phaser's hit test applies each object's own scroll factor, not its container's: without this, every tap
    // missed by the camera's scrollX once the stage scrolled (smoke 4c taps pause after the hero has moved).
    ;[shape, glow, label].forEach((part) => part.setScrollFactor(0))
    container.setScrollFactor(0)
    // Smoke 13f finds a button by `getData('layout').key`, as it did before part 12i.
    container.setDataEnabled()
    container.data?.set('layout', { ...spec, key: spec.id })
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
}
