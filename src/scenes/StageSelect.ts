import Phaser from 'phaser'
import { ORDERED_BOSSES } from '../bosses/roster'

type SlotEntry = {
  rect: Phaser.GameObjects.Rectangle
  name: Phaser.GameObjects.Text
  element: Phaser.GameObjects.Text
  bossIndex: number | null
}

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
  private readonly columns = 3
  private readonly rows = 3
  private readonly pageSize = this.columns * this.rows
  private panelWidth = 140
  private cellWidth = 0
  private readonly cellHeight = 56

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

    this.registerKeyboardShortcuts()
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
    this.panelWidth = Math.round(Math.min(desiredPanelWidth, maxPanelWidth))
    const panelHeight = height - 72
    const panelX = width - this.panelWidth / 2 - 28
    const panelY = height / 2 + 6

    this.add
      .rectangle(panelX, panelY, this.panelWidth, panelHeight, 0x0c1324, 0.9)
      .setStrokeStyle(2, 0x3a75c4, 0.6)

    this.previewTitle = this.add
      .text(panelX, panelY - panelHeight / 2 + 16, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#8fb8ff',
        align: 'center',
        wordWrap: { width: this.panelWidth - 24 }
      })
      .setOrigin(0.5, 0)

    this.bossNameText = this.add
      .text(panelX, this.previewTitle.y + 32, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5, 0)

    this.elementText = this.add
      .text(panelX, this.bossNameText.y + 24, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#9ad'
      })
      .setOrigin(0.5, 0)

    this.previewDescription = this.add
      .text(panelX, this.elementText.y + 24, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#c7d8ff',
        align: 'center',
        wordWrap: { width: this.panelWidth - 24 }
      })
      .setOrigin(0.5, 0)

    const infoTop = panelY + panelHeight / 2 - 52
    this.infoText = this.add
      .text(panelX, infoTop, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#cbd3ff',
        align: 'center',
        wordWrap: { width: this.panelWidth - 24 }
      })
      .setOrigin(0.5, 0)
  }

  private drawGrid(width: number, height: number): void {
    const gridWidth = width - this.panelWidth - 96
    const computedCellWidth = Math.floor(gridWidth / this.columns)
    this.cellWidth = Math.max(56, computedCellWidth)
    const horizontalPadding = (gridWidth - this.cellWidth * this.columns) / 2
    const startX = 44 + horizontalPadding + this.cellWidth / 2
    const gridHeight = this.rows * this.cellHeight
    const startY = height / 2 - gridHeight / 2 + 12

    this.slots = []
    this.slotEntries = []

    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.columns; col += 1) {
        const slotIndex = row * this.columns + col
        const x = startX + col * this.cellWidth
        const y = startY + row * this.cellHeight

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
          .setOrigin(0.5)

        const element = this.add
          .text(x, y + 8, '', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#9ad'
          })
          .setOrigin(0.5)

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
      .text(width / 2, footerY - 10, '← ↑ → ↓ NAVIGATE   •   ENTER / SPACE START   •   Q / E CHANGE PAGE', {
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
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)?.on('down', () => this.confirm())
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)?.on('down', () => this.confirm())
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)?.on('down', () => this.changePage(-1))
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)?.on('down', () => this.changePage(1))
  }

  private onSlotHover(slotIndex: number): void {
    const slot = this.slotEntries[slotIndex]
    if (!slot || slot.bossIndex == null || slot.bossIndex === this.index) {
      return
    }
    this.index = slot.bossIndex
    this.updateCursor()
    this.updatePreview()
  }

  private move(delta: number): void {
    const total = ORDERED_BOSSES.length
    this.index = (this.index + delta + total) % total
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
    this.cursor.setPosition(slotPosition.x, slotPosition.y)
    this.refreshInfo()
  }

  private changePage(delta: number): void {
    const totalPages = Math.max(1, Math.ceil(ORDERED_BOSSES.length / this.pageSize))
    this.currentPage = (this.currentPage + delta + totalPages) % totalPages

    const start = this.currentPage * this.pageSize
    const end = Math.min(start + this.pageSize - 1, ORDERED_BOSSES.length - 1)
    this.index = Phaser.Math.Clamp(this.index, start, end)

    this.refreshPage()
    this.updateCursor()
    this.updatePreview()
  }

  private confirm(): void {
    const entry = ORDERED_BOSSES[this.index]
    if (!entry) {
      return
    }
    this.scene.start('Game', { bossId: entry.id })
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
  }
}
