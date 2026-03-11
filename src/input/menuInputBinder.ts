import Phaser from 'phaser'
import AudioService from '../audio'
import InputActions from './InputActions'

type MenuInputBinderOptions = {
  onConfirm?: () => void
  onCancel?: () => void
}

export function bindMenuConfirmCancel(
  scene: Phaser.Scene,
  options: MenuInputBinderOptions
): () => void {
  InputActions.init(scene)
  const keyboard = scene.input.keyboard
  if (!keyboard) {
    return () => {}
  }

  const wrap =
    (handler?: () => void, sfxKey?: string) =>
    (event?: KeyboardEvent) => {
      if (event?.repeat) {
        return
      }
      event?.preventDefault?.()
      AudioService.unlock()
      if (sfxKey) {
        AudioService.playSfx(sfxKey)
      }
      handler?.()
    }

  const enterHandler = wrap(options.onConfirm, 'ui_confirm')
  const numpadHandler = wrap(options.onConfirm, 'ui_confirm')
  const spaceHandler = wrap(options.onConfirm, 'ui_confirm')
  const escHandler = wrap(options.onCancel, 'ui_cancel')

  keyboard.on('keydown-ENTER', enterHandler)
  keyboard.on('keydown-NUMPAD_ENTER', numpadHandler)
  keyboard.on('keydown-SPACE', spaceHandler)
  keyboard.on('keydown-ESC', escHandler)

  const cleanup = () => {
    try {
      keyboard.off('keydown-ENTER', enterHandler)
      keyboard.off('keydown-NUMPAD_ENTER', numpadHandler)
      keyboard.off('keydown-SPACE', spaceHandler)
      keyboard.off('keydown-ESC', escHandler)
    } catch {
      // Keyboard plugin may already be torn down during scene shutdown.
    }
  }

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
  return cleanup
}

export default bindMenuConfirmCancel
