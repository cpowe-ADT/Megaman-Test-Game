import Phaser from 'phaser'
import AudioService from '../audio'
import { AUTOMATION } from '../config/automation'
import InputActions from '../input/InputActions'
import { showToast } from '../core/navigation'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import {
  addMenuBackdrop,
  addMenuPanel,
  MENU_COLORS,
  MENU_FONT_BODY,
  MENU_FONT_CODE,
  MENU_FONT_DISPLAY,
  styleMenuHeading
} from '../ui/menu/menuTheme'
import {
  buildSystemMenuOptions,
  selectMenuIndex,
  type PauseInventory,
  type SystemMenuAction,
  type SystemMenuOption,
  type SystemMenuSource
} from './menu/systemMenuSelector'

type SystemMenuData = {
  sourceScene: SystemMenuSource
}

type MenuCapableScene = Phaser.Scene & {
  onSystemMenuAction?: (action: SystemMenuAction) => void
  onSystemMenuCycle?: (action: SystemMenuAction, delta: number) => void
  getPauseInventory?: () => PauseInventory
}

/**
 * In-game: the pause menu (weapon row, sub tank row, actions, inventory status line).
 * Stage Select: the route console. One linear cursor so keyboard, touch and automation agree.
 */
export class SystemMenu extends Phaser.Scene {
  private sourceSceneKey: SystemMenuSource = 'Game'
  private options: SystemMenuOption[] = []
  private rows: Phaser.GameObjects.Text[] = []
  private rowBackplates: Phaser.GameObjects.Rectangle[] = []
  private cursor?: Phaser.GameObjects.Rectangle
  private statusText?: Phaser.GameObjects.Text
  private index = 0

  constructor() {
    super('SystemMenu')
  }

