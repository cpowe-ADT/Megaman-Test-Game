import Phaser from 'phaser'
import { ORDERED_BOSSES } from '../bosses/roster'
import { DEBUG_UI } from '../config/debug'
import { inputActions } from '../input/InputActions'
import { StageSelectLogic } from './stage-select/StageSelectLogic'
import { DebugOverlay } from '../ui/DebugOverlay'

type SlotEntry = {
  rect: Phaser.GameObjects.Rectangle
  name: Phaser.GameObjects.Text
  element: Phaser.GameObjects.Text
  bossIndex: number | null
}

/**
 * Stage select layout guidelines:
 * 1. Always verify copy will fit inside its slot or preview panel before rendering.
 * 2. Auto-resize text when it exceeds its container and then reflow it with generous spacing.
 * 3. Keep a minimum 6px rhythm between stacked lines so captions never collide with borders.
 */
export class StageSelect extends Phaser.Scene {
  private index = 0
  private currentPage = 0
  private slots: Phaser.Math.Vector2[] = []
  private slotEntries: SlotEntry[] = []
  private cursor?: Phaser.GameObjects.Rectangle
  private bossNameText?: Phaser.GameObjects.Text
  private elementText?: Phaser.GameObjects.Text
  private infoText?: Phaser.GameObjects.Text
  private previewTitle?: Phaser.GameObjects.Text
  private previewDescription?: Phaser.GameObjects.Text
  private pageIndicator?: Phaser.GameObjects.Text
  private debugOverlay?: DebugOverlay
  private readonly logic = new StageSelectLogic()
  private requestedTransition: { scene: string; data: unknown } | null = null
  private readonly columns = 3
  private readonly rows = 3
  private readonly pageSize = this.columns * this.rows
  private panelWidth = 140
  private cellWidth = 0
  private readonly cellHeight = 56
  private previewPanelBounds?: { top: number; height: number; width: number; x: number }
  private snap(value: number): number {
    return Math.round(value)
  }

  constructor() {
    super('StageSelect')
  }

  create(): void {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#06090f')

    this.createBackdrop(width, height)
    this.createHeader(width)
    this.createPreviewPanel(width, height)
    this.drawGrid(width, height)
    this.createFooter(width, height)

    this.cursor = this.add
      .rectangle(0, 0, this.cellWidth - 14, this.cellHeight - 18)
      .setStrokeStyle(3, 0xffffff, 0.9)
      .setFillStyle(0xffffff, 0)
      .setDepth(3)

    this.refreshPage()
    this.updateCursor()
    this.updatePreview()
    this.logic.setIndex(this.index)

    this.registerKeyboardShortcuts()

    if (this.input.keyboard) {
      inputActions.initialize(this.input.keyboard)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => inputActions.release(this.input.keyboard!))
    }

