import Phaser from 'phaser'
import AudioService from '../audio'
import InputActions from '../input/InputActions'
import { GAME_SIZE } from '../config/renderPolicy'
import { Profiles } from '../systems/Save'
import {
  activateNameCell,
  moveNameCursor,
  NAME_GRID,
  nameEntryCell,
  nameEntryKey,
  startNameEntry,
  type NameEntryResult,
  type NameEntryState,
  type ProfileSlot
} from '../progression/profiles'
import { addMenuBackdrop, addMenuPanel, MENU_COLORS, MENU_FONT_BODY, MENU_FONT_CODE, MENU_FONT_DISPLAY, styleMenuHeading } from '../ui/menu/menuTheme'
import { openNewCampaign } from './NewCampaignScene'
import { resumeActiveSlot } from './Title'

type Mode = 'slots' | 'used' | 'name'
const USED_CHOICES = ['LOAD', 'OVERWRITE', 'BACK'] as const
/** Keys the DOM handler owns; the action hub's confirm and cancel ignore the same press. */
const KEYBOARD_GUARD_MS = 300

/**
 * Title -> NEW GAME: the slot picker (three cards), then the pilot name, then `NewCampaignScene`
 * (prompt 05 5.6). Export and import live on the cards. The pending pilot is committed only when the
 * campaign starts, so backing out never touches a slot.
 */
export class ProfileScene extends Phaser.Scene {
  mode: Mode = 'slots'
  cursor = 0
  choice = 0
  entry: NameEntryState = startNameEntry()
  status = ''
  private layer?: Phaser.GameObjects.Container
  private keyHandler?: (event: KeyboardEvent) => void
  private keyboardAt = -Infinity

  constructor() {
    super('Profiles')
  }

