import Phaser from 'phaser'
import AudioService from '../audio'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import InputActions from '../input/InputActions'
import { DEFAULT_BINDINGS, DEFAULT_PAD_BINDINGS, type ActionName, type PadInput } from '../input/ActionState'
import { Profiles } from '../systems/Save'
import { isBindableKey, Settings } from '../systems/Settings'
import { CONTROL_SECTIONS } from '../ui/controls/controlMap'
import {
  addMenuBackdrop,
  addMenuPanel,
  MENU_COLORS,
  MENU_FONT_BODY,
  MENU_FONT_CODE,
  MENU_FONT_DISPLAY,
  styleMenuHeading
} from '../ui/menu/menuTheme'
import { bindingText, listConflicts, rebind, rebindMessage, REMAP_ROWS, type BindingTable, type RemapDevice } from '../ui/menu/remapModel'
import { GAME_SIZE } from '../config/renderPolicy'

type ControlsSceneData = {
  returnSceneKey?: string
  /** The first-run page (prompt 05 5.6): eight keys, once per profile before the tutorial briefing. */
  firstRun?: boolean
  /** Where the first-run page goes next; absent when it is replayed from the control map. */
  next?: { key: string; data: object }
}

/** The eight keys of the first-run page, from the control map's gameplay rows (both weapon rows as one). */
export function firstRunRows(): Array<{ action: string; input: string }> {
  return CONTROL_SECTIONS[0]!.rows
    .filter((row) => row.action !== 'Cycle weapon back')
    .map((row) => (row.action === 'Cycle weapon' ? { action: 'Switch weapon', input: 'Q back, D or E forward' } : row))
}

/** Rows below the actions: reset both columns, then leave. */
const EXTRA_ROWS = ['reset', 'back'] as const
const DEVICES: readonly RemapDevice[] = ['keyboard', 'pad']
/** A bind that hears nothing in this long is dropped and the old binding stays. */
const LISTEN_TIMEOUT_MS = 5000
const CELL_WIDTH = 128
const ROW_SPACING = 11

type Cell = { plate: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }

/**
 * The remap screen (prompt 04 §4.3): keyboard and pad columns, press-to-bind, conflict detection and
 * reset to default, persisted in `settings.v1`. The rules live in `ui/menu/remapModel.ts`.
 */
export class ControlsScene extends Phaser.Scene {
  private returnSceneKey = 'Title'
  firstRun = false
  private row = 0
  private column = 0
  private listening: { device: RemapDevice; action: ActionName } | null = null
  private listenTimer?: Phaser.Time.TimerEvent
  private message = ''
  private labels: Phaser.GameObjects.Text[] = []
  private cells: Cell[][] = []
  private cursor?: Phaser.GameObjects.Rectangle
  private messageText?: Phaser.GameObjects.Text
  private hintText?: Phaser.GameObjects.Text

  constructor() {
    super('Controls')
  }

