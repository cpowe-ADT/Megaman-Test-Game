import { ACTION_NAMES, DEFAULT_BINDINGS, DEFAULT_PAD_BINDINGS, PAD_INPUTS, type InputBindings, type PadBindings, type PadInput } from '../input/ActionState'
import { PIXEL_SCALING_MODES, setPixelScalingSource, type PixelScaling } from '../config/renderPolicy'
type SettingsStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** Device-level preferences (key `settings.v1`). Campaign state lives in `save.v1`. */
export type KnownSettings = {
  bindings: InputBindings
  /** The pad column of the remap screen (prompt 04 §4.3); absent from settings written before part 12i. */
  padBindings: PadBindings
  /** 0 to 10 steps. */
  musicVolume: number
  sfxVolume: number
  screenShake: boolean
  /** Replay story surfaces that were already seen. */
  storyReplay: boolean
  /** Caps flash frequency: the charge ring and the hero's death burst read it (prompt 04 §4.3). */
  reducedFlashing: boolean
  /** `integer` keeps a whole-number zoom at every window size (letterboxed); `smooth` fills windows under 2x. */
  pixelScaling: PixelScaling
}
/** Known fields plus any newer build's keys, preserved untouched. */
export type SettingsData = KnownSettings & Record<string, unknown>
export const SETTINGS_DEFAULTS: Omit<KnownSettings, 'bindings' | 'padBindings'> = Object.freeze({
  musicVolume: 8, sfxVolume: 8, screenShake: true, storyReplay: false, reducedFlashing: false, pixelScaling: 'smooth'
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
/** Whether a `KeyboardEvent.code` can be stored as a binding (the remap screen ignores any other key). */
export function isBindableKey(code: string): boolean {
  return keyCodes.has(code)
}
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
const padInputs = new Set<string>(PAD_INPUTS)
/** The keyboard's rules for the pad: one to four known inputs per action, otherwise that action's default. */
export function validatePadBindings(value: unknown): PadBindings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const bindings = { ...DEFAULT_PAD_BINDINGS }
  for (const action of ACTION_NAMES) {
    const inputs = raw[action]
    if (Array.isArray(inputs) && inputs.length > 0 && inputs.length <= 4 &&
      inputs.every(input => typeof input === 'string' && padInputs.has(input))) bindings[action] = Object.freeze([...new Set(inputs as PadInput[])])
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
    padBindings: validatePadBindings(raw.padBindings),
    musicVolume: volumeStep(raw.musicVolume, SETTINGS_DEFAULTS.musicVolume),
    sfxVolume: volumeStep(raw.sfxVolume, SETTINGS_DEFAULTS.sfxVolume),
    screenShake: bool(raw.screenShake, SETTINGS_DEFAULTS.screenShake),
    storyReplay: bool(raw.storyReplay, SETTINGS_DEFAULTS.storyReplay),
    reducedFlashing: bool(raw.reducedFlashing, SETTINGS_DEFAULTS.reducedFlashing),
    pixelScaling: PIXEL_SCALING_MODES.includes(raw.pixelScaling as PixelScaling) ? raw.pixelScaling as PixelScaling : SETTINGS_DEFAULTS.pixelScaling
  }
}
function objectPatch(value: unknown): object {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
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
  /** Binding patches merge per action, so a patch naming one action leaves the others alone. */
  update(patch: Partial<SettingsData> & Record<string, unknown>): SettingsData {
    const previous = this.get()
    this.memory = validateSettings({ ...previous, ...patch,
      bindings: { ...previous.bindings, ...objectPatch(patch.bindings) },
      padBindings: { ...previous.padBindings, ...objectPatch(patch.padBindings) } })
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
// The render scale asks on every resize; main.ts imports this module before it measures the first one.
setPixelScalingSource(() => Settings.get().pixelScaling)

/**
 * Reduced flashing for explosion bursts (prompt 04 §4.3): no additive glow and a dimmer burst, so a
 * burst reads as a shape rather than a flash. The charge ring's cap is `resolveChargeAuraFrequencyMs`.
 */
export function explosionFlashStyle(reducedFlashing: boolean): { additive: boolean; alphaScale: number } {
  return reducedFlashing ? { additive: false, alphaScale: 0.55 } : { additive: true, alphaScale: 1 }
}
