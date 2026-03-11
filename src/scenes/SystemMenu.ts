import Phaser from 'phaser'
import AudioService from '../audio'
import { showToast } from '../core/navigation'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { Save } from '../systems/Save'
import { buildSystemMenuOptions, selectMenuIndex, SystemMenuAction, SystemMenuOption, SystemMenuSource } from './menu/systemMenuSelector'

type SystemMenuData = {
  sourceScene: SystemMenuSource
}

type MenuCapableScene = Phaser.Scene & {
  onSystemMenuAction?: (action: SystemMenuAction) => void
}

export class SystemMenu extends Phaser.Scene {
  private sourceSceneKey: SystemMenuSource = 'Game'
  private options: SystemMenuOption[] = []
  private rows: Phaser.GameObjects.Text[] = []
  private cursor?: Phaser.GameObjects.Text
  private index = 0

  constructor() {
    super('SystemMenu')
  }

  create(data: SystemMenuData): void {
    this.sourceSceneKey = data?.sourceScene === 'StageSelect' ? 'StageSelect' : 'Game'
    this.options = buildSystemMenuOptions(this.sourceSceneKey, Save.hasActiveRun())

    const { width, height } = this.scale
    const panelWidth = 250
    const panelHeight = 168
    const panelX = Math.round(width / 2)
    const panelY = Math.round(height / 2)
    this.add.rectangle(panelX, panelY, width, height, 0x000000, 0.62)
    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x0b1c3c, 0.95).setStrokeStyle(2, 0x4a8cff, 0.95)
    this.add.text(panelX, panelY - panelHeight / 2 + 12, 'SYSTEM MENU', {
      font: '16px monospace',
      color: '#f5f8ff'
    }).setOrigin(0.5, 0)

    this.cursor = this.add.text(panelX - panelWidth / 2 + 14, panelY - 44, '>', {
      font: '12px monospace',
      color: '#ffffff'
    }).setOrigin(0, 0.5)

    this.rows = this.options.map((option, idx) => {
      const y = panelY - 44 + idx * 20
      return this.add.text(panelX - panelWidth / 2 + 28, y, option.label, {
        font: '12px monospace',
        color: option.enabled ? '#f5f8ff' : '#6f8cb8'
      }).setOrigin(0, 0.5)
    })

    this.updateCursor()
    this.registerInput()
  }

  private registerInput(): void {
    const keyboard = this.input.keyboard
    if (!keyboard) {
      return
    }

    keyboard.on('keydown-UP', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_move')
      this.index = selectMenuIndex(this.index, -1, this.options.length)
      this.updateCursor()
    })
    keyboard.on('keydown-DOWN', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_move')
      this.index = selectMenuIndex(this.index, 1, this.options.length)
      this.updateCursor()
    })
    bindMenuConfirmCancel(this, {
      onConfirm: () => this.activateSelection(),
      onCancel: () => this.closeWithAction(this.sourceSceneKey === 'Game' ? 'resume' : 'back')
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const hitIndex = this.rows.findIndex((row) => row.getBounds().contains(pointer.x, pointer.y))
      if (hitIndex >= 0) {
        AudioService.unlock()
        this.index = hitIndex
        this.updateCursor()
        this.activateSelection()
      }
    })
  }

  private activateSelection(): void {
    const selected = this.options[this.index]
    if (!selected) {
      return
    }
    if (!selected.enabled) {
      AudioService.playSfx('ui_cancel')
      showToast(this, 'No saved game found.', 900)
      return
    }
    AudioService.playSfx('ui_confirm')
    this.closeWithAction(selected.id)
  }

  private closeWithAction(action: SystemMenuAction): void {
    const source = this.scene.get(this.sourceSceneKey) as MenuCapableScene | undefined
    this.scene.stop()
    source?.onSystemMenuAction?.(action)
  }

  private updateCursor(): void {
    const row = this.rows[this.index]
    if (!this.cursor || !row) {
      return
    }
    this.cursor.setPosition(row.x - 14, row.y)
  }
}
