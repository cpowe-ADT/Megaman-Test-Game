import Phaser from 'phaser'
import AudioService from '../audio'
import InputActions from '../input/InputActions'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { Save } from '../systems/Save'
import { Settings } from '../systems/Settings'
import { addMenuBackdrop, addMenuPanel, MENU_COLORS, MENU_FONT_BODY, MENU_FONT_CODE, MENU_FONT_DISPLAY, styleMenuHeading } from '../ui/menu/menuTheme'
import { advanceDeleteConfirmation, applyOptionsChange, DELETE_WORD, optionsRows, type OptionsRow } from './menu/optionsModel'
import { selectMenuIndex } from './menu/systemMenuSelector'
import { GAME_SIZE } from '../config/renderPolicy'

type OptionsSceneData = { returnSceneKey?: string }

/** Device settings, difficulty, controls, and the typed delete. Reachable from Title, the route console and the pause menu. */
export class OptionsScene extends Phaser.Scene {
  private returnSceneKey = 'Title'
  private rows: OptionsRow[] = []
  private labels: Phaser.GameObjects.Text[] = []
  private values: Phaser.GameObjects.Text[] = []
  private backplates: Phaser.GameObjects.Rectangle[] = []
  private cursor?: Phaser.GameObjects.Rectangle
  private hint!: Phaser.GameObjects.Text
  private index = 0
  private typed = ''
  private deleting = false
  private keyHandler?: (event: KeyboardEvent) => void

  constructor() {
    super('Options')
  }

