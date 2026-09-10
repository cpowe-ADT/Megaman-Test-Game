import type { Difficulty } from '../../progression/types'
import { VOLUME_STEPS, type KnownSettings } from '../../systems/Settings'

export type OptionsRowId = 'musicVolume' | 'sfxVolume' | 'screenShake' | 'storyReplay' | 'difficulty' | 'controls' | 'delete' | 'back'
export type OptionsRow = { id: OptionsRowId; label: string; value: string; kind: 'cycle' | 'action' }

export const DIFFICULTIES: Difficulty[] = ['assist', 'normal', 'veteran']
export const DELETE_WORD = 'DELETE'

export type OptionsState = { settings: Pick<KnownSettings, 'musicVolume' | 'sfxVolume' | 'screenShake' | 'storyReplay'>; difficulty: Difficulty }

export function optionsRows(state: OptionsState): OptionsRow[] {
  const onOff = (value: boolean) => (value ? 'ON' : 'OFF')
  return [
    { id: 'musicVolume', label: 'Music Volume', value: `${state.settings.musicVolume}/${VOLUME_STEPS}`, kind: 'cycle' },
    { id: 'sfxVolume', label: 'Sound Volume', value: `${state.settings.sfxVolume}/${VOLUME_STEPS}`, kind: 'cycle' },
    { id: 'screenShake', label: 'Screen Shake', value: onOff(state.settings.screenShake), kind: 'cycle' },
    { id: 'storyReplay', label: 'Replay Story', value: onOff(state.settings.storyReplay), kind: 'cycle' },
    { id: 'difficulty', label: 'Difficulty', value: state.difficulty.toUpperCase(), kind: 'cycle' },
    { id: 'controls', label: 'Controls', value: '', kind: 'action' },
    { id: 'delete', label: 'Delete All Data', value: '', kind: 'action' },
    { id: 'back', label: 'Back', value: '', kind: 'action' }
  ]
}

/** Applies a left/right change to a cycle row; returns the patch to persist (settings and/or difficulty). */
export function applyOptionsChange(
  state: OptionsState,
  row: OptionsRowId,
  delta: number
): { settings?: Partial<OptionsState['settings']>; difficulty?: Difficulty } {
  const step = delta < 0 ? -1 : 1
  switch (row) {
    case 'musicVolume':
      return { settings: { musicVolume: Math.max(0, Math.min(VOLUME_STEPS, state.settings.musicVolume + step)) } }
    case 'sfxVolume':
      return { settings: { sfxVolume: Math.max(0, Math.min(VOLUME_STEPS, state.settings.sfxVolume + step)) } }
    case 'screenShake':
      return { settings: { screenShake: !state.settings.screenShake } }
    case 'storyReplay':
      return { settings: { storyReplay: !state.settings.storyReplay } }
    case 'difficulty': {
      const index = DIFFICULTIES.indexOf(state.difficulty)
      return { difficulty: DIFFICULTIES[(index + step + DIFFICULTIES.length) % DIFFICULTIES.length] }
    }
    default:
      return {}
  }
}

/** Typed confirmation: feed key names one at a time; returns the matched prefix length, or 0 on a wrong key. */
export function advanceDeleteConfirmation(typed: string, key: string): string {
  const next = typed + key.toUpperCase()
  return DELETE_WORD.startsWith(next) ? next : ''
}
