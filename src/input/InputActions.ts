import type Phaser from 'phaser'
import AudioService from '../audio'
import { Settings } from '../systems/Settings'
import { ActionState, ACTION_NAMES, INPUT_ACTIONS, readPadInputs, resolveKeyboardActions, resolvePadActions, type HeldActions, type InputAction, type ActionSnapshot, type PadInput, type PadSample } from './ActionState'
import type { DigitalButtonPad } from './DigitalButtonPad'
import { bindVisibilityPause, type VisibilityPauseHooks } from './visibilityPause'

const adapters = new WeakMap<Phaser.Scene, SceneInputActions>()
const hubs = new WeakMap<Phaser.Game, KeyboardHub>()
const touchActions = { left: 'moveLeft', right: 'moveRight', up: 'aimUp', down: 'aimDown',
  jump: 'jump', dash: 'dash', shoot: 'shoot', saber: 'saber' } as const
const gameplayActions = ACTION_NAMES.filter(action => !['pause', 'confirm', 'cancel'].includes(action))

/** Every connected pad's held inputs, merged. `getGamepads` can throw where a permissions policy blocks pads. */
function readConnectedPads(): Set<PadInput> {
  const held = new Set<PadInput>()
  try {
    const pads = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
    for (const pad of pads ?? []) {
      if (pad?.connected) readPadInputs(pad).forEach(input => held.add(input))
    }
  } catch { /* No pads. */ }
  return held
}
function sameInputs(a: ReadonlySet<PadInput>, b: ReadonlySet<PadInput>): boolean {
  return a.size === b.size && [...a].every(input => b.has(input))
}