  create(data?: OptionsSceneData): void {
    this.returnSceneKey = data?.returnSceneKey || 'Title'
    // Scene instances are reused: without this, every visit indexed the first visit's destroyed rows.
    this.labels = []
    this.values = []
    this.backplates = []
    this.index = 0
    this.typed = ''
    this.deleting = false
    const { width, height } = GAME_SIZE
    const panelWidth = 330
    const panelHeight = 214
    const panelX = Math.round(width / 2)
    const panelY = Math.round(height / 2)
    this.add.rectangle(panelX, panelY, width, height, 0x000000, 0.6)
    addMenuBackdrop(this, 0.34)
    addMenuPanel(this, panelX, panelY, panelWidth, panelHeight)
    this.add.text(panelX, panelY - panelHeight / 2 + 9, 'DEVICE AND CAMPAIGN', { fontFamily: MENU_FONT_CODE, fontSize: '7px', color: '#5de1ff', letterSpacing: 2 }).setOrigin(0.5, 0)
    styleMenuHeading(this.add.text(panelX, panelY - panelHeight / 2 + 19, 'OPTIONS', { fontFamily: MENU_FONT_DISPLAY, fontSize: '16px', color: '#f5f8ff' }).setOrigin(0.5, 0))
    this.rows = this.currentRows()
    const rowStartY = panelY - panelHeight / 2 + 50
    this.cursor = this.add.rectangle(panelX - panelWidth / 2 + 12, rowStartY, 3, 15, MENU_COLORS.cyan, 1)
    this.rows.forEach((row, idx) => {
      const y = rowStartY + idx * 17
      this.backplates.push(this.add.rectangle(panelX, y, panelWidth - 20, 15, MENU_COLORS.panelBright, 0.2))
      this.labels.push(this.add.text(panelX - panelWidth / 2 + 22, y, row.label.toUpperCase(), { fontFamily: MENU_FONT_BODY, fontSize: '10px', fontStyle: 'bold', color: '#f5f8ff' }).setOrigin(0, 0.5))
      this.values.push(this.add.text(panelX + panelWidth / 2 - 22, y, row.value, { fontFamily: MENU_FONT_CODE, fontSize: '10px', color: '#7de8ff' }).setOrigin(1, 0.5))
    })
    this.hint = this.add.text(panelX, panelY + panelHeight / 2 - 11, '', { fontFamily: MENU_FONT_CODE, fontSize: '7px', color: '#8faed8' }).setOrigin(0.5)
    this.renderRows()

    const actions = InputActions.forScene(this)
    actions.onPressed('aimUp', () => this.move(-1))
    actions.onPressed('aimDown', () => this.move(1))
    actions.onPressed('moveLeft', () => this.change(-1))
    actions.onPressed('moveRight', () => this.change(1))
    bindMenuConfirmCancel(this, { onConfirm: () => this.activate(), onCancel: () => this.close() })
    this.keyHandler = (event: KeyboardEvent) => this.onTypedKey(event)
    window.addEventListener('keydown', this.keyHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler) })
  }

  getDebugState(): { index: number; rows: OptionsRow[]; typed: string; deleting: boolean; rowObjects: number; shownValues: Array<string | null> } {
    return {
      index: this.index,
      rows: this.rows,
      typed: this.typed,
      deleting: this.deleting,
      rowObjects: this.labels.length,
      shownValues: this.values.map((value) => (value.active ? value.text : null))
    }
  }

  private currentRows(): OptionsRow[] {
    const settings = Settings.get()
    return optionsRows({ settings, difficulty: Save.load().difficulty })
  }

  private renderRows(): void {
    this.rows = this.currentRows()
    this.rows.forEach((row, idx) => {
      this.values[idx]?.setText(row.id === 'delete' && this.deleting ? `TYPE ${DELETE_WORD}: ${this.typed}_` : row.value)
    })
    this.backplates.forEach((plate, idx) => {
      const selected = idx === this.index
      plate.setFillStyle(selected ? MENU_COLORS.panelBright : MENU_COLORS.panel, selected ? 0.95 : 0.24)
      this.labels[idx]?.setColor(selected ? '#ffffff' : '#c8dcf8')
    })
    const row = this.labels[this.index]
    if (row && this.cursor) this.cursor.setPosition(row.x - 10, row.y)
    const selected = this.rows[this.index]
    this.hint.setText(
      this.deleting ? `TYPE ${DELETE_WORD} TO ERASE THE CAMPAIGN AND SETTINGS   ESC CANCEL`
        : selected?.id === 'difficulty' ? 'BOSS HEALTH APPLIES ON THE NEXT STAGE ENTRY   LEFT / RIGHT CHANGE'
          : selected?.kind === 'cycle' ? 'LEFT / RIGHT CHANGE     ENTER / ESC BACK' : 'ENTER CONFIRM     ESC BACK'
    )
  }

  private move(delta: number): void {
    if (this.deleting) return
    AudioService.playSfx('ui_move')
    this.index = selectMenuIndex(this.index, delta, this.rows.length)
    this.renderRows()
  }

  private change(delta: number): void {
    if (this.deleting) return
    const row = this.rows[this.index]
    if (!row || row.kind !== 'cycle') return
    const patch = applyOptionsChange({ settings: Settings.get(), difficulty: Save.load().difficulty }, row.id, delta)
    if (patch.settings) Settings.update(patch.settings)
    if (patch.difficulty) {
      const state = Save.load()
      state.difficulty = patch.difficulty
      Save.save(state)
    }
    AudioService.playSfx('ui_move')
    this.renderRows()
  }

  private activate(): void {
    if (this.deleting) return
    const row = this.rows[this.index]
    if (!row) return
    if (row.id === 'controls') {
      this.scene.launch('Controls', { returnSceneKey: 'Options' })
      this.scene.pause()
      return
    }
    if (row.id === 'delete') {
      this.deleting = true
      this.typed = ''
      this.renderRows()
      return
    }
    this.close()
  }

  private onTypedKey(event: KeyboardEvent): void {
    if (!this.deleting) return
    if (event.key === 'Escape') {
      this.deleting = false
      this.typed = ''
      this.renderRows()
      return
    }
    if (event.key.length !== 1) return
    this.typed = advanceDeleteConfirmation(this.typed, event.key)
    if (this.typed === DELETE_WORD) {
      this.deleting = false
      Save.deleteAll()
      Settings.update({ musicVolume: 8, sfxVolume: 8, screenShake: true, storyReplay: false, reducedFlashing: false })
      AudioService.playSfx('ui_confirm')
      const stop = [this.returnSceneKey, 'SystemMenu', 'Game', 'StageSelect'].filter((key) => this.scene.isActive(key) || this.scene.isPaused(key))
      this.scene.stop()
      stop.forEach((key) => this.scene.stop(key))
      this.scene.start('Title')
      return
    }
    this.renderRows()
  }

  private close(): void {
    const target = this.returnSceneKey
    this.scene.stop()
    if (this.scene.isPaused(target)) this.scene.resume(target)
  }
}

export default OptionsScene