  create(data?: ControlsSceneData): void {
    this.returnSceneKey = data?.returnSceneKey || 'Title'
    this.firstRun = Boolean(data?.firstRun)
    if (this.firstRun) {
      this.renderFirstRun(data?.next)
      return
    }
    // Scene instances are reused: every visit builds its own rows. The cursor opens on BACK so Enter still
    // leaves at once, as it did on the read-only control map; Down wraps to the first action.
    this.row = REMAP_ROWS.length + EXTRA_ROWS.indexOf('back')
    this.column = 0
    this.listening = null
    this.message = ''
    this.labels = []
    this.cells = []

    const { width, height } = GAME_SIZE
    const panelWidth = 424
    const panelHeight = 240
    const panelX = Math.round(width / 2)
    const panelY = Math.round(height / 2)
    const top = panelY - panelHeight / 2
    const left = panelX - panelWidth / 2
    const columnX = [left + 214, left + 214 + CELL_WIDTH + 8]

    this.add.rectangle(panelX, panelY, width, height, 0x000000, 0.72)
    addMenuBackdrop(this, 0.38)
    addMenuPanel(this, panelX, panelY, panelWidth, panelHeight)
    styleMenuHeading(this.add.text(panelX, top + 5, 'CONTROLS', { fontFamily: MENU_FONT_DISPLAY, fontSize: '14px', color: '#f5f8ff' }).setOrigin(0.5, 0))
    this.add.text(panelX, top + 24, 'PRESS-TO-BIND  ·  KEYBOARD AND PAD', { fontFamily: MENU_FONT_CODE, fontSize: '7px', color: '#5de1ff', letterSpacing: 2 }).setOrigin(0.5, 0)
    const headerY = top + 38
    this.add.text(left + 16, headerY, 'ACTION', { fontFamily: MENU_FONT_BODY, fontSize: '8px', fontStyle: 'bold', color: '#79e7ff' }).setOrigin(0, 0.5)
    ;['KEYBOARD', 'PAD'].forEach((title, index) => {
      this.add.text(columnX[index]!, headerY, title, { fontFamily: MENU_FONT_BODY, fontSize: '8px', fontStyle: 'bold', color: '#79e7ff' }).setOrigin(0.5)
    })
    this.add.rectangle(panelX, headerY + 6, panelWidth - 24, 1, MENU_COLORS.blue, 0.65)

    const rowStartY = headerY + 13
    this.cursor = this.add.rectangle(left + 9, rowStartY, 3, ROW_SPACING - 2, MENU_COLORS.cyan, 1)
    REMAP_ROWS.forEach((entry, index) => {
      const y = rowStartY + index * ROW_SPACING
      if (index % 2 === 0) this.add.rectangle(panelX, y, panelWidth - 24, ROW_SPACING - 1, 0x123259, 0.22)
      this.labels.push(this.add.text(left + 16, y, entry.label.toUpperCase(), { fontFamily: MENU_FONT_BODY, fontSize: '8px', fontStyle: 'bold', color: '#e8f3ff' }).setOrigin(0, 0.5))
      this.cells.push(DEVICES.map((_, column) => ({
        plate: this.add.rectangle(columnX[column]!, y, CELL_WIDTH, ROW_SPACING - 2, MENU_COLORS.panel, 0.5),
        text: this.add.text(columnX[column]!, y, '', { fontFamily: MENU_FONT_CODE, fontSize: '7px', color: '#9fd8ff' }).setOrigin(0.5)
      })))
    })
    const extraY = rowStartY + REMAP_ROWS.length * ROW_SPACING + 3
    ;['RESET TO DEFAULT', 'BACK'].forEach((label, index) => {
      this.labels.push(this.add.text(left + 16, extraY + index * ROW_SPACING, label, { fontFamily: MENU_FONT_BODY, fontSize: '8px', fontStyle: 'bold', color: '#e8f3ff' }).setOrigin(0, 0.5))
    })
    this.messageText = this.add.text(left + 214 + CELL_WIDTH / 2 + 4, extraY + 5, '', { fontFamily: MENU_FONT_CODE, fontSize: '7px', color: '#ffc857', align: 'center', wordWrap: { width: 250 } }).setOrigin(0.5)
    this.hintText = this.add.text(panelX, top + panelHeight - 8, '', { fontFamily: MENU_FONT_CODE, fontSize: '7px', color: '#8faed8' }).setOrigin(0.5)

    const actions = InputActions.forScene(this)
    actions.onPressed('aimUp', () => this.moveRow(-1))
    actions.onPressed('aimDown', () => this.moveRow(1))
    actions.onPressed('moveLeft', () => this.moveColumn(-1))
    actions.onPressed('moveRight', () => this.moveColumn(1))
    actions.onPressed('tutorial', () => { if (!this.listening) this.scene.restart({ returnSceneKey: this.returnSceneKey, firstRun: true }) })
    actions.onPadPressed((input) => this.onPadInput(input))
    bindMenuConfirmCancel(this, { onConfirm: () => this.activate(), onCancel: () => { if (!this.listening) this.close() } })
    const onKey = (event: KeyboardEvent) => this.onKey(event)
    window.addEventListener('keydown', onKey)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey))
    this.renderTable()
  }

  getDebugState() {
    const settings = Settings.get()
    return {
      firstRun: this.firstRun,
      row: this.row,
      column: this.column,
      listening: this.listening,
      message: this.message,
      conflicts: [...listConflicts(settings.bindings), ...listConflicts(settings.padBindings)],
      rows: REMAP_ROWS.map((entry, index) => ({
        action: entry.action,
        keyboard: settings.bindings[entry.action],
        pad: settings.padBindings[entry.action],
        shown: this.cells[index]?.map((cell) => cell.text.text) ?? []
      }))
    }
  }

  private bindings(device: RemapDevice): BindingTable {
    const settings = Settings.get()
    return device === 'keyboard' ? settings.bindings : settings.padBindings
  }

  private renderTable(): void {
    const conflicted = new Set(DEVICES.flatMap((device) =>
      listConflicts(this.bindings(device)).flatMap((conflict) => conflict.actions.map((action) => `${device}:${action}`))))
    REMAP_ROWS.forEach((entry, index) => {
      DEVICES.forEach((device, column) => {
        const cell = this.cells[index]![column]!
        const selected = index === this.row && column === this.column
        const listening = selected && this.listening !== null
        cell.plate.setFillStyle(selected ? MENU_COLORS.panelBright : MENU_COLORS.panel, selected ? 0.95 : 0.5)
        cell.plate.setStrokeStyle(1, conflicted.has(`${device}:${entry.action}`) ? MENU_COLORS.danger : MENU_COLORS.cyan, selected || conflicted.has(`${device}:${entry.action}`) ? 0.9 : 0)
        cell.text.setText(listening ? (device === 'keyboard' ? 'PRESS A KEY' : 'PRESS A BUTTON') : bindingText(device, this.bindings(device)[entry.action]))
        cell.text.setColor(listening ? '#ffc857' : conflicted.has(`${device}:${entry.action}`) ? '#ff6b77' : selected ? '#ffffff' : '#9fd8ff')
      })
    })
    this.labels.forEach((label, index) => label.setColor(index === this.row ? '#ffffff' : '#c8dcf8'))
    const label = this.labels[this.row]
    if (label && this.cursor) this.cursor.setPosition(label.x - 7, label.y)
    this.messageText?.setText(this.message)
    const onAction = this.row < REMAP_ROWS.length
    this.hintText?.setText(
      this.listening ? `${this.listening.device === 'keyboard' ? 'PRESS THE NEW KEY   BACKSPACE CANCELS' : 'PRESS THE NEW BUTTON'}   ${LISTEN_TIMEOUT_MS / 1000}S TO KEEP THE OLD ONE`
        : onAction ? 'ENTER / A REBIND   LEFT / RIGHT COLUMN   ESC / B BACK   T FIRST-RUN PAGE'
          : EXTRA_ROWS[this.row - REMAP_ROWS.length] === 'reset' ? 'ENTER / A RESET KEYBOARD AND PAD   ESC / B BACK'
            : 'UP / DOWN PICK AN ACTION TO REBIND   ENTER / A BACK   T FIRST-RUN PAGE'
    )
  }

  private moveRow(delta: number): void {
    if (this.listening) return
    const count = REMAP_ROWS.length + EXTRA_ROWS.length
    this.row = (this.row + delta + count) % count
    AudioService.playSfx('ui_move')
    this.renderTable()
  }

  private moveColumn(delta: number): void {
    if (this.listening || this.row >= REMAP_ROWS.length) return
    this.column = Math.max(0, Math.min(DEVICES.length - 1, this.column + delta))
    AudioService.playSfx('ui_move')
    this.renderTable()
  }

  private activate(): void {
    if (this.listening) return
    if (this.row < REMAP_ROWS.length) {
      this.listening = { device: DEVICES[this.column]!, action: REMAP_ROWS[this.row]!.action }
      this.message = ''
      this.listenTimer?.remove(false)
      this.listenTimer = this.time.delayedCall(LISTEN_TIMEOUT_MS, () => this.stopListening('NOTHING PRESSED: BINDING KEPT'))
      this.renderTable()
      return
    }
    if (EXTRA_ROWS[this.row - REMAP_ROWS.length] === 'reset') {
      Settings.update({ bindings: DEFAULT_BINDINGS, padBindings: DEFAULT_PAD_BINDINGS })
      this.message = 'KEYBOARD AND PAD DEFAULTS RESTORED'
      this.renderTable()
      return
    }
    this.close()
  }

  private onKey(event: KeyboardEvent): void {
    if (event.repeat || this.listening?.device !== 'keyboard') return
    event.preventDefault()
    if (event.code === 'Backspace') { this.stopListening('BINDING KEPT'); return }
    if (!isBindableKey(event.code)) { this.message = 'THAT KEY CANNOT BE BOUND'; this.renderTable(); return }
    this.bind('keyboard', event.code)
  }

  private onPadInput(input: PadInput): void {
    if (this.listening?.device === 'pad') this.bind('pad', input)
  }

  private bind(device: RemapDevice, input: string): void {
    const action = this.listening!.action
    const settings = Settings.get()
    let message: string
    if (device === 'keyboard') {
      const result = rebind(settings.bindings, action, input)
      Settings.update({ bindings: result.bindings })
      message = rebindMessage(device, action, input, result)
    } else {
      const result = rebind<PadInput>(settings.padBindings, action, input as PadInput)
      Settings.update({ padBindings: result.bindings })
      message = rebindMessage(device, action, input, result)
    }
    AudioService.playSfx('ui_confirm')
    this.stopListening(message)
  }

  private stopListening(message: string): void {
    this.listening = null
    this.listenTimer?.remove(false)
    this.listenTimer = undefined
    this.message = message
    // The press that bound (or cancelled) is still held: drop its latched edge so it does not also confirm or back out.
    InputActions.forScene(this).reset()
    this.renderTable()
  }

  private renderFirstRun(next?: { key: string; data: object }): void {
    const { width, height } = GAME_SIZE
    const panelX = Math.round(width / 2)
    this.add.rectangle(panelX, height / 2, width, height, 0x000000, 0.72)
    addMenuBackdrop(this, 0.38)
    addMenuPanel(this, panelX, height / 2, 320, 228)
    styleMenuHeading(this.add.text(panelX, 22, 'EIGHT KEYS', { fontFamily: MENU_FONT_DISPLAY, fontSize: '16px', color: '#f5f8ff' }).setOrigin(0.5).setName('first-run-heading'))
    this.add.text(panelX, 40, 'FIRST FLIGHT  ·  REPLAY IT FROM THE CONTROL MAP (T)', { fontFamily: MENU_FONT_CODE, fontSize: '7px', color: '#5de1ff', letterSpacing: 1 }).setOrigin(0.5)
    firstRunRows().forEach((row, index) => {
      const y = 60 + index * 18
      this.add.rectangle(panelX, y, 288, 15, index % 2 === 0 ? 0x123259 : MENU_COLORS.panelBright, 0.3)
      this.add.text(panelX - 136, y, row.action.toUpperCase(), { fontFamily: MENU_FONT_BODY, fontSize: '9px', fontStyle: 'bold', color: '#e8f3ff' }).setOrigin(0, 0.5)
      this.add.text(panelX + 136, y, row.input, { fontFamily: MENU_FONT_CODE, fontSize: '8px', color: '#9fd8ff' }).setOrigin(1, 0.5)
    })
    this.add.text(panelX, 220, next ? 'ENTER  CONTINUE' : 'ENTER / ESC  BACK', {
      fontFamily: MENU_FONT_BODY, fontSize: '9px', fontStyle: 'bold', color: '#f5f8ff', backgroundColor: '#164b7c', padding: { x: 12, y: 4 }
    }).setOrigin(0.5)
    const done = () => {
      if (!next) { this.scene.restart({ returnSceneKey: this.returnSceneKey }); return }
      Profiles.markControlsSeen()
      this.scene.start(next.key, next.data)
    }
    bindMenuConfirmCancel(this, { onConfirm: done, onCancel: done })
  }

  private close(): void {
    const target = this.returnSceneKey
    this.scene.stop()
    if (target && this.scene.manager.keys[target]) {
      this.scene.resume(target)
    }
  }
}

export default ControlsScene
