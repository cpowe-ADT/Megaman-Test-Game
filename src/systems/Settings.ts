import { ACTION_NAMES, DEFAULT_BINDINGS, type InputBindings } from '../input/ActionState'
type SettingsStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type SettingsData = Record<string, unknown> & { bindings: InputBindings }
const KEY = 'settings.v1'
const keyCodes = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(key => `Key${key}`),
  ...'0123456789'.split('').map(key => `Digit${key}`),
  ...Array.from({ length: 12 }, (_, index) => `F${index + 1}`),
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'NumpadEnter', 'Escape', 'Tab',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'Backquote', 'Backslash',
  'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'Minus', 'Equal'
])
export function validateBindings(value: unknown): InputBindings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const bindings = { ...DEFAULT_BINDINGS }
  for (const action of ACTION_NAMES) {
    const keys = raw[action]
    if (Array.isArray(keys) && keys.length > 0 && keys.length <= 4 &&
      keys.every(key => typeof key === 'string' && keyCodes.has(key))) bindings[action] = Object.freeze([...new Set(keys)])
  }
  return Object.freeze(bindings)
}
export class SettingsStore {
  private memory: SettingsData = { bindings: DEFAULT_BINDINGS }
  constructor(private readonly storage?: SettingsStorage) {}
  get(): SettingsData {
    try {
      const raw = this.storage?.getItem(KEY)
      if (!raw) return this.memory
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return this.memory
      // Later settings slices own other fields; preserve them while validating bindings.
      return { ...parsed, bindings: validateBindings(parsed.bindings) }
    } catch { return this.memory }
  }
  update(patch: Record<string, unknown>): SettingsData {
    const previous = this.get()
    const bindingPatch = patch.bindings && typeof patch.bindings === 'object' && !Array.isArray(patch.bindings)
      ? patch.bindings : {}
    this.memory = { ...previous, ...patch, bindings: validateBindings({ ...previous.bindings, ...bindingPatch }) }
    try { this.storage?.setItem(KEY, JSON.stringify(this.memory)) } catch { /* Storage can be unavailable. */ }
    return this.memory
  }
}
function browserStorage(): SettingsStorage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined }
}
export const Settings = new SettingsStore(browserStorage())
