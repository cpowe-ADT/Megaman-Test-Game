import type Phaser from 'phaser'
import AudioService from '../audio'
import { Settings } from '../systems/Settings'
import { ActionState, ACTION_NAMES, INPUT_ACTIONS, resolveKeyboardActions, type HeldActions, type InputAction, type ActionSnapshot } from './ActionState'
import type { DigitalButtonPad } from './DigitalButtonPad'

const adapters = new WeakMap<Phaser.Scene, SceneInputActions>()
const hubs = new WeakMap<Phaser.Game, KeyboardHub>()
const touchActions = { left: 'moveLeft', right: 'moveRight', up: 'aimUp', down: 'aimDown',
  jump: 'jump', dash: 'dash', shoot: 'shoot', saber: 'saber' } as const
const gameplayActions = ACTION_NAMES.filter(action => !['pause', 'confirm', 'cancel'].includes(action))

class KeyboardHub {
  readonly held = new Set<string>()
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
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    game.events.once('destroy', () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
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
  private readonly cancellationListeners = new Set<() => void>()
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
    const held = resolveKeyboardActions(this.hub.held, Settings.get().bindings)
    for (const [button, action] of Object.entries(touchActions)) held[action] ||= Boolean(touch?.[button as keyof typeof touchActions])
    for (const action of INPUT_ACTIONS) held[action] ||= this.pulses[action]
    return held
  }
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
export const InputActions = {
  init(scene: Phaser.Scene): SceneInputActions { return this.forScene(scene) },
  forScene(scene: Phaser.Scene): SceneInputActions {
    let adapter = adapters.get(scene)
    if (!adapter) {
      let hub = hubs.get(scene.game)
      if (!hub) { hub = new KeyboardHub(scene.game); hubs.set(scene.game, hub) }
      adapter = new SceneInputActions(scene, hub)
      adapters.set(scene, adapter)
    }
    return adapter
  },
  flushTransientState(scene: Phaser.Scene): void { adapters.get(scene)?.reset() }
}
export default InputActions
