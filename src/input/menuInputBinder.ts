import type Phaser from 'phaser'
import AudioService from '../audio'
import InputActions from './InputActions'

type MenuInputBinderOptions = { onConfirm?: () => void; onCancel?: () => void }
export function bindMenuConfirmCancel(scene: Phaser.Scene, options: MenuInputBinderOptions): () => void {
  const actions = InputActions.forScene(scene)
  const confirm = actions.onPressed('confirm', () => {
    AudioService.playSfx('ui_confirm')
    options.onConfirm?.()
  })
  const cancel = actions.onPressed('cancel', () => {
    AudioService.playSfx('ui_cancel')
    options.onCancel?.()
  })
  const cleanup = () => { confirm(); cancel() }
  scene.events.once('shutdown', cleanup)
  return cleanup
}
export default bindMenuConfirmCancel
