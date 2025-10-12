import Phaser from 'phaser'

class InputActionsSingleton {
  private keyboard?: Phaser.Input.Keyboard.KeyboardPlugin
  private enterKey?: Phaser.Input.Keyboard.Key
  private spaceKey?: Phaser.Input.Keyboard.Key
  private escKey?: Phaser.Input.Keyboard.Key
  private pendingNumpadConfirm = false
  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (event.code === 'NumpadEnter' && !event.repeat) {
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

    keyboard.on('keydown', this.handleKeydown)

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keyboard === keyboard) {
        this.unbind()
      }
    })
  }

  confirmPressedOnce(): boolean {
    const fromEnter = this.enterKey ? Phaser.Input.Keyboard.JustDown(this.enterKey) : false
    const fromNumpad = this.pendingNumpadConfirm
    this.pendingNumpadConfirm = false
    return fromEnter || fromNumpad
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

    this.keyboard.off('keydown', this.handleKeydown)

    if (this.enterKey) {
      this.keyboard.removeKey(this.enterKey.keyCode)
    }

    if (this.spaceKey) {
      this.keyboard.removeKey(this.spaceKey.keyCode)
    }

    if (this.escKey) {
      this.keyboard.removeKey(this.escKey.keyCode)
    }

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