  create(data: SystemMenuData): void {
    this.sourceSceneKey = data?.sourceScene === 'StageSelect' ? 'StageSelect' : 'Game'
    this.index = this.sourceSceneKey === 'Game' ? 2 : 0
    this.options = this.buildOptions()

    const { width, height } = this.scale
    const isGame = this.sourceSceneKey === 'Game'
    const panelWidth = isGame ? 340 : 278
    const statusHeight = isGame ? 20 : 0
    const panelHeight = Math.min(height - 14, Math.max(176, 74 + this.options.length * 19 + statusHeight))
    const panelX = Math.round(width / 2)
    const panelY = Math.round(height / 2)
    const rowStartY = panelY - panelHeight / 2 + 49
    this.add.rectangle(panelX, panelY, width, height, 0x000000, 0.58)
    addMenuBackdrop(this, 0.34)
    addMenuPanel(this, panelX, panelY, panelWidth, panelHeight)
    this.add.text(panelX, panelY - panelHeight / 2 + 9, isGame ? 'MISSION PAUSED' : 'ROUTE CONSOLE', {
      fontFamily: MENU_FONT_CODE,
      fontSize: '7px',
      color: '#5de1ff',
      letterSpacing: 2
    }).setOrigin(0.5, 0)
    styleMenuHeading(this.add.text(panelX, panelY - panelHeight / 2 + 19, isGame ? 'PAUSE MENU' : 'SYSTEM MENU', {
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

    if (isGame) {
      this.statusText = this.add.text(panelX, rowStartY + this.options.length * 19 + 2, '', {
        fontFamily: MENU_FONT_CODE,
        fontSize: '8px',
        color: '#a9c9f2',
        align: 'center'
      }).setOrigin(0.5, 0)
      this.renderStatus()
    }

    this.add.text(panelX, panelY + panelHeight / 2 - 11, isGame
      ? 'ARROWS  SELECT / CYCLE     ENTER  CONFIRM     ESC  RESUME'
      : 'ARROWS  SELECT     ENTER  CONFIRM     ESC  BACK', {
      fontFamily: MENU_FONT_CODE,
      fontSize: '7px',
      color: '#8faed8'
    }).setOrigin(0.5)

    this.updateCursor()
    this.registerInput()
  }

  private host(): MenuCapableScene | undefined {
    return this.scene.get(this.sourceSceneKey) as MenuCapableScene | undefined
  }

  private buildOptions(): SystemMenuOption[] {
    const inventory = this.sourceSceneKey === 'Game' ? this.host()?.getPauseInventory?.() ?? null : null
    return buildSystemMenuOptions(this.sourceSceneKey, inventory, AUTOMATION.enabled)
  }

  private refreshLabels(): void {
    this.options = this.buildOptions()
    this.options.forEach((option, idx) => {
      this.rows[idx]?.setText(option.label.toUpperCase())
    })
    this.renderStatus()
    this.updateCursor()
  }

  private renderStatus(): void {
    if (!this.statusText) return
    const inventory = this.host()?.getPauseInventory?.()
    if (!inventory) return
    const armor = inventory.upgrades.filter((id) => id.startsWith('armor_')).map((id) => id.replace('armor_', '')).join(' ')
    const chips = inventory.upgrades.filter((id) => id.startsWith('chip_')).map((id) => id.replace('chip_', '').replace('_', ' ')).join(' ')
    this.statusText.setText(
      `HEARTS ${inventory.heartTanks}/8    ARMOR ${armor || 'NONE'}    CHIPS ${chips || 'NONE'}`.toUpperCase()
    )
  }

  private registerInput(): void {
    const actions = InputActions.forScene(this)

    actions.onPressed('aimUp', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_move')
      this.index = selectMenuIndex(this.index, -1, this.options.length)
      this.updateCursor()
    })
    actions.onPressed('aimDown', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_move')
      this.index = selectMenuIndex(this.index, 1, this.options.length)
      this.updateCursor()
    })
    actions.onPressed('moveLeft', () => this.cycleSelection(-1))
    actions.onPressed('moveRight', () => this.cycleSelection(1))
    bindMenuConfirmCancel(this, {
      onConfirm: () => this.activateSelection(),
      onCancel: () => this.closeWithAction(this.sourceSceneKey === 'Game' ? 'resume' : 'back')
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const hitIndex = this.rows.findIndex((row) => row.getBounds().contains(pointer.worldX, pointer.worldY))
      if (hitIndex >= 0) {
        AudioService.unlock()
        this.index = hitIndex
        this.updateCursor()
        this.activateSelection()
      }
    })
  }

  private cycleSelection(delta: number): void {
    const selected = this.options[this.index]
    if (!selected || selected.kind !== 'cycle' || !selected.enabled) return
    AudioService.unlock()
    AudioService.playSfx('ui_move')
    this.host()?.onSystemMenuCycle?.(selected.id, delta)
    this.refreshLabels()
  }

  private activateSelection(): void {
    const selected = this.options[this.index]
    if (!selected) {
      return
    }
    if (selected.id === 'controls' || selected.id === 'options') {
      AudioService.playSfx('ui_confirm')
      this.scene.launch(selected.id === 'controls' ? 'Controls' : 'Options', { returnSceneKey: 'SystemMenu' })
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
      showToast(this, selected.id === 'sub_tank' ? 'No sub tanks yet.' : 'Unavailable.', 900)
      return
    }
    if (selected.id === 'sub_tank') {
      AudioService.playSfx('ui_confirm')
      this.host()?.onSystemMenuAction?.('sub_tank')
      this.refreshLabels()
      return
    }
    if (selected.id === 'weapon') {
      this.closeWithAction('resume')
      return
    }
    AudioService.playSfx('ui_confirm')
    this.closeWithAction(selected.id)
  }

  private closeWithAction(action: SystemMenuAction): void {
    const source = this.host()
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

  /** Automation payload. */
  getDebugState(): { source: SystemMenuSource; index: number; options: Array<{ id: string; label: string; enabled: boolean }> } {
    return { source: this.sourceSceneKey, index: this.index, options: this.options.map((o) => ({ id: o.id, label: o.label, enabled: o.enabled })) }
  }
}

