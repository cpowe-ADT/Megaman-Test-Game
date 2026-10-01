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
import AudioService from '../../audio'
import type { ActionName } from '../ActionState'
import { GAME_WIDTH } from '../../config/renderPolicy'
import { Settings } from '../../systems/Settings'
import { cycleTouchControls } from '../../ui/menu/touchOptions'
import { keyEventInitFor } from './touchKeyMap'
import { cssBoxForSpec, touchButtonsFor, touchControlsVisible, touchSetForScene, type TouchSet } from './touchButtonSets'

/** Persists across sessions: the start card shows again only once the stored mode no longer matches
 * the live one (Craig's v2 note: "once per device until the setting changes"). */
const START_CARD_KEY = 'touchStartCard.v1'

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
      buttons: instance ? [...new Set([...instance.buttons.values()].map((entry) => entry.action))] : [],
      toggleMode: Settings.get().touchControls
    }
  }

  private readonly root: HTMLDivElement
  private readonly toggle: HTMLButtonElement
  private readonly hint: HTMLDivElement
  private readonly startCard: HTMLDivElement
  private readonly buttons = new Map<string, { el: HTMLDivElement; action: ActionName }>()
  private readonly pressCounts = new Map<string, number>()
  private currentSet: TouchSet | null = null
  private shown = false
  private chipUntil = 0

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

    this.startCard = document.createElement('div')
    this.startCard.className = 'touch-start-card'
    this.startCard.style.display = 'none'
    this.startCard.innerHTML = '<div class="touch-start-card-inner">TAP TO START<br>TOUCH CONTROLS ON</div>'
    this.startCard.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.dismissStartCard(true)
    })
    const dismissFromPhysicalInput = () => { if (this.startCard.style.display !== 'none') this.dismissStartCard(false) }
    window.addEventListener('keydown', dismissFromPhysicalInput)

    // "A tap anywhere" (Craig's v2 note): any pointerdown while touch is off expands the corner toggle
    // into "TOUCH: OFF -- TAP TO TURN ON" for a moment, so a phone player is never locked out without
    // a second DOM element (`chipUntil`, read back in `poll`).
    window.addEventListener('pointerdown', (event) => {
      if (event.target === this.toggle) return
      if (event.target === this.startCard || (event.target instanceof Node && this.startCard.contains(event.target))) return
      if (Settings.get().touchControls === 'off' && isTouchScreen()) this.chipUntil = Date.now() + 2500
    })

    document.body.appendChild(this.root)
    document.body.appendChild(this.toggle)
    document.body.appendChild(this.hint)
    document.body.appendChild(this.startCard)

    window.addEventListener('resize', () => this.layout())
    window.addEventListener('orientationchange', () => this.layout())
    Settings.onChange(() => this.poll())
    game.events.on('prestep', () => this.poll())
    this.poll()
  }

  private maybeShowStartCard(eligible: boolean): void {
    if (this.startCard.style.display !== 'none') return
    if (!eligible) return
    let seenForMode: string | null = null
    try { seenForMode = window.localStorage?.getItem(START_CARD_KEY) } catch { /* private mode */ }
    if (seenForMode === Settings.get().touchControls) return
    this.startCard.style.display = 'flex'
    // Phaser's own input manager hit-tests the canvas's bounding rect directly, independent of DOM
    // stacking, so a tap "through" this DOM card would otherwise still reach whatever is underneath
    // it in the scene; disabling it is what actually blocks the game while the card is up.
    this.game.input.enabled = false
  }

  /** A pad press (automation's injected pad included, via `navigator.getGamepads`) also dismisses the
   * start card, like a keyboard key (Craig's v2 note: "a keyboard or pad press dismisses it"). */
  private pollGamepadDismiss(): void {
    if (this.startCard.style.display === 'none') return
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return
    const pads = navigator.getGamepads()
    for (const pad of pads ?? []) {
      if (pad?.buttons?.some((button) => button.pressed)) {
        this.dismissStartCard(false)
        return
      }
    }
  }

  private dismissStartCard(turnOn: boolean): void {
    if (turnOn) {
      Settings.update({ touchControls: 'on' })
      AudioService.unlock()
    }
    try { window.localStorage?.setItem(START_CARD_KEY, Settings.get().touchControls) } catch { /* private mode */ }
    this.startCard.style.display = 'none'
    // Re-enabled on the next poll (not here): Phaser's own input manager hit-tests the canvas's
    // bounding rect directly off the *same physical tap*, independent of DOM event order, so
    // re-enabling synchronously within this same handler could still let that tap reach the scene.
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
    this.toggle.textContent = Date.now() < this.chipUntil ? 'TOUCH: OFF — TAP TO TURN ON' : `TOUCH: ${Settings.get().touchControls.toUpperCase()}`
    this.maybeShowStartCard(touchScreen || forced)
    if (this.startCard.style.display === 'none') this.game.input.enabled = true
    this.pollGamepadDismiss()

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
      // Smoke 67 (and any future one) finds a button by its action or its own id (two buttons, e.g.
      // SELECT and BACK, can share an action); `data-id` disambiguates, `data-action` is the common case.
      el.dataset.action = spec.action
      el.dataset.id = spec.id
      const press = (event: Event) => {
        event.preventDefault()
        this.press(spec.id, spec.action)
      }
      const release = (event: Event) => {
        event.preventDefault()
        this.release(spec.id, spec.action)
      }
      el.addEventListener('pointerdown', press)
      el.addEventListener('pointerup', release)
      el.addEventListener('pointercancel', release)
      this.root.appendChild(el)
      this.buttons.set(spec.id, { el, action: spec.action })
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
      const entry = this.buttons.get(spec.id)
      if (!entry) return
      const box = cssBoxForSpec(spec, scale)
      entry.el.style.left = `${box.left}px`
      entry.el.style.top = `${box.top}px`
      entry.el.style.width = `${box.width}px`
      entry.el.style.height = `${box.height}px`
    })
  }

  private press(id: string, action: ActionName): void {
    const count = (this.pressCounts.get(id) ?? 0) + 1
    this.pressCounts.set(id, count)
    this.buttons.get(id)?.el.classList.add('pressed')
    if (count === 1) this.dispatchKey(action, 'keydown')
  }

  private release(id: string, action: ActionName): void {
    const count = Math.max(0, (this.pressCounts.get(id) ?? 0) - 1)
    this.pressCounts.set(id, count)
    if (count > 0) return
    this.buttons.get(id)?.el.classList.remove('pressed')
    this.dispatchKey(action, 'keyup')
  }

  private releaseAllHeld(): void {
    this.buttons.forEach(({ action }, id) => {
      if ((this.pressCounts.get(id) ?? 0) > 0) this.dispatchKey(action, 'keyup')
    })
    this.pressCounts.clear()
    this.buttons.forEach(({ el }) => el.classList.remove('pressed'))
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
