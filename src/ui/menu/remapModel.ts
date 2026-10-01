/**
 * The remap screen's rules (prompt 04 §4.3, `ControlsScene`): which actions it lists, press-to-bind,
 * conflict detection and the labels for key codes and pad inputs. No Phaser here.
 */
import type { ActionName, PadInput } from '../../input/ActionState'

export type RemapDevice = 'keyboard' | 'pad'
export type BindingTable<T extends string = string> = Readonly<Record<ActionName, readonly T[]>>
export type RemapRow = Readonly<{ action: ActionName; label: string }>

export const REMAP_ROWS: readonly RemapRow[] = Object.freeze([
  { action: 'moveLeft', label: 'Move left' },
  { action: 'moveRight', label: 'Move right' },
  { action: 'aimUp', label: 'Aim up' },
  { action: 'aimDown', label: 'Aim down / crouch' },
  { action: 'jump', label: 'Jump' },
  { action: 'dash', label: 'Dash' },
  { action: 'shoot', label: 'Shoot / charge' },
  { action: 'saber', label: 'Saber' },
  { action: 'weaponPrev', label: 'Weapon back' },
  { action: 'weaponNext', label: 'Weapon forward' },
  { action: 'pause', label: 'Pause' },
  { action: 'confirm', label: 'Menu confirm' },
  { action: 'cancel', label: 'Menu back' }
])

/**
 * Actions that are live at the same time. Two of them on one input is a conflict; sharing across
 * contexts is by design (Space jumps in play and confirms in menus, Esc pauses and backs out).
 */
export const REMAP_CONTEXTS: readonly (readonly ActionName[])[] = Object.freeze([
  ['moveLeft', 'moveRight', 'aimUp', 'aimDown', 'jump', 'dash', 'shoot', 'saber', 'weaponPrev', 'weaponNext', 'pause'],
  ['moveLeft', 'moveRight', 'aimUp', 'aimDown', 'confirm', 'cancel']
])

/** The actions sharing a context with `action` that already hold `input`. */
export function conflictsFor(bindings: BindingTable, action: ActionName, input: string): ActionName[] {
  const others = new Set<ActionName>()
  for (const context of REMAP_CONTEXTS) {
    if (!context.includes(action)) continue
    for (const other of context) if (other !== action && bindings[other].includes(input)) others.add(other)
  }
  return [...others]
}

export type BindingConflict = Readonly<{ input: string; actions: readonly ActionName[] }>
/** Every input two live actions share, one entry per input and context. */
export function listConflicts(bindings: BindingTable): BindingConflict[] {
  const conflicts: BindingConflict[] = []
  for (const context of REMAP_CONTEXTS) {
    const owners = new Map<string, ActionName[]>()
    for (const action of context) for (const input of bindings[action]) owners.set(input, [...(owners.get(input) ?? []), action])
    for (const [input, actions] of owners) if (actions.length > 1) conflicts.push({ input, actions })
  }
  return conflicts
}

export type RebindResult<T extends string> = Readonly<{
  bindings: Record<ActionName, readonly T[]>
  /** Actions that lost the pressed input, and the input each took instead (null when it kept others). */
  moved: ReadonlyArray<{ action: ActionName; input: T | null }>
}>
/**
 * Press-to-bind: the action takes exactly the pressed input. A live action that held it loses it, and
 * when that leaves it with nothing it takes the rebound action's old first input (a swap), so no
 * action is ever left unbound. `listConflicts` reports anything a swap cannot settle.
 */
export function rebind<T extends string>(bindings: BindingTable<T>, action: ActionName, input: T): RebindResult<T> {
  const next = { ...bindings } as Record<ActionName, readonly T[]>
  const previous = bindings[action][0] ?? null
  next[action] = [input]
  const moved: Array<{ action: ActionName; input: T | null }> = []
  for (const other of conflictsFor(bindings, action, input)) {
    const remaining = bindings[other].filter(existing => existing !== input)
    if (remaining.length > 0) {
      next[other] = remaining
      moved.push({ action: other, input: null })
    } else if (previous !== null && previous !== input) {
      next[other] = [previous]
      moved.push({ action: other, input: previous })
    }
  }
  return { bindings: next, moved }
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER', NumpadEnter: 'NUM ENTER', Tab: 'TAB',
  ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
  ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT', ControlLeft: 'L CTRL', ControlRight: 'R CTRL', AltLeft: 'L ALT', AltRight: 'R ALT',
  Backquote: '`', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '='
}
export function keyLabel(code: string): string {
  return KEY_LABELS[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '').toUpperCase()
}
const PAD_LABELS: Readonly<Partial<Record<PadInput, string>>> = {
  Select: 'SELECT', Start: 'START', DpadUp: 'D-UP', DpadDown: 'D-DOWN', DpadLeft: 'D-LEFT', DpadRight: 'D-RIGHT',
  LStickUp: 'LS UP', LStickDown: 'LS DOWN', LStickLeft: 'LS LEFT', LStickRight: 'LS RIGHT'
}
export function padLabel(input: PadInput): string {
  return PAD_LABELS[input] ?? input
}
export function inputLabel(device: RemapDevice, input: string): string {
  return device === 'keyboard' ? keyLabel(input) : padLabel(input as PadInput)
}
export function bindingText(device: RemapDevice, inputs: readonly string[]): string {
  return inputs.map(input => inputLabel(device, input)).join(' / ')
}
const ACTION_LABELS = new Map(REMAP_ROWS.map(row => [row.action, row.label.toUpperCase()]))
export function actionLabel(action: ActionName): string {
  return ACTION_LABELS.get(action) ?? action.toUpperCase()
}
/** The line under the table after a bind: what moved, or the conflict that is left. */
export function rebindMessage<T extends string>(device: RemapDevice, action: ActionName, input: T, result: RebindResult<T>): string {
  const label = inputLabel(device, input)
  const conflict = listConflicts(result.bindings).find(entry => entry.actions.includes(action))
  if (conflict) return `CONFLICT: ${inputLabel(device, conflict.input)} IS ${conflict.actions.map(actionLabel).join(' AND ')}`
  const swapped = result.moved.find(entry => entry.input !== null)
  if (swapped?.input) return `${actionLabel(action)}: ${label}   ${actionLabel(swapped.action)} TAKES ${inputLabel(device, swapped.input)}`
  return `${actionLabel(action)}: ${label}`
}
