export const ACTION_NAMES = [
  'moveLeft', 'moveRight', 'aimUp', 'aimDown', 'jump', 'dash', 'shoot', 'saber',
  'weaponPrev', 'weaponNext', 'pause', 'confirm', 'cancel'
] as const
export type ActionName = typeof ACTION_NAMES[number]
export type InputBindings = Readonly<Record<ActionName, readonly string[]>>
export const DEFAULT_BINDINGS: InputBindings = Object.freeze({
  moveLeft: ['ArrowLeft'], moveRight: ['ArrowRight'], aimUp: ['ArrowUp'], aimDown: ['ArrowDown'],
  jump: ['Space'], dash: ['KeyZ'], shoot: ['KeyX'], saber: ['KeyC'], weaponPrev: ['KeyQ'],
  weaponNext: ['KeyD', 'KeyE'], pause: ['Escape'], confirm: ['Enter', 'NumpadEnter', 'Space'], cancel: ['Escape']
})
export const SHORTCUT_BINDINGS = {
  pagePrev: ['KeyQ'], pageNext: ['KeyE'], checkpointNext: ['KeyL'], checkpointPrev: ['KeyR'],
  tutorial: ['KeyT'], finalRoute: ['KeyF'], newCampaign: ['KeyN'], controls: ['KeyC'], options: ['KeyO'],
  copyProgression: ['KeyC'], downloadProgression: ['KeyD'], pasteProgression: ['KeyV'], uploadProgression: ['KeyU'],
  debugOverlay: ['Backquote'], debugDump: ['KeyD'], debugPhysics: ['Backslash'], debugPlayer: ['F2'],
  modifier: ['ShiftLeft', 'ShiftRight']
} as const
export type InputAction = ActionName | keyof typeof SHORTCUT_BINDINGS
export const INPUT_ACTIONS = [...ACTION_NAMES, ...Object.keys(SHORTCUT_BINDINGS)] as InputAction[]
export type HeldActions = Partial<Record<InputAction, boolean>>
export type ActionButton = Readonly<{ held: boolean; pressed: boolean; released: boolean }>
export type ActionSnapshot = Readonly<Record<InputAction, ActionButton>>
export function resolveKeyboardActions(codes: ReadonlySet<string>, bindings: InputBindings): HeldActions {
  const result: HeldActions = {}
  const all = { ...bindings, ...SHORTCUT_BINDINGS }
  for (const action of INPUT_ACTIONS) result[action] = all[action].some(code => codes.has(code))
  return result
}
export class ActionState {
  private previous: HeldActions = {}
  private lastFrame = -1
  private readonly presses = new Set<InputAction>()
  private readonly releases = new Set<InputAction>()
  private wasEnabled = true
  private snapshot = {} as ActionSnapshot
  reset(held: HeldActions = {}): void {
    this.previous = { ...held }
    this.presses.clear()
    this.releases.clear()
    this.lastFrame = -1
  }
  latch(before: HeldActions, after: HeldActions): void {
    for (const action of INPUT_ACTIONS) {
      if (after[action] && !before[action]) this.presses.add(action)
      if (!after[action] && before[action]) this.releases.add(action)
    }
  }
  sample(frame: number, sources: readonly HeldActions[], enabled = true, deferred: readonly InputAction[] = []): ActionSnapshot {
    if (frame === this.lastFrame) return this.snapshot
    const next = {} as Record<InputAction, ActionButton>
    for (const action of INPUT_ACTIONS) {
      const held = sources.some(source => Boolean(source[action]))
      const previous = Boolean(this.previous[action])
      const defer = enabled && deferred.includes(action)
      if (defer && this.wasEnabled) {
        if (held && !previous) this.presses.add(action)
        if (!held && previous) this.releases.add(action)
      }
      next[action] = Object.freeze({ held: enabled && held,
        pressed: enabled && !defer && (this.presses.has(action) || (this.wasEnabled && held && !previous)),
        released: enabled && !defer && (this.releases.has(action) || (this.wasEnabled && !held && previous)) })
      this.previous[action] = held
      if (!defer) { this.presses.delete(action); this.releases.delete(action) }
    }
    this.wasEnabled = enabled
    this.lastFrame = frame
    this.snapshot = Object.freeze(next)
    return this.snapshot
  }
}
