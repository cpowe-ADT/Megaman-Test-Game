import { ACTION_NAMES, DEFAULT_BINDINGS, type InputBindings } from '../input/ActionState'
type SettingsStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** Device-level preferences (key `settings.v1`). Campaign state lives in `save.v1`. */
export type KnownSettings = {
  bindings: InputBindings
  /** 0 to 10 steps. */
  musicVolume: number
  sfxVolume: number
  screenShake: boolean
  /** Replay story surfaces that were already seen. */
  storyReplay: boolean
  /** Caps flash frequency; prompt 04 wires the consumers. */
  reducedFlashing: boolean
}
/** Known fields plus any newer build's keys, preserved untouched. */
export type SettingsData = KnownSettings & Record<string, unknown>
export const SETTINGS_DEFAULTS: Omit<KnownSettings, 'bindings'> = Object.freeze({
  musicVolume: 8, sfxVolume: 8, screenShake: true, storyReplay: false, reducedFlashing: false
})
export const VOLUME_STEPS = 10
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
function volumeStep(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.min(VOLUME_STEPS, Math.round(n))) : fallback
}
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}
export function validateSettings(value: unknown): SettingsData {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  // Unknown keys survive so a newer build's settings are not erased by an older one.
  return {
    ...raw,
    bindings: validateBindings(raw.bindings),
    musicVolume: volumeStep(raw.musicVolume, SETTINGS_DEFAULTS.musicVolume),
    sfxVolume: volumeStep(raw.sfxVolume, SETTINGS_DEFAULTS.sfxVolume),
    screenShake: bool(raw.screenShake, SETTINGS_DEFAULTS.screenShake),
    storyReplay: bool(raw.storyReplay, SETTINGS_DEFAULTS.storyReplay),
    reducedFlashing: bool(raw.reducedFlashing, SETTINGS_DEFAULTS.reducedFlashing)
  }
}
export class SettingsStore {
  private memory: SettingsData = validateSettings({})
  /** Last stored string and its validated value: input reads settings several times a frame. */
  private parsed: { raw: string; value: SettingsData } | null = null
  private readonly listeners = new Set<(settings: SettingsData) => void>()
  constructor(private readonly storage?: SettingsStorage) {}
  /** Storage is still read every call so outside writes (smoke fixtures, another tab) take effect; only an unchanged string skips the parse. */
  get(): SettingsData {
    try {
      const raw = this.storage?.getItem(KEY)
      if (!raw) return this.memory
      if (this.parsed?.raw === raw) return this.parsed.value
      const value = validateSettings(JSON.parse(raw))
      this.parsed = { raw, value }
      return value
    } catch { return this.memory }
  }
  update(patch: Partial<SettingsData> & Record<string, unknown>): SettingsData {
    const previous = this.get()
    const bindingPatch = patch.bindings && typeof patch.bindings === 'object' && !Array.isArray(patch.bindings)
      ? patch.bindings : {}
    this.memory = validateSettings({ ...previous, ...patch, bindings: { ...previous.bindings, ...bindingPatch } })
    try {
      const raw = JSON.stringify(this.memory)
      this.storage?.setItem(KEY, raw)
      this.parsed = { raw, value: this.memory }
    } catch { /* Storage can be unavailable. */ }
    this.listeners.forEach(listener => listener(this.memory))
    return this.memory
  }
  /** Consumers such as the audio service subscribe once; the unsubscribe is returned. */
  onChange(listener: (settings: SettingsData) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
}
function browserStorage(): SettingsStorage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined }
}
export const Settings = new SettingsStore(browserStorage())