  create(): void {
    this.mode = 'slots'
    this.choice = 0
    this.status = ''
    this.entry = startNameEntry()
    this.layer = undefined
    this.cursor = Profiles.activeSlot() - 1
    const { width, height } = GAME_SIZE
    this.cameras.main.setBackgroundColor('#030711')
    addMenuBackdrop(this, 0.5)
    addMenuPanel(this, width / 2, height / 2, width - 20, height - 18, 0.9)
    const actions = InputActions.forScene(this)
    actions.onPressed('moveLeft', () => this.pad(-1, 0))
    actions.onPressed('moveRight', () => this.pad(1, 0))
    actions.onPressed('aimUp', () => this.pad(0, -1))
    actions.onPressed('aimDown', () => this.pad(0, 1))
    actions.onPressed('confirm', () => { if (!this.keyboardOwned()) this.confirm() })
    actions.onPressed('cancel', () => { if (!this.keyboardOwned()) this.back() })
    this.keyHandler = (event: KeyboardEvent) => this.onKey(event)
    window.addEventListener('keydown', this.keyHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler) })
    const onResume = () => this.render()
    this.events.on(Phaser.Scenes.Events.RESUME, onResume)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, onResume))
    this.render()
  }

  getDebugState(): { mode: Mode; slot: ProfileSlot; choice: string | null; name: string; cell: string; status: string } {
    return { mode: this.mode, slot: this.slot(), choice: this.mode === 'used' ? USED_CHOICES[this.choice] ?? null : null, name: this.entry.name, cell: nameEntryCell(this.entry), status: this.status }
  }

  private slot(): ProfileSlot {
    return (this.cursor + 1) as ProfileSlot
  }

  private keyboardOwned(): boolean {
    return this.mode === 'name' && performance.now() - this.keyboardAt < KEYBOARD_GUARD_MS
  }

  private pad(dx: number, dy: number): void {
    AudioService.playSfx('ui_move')
    if (this.mode === 'slots') this.cursor = (this.cursor + dx + 3) % 3
    else if (this.mode === 'used') this.choice = (this.choice + dx + USED_CHOICES.length) % USED_CHOICES.length
    else this.entry = moveNameCursor(this.entry, dx, dy)
    this.render()
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.scene.isActive()) return
    if (this.mode === 'name') {
      if (event.key === 'Escape') { this.keyboardAt = performance.now(); this.back(); return }
      const result = nameEntryKey(this.entry, event.key)
      if (!result) return
      this.keyboardAt = performance.now()
      event.preventDefault()
      this.applyName(result)
      return
    }
    if (this.mode !== 'slots' || event.repeat) return
    const key = event.key.toLowerCase()
    if (key === 'e') this.exportSlot()
    else if (key === 'i') this.importSlot()
  }

  private confirm(): void {
    AudioService.playSfx('ui_confirm')
    if (this.mode === 'name') { this.applyName(activateNameCell(this.entry)); return }
    const card = Profiles.cards()[this.cursor]
    if (this.mode === 'slots') {
      if (!card || card.empty) this.openName()
      else { this.mode = 'used'; this.choice = 0; this.render() }
      return
    }
    const picked = USED_CHOICES[this.choice]
    if (picked === 'LOAD') this.loadSlot()
    else if (picked === 'OVERWRITE') this.openName()
    else { this.mode = 'slots'; this.render() }
  }

  private back(): void {
    AudioService.playSfx('ui_cancel')
    if (this.mode === 'slots') { this.scene.start('Title'); return }
    this.mode = 'slots'
    this.status = ''
    this.render()
  }

  private openName(): void {
    this.mode = 'name'
    this.status = ''
    this.entry = startNameEntry()
    this.render()
  }

  private applyName(result: NameEntryResult): void {
    if (result.kind === 'edit') { this.entry = result.state; this.status = ''; this.render(); return }
    if (result.kind === 'invalid') { this.status = `NAME: ${result.reason.toUpperCase()}`; this.render(); return }
    Profiles.beginNew(this.slot(), result.name)
    openNewCampaign(this, () => Profiles.cancelPending())
  }

  /** LOAD: a started campaign resumes; a slot that never started goes through NEW CAMPAIGN with its pilot. */
  private loadSlot(): void {
    Profiles.select(this.slot())
    const meta = Profiles.active()
    if (meta?.campaignStarted) { resumeActiveSlot(this); return }
    Profiles.beginNew(this.slot(), meta?.pilotName ?? 'WREN')
    openNewCampaign(this, () => Profiles.cancelPending())
  }

  private exportSlot(): void {
    const file = Profiles.exportSlot(this.slot())
    if (!file) { this.status = 'EMPTY SLOT: NOTHING TO EXPORT'; this.render(); return }
    const url = URL.createObjectURL(new Blob([file.text], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = file.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    this.status = `EXPORTED ${file.fileName.toUpperCase()}`
    this.render()
  }

  private importSlot(): void {
    const slot = this.slot()
    if (!Profiles.cards()[this.cursor]?.empty) { this.status = 'IMPORT INTO AN EMPTY SLOT'; this.render(); return }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.style.display = 'none'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) return
      void file.text().then((text) => {
        const result = Profiles.importSlot(slot, text)
        this.status = result.ok ? `IMPORTED ${result.pilotName} INTO SLOT ${slot}` : `IMPORT REFUSED: ${result.reason.toUpperCase()}`
        if (this.scene.isActive()) this.render()
      })
    })
    input.click()
  }

  private text(x: number, y: number, value: string, size: number, color: string, font = MENU_FONT_CODE): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, value, { fontFamily: font, fontSize: `${size}px`, color }).setOrigin(0.5)
    this.layer?.add(text)
    return text
  }

  private render(): void {
    this.layer?.destroy()
    this.layer = this.add.container(0, 0)
    const { width } = GAME_SIZE
    const heading = this.mode === 'name' ? `PILOT NAME  ·  SLOT ${this.slot()}` : 'PILOT SLOTS'
    this.layer.add(styleMenuHeading(this.add.text(width / 2, 22, heading, { fontFamily: MENU_FONT_DISPLAY, fontSize: '16px', color: '#f5f8ff' }).setOrigin(0.5)))
    if (this.mode === 'name') this.renderName()
    else this.renderSlots()
    this.text(width / 2, 232, this.status, 8, '#ffd27a')
  }

  private renderSlots(): void {
    const { width } = GAME_SIZE
    Profiles.cards().forEach((card, index) => {
      const x = width / 2 + (index - 1) * 142
      const selected = index === this.cursor
      this.layer?.add(this.add.rectangle(x, 108, 132, 116, selected ? MENU_COLORS.panelBright : 0x081a34, selected ? 0.98 : 0.8)
        .setStrokeStyle(selected ? 2 : 1, selected ? MENU_COLORS.cyan : MENU_COLORS.blue, selected ? 1 : 0.5))
      this.text(x, 60, `SLOT ${card.slot}${card.slot === Profiles.activeSlot() && !card.empty ? '  ·  ACTIVE' : ''}`, 7, '#5de1ff')
      this.text(x, 84, card.pilotName, 15, card.empty ? '#6f86a8' : '#f5f8ff', MENU_FONT_BODY).setFontStyle('bold').setName(`profile-card-${card.slot}`)
      if (!card.empty) {
        this.text(x, 110, `WARDENS ${card.wardensCleared}/${card.wardensTotal}`, 9, '#d9edff')
        this.text(x, 126, `TIME ${card.playTime}`, 9, '#d9edff')
        this.text(x, 142, (card.difficulty ?? 'normal').toUpperCase(), 8, '#9fd8ff')
      }
    })
    if (this.mode === 'used') {
      const card = Profiles.cards()[this.cursor]
      this.layer?.add(this.add.rectangle(width / 2, 186, 300, 34, 0x06142a, 0.98).setStrokeStyle(1, MENU_COLORS.cyan, 0.8))
      this.text(width / 2, 177, `SLOT ${this.slot()}  ·  ${card?.pilotName ?? ''}`, 8, '#a9c9f2')
      USED_CHOICES.forEach((label, index) => this.text(width / 2 + (index - 1) * 90, 193, index === this.choice ? `> ${label} <` : label, 10, index === this.choice ? '#5de1ff' : '#a9c9f2', MENU_FONT_BODY))
      this.text(width / 2, 214, 'LEFT / RIGHT CHOOSE   ENTER CONFIRM   ESC BACK', 7, '#8faed8')
      return
    }
    this.text(width / 2, 184, 'LEFT / RIGHT CHOOSE    ENTER SELECT    ESC BACK', 8, '#a9c9f2')
    this.text(width / 2, 200, 'E  EXPORT SLOT      I  IMPORT INTO AN EMPTY SLOT', 8, '#a9c9f2')
  }

  private renderName(): void {
    const { width } = GAME_SIZE
    this.layer?.add(this.add.rectangle(width / 2, 58, 200, 28, 0x06142a, 0.98).setStrokeStyle(1, MENU_COLORS.cyan, 0.8))
    this.text(width / 2, 58, `${this.entry.name}${this.entry.name.length < 10 ? '_' : ''}`, 16, this.entry.pristine ? '#9fb3cc' : '#f5f8ff', MENU_FONT_BODY).setFontStyle('bold').setName('profile-name')
    const cellW = 30
    const left = width / 2 - (cellW * 10) / 2 + cellW / 2
    NAME_GRID.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      const x = left + colIndex * cellW
      const y = 94 + rowIndex * 22
      const selected = rowIndex === this.entry.row && colIndex === this.entry.col
      if (selected) this.layer?.add(this.add.rectangle(x, y, cellW - 4, 18, MENU_COLORS.panelBright, 1).setStrokeStyle(1, MENU_COLORS.cyan, 1))
      this.text(x, y, cell === 'SPACE' ? 'SPC' : cell, cell.length > 1 ? 8 : 11, selected ? '#ffffff' : '#a9c9f2', MENU_FONT_BODY)
    }))
    this.text(width / 2, 190, 'TYPE A NAME, OR PICK LETTERS WITH THE ARROWS AND ENTER', 7, '#a9c9f2')
    this.text(width / 2, 204, 'ENTER CONFIRM  ·  BACKSPACE ERASE  ·  ESC BACK  ·  2 TO 10 OF A-Z, 0-9, SPACE', 7, '#8faed8')
  }
}

export default ProfileScene
