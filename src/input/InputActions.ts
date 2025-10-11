import Phaser from 'phaser'

type EdgeAction = 'confirm' | 'pause' | 'toggleDebug'
export type InputAction = EdgeAction | 'jump'

const ACTION_CONFIG: Record<InputAction, { type: 'edge' | 'level'; codes: number[] }> = {
  confirm: {
    type: 'edge',
    codes: [Phaser.Input.Keyboard.KeyCodes.ENTER, Phaser.Input.Keyboard.KeyCodes.NUMPAD_ENTER]
  },
  jump: { type: 'level', codes: [Phaser.Input.Keyboard.KeyCodes.SPACE] },
  pause: { type: 'edge', codes: [Phaser.Input.Keyboard.KeyCodes.ESC] },
  toggleDebug: { type: 'edge', codes: [Phaser.Input.Keyboard.KeyCodes.BACKTICK] }
}

type KeyBinding = {
  key: Phaser.Input.Keyboard.Key
  isDown: boolean
}

export interface InputSnapshot {
  lastKey: string | null
}

export class InputActions {
  private keyboard?: Phaser.Input.Keyboard.KeyboardPlugin
  private readonly bindings = new Map<InputAction, KeyBinding[]>()
  private readonly edgeActions = new Set<EdgeAction>()
  private readonly keyStates = new Map<number, boolean>()
  private keydownHandler?: (event: KeyboardEvent) => void
  private lastKey: string | null = null

  initialize(keyboard: Phaser.Input.Keyboard.KeyboardPlugin): void {
    if (this.keyboard === keyboard) {
      return
    }

    this.release()
    this.keyboard = keyboard

    for (const [action, config] of Object.entries(ACTION_CONFIG) as [InputAction, (typeof ACTION_CONFIG)[InputAction]][]) {
      const keys = config.codes
        .map((code) => keyboard.addKey(code))
        .filter((key): key is Phaser.Input.Keyboard.Key => Boolean(key))
        .map((key) => ({ key, isDown: key.isDown }))
      if (keys.length > 0) {
        this.bindings.set(action, keys)
      }
    }

    this.keydownHandler = (event: KeyboardEvent) => {
      this.lastKey = event.key || event.code || null
    }
    keyboard.on('keydown', this.keydownHandler)
  }

  release(target?: Phaser.Input.Keyboard.KeyboardPlugin): void {
    if (target && this.keyboard && target !== this.keyboard) {
      return
    }

    if (this.keyboard && this.keydownHandler) {
      this.keyboard.off('keydown', this.keydownHandler)
    }

    for (const bindings of this.bindings.values()) {
      bindings.forEach(({ key }) => this.keyboard?.removeKey(key))
    }

    this.bindings.clear()
    this.edgeActions.clear()
    this.keyStates.clear()
    this.keydownHandler = undefined
    this.keyboard = undefined
    this.lastKey = null
  }

  updateFrameClock(_ts: number): void {
    this.edgeActions.clear()

    for (const [action, bindings] of this.bindings.entries()) {
      const config = ACTION_CONFIG[action]
      for (const binding of bindings) {
        const key = binding.key
        const wasDown = this.keyStates.get(key.keyCode) ?? false
        const isDown = key.isDown
        binding.isDown = isDown
        this.keyStates.set(key.keyCode, isDown)

        if (isDown && !wasDown) {
          this.lastKey = key.key ?? key.originalEvent?.key ?? key.originalEvent?.code ?? String(key.keyCode)
          if (config.type === 'edge') {
            this.edgeActions.add(action as EdgeAction)
          }
        }
      }
    }
  }

  isPressed(action: EdgeAction): boolean {
    return this.edgeActions.has(action)
  }

  isDown(action: 'jump'): boolean {
    const bindings = this.bindings.get(action)
    if (!bindings) {
      return false
    }
    return bindings.some((binding) => binding.key.isDown)
  }

  getSnapshot(): InputSnapshot {
    return { lastKey: this.lastKey }
  }

  getLastKey(): string | null {
    return this.lastKey
  }
}

export const inputActions = new InputActions()
