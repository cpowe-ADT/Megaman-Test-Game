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

type HeldButtons = Record<DigitalButtonName, boolean>
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
  private readonly listeners = new Set<(before: HeldButtons, after: HeldButtons) => void>()
  private readonly held = createInitialStates(false)
  private readonly previous = createInitialStates(false)

  setHeld(name: DigitalButtonName, held: boolean): void {
    if (this.held[name] === held) return
    const before = this.getHeldSnapshot()
    this.held[name] = held
    this.listeners.forEach(listener => listener(before, this.getHeldSnapshot()))
  }

  onChange(listener: (before: HeldButtons, after: HeldButtons) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
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
    const before = this.getHeldSnapshot()
    BUTTON_NAMES.forEach((name) => {
      this.held[name] = false
      this.previous[name] = false
    })
    this.listeners.forEach(listener => listener(before, this.getHeldSnapshot()))
  }
}