/** The game's physical sources: keyboard codes from window events, and pad inputs polled once per game step. */
class KeyboardHub {
  readonly held = new Set<string>()
  /** Inputs the pads hold (or automation's injected pad while one is set), latched like key changes. */
  padHeld: ReadonlySet<PadInput> = new Set()
  private injectedPad: PadSample | null = null
  private readonly padPressListeners = new Set<(input: PadInput) => void>()
  private ownerFrame = -1
  private owner?: Phaser.Scene
  constructor(private readonly game: Phaser.Game) {
    const down = (event: KeyboardEvent) => {
      // Block page scrolling on every keydown, including OS key repeats, before deciding whether it is a new press.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
      AudioService.unlock()
      if (event.repeat) return
      this.changePhysicalSource(() => this.held.add(event.code))
    }
    const up = (event: KeyboardEvent) => this.changePhysicalSource(() => this.held.delete(event.code))
    const blur = () => {
      this.held.clear()
      for (const scene of game.scene.getScenes(false)) adapters.get(scene)?.cancelPendingInput()
    }
    const poll = () => this.pollPads()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    game.events.on('prestep', poll)
    game.events.once('destroy', () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      game.events.off('prestep', poll)
    })
  }
  eventOwner(): Phaser.Scene | undefined {
    const active = this.game.scene.getScenes(true).filter(candidate => adapters.has(candidate))
    return active[active.length - 1]
  }
  private changePhysicalSource(change: () => void): void {
    const owner = this.eventOwner()
    const adapter = owner && adapters.get(owner)
    if (adapter) adapter.captureSourceChange(change)
    else change()
  }
  /** Reads the pads (or the injected pad) and latches a change for the scene that owns input. */
  pollPads(): void {
    const next = this.injectedPad ? readPadInputs(this.injectedPad) : readConnectedPads()
    if (sameInputs(next, this.padHeld)) return
    const pressed = [...next].filter(input => !this.padHeld.has(input))
    this.changePhysicalSource(() => { this.padHeld = next })
    for (const input of pressed) this.padPressListeners.forEach(listener => listener(input))
  }
  /** Automation-only (`stageDebug.injectPadState`): replaces the physical pads until cleared with null. */
  injectPad(sample: PadSample | null): void {
    this.injectedPad = sample
    this.pollPads()
  }
  onPadPressed(listener: (input: PadInput) => void): () => void {
    this.padPressListeners.add(listener)
    return () => { this.padPressListeners.delete(listener) }
  }
  owns(scene: Phaser.Scene): boolean {
    const frame = this.game.loop.frame
    if (frame !== this.ownerFrame) {
      // Modals may leave underlays active; one owner is fixed for the entire frame.
      const active = this.game.scene.getScenes(true).filter(candidate => adapters.has(candidate))
      this.owner = active[active.length - 1]
      this.ownerFrame = frame
    }
    return this.owner === scene
  }
}
export class SceneInputActions {
  private readonly state = new ActionState()
  private readonly listeners = new Map<InputAction, Set<() => void>>()
  private readonly pulses: HeldActions = {}
  /** Automation-only source (`stageDebug.replayInputs`/`recordInputs`): a held-action set the hub
   * treats like a physical device, latched through `captureSourceChange` so presses/releases fire
   * exactly like key events. */
  private automationHeld: HeldActions = {}
  private readonly cancellationListeners = new Set<() => void>()
  private readonly padPressOffs = new Set<() => void>()
  private buttons?: DigitalButtonPad
  private removeTouchListener?: () => void
  private deferGameplay = () => false
  private dispatchedFrame = -1
  constructor(private readonly scene: Phaser.Scene, private readonly hub: KeyboardHub) {
    this.state.reset(this.rawHeld())
    scene.events.on('preupdate', this.dispatch, this)
    scene.events.on('resume', this.reset, this)
    scene.events.on('wake', this.reset, this)
    scene.events.once('shutdown', () => {
      scene.events.off('preupdate', this.dispatch, this)
      scene.events.off('resume', this.reset, this)
      scene.events.off('wake', this.reset, this)
      this.removeTouchListener?.()
      this.padPressOffs.forEach(off => off())
      this.padPressOffs.clear()
      this.listeners.clear()
      this.cancellationListeners.clear()
      adapters.delete(scene)
    })
  }
  setTouchSource(buttons: DigitalButtonPad): void {
    this.removeTouchListener?.()
    this.buttons = buttons
    this.removeTouchListener = buttons.onChange((before, after) => {
      if (this.hub.eventOwner() === this.scene) this.state.latch(this.rawHeld(before), this.rawHeld(after))
    })
  }
  captureSourceChange(change: () => void): void {
    const before = this.rawHeld()
    change()
    this.state.latch(before, this.rawHeld())
  }
  private rawHeld(touch = this.buttons?.getHeldSnapshot()): HeldActions {
    const settings = Settings.get()
    const held = resolveKeyboardActions(this.hub.held, settings.bindings)
    const pad = resolvePadActions(this.hub.padHeld, settings.padBindings)
    for (const [button, action] of Object.entries(touchActions)) held[action] ||= Boolean(touch?.[button as keyof typeof touchActions])
    for (const action of INPUT_ACTIONS) held[action] ||= pad[action] || this.pulses[action] || this.automationHeld[action]
    return held
  }
  /** Replaces the automation-held set, latching presses/releases the same way a keyboard change does. */
  setAutomationHeld(held: HeldActions): void {
    this.captureSourceChange(() => { this.automationHeld = { ...held } })
  }
  /** The held-action set as the hub currently sees it, for automation recording. */
  heldSnapshot(): HeldActions { return this.rawHeld() }
  snapshot(): ActionSnapshot {
    return this.state.sample(this.scene.game.loop.frame, [this.rawHeld()], this.hub.owns(this.scene), this.deferGameplay() ? gameplayActions : [])
  }
  deferGameplayWhile(predicate: () => boolean): void { this.deferGameplay = predicate }
  isHeld(action: InputAction): boolean { return Boolean(this.rawHeld()[action]) }
  confirmReleased(): boolean { return !this.rawHeld().confirm }
  reset(): void { this.state.reset(this.rawHeld()) }
  onCancelled(handler: () => void): () => void {
    this.cancellationListeners.add(handler)
    return () => { this.cancellationListeners.delete(handler) }
  }
  cancelPendingInput(): void {
    for (const action of INPUT_ACTIONS) delete this.pulses[action]
    this.automationHeld = {}
    this.buttons?.reset()
    this.cancellationListeners.forEach(handler => handler())
    this.state.reset(this.rawHeld())
  }
  pulse(action: InputAction): void { this.captureSourceChange(() => { this.pulses[action] = true }) }
  onPressed(action: InputAction, handler: () => void): () => void {
    const listeners = this.listeners.get(action) ?? new Set()
    listeners.add(handler)
    this.listeners.set(action, listeners)
    return () => listeners.delete(handler)
  }
  /** A newly pressed pad input while this scene owns input (the remap screen's press-to-bind); removed at shutdown. */
  onPadPressed(handler: (input: PadInput) => void): () => void {
    const off = this.hub.onPadPressed(input => { if (this.hub.eventOwner() === this.scene) handler(input) })
    this.padPressOffs.add(off)
    return () => { off(); this.padPressOffs.delete(off) }
  }
  private dispatch(): void {
    const frame = this.scene.game.loop.frame
    if (this.dispatchedFrame === frame) return
    this.dispatchedFrame = frame
    const snapshot = this.snapshot()
    const callbacks = INPUT_ACTIONS.flatMap(action => snapshot[action].pressed ? [...(this.listeners.get(action) ?? [])] : [])
    for (const action of INPUT_ACTIONS) delete this.pulses[action]
    for (const callback of callbacks) callback()
  }
}
function hubFor(game: Phaser.Game): KeyboardHub {
  let hub = hubs.get(game)
  if (!hub) { hub = new KeyboardHub(game); hubs.set(game, hub) }
  return hub
}
export const InputActions = {
  init(scene: Phaser.Scene): SceneInputActions { return this.forScene(scene) },
  forScene(scene: Phaser.Scene): SceneInputActions {
    let adapter = adapters.get(scene)
    if (!adapter) {
      adapter = new SceneInputActions(scene, hubFor(scene.game))
      adapters.set(scene, adapter)
    }
    return adapter
  },
  flushTransientState(scene: Phaser.Scene): void { adapters.get(scene)?.reset() },
  /**
   * The pause binding (prompt 04 §4.3): the pause action (Esc, Start) runs `hooks.pause`, and so does the
   * page going hidden, unless the pause menu is already open or `hooks.blocked` says the key would do
   * something else. Both are removed at shutdown.
   */
  bindPause(scene: Phaser.Scene, hooks: VisibilityPauseHooks): () => void {
    const actions = this.forScene(scene)
    const offPress = actions.onPressed('pause', hooks.pause)
    const offHidden = bindVisibilityPause(scene, hooks, () => actions.cancelPendingInput())
    return () => { offPress(); offHidden() }
  },
  /** Automation-only: feeds a pad state through the same poll-and-latch path as a physical pad; null restores the real pads. */
  injectPadState(game: Phaser.Game, sample: PadSample | null): ReadonlySet<PadInput> {
    const hub = hubFor(game)
    hub.injectPad(sample)
    return hub.padHeld
  },
  /** The pad inputs currently held (debug and the remap screen). */
  padHeld(game: Phaser.Game): ReadonlySet<PadInput> { return hubFor(game).padHeld }
}
export default InputActions
