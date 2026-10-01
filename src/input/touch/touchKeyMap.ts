/**
 * Touch button -> key, pure (post-v1.0 touch mode task card). Every touch button is named for the
 * `ActionName` it presses, so a remapped player's own bindings decide the key: `keyEventInitFor`
 * reads the action's first bound `KeyboardEvent.code` from `InputBindings` and derives `key` and
 * `keyCode` for it, the same triple a real keyboard key fires. `TouchOverlay` dispatches the result
 * as a real `KeyboardEvent` on `window`, which is all `KeyboardHub` (`src/input/InputActions.ts`)
 * ever reads, so one dispatch reaches every scene uniformly.
 */
import { DEFAULT_BINDINGS, type ActionName, type InputBindings } from '../ActionState'

/** `KeyboardEvent.key` and `.keyCode` for a `.code`, covering every code the remap screen accepts
 * (`isBindableKey` in `src/systems/Settings.ts`) so a remapped binding still gets a sane synthetic event. */
const SPECIAL_KEY_INFO: Readonly<Record<string, { key: string; keyCode: number }>> = Object.freeze({
  ArrowLeft: { key: 'ArrowLeft', keyCode: 37 },
  ArrowUp: { key: 'ArrowUp', keyCode: 38 },
  ArrowRight: { key: 'ArrowRight', keyCode: 39 },
  ArrowDown: { key: 'ArrowDown', keyCode: 40 },
  Space: { key: ' ', keyCode: 32 },
  Enter: { key: 'Enter', keyCode: 13 },
  NumpadEnter: { key: 'Enter', keyCode: 13 },
  Escape: { key: 'Escape', keyCode: 27 },
  Tab: { key: 'Tab', keyCode: 9 },
  ShiftLeft: { key: 'Shift', keyCode: 16 },
  ShiftRight: { key: 'Shift', keyCode: 16 },
  ControlLeft: { key: 'Control', keyCode: 17 },
  ControlRight: { key: 'Control', keyCode: 17 },
  AltLeft: { key: 'Alt', keyCode: 18 },
  AltRight: { key: 'Alt', keyCode: 18 },
  Backquote: { key: '`', keyCode: 192 },
  Backslash: { key: '\\', keyCode: 220 },
  BracketLeft: { key: '[', keyCode: 219 },
  BracketRight: { key: ']', keyCode: 221 },
  Semicolon: { key: ';', keyCode: 186 },
  Quote: { key: "'", keyCode: 222 },
  Comma: { key: ',', keyCode: 188 },
  Period: { key: '.', keyCode: 190 },
  Slash: { key: '/', keyCode: 191 },
  Minus: { key: '-', keyCode: 189 },
  Equal: { key: '=', keyCode: 187 }
})

/** `KeyboardEvent.key` and `.keyCode` for a `KeyboardEvent.code` string; an unknown code falls back
 * to the code itself with `keyCode` 0 rather than throwing, so a future bindable key still dispatches. */
export function keyInfoForCode(code: string): { key: string; keyCode: number } {
  const special = SPECIAL_KEY_INFO[code]
  if (special) return special
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return { key: letter[1]!.toLowerCase(), keyCode: 65 + (letter[1]!.charCodeAt(0) - 65) }
  const digit = /^Digit([0-9])$/.exec(code)
  if (digit) return { key: digit[1]!, keyCode: 48 + Number(digit[1]) }
  const fKey = /^F([1-9]|1[0-2])$/.exec(code)
  if (fKey) return { key: code, keyCode: 111 + Number(fKey[1]) }
  return { key: code, keyCode: 0 }
}

/** The action's first bound code (its default when the binding is empty, which the remap screen never allows). */
export function primaryCodeForAction(action: ActionName, bindings: InputBindings): string {
  return bindings[action]?.[0] ?? DEFAULT_BINDINGS[action][0]!
}

/** A real keydown/keyup `KeyboardEventInit` for the action's current binding (`window.dispatchEvent`
 * reaches `KeyboardHub`, which reads `.code` only, the same path a physical key takes). */
export function keyEventInitFor(action: ActionName, bindings: InputBindings): KeyboardEventInit {
  const code = primaryCodeForAction(action, bindings)
  const { key, keyCode } = keyInfoForCode(code)
  return { code, key, keyCode, which: keyCode, bubbles: true, cancelable: true, repeat: false }
}
