/**
 * The one touch layer for the whole game (post-v1.0 touch mode task card): a DOM overlay over the
 * canvas, created once at boot (`TouchOverlay.boot`, called from `src/main.ts`), independent of
 * Phaser scenes. Each frame it reads the topmost active scene (the same convention
 * `KeyboardHub.eventOwner` uses) and, for `Game`, that scene's own `isPlayInputActive()` to pick the
 * play or the menu button set (`touchButtonSets.ts`). Every button press/release dispatches a real
 * `KeyboardEvent` on `window` for the action's current binding (`touchKeyMap.ts`), the same event a
 * physical key fires, so every scene already reads it through `InputActions`/`KeyboardHub` with no
 * other scene wiring. Replaces part 12i's Phaser-drawn `src/ui/GameplayTouchControls.ts`.
 */
import type Phaser from 'phaser'
import { ACTION_NAMES, type ActionName } from '../ActionState'
import { GAME_WIDTH } from '../../config/renderPolicy'
import { Settings } from '../../systems/Settings'
import { cycleTouchControls } from '../../ui/menu/touchOptions'
import { keyEventInitFor } from './touchKeyMap'
import { cssBoxForSpec, touchButtonsFor, touchControlsVisible, touchSetForScene, type TouchSet } from './touchButtonSets'

type SceneWithPlayQuery = Phaser.Scene & { isPlayInputActive?: () => boolean }

function isTouchScreen(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true
  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
}

/** `?touchControls=1` (automation only) forces the overlay on for a smoke without a real touch screen. */
function automationForced(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('touchControls') === '1'
}

export class TouchOverlay {
  private static instance: TouchOverlay | null = null

  static boot(game: Phaser.Game): TouchOverlay {
    if (!this.instance) this.instance = new TouchOverlay(game)
    return this.instance
  }

  /** Smoke/debug only: the overlay's own idea of whether it is currently shown. */
  static isShown(): boolean {
    return this.instance?.shown ?? false
  }

  /** `render_game_to_text`'s `touch` field (automation only): shown, the active set and its buttons,
   * and the toggle's current mode, so a smoke can assert the overlay without scraping the DOM. */
  static describe(): { shown: boolean; set: TouchSet | null; buttons: ActionName[]; toggleMode: string } {
    const instance = this.instance
    return {
      shown: instance?.shown ?? false,
      set: instance?.currentSet ?? null,
      buttons: instance ? [...instance.buttons.keys()] : [],
      toggleMode: Settings.get().touchControls
    }
  }

  private readonly root: HTMLDivElement
  private readonly toggle: HTMLButtonElement
  private readonly hint: HTMLDivElement
  private readonly buttons = new Map<ActionName, HTMLDivElement>()
  private readonly pressCounts = new Map<ActionName, number>()
  private currentSet: TouchSet | null = null
  private shown = false

