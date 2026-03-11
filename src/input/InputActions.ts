import Phaser from 'phaser'

class InputActionsSingleton {
  private keyboard?: Phaser.Input.Keyboard.KeyboardPlugin
  private enterKey?: Phaser.Input.Keyboard.Key
  private spaceKey?: Phaser.Input.Keyboard.Key
  private escKey?: Phaser.Input.Keyboard.Key
  private pendingNumpadConfirm = false
  private readonly handleNumpadEnter = (event: KeyboardEvent) => {
    if (!event.repeat) {
      this.pendingNumpadConfirm = true
    }
  }

  init(scene: Phaser.Scene): void {
    const keyboard = scene.input.keyboard
    if (!keyboard) {
      this.unbind()
      return
    }

    this.unbind()
    this.keyboard = keyboard

    this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.spaceKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    keyboard.on('keydown-NUMPAD_ENTER', this.handleNumpadEnter)

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keyboard === keyboard) {
        this.unbind()
      }
    })
  }

  confirmPressedOnce(): boolean {
    const fromEnter = this.enterKey ? Phaser.Input.Keyboard.JustDown(this.enterKey) : false
    const fromSpace = this.spaceKey ? Phaser.Input.Keyboard.JustDown(this.spaceKey) : false
    const fromNumpad = this.pendingNumpadConfirm
    this.pendingNumpadConfirm = false
    return fromEnter || fromSpace || fromNumpad
  }

  confirmReleased(): boolean {
    return !this.enterKey?.isDown && !this.spaceKey?.isDown && !this.pendingNumpadConfirm
  }

  flushTransientState(scene?: Phaser.Scene): void {
    const keyboard = scene?.input.keyboard ?? this.keyboard
    try {
      keyboard?.resetKeys()
    } catch {
      // Keyboard plugin may already be unavailable during teardown.
    }
  }

  isDownJump(): boolean {
    return this.spaceKey?.isDown ?? false
  }

  isPressedPauseOnce(): boolean {
    return this.escKey ? Phaser.Input.Keyboard.JustDown(this.escKey) : false
  }

  private unbind(): void {
    if (!this.keyboard) {
      this.enterKey = undefined
      this.spaceKey = undefined
      this.escKey = undefined
      this.pendingNumpadConfirm = false
      return
    }

    try {
      this.keyboard.resetKeys()
    } catch {
      // Keyboard plugin may already be torn down during scene swaps.
    }

    try {
      this.keyboard.off('keydown-NUMPAD_ENTER', this.handleNumpadEnter)
    } catch {
      // Keyboard plugin may already be torn down during scene swaps.
    }

    const keys = [this.enterKey, this.spaceKey, this.escKey]
    keys.forEach((key) => {
      if (!key) {
        return
      }
      try {
        this.keyboard?.removeKey(key.keyCode)
      } catch {
        // no-op
      }
    })

    this.keyboard = undefined
    this.enterKey = undefined
    this.spaceKey = undefined
    this.escKey = undefined
    this.pendingNumpadConfirm = false
  }
}

const instance = new InputActionsSingleton()

export const InputActions = instance
export default instance
