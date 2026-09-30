import { DEFAULT_BINDINGS, type ActionName, type InputBindings } from '../../input/ActionState'

/** Part 12i (EVAL-P8-003): what the Preload loading screen says and draws. Pure. */
const KEY_LABELS: Readonly<Record<string, string>> = {
  Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER', ArrowLeft: 'ARROWS', ArrowRight: 'ARROWS', ArrowUp: 'UP', ArrowDown: 'DOWN'
}

export function keyLabel(code: string): string {
  return KEY_LABELS[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '').toUpperCase()
}

/** The first-visit note: one key per verb, read from the default bindings so it can never drift from them. Two lines. */
export function firstVisitControlsLines(bindings: InputBindings = DEFAULT_BINDINGS): [string, string] {
  const first = (action: ActionName) => keyLabel(bindings[action][0])
  const last = (action: ActionName) => keyLabel(bindings[action][bindings[action].length - 1])
  return [
    [`${first('moveLeft')} MOVE`, `${first('jump')} JUMP`, `${first('shoot')} SHOOT`, `${first('saber')} SABER`].join(' · '),
    [`${first('dash')} DASH`, `${first('weaponPrev')}/${last('weaponNext')} WEAPON`, `${first('pause')} PAUSE`].join(' · ')
  ]
}

/** Only a first visit names the controls: once a campaign has started, the player has had the control map. */
export function showsFirstVisitNote(profile: { campaignStarted?: boolean } | null | undefined): boolean {
  return !profile?.campaignStarted
}

/** The bar's fill in whole pixels, so 1x never draws a half pixel. */
export function loadingBarFill(progress: number, width: number): number {
  return Math.round(Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * width)
}
