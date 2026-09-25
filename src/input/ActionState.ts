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

/**
 * Pad inputs (prompt 04 §4.3): the W3C "standard" gamepad layout with Xbox face labels, plus the
 * left stick's four directions. The pad feeds the same action map as the keyboard.
 */
export const PAD_INPUTS = [
  'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3',
  'DpadUp', 'DpadDown', 'DpadLeft', 'DpadRight', 'LStickUp', 'LStickDown', 'LStickLeft', 'LStickRight'
] as const
export type PadInput = typeof PAD_INPUTS[number]
export type PadBindings = Readonly<Record<ActionName, readonly PadInput[]>>
/** A jump, X shoot and charge, Y saber, B dash, LB and RB cycle weapons, Start pause; d-pad and left stick move and aim. */
export const DEFAULT_PAD_BINDINGS: PadBindings = Object.freeze({
  moveLeft: ['DpadLeft', 'LStickLeft'], moveRight: ['DpadRight', 'LStickRight'],
  aimUp: ['DpadUp', 'LStickUp'], aimDown: ['DpadDown', 'LStickDown'],
  jump: ['A'], dash: ['B'], shoot: ['X'], saber: ['Y'], weaponPrev: ['LB'], weaponNext: ['RB'],
  pause: ['Start'], confirm: ['A'], cancel: ['B']
})
/** Select opens Options wherever the keyboard's O does; not remappable, like the keyboard shortcuts. */
export const PAD_SHORTCUTS: Readonly<Partial<Record<keyof typeof SHORTCUT_BINDINGS, readonly PadInput[]>>> = Object.freeze({ options: ['Select'] })
export const PAD_DEADZONE = 0.25
/** Standard-mapping button index of each pad button (the stick directions come from axes 0 and 1). */
const PAD_BUTTON_INDEX: Readonly<Partial<Record<PadInput, number>>> = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, Select: 8, Start: 9, L3: 10, R3: 11,
  DpadUp: 12, DpadDown: 13, DpadLeft: 14, DpadRight: 15
}
export type PadButtonSample = boolean | number | Readonly<{ pressed?: boolean; value?: number }>
/** One pad's raw state: `navigator.getGamepads()` entries fit it, and so does automation's injected state. */
export type PadSample = Readonly<{ buttons?: readonly PadButtonSample[]; axes?: readonly number[] }>
/** Left-stick sector (0 right, then counter-clockwise in 45 degree steps) to the directions it holds. */
const STICK_SECTORS: readonly (readonly PadInput[])[] = [
  ['LStickRight'], ['LStickRight', 'LStickUp'], ['LStickUp'], ['LStickLeft', 'LStickUp'],
  ['LStickLeft'], ['LStickLeft', 'LStickDown'], ['LStickDown'], ['LStickRight', 'LStickDown']
]
function buttonHeld(sample: PadButtonSample | undefined): boolean {
  if (typeof sample === 'boolean') return sample
  if (typeof sample === 'number') return sample > 0.5
  return Boolean(sample && (sample.pressed || (sample.value ?? 0) > 0.5))
}
/**
 * The pad inputs one pad holds: buttons pressed (analogue triggers past half travel) and the left stick
 * past the radial deadzone, read in eight 45 degree sectors so a slight tilt while running does not aim.
 */
export function readPadInputs(sample: PadSample, deadzone = PAD_DEADZONE): Set<PadInput> {
  const held = new Set<PadInput>()
  for (const input of PAD_INPUTS) {
    const index = PAD_BUTTON_INDEX[input]
    if (index !== undefined && buttonHeld(sample.buttons?.[index])) held.add(input)
  }
  const x = Number(sample.axes?.[0]) || 0
  const y = Number(sample.axes?.[1]) || 0
  if (Math.hypot(x, y) > deadzone) {
    // Screen y points down; the sector count runs counter-clockwise from the right.
    const sector = Math.round(Math.atan2(-y, x) / (Math.PI / 4)) & 7
    for (const direction of STICK_SECTORS[sector]!) held.add(direction)
  }
  return held
}
/**
 * Automation's pad state (`stageDebug.injectPadState`): held pad input names and optional stick axes,
 * turned into a standard-mapped sample. Throws on an unknown name instead of holding nothing.
 */
export function padSampleFromNames(state: Readonly<{ buttons?: readonly string[]; axes?: readonly number[] }>): PadSample {
  const buttons: boolean[] = Array.from({ length: 17 }, () => false)
  const axes = [0, 0, 0, 0]
  for (const name of state.buttons ?? []) {
    if (!(PAD_INPUTS as readonly string[]).includes(name)) throw new Error(`injectPadState: unknown pad input "${name}".`)
    const index = PAD_BUTTON_INDEX[name as PadInput]
    if (index !== undefined) buttons[index] = true
    // A stick direction by name is a full tilt that way.
    if (name === 'LStickLeft') axes[0] = -1
    if (name === 'LStickRight') axes[0] = 1
    if (name === 'LStickUp') axes[1] = -1
    if (name === 'LStickDown') axes[1] = 1
  }
  ;(state.axes ?? []).slice(0, 4).forEach((value, index) => { if (Number.isFinite(value)) axes[index] = Math.max(-1, Math.min(1, value)) })
  return { buttons, axes }
}
export function resolvePadActions(inputs: ReadonlySet<PadInput>, bindings: PadBindings): HeldActions {
  const result: HeldActions = {}
  if (inputs.size === 0) return result
  for (const action of ACTION_NAMES) result[action] = bindings[action].some(input => inputs.has(input))
  for (const [action, pads] of Object.entries(PAD_SHORTCUTS)) result[action as InputAction] ||= Boolean(pads?.some(input => inputs.has(input)))
  return result
}
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