    if (DEBUG_UI) {
      this.debugOverlay = new DebugOverlay(this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.debugOverlay?.destroy())
    }
  }

  update(): void {
    if (this.input.keyboard) {
      inputActions.updateFrameClock(this.game.loop.now)
    }

    if (inputActions.isPressed('toggleDebug')) {
      this.debugOverlay?.toggle()
    }

    if (inputActions.isPressed('confirm')) {
      this.confirm()
    }

    const pendingTransition = this.requestedTransition

    if (DEBUG_UI) {
      const snapshot = inputActions.getSnapshot()
      const info = `Scene=StageSelect | LastKey=${snapshot?.lastKey ?? '--'} | Transition=${
        pendingTransition ? JSON.stringify(pendingTransition) : 'none'
      }`
      // eslint-disable-next-line no-console
      console.debug(`[debug] ${info}`)
      this.debugOverlay?.update({
        scene: this.scene.key,
        lastKey: snapshot?.lastKey ?? null,
        transition: pendingTransition ? pendingTransition.scene : null,
        confirmHint: 'Enter / NumpadEnter',
        jumpHint: 'Space (gameplay)',
        paused: false
      })
    }

    if (pendingTransition) {
      this.requestedTransition = null
      this.scene.start(pendingTransition.scene, pendingTransition.data)
    }
  }

  private createBackdrop(width: number, height: number): void {
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x0d1424)
      .setAlpha(0.95)

    this.add
      .rectangle(width / 2, height / 2, width, height, 0x1a2847)
      .setAlpha(0.35)

    this.add
      .rectangle(width / 2, height - 48, width, 96, 0x03060c)
      .setAlpha(0.35)
  }

  private createHeader(width: number): void {
    this.add
      .rectangle(width / 2, 48, width - 64, 84, 0x101c33, 0.88)
      .setStrokeStyle(2, 0x3a75c4, 0.6)

    this.add
      .text(width / 2, 30, 'MISSION SELECT', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffffff',
        letterSpacing: 2
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 68, 'Choose a Maverick to infiltrate their stronghold', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#8fb8ff'
      })
      .setOrigin(0.5)
  }

  private createPreviewPanel(width: number, height: number): void {
    const maxPanelWidth = Math.max(120, width - 96 - this.columns * 60)
    const desiredPanelWidth = Phaser.Math.Clamp(width * 0.36, 120, 168)
    this.panelWidth = this.snap(Math.min(desiredPanelWidth, maxPanelWidth))
    const panelHeight = height - 72
    const panelX = this.snap(width - this.panelWidth / 2 - 28)
    const panelY = this.snap(height / 2 + 6)
    const panelTop = this.snap(panelY - panelHeight / 2)

    this.add
      .rectangle(panelX, panelY, this.panelWidth, panelHeight, 0x0c1324, 0.9)
      .setStrokeStyle(2, 0x3a75c4, 0.6)

    const titleY = this.snap(panelTop + 16)
    this.previewPanelBounds = { top: panelTop, height: panelHeight, width: this.panelWidth, x: panelX }

    this.previewTitle = this.add
      .text(panelX, titleY, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#8fb8ff',
        align: 'center',
        wordWrap: { width: this.panelWidth - 24 }
      })
      .setOrigin(0.5, 0)
    this.registerSizing(this.previewTitle, 11)

    const nameY = this.snap(titleY + 32)
    this.bossNameText = this.add
      .text(panelX, nameY, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5, 0)
    this.registerSizing(this.bossNameText, 12)

    const elementY = this.snap(nameY + 24)
    this.elementText = this.add
      .text(panelX, elementY, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#9ad'
      })
      .setOrigin(0.5, 0)
    this.registerSizing(this.elementText, 10)

    const descriptionY = this.snap(elementY + 24)
    this.previewDescription = this.add
      .text(panelX, descriptionY, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#c7d8ff',
        align: 'center',
        wordWrap: { width: this.panelWidth - 24 }
      })
      .setOrigin(0.5, 0)
    this.registerSizing(this.previewDescription, 9)

    const infoTop = this.snap(panelY + panelHeight / 2 - 52)
    this.infoText = this.add
      .text(panelX, infoTop, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#cbd3ff',
        align: 'center',
        wordWrap: { width: this.panelWidth - 24 }
      })
      .setOrigin(0.5, 0)
    this.registerSizing(this.infoText, 9)
  }

  private drawGrid(width: number, height: number): void {
    const gridWidth = width - this.panelWidth - 96
    const computedCellWidth = Math.floor(gridWidth / this.columns)
    this.cellWidth = Math.max(56, computedCellWidth)
    const horizontalPadding = this.snap((gridWidth - this.cellWidth * this.columns) / 2)
    const startX = this.snap(44 + horizontalPadding + this.cellWidth / 2)
    const gridHeight = this.rows * this.cellHeight
    const startY = this.snap(height / 2 - gridHeight / 2 + 12)

    this.slots = []
    this.slotEntries = []

    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.columns; col += 1) {
        const slotIndex = row * this.columns + col
        const x = this.snap(startX + col * this.cellWidth)
        const y = this.snap(startY + row * this.cellHeight)

        const rect = this.add
          .rectangle(x, y, this.cellWidth - 18, this.cellHeight - 20, 0x1a2847, 0.28)
          .setStrokeStyle(2, 0x3a75c4, 0.5)
          .setData('slotIndex', slotIndex)
          .setInteractive({ useHandCursor: true })

        rect.on('pointerover', () => this.onSlotHover(slotIndex))
        rect.on('pointerdown', () => this.confirm())

        const name = this.add
          .text(x, y - 12, '', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffffff',
            fontStyle: 'bold',
            align: 'center'
          })
          .setOrigin(0.5, 0)
        this.registerSizing(name, 11)

        const element = this.add
          .text(x, y + 8, '', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#9ad'
          })
          .setOrigin(0.5, 0)
        this.registerSizing(element, 9)

        this.slots.push(new Phaser.Math.Vector2(x, y))
        this.slotEntries.push({ rect, name, element, bossIndex: null })
      }
    }
  }

  private createFooter(width: number, height: number): void {
    const footerY = height - 28

    this.add
      .rectangle(width / 2, footerY, width - 160, 44, 0x091020, 0.8)
      .setStrokeStyle(1, 0x3a75c4, 0.4)

    this.add
      .text(width / 2, footerY - 10, '← ↑ → ↓ NAVIGATE   •   ENTER START   •   Q / E CHANGE PAGE', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9acbff',
        align: 'center'
      })
      .setOrigin(0.5)

    this.pageIndicator = this.add
      .text(width / 2, footerY + 12, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#8fb8ff'
      })
      .setOrigin(0.5)
  }

  private registerKeyboardShortcuts(): void {
    const keyboard = this.input.keyboard
    if (!keyboard) {
      return
    }

    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)?.on('down', () => this.move(-1))
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)?.on('down', () => this.move(1))
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)?.on('down', () => this.move(-this.columns))
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)?.on('down', () => this.move(this.columns))
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)?.on('down', () => this.changePage(-1))
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)?.on('down', () => this.changePage(1))
  }

  private onSlotHover(slotIndex: number): void {
    const slot = this.slotEntries[slotIndex]
    if (!slot || slot.bossIndex == null || slot.bossIndex === this.index) {
      return
    }
    this.index = slot.bossIndex
    this.logic.setIndex(this.index)
    this.updateCursor()
    this.updatePreview()
  }

  private move(delta: number): void {
    const total = ORDERED_BOSSES.length
    this.index = (this.index + delta + total) % total
    this.logic.setIndex(this.index)
    this.updateCursor()
    this.updatePreview()
  }

  private ensurePageForIndex(): void {
    const targetPage = Math.floor(this.index / this.pageSize)
    if (targetPage !== this.currentPage) {
      this.currentPage = targetPage
      this.refreshPage()
    }
  }

  private refreshPage(): void {
    const bosses = ORDERED_BOSSES
    const totalPages = Math.max(1, Math.ceil(bosses.length / this.pageSize))
    this.currentPage = Phaser.Math.Clamp(this.currentPage, 0, totalPages - 1)
    const start = this.currentPage * this.pageSize

    this.slotEntries.forEach((slot, slotIndex) => {
      const entry = bosses[start + slotIndex]
      if (!entry) {
        slot.bossIndex = null
        slot.rect.setVisible(false).disableInteractive()
        slot.name.setVisible(false)
        slot.element.setVisible(false)
        return
      }

      slot.bossIndex = start + slotIndex
      slot.rect
        .setVisible(true)
        .setStrokeStyle(2, entry.blueprint.theme.primary, 0.9)
        .setFillStyle(entry.blueprint.theme.primary, 0.2)
        .setInteractive({ useHandCursor: true })
      slot.name.setVisible(true).setText(entry.blueprint.codename)
      slot.element.setVisible(true).setText(entry.blueprint.element.toUpperCase())
      this.layoutSlotEntry(slot)
    })

    this.pageIndicator?.setText(`Page ${this.currentPage + 1} / ${totalPages}`)
  }

  private updateCursor(): void {
    this.ensurePageForIndex()
    if (!this.cursor) {
      return
    }

    const slotIndex = this.slotEntries.findIndex((slot) => slot.bossIndex === this.index)
    if (slotIndex === -1) {
      this.cursor.setVisible(false)
      return
    }

    const slotPosition = this.slots[slotIndex]
    if (!slotPosition) {
      this.cursor.setVisible(false)
      return
    }

    this.cursor.setVisible(true)
    this.cursor.setPosition(this.snap(slotPosition.x), this.snap(slotPosition.y))
    this.refreshInfo()
  }

  private changePage(delta: number): void {
    const totalPages = Math.max(1, Math.ceil(ORDERED_BOSSES.length / this.pageSize))
    this.currentPage = (this.currentPage + delta + totalPages) % totalPages

    const start = this.currentPage * this.pageSize
    const end = Math.min(start + this.pageSize - 1, ORDERED_BOSSES.length - 1)
    this.index = Phaser.Math.Clamp(this.index, start, end)
    this.logic.setIndex(this.index)

    this.refreshPage()
    this.updateCursor()
    this.updatePreview()
  }

  private confirm(): void {
    this.logic.setIndex(this.index)
    const transition = this.logic.confirm()
    if (!transition) {
      return
    }

    this.requestedTransition = { scene: transition.scene, data: transition.data }
    if (!DEBUG_UI) {
      // Immediately start the scene when debug overlay isn't intercepting for display.
      const pending = this.requestedTransition
      this.requestedTransition = null
      this.scene.start(pending.scene, pending.data)
    }
  }

  private refreshInfo(): void {
    const entry = ORDERED_BOSSES[this.index]
    if (!entry || !this.bossNameText || !this.elementText || !this.infoText) {
      return
    }

    const blueprint = entry.blueprint
    const reward = blueprint.weaponReward

    this.bossNameText.setText(blueprint.codename)
    this.elementText.setText(
      `Type: ${blueprint.element}  •  Weak: ${entry.weakTo}  •  Resists: ${entry.strongAgainst}`
    )
    this.infoText.setText(`Arena: ${blueprint.arena}\nWeapon: ${reward.displayName}\n${reward.description}`)

    this.layoutPreviewPanel()
  }

  private updatePreview(): void {
    const entry = ORDERED_BOSSES[this.index]
    if (!entry || !this.previewTitle || !this.previewDescription) {
      return
    }

    const { blueprint } = entry
    this.previewTitle.setText(blueprint.introCallout)
    this.previewDescription.setText(
      `Profile: ${blueprint.movementProfile.mobilityNotes}\nReward Tip: ${blueprint.weaponReward.tutorial}`
    )

    this.layoutPreviewPanel()
  }

  private registerSizing(text: Phaser.GameObjects.Text, minFontSize: number): void {
    if (!text.getData('baseFontSize')) {
      text.setData('baseFontSize', this.getCurrentFontSize(text))
    }
    text.setData('minFontSize', minFontSize)
  }

  private getCurrentFontSize(text: Phaser.GameObjects.Text): number {
    const raw = text.style.fontSize
    if (typeof raw === 'number') {
      return raw
    }
    const parsed = parseFloat(raw ?? '12')
    return Number.isFinite(parsed) ? parsed : 12
  }

  private getBaseFontSize(text: Phaser.GameObjects.Text): number {
    const stored = text.getData('baseFontSize')
    if (typeof stored === 'number') {
      return stored
    }
    const current = this.getCurrentFontSize(text)
    text.setData('baseFontSize', current)
    return current
  }

  private getMinFontSize(text: Phaser.GameObjects.Text): number {
    const stored = text.getData('minFontSize')
    return typeof stored === 'number' ? stored : 8
  }

  private restoreBaseFontSize(text: Phaser.GameObjects.Text): void {
    text.setFontSize(this.getBaseFontSize(text))
  }

  private fitTextWithinBounds(
    text: Phaser.GameObjects.Text,
    maxWidth: number,
    maxHeight?: number
  ): void {
    this.restoreBaseFontSize(text)

    const minFont = this.getMinFontSize(text)
    let guard = 0
    while (guard < 24 && text.displayWidth > maxWidth && this.getCurrentFontSize(text) > minFont) {
      text.setFontSize(this.getCurrentFontSize(text) - 1)
      guard += 1
    }

    if (typeof maxHeight === 'number') {
      guard = 0
      while (guard < 24 && text.displayHeight > maxHeight && this.getCurrentFontSize(text) > minFont) {
        text.setFontSize(this.getCurrentFontSize(text) - 1)
        guard += 1
      }
    }
  }

  private shrinkText(text: Phaser.GameObjects.Text, maxWidth: number): boolean {
    const minFont = this.getMinFontSize(text)
    const current = this.getCurrentFontSize(text)
    if (current <= minFont) {
      return false
    }

    text.setFontSize(current - 1)

    let guard = 0
    while (guard < 24 && text.displayWidth > maxWidth && this.getCurrentFontSize(text) > minFont) {
      text.setFontSize(this.getCurrentFontSize(text) - 1)
      guard += 1
    }

    return true
  }

  private positionPreviewTexts(
    bounds: { top: number; height: number; width: number; x: number },
    topPadding: number,
    spacing: { tight: number; standard: number; roomy: number }
  ): number {
    if (!this.previewTitle || !this.bossNameText || !this.elementText || !this.previewDescription || !this.infoText) {
      return bounds.top
    }

    let cursorY = bounds.top + topPadding

    const applyPosition = (
      text: Phaser.GameObjects.Text,
      additionalSpacing: number
    ): void => {
      text.setX(bounds.x)
      text.setY(this.snap(cursorY))
      cursorY += text.displayHeight + additionalSpacing
    }

    applyPosition(this.previewTitle, spacing.standard)
    applyPosition(this.bossNameText, spacing.tight)
    applyPosition(this.elementText, spacing.standard)
    applyPosition(this.previewDescription, spacing.roomy)
    applyPosition(this.infoText, 0)

    return cursorY
  }

  private layoutPreviewPanel(): void {
    if (
      !this.previewPanelBounds ||
      !this.previewTitle ||
      !this.bossNameText ||
      !this.elementText ||
      !this.previewDescription ||
      !this.infoText
    ) {
      return
    }

    const bounds = this.previewPanelBounds
    const innerWidth = bounds.width - 24

    this.fitTextWithinBounds(this.previewTitle, innerWidth, 48)
    this.fitTextWithinBounds(this.bossNameText, innerWidth, 40)
    this.fitTextWithinBounds(this.elementText, innerWidth, 32)
    this.fitTextWithinBounds(this.previewDescription, innerWidth, bounds.height * 0.35)
    this.fitTextWithinBounds(this.infoText, innerWidth, bounds.height * 0.32)

    const spacing = { tight: 6, standard: 12, roomy: 16 }
    let iterations = 0
    const maxBottom = bounds.top + bounds.height - 16

    while (iterations < 12) {
      const contentBottom = this.positionPreviewTexts(bounds, 16, spacing)
      if (contentBottom <= maxBottom) {
        break
      }

      if (this.shrinkText(this.infoText, innerWidth)) {
        iterations += 1
        continue
      }

      if (this.shrinkText(this.previewDescription, innerWidth)) {
        iterations += 1
        continue
      }

      break
    }

    this.positionPreviewTexts(bounds, 16, spacing)
  }

  private layoutSlotEntry(slot: SlotEntry): void {
    const { rect, name, element } = slot
    const innerWidth = this.cellWidth - 28

    this.fitTextWithinBounds(name, innerWidth, this.cellHeight / 2)
    this.fitTextWithinBounds(element, innerWidth, this.cellHeight / 2)

    const spacing = 6
    const totalHeight = name.displayHeight + spacing + element.displayHeight
    const topY = rect.y - totalHeight / 2

    name.setX(rect.x)
    name.setY(this.snap(topY))

    element.setX(rect.x)
    element.setY(this.snap(topY + name.displayHeight + spacing))
  }
}