  private constructor(private readonly game: Phaser.Game) {
    this.root = document.createElement('div')
    this.root.className = 'touch-overlay-root'
    this.root.style.display = 'none'

    this.toggle = document.createElement('button')
    this.toggle.type = 'button'
    this.toggle.className = 'touch-toggle'
    this.toggle.style.display = 'none'
    this.toggle.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      Settings.update({ touchControls: cycleTouchControls(Settings.get().touchControls, 1) })
    })

    this.hint = document.createElement('div')
    this.hint.className = 'touch-orientation-hint'
    this.hint.textContent = 'TURN YOUR PHONE SIDEWAYS'
    this.hint.style.display = 'none'

    document.body.appendChild(this.root)
    document.body.appendChild(this.toggle)
    document.body.appendChild(this.hint)

    window.addEventListener('resize', () => this.layout())
    window.addEventListener('orientationchange', () => this.layout())
    Settings.onChange(() => this.poll())
    game.events.on('prestep', () => this.poll())
    this.poll()
  }

  private activeScene(): SceneWithPlayQuery | undefined {
    const active = this.game.scene.getScenes(true) as SceneWithPlayQuery[]
    return active[active.length - 1]
  }

  private poll(): void {
    const scene = this.activeScene()
    const sceneKey = scene?.scene.key ?? 'None'
    const playInputActive = typeof scene?.isPlayInputActive === 'function' ? Boolean(scene.isPlayInputActive()) : true
    const nextSet = touchSetForScene({ sceneKey, playInputActive })
    const touchScreen = isTouchScreen()
    const forced = automationForced()

    this.toggle.style.display = touchScreen || forced ? 'flex' : 'none'
    this.toggle.textContent = `TOUCH: ${Settings.get().touchControls.toUpperCase()}`

    const visible = nextSet !== null && touchControlsVisible({ mode: Settings.get().touchControls, touchScreen, forced })
    this.shown = visible
    if (!visible) {
      this.releaseAllHeld()
      this.root.style.display = 'none'
      this.hint.style.display = 'none'
      return
    }

    if (nextSet !== this.currentSet) {
      this.currentSet = nextSet
      this.rebuild(nextSet!)
    }
    this.root.style.display = 'block'
    this.hint.style.display = touchScreen && window.innerHeight > window.innerWidth ? 'flex' : 'none'
    this.layout()
  }

  private rebuild(set: TouchSet): void {
    this.releaseAllHeld()
    this.root.innerHTML = ''
    this.buttons.clear()
    touchButtonsFor(set).forEach((spec) => {
      const el = document.createElement('div')
      el.className = `touch-btn${spec.round ? ' round' : ''}`
      el.textContent = spec.label
      el.style.opacity = String(spec.alpha + 0.6)
      // Smoke 67 (and any future one) finds a button by its action name, the same way part 12i's
      // layer exposed `getData('layout').key`.
      el.dataset.action = spec.action
      const press = (event: Event) => {
        event.preventDefault()
        this.press(spec.action)
      }
      const release = (event: Event) => {
        event.preventDefault()
        this.release(spec.action)
      }
      el.addEventListener('pointerdown', press)
      el.addEventListener('pointerup', release)
      el.addEventListener('pointercancel', release)
      this.root.appendChild(el)
      this.buttons.set(spec.action, el)
    })
  }

  private layout(): void {
    if (this.root.style.display === 'none') return
    const rect = this.game.canvas?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    this.root.style.left = `${rect.left}px`
    this.root.style.top = `${rect.top}px`
    this.root.style.width = `${rect.width}px`
    this.root.style.height = `${rect.height}px`
    const scale = rect.width / GAME_WIDTH
    const set = this.currentSet
    if (!set) return
    touchButtonsFor(set).forEach((spec) => {
      const el = this.buttons.get(spec.action)
      if (!el) return
      const box = cssBoxForSpec(spec, scale)
      el.style.left = `${box.left}px`
      el.style.top = `${box.top}px`
      el.style.width = `${box.width}px`
      el.style.height = `${box.height}px`
    })
  }

  private press(action: ActionName): void {
    const count = (this.pressCounts.get(action) ?? 0) + 1
    this.pressCounts.set(action, count)
    this.buttons.get(action)?.classList.add('pressed')
    if (count === 1) this.dispatchKey(action, 'keydown')
  }

  private release(action: ActionName): void {
    const count = Math.max(0, (this.pressCounts.get(action) ?? 0) - 1)
    this.pressCounts.set(action, count)
    if (count > 0) return
    this.buttons.get(action)?.classList.remove('pressed')
    this.dispatchKey(action, 'keyup')
  }

  private releaseAllHeld(): void {
    ACTION_NAMES.forEach((action) => {
      if ((this.pressCounts.get(action) ?? 0) > 0) this.dispatchKey(action, 'keyup')
    })
    this.pressCounts.clear()
    this.buttons.forEach((el) => el.classList.remove('pressed'))
  }

  private dispatchKey(action: ActionName, type: 'keydown' | 'keyup'): void {
    window.dispatchEvent(new KeyboardEvent(type, keyEventInitFor(action, Settings.get().bindings)))
  }
}

/** The `src/main.ts` boot call; a no-op outside a browser (tests, SSR). */
export function installTouchOverlay(game: Phaser.Game): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  TouchOverlay.boot(game)
}
