export type DigitalButtonName =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'dash'
  | 'shoot'
  | 'saber'

export type DigitalButtonState = {
  held: boolean
  pressed: boolean
  released: boolean
}

type DigitalButtonFrameState = Record<DigitalButtonName, DigitalButtonState>

const BUTTON_NAMES: DigitalButtonName[] = ['left', 'right', 'up', 'down', 'jump', 'dash', 'shoot', 'saber']

function createInitialStates(value: boolean): Record<DigitalButtonName, boolean> {
  return {
    left: value,
    right: value,
    up: value,
    down: value,
    jump: value,
    dash: value,
    shoot: value,
    saber: value
  }
}

export class DigitalButtonPad {
  private readonly held = createInitialStates(false)
  private readonly previous = createInitialStates(false)

  setHeld(name: DigitalButtonName, held: boolean): void {
    this.held[name] = held
  }

  isHeld(name: DigitalButtonName): boolean {
    return this.held[name]
  }

  getHeldSnapshot(): Record<DigitalButtonName, boolean> {
    return { ...this.held }
  }

  sample(): DigitalButtonFrameState {
    const snapshot = {} as DigitalButtonFrameState
    BUTTON_NAMES.forEach((name) => {
      const held = this.held[name]
      const previous = this.previous[name]
      snapshot[name] = {
        held,
        pressed: held && !previous,
        released: !held && previous
      }
      this.previous[name] = held
    })
    return snapshot
  }

  reset(): void {
    BUTTON_NAMES.forEach((name) => {
      this.held[name] = false
      this.previous[name] = false
    })
  }
}
