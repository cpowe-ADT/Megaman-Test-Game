import Phaser from 'phaser'
import AudioService from '../audio'
import { showToast } from '../core/navigation'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { Save } from '../systems/Save'
import {
  addMenuBackdrop,
  addMenuPanel,
  MENU_COLORS,
  MENU_FONT_BODY,
  MENU_FONT_CODE,
  MENU_FONT_DISPLAY,
  styleMenuHeading
} from '../ui/menu/menuTheme'
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
  private rowBackplates: Phaser.GameObjects.Rectangle[] = []
  private cursor?: Phaser.GameObjects.Rectangle
  private index = 0

  constructor() {
    super('SystemMenu')
  }

  create(data: SystemMenuData): void {
    this.sourceSceneKey = data?.sourceScene === 'StageSelect' ? 'StageSelect' : 'Game'
    this.options = buildSystemMenuOptions(this.sourceSceneKey, Save.hasActiveRun())

    const { width, height } = this.scale
    const panelWidth = 278
    const panelHeight = Math.min(height - 14, Math.max(176, 74 + this.options.length * 19))
    const panelX = Math.round(width / 2)
    const panelY = Math.round(height / 2)
    const rowStartY = panelY - panelHeight / 2 + 49
    this.add.rectangle(panelX, panelY, width, height, 0x000000, 0.58)
    addMenuBackdrop(this, 0.34)
    addMenuPanel(this, panelX, panelY, panelWidth, panelHeight)
    this.add.text(panelX, panelY - panelHeight / 2 + 9, this.sourceSceneKey === 'Game' ? 'MISSION PAUSED' : 'ROUTE CONSOLE', {
      fontFamily: MENU_FONT_CODE,
      fontSize: '7px',
      color: '#5de1ff',
      letterSpacing: 2
    }).setOrigin(0.5, 0)
    styleMenuHeading(this.add.text(panelX, panelY - panelHeight / 2 + 19, 'SYSTEM MENU', {
      fontFamily: MENU_FONT_DISPLAY,
      fontSize: '16px',
      color: '#f5f8ff'
    }).setOrigin(0.5, 0))

    this.cursor = this.add.rectangle(panelX - panelWidth / 2 + 12, rowStartY, 3, 15, MENU_COLORS.cyan, 1)

    this.rows = this.options.map((option, idx) => {
      const y = rowStartY + idx * 19
      this.rowBackplates.push(
        this.add.rectangle(panelX, y, panelWidth - 20, 16, MENU_COLORS.panelBright, 0.2)
      )
      return this.add.text(panelX - panelWidth / 2 + 22, y, option.label.toUpperCase(), {
        fontFamily: MENU_FONT_BODY,
        fontSize: '10px',
        fontStyle: 'bold',
        color: option.enabled ? '#f5f8ff' : '#6f8cb8'
      }).setOrigin(0, 0.5)
    })

    this.add.text(panelX, panelY + panelHeight / 2 - 11, 'ARROWS  SELECT     ENTER  CONFIRM     ESC  BACK', {
      fontFamily: MENU_FONT_CODE,
      fontSize: '7px',
      color: '#8faed8'
    }).setOrigin(0.5)

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
    if (selected.id === 'controls') {
      AudioService.playSfx('ui_confirm')
      this.scene.launch('Controls', { returnSceneKey: 'SystemMenu' })
      this.scene.pause()
      return
    }
    if (selected.id === 'progression') {
      AudioService.playSfx('ui_confirm')
      this.scene.launch('ProgressionSummary', {
        returnSceneKey: 'SystemMenu',
        sourceSceneKey: this.sourceSceneKey
      })
      this.scene.pause()
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
    this.cursor.setPosition(row.x - 10, row.y)
    this.rowBackplates.forEach((backplate, index) => {
      const selected = index === this.index
      backplate.setFillStyle(selected ? MENU_COLORS.panelBright : MENU_COLORS.panel, selected ? 0.95 : 0.24)
      backplate.setStrokeStyle(selected ? 1 : 0, selected ? MENU_COLORS.blue : MENU_COLORS.panel, selected ? 0.75 : 0)
      this.rows[index]?.setColor(
        this.options[index]?.enabled ? (selected ? '#ffffff' : '#c8dcf8') : selected ? '#8da0bc' : '#627b9e'
      )
    })
  }
}
