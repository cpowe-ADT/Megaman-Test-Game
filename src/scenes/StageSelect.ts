import Phaser from 'phaser'
import AudioService from '../audio'
import { ORDERED_BOSSES } from '../bosses/roster'
import {
  countClearedRobotMasters,
  FINAL_STAGE_ID,
  getCampaignStage,
  getRobotMasterStages,
  isFinalRouteUnlocked,
  TUTORIAL_STAGE_ID
} from '../content/campaign'
import { DEBUG_UI } from '../config/debug'
import { showToast } from '../core/navigation'
import InputActions from '../input/InputActions'
import { Save, SaveData } from '../systems/Save'
import { DebugOverlay } from '../ui/DebugOverlay'
import type { SystemMenuAction } from './menu/systemMenuSelector'
import { StageSelectLogic } from './stage-select/StageSelectLogic'
import { resolveSlotClick, truncateLabel } from './stage-select/selectionContract'

type SlotEntry = {
  rect: Phaser.GameObjects.Rectangle
  name: Phaser.GameObjects.Text
  meta: Phaser.GameObjects.Text
  badge: Phaser.GameObjects.Text
  stageIndex: number | null
}

type Layout = {
  headerRect: Phaser.Geom.Rectangle
  gridRect: Phaser.Geom.Rectangle
  previewRect: Phaser.Geom.Rectangle
  footerRect: Phaser.Geom.Rectangle
  slotWidth: number
  slotHeight: number
  slotGapX: number
  slotGapY: number
}

const COLUMNS = 3
const ROWS = 3
const PAGE_SIZE = COLUMNS * ROWS

const FONT = {
  title: '30px monospace',
  subtitle: '10px monospace',
  slotTitle: '10px monospace',
  slotMeta: '8px monospace',
  panelTitle: '10px monospace',
  panelName: '16px monospace',
  panelBody: '9px monospace',
  footer: '9px monospace'
}

const COLOR = {
  bgTop: 0x081429,
  bgBottom: 0x040914,
  panel: 0x0b1c3c,
  panelInner: 0x07142a,
  border: 0x4a8cff,
  borderMuted: 0x2b5ca8,
  clearedFill: 0x1b2130,
  clearedStroke: 0x5a637a,
  text: '#f5f8ff',
  textMuted: '#9ec2ff',
  textAccent: '#8bc6ff',
  textCleared: '#a8b3c8'
}

export class StageSelect extends Phaser.Scene {
  private readonly logic = new StageSelectLogic()
  private readonly columns = COLUMNS
  private readonly rows = ROWS
  private readonly pageSize = PAGE_SIZE
  private readonly stages = getRobotMasterStages()

  private layout?: Layout
  private slots: Phaser.Math.Vector2[] = []
  private slotEntries: SlotEntry[] = []

  private index = 0
  private currentPage = 0

  public selectedBossId: string | null = null
  public canConfirm = false
  public confirmArmed = true

  private saveData: SaveData = Save.load()

  private cursor?: Phaser.GameObjects.Rectangle
  private previewTitle?: Phaser.GameObjects.Text
  private bossNameText?: Phaser.GameObjects.Text
  private infoText?: Phaser.GameObjects.Text
  private detailsText?: Phaser.GameObjects.Text
  private pageIndicator?: Phaser.GameObjects.Text
  private footerStatus?: Phaser.GameObjects.Text
  private toastHandle?: Phaser.GameObjects.Container

  private requestedTransition: { scene: string; data: Record<string, unknown> } | null = null
  private transitionRequestedAt = 0
  private armConfirmAfterRelease = false
  private confirmArmAvailableAt = 0
  private manualSelectionRequired = false

  private debugOverlay?: DebugOverlay
  private debugToggleHandler?: () => void
  private preventScrollHandler?: (event: KeyboardEvent) => void

  constructor() {
    super('StageSelect')
  }

  create(): void {
    AudioService.playMusic(this, 'stage_select')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))
    this.saveData = Save.load()
    this.requestedTransition = null
    this.transitionRequestedAt = 0
    this.armConfirmAfterRelease = false
    this.confirmArmAvailableAt = 0
    this.confirmArmed = true
    this.manualSelectionRequired = false
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor('#050d1a')

    this.layout = this.computeLayout(width, height)
    this.createBackdrop(width, height)
    this.createHeader()
    this.createGrid()
    this.createPreviewPanel()
    this.createFooter()

    this.cursor = this.add
      .rectangle(0, 0, this.layout.slotWidth - 8, this.layout.slotHeight - 8)
      .setStrokeStyle(2, 0xffffff, 0.95)
      .setFillStyle(0xffffff, 0)
      .setDepth(10)

    this.refreshPage()
    this.setSelection(this.index)
    this.applyPostReturnState()

    this.registerKeyboardShortcuts()
    this.installScrollGuards()
    InputActions.init(this)

    if (this.input.keyboard) {
      this.debugToggleHandler = () => this.debugOverlay?.toggle()
      this.input.keyboard.on('keydown-BACKTICK', this.debugToggleHandler)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (this.debugToggleHandler) {
          this.input.keyboard?.off('keydown-BACKTICK', this.debugToggleHandler)
          this.debugToggleHandler = undefined
        }
      })
    }

    if (DEBUG_UI) {
      this.debugOverlay = new DebugOverlay(this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.debugOverlay?.destroy())
    }
  }

  update(): void {
    if (this.armConfirmAfterRelease && !this.confirmArmed) {
      if (this.time.now >= this.confirmArmAvailableAt && InputActions.confirmReleased()) {
        this.confirmArmed = true
        this.armConfirmAfterRelease = false
        this.confirmArmAvailableAt = 0
      }
    }

    if (DEBUG_UI) {
      this.debugOverlay?.update({
        sceneName: this.scene.key,
        managerName: this.scene.key,
        confirmHint: 'Enter / NumpadEnter',
        jumpHint: 'Space (gameplay)',
        pauseHint: 'Esc (gameplay)',
        transitionRequestedAt: this.transitionRequestedAt
      })
    }

  }

  private computeLayout(width: number, height: number): Layout {
    const outerPad = 12
    const headerHeight = 50
    const footerHeight = 34
    const contentGap = 8
    const previewWidth = 174

    const headerRect = new Phaser.Geom.Rectangle(outerPad, outerPad, width - outerPad * 2, headerHeight)
    const footerRect = new Phaser.Geom.Rectangle(
      outerPad,
      height - outerPad - footerHeight,
      width - outerPad * 2,
      footerHeight
    )

    const contentTop = headerRect.bottom + contentGap
    const contentBottom = footerRect.y - contentGap
    const contentHeight = contentBottom - contentTop

    const previewRect = new Phaser.Geom.Rectangle(width - outerPad - previewWidth, contentTop, previewWidth, contentHeight)
    const gridRect = new Phaser.Geom.Rectangle(
      outerPad,
      contentTop,
      previewRect.x - outerPad - contentGap,
      contentHeight
    )

    const slotGapX = 8
    const slotGapY = 10
    const slotWidth = Math.floor((gridRect.width - slotGapX * (this.columns - 1)) / this.columns)
    const slotHeight = Math.floor((gridRect.height - slotGapY * (this.rows - 1)) / this.rows)

    return { headerRect, gridRect, previewRect, footerRect, slotWidth, slotHeight, slotGapX, slotGapY }
  }

  private createBackdrop(width: number, height: number): void {
    const top = this.add.rectangle(width / 2, height / 2, width, height, COLOR.bgTop, 1)
    top.setDepth(-30)

    const stripe = this.add.rectangle(width / 2, height * 0.82, width, height * 0.45, COLOR.bgBottom, 0.9)
    stripe.setDepth(-29)

    const scan = this.add.graphics()
    scan.setDepth(-28)
    scan.fillStyle(0x9ec2ff, 0.03)
    for (let y = 0; y < height; y += 4) {
      scan.fillRect(0, y, width, 1)
    }
  }

  private createHeader(): void {
    const layout = this.layout!

    this.add
      .rectangle(layout.headerRect.centerX, layout.headerRect.centerY, layout.headerRect.width, layout.headerRect.height, COLOR.panel, 0.88)
      .setStrokeStyle(2, COLOR.border, 0.8)

    this.add
      .text(layout.headerRect.centerX, layout.headerRect.y + 4, 'ROBOT MASTER SELECT', {
        font: FONT.title,
        color: COLOR.text,
        letterSpacing: 1
      })
      .setOrigin(0.5, 0)

    this.add
      .text(layout.headerRect.centerX, layout.headerRect.bottom - 5, '8 robot masters • T tutorial • F final route', {
        font: FONT.subtitle,
        color: COLOR.textMuted,
        align: 'center'
      })
      .setOrigin(0.5, 1)
  }

  private createGrid(): void {
    const layout = this.layout!

    this.add
      .rectangle(layout.gridRect.centerX, layout.gridRect.centerY, layout.gridRect.width, layout.gridRect.height, COLOR.panelInner, 0.7)
      .setStrokeStyle(1, COLOR.borderMuted, 0.7)

    this.slots = []
    this.slotEntries = []

    const startX = layout.gridRect.x + layout.slotWidth / 2
    const startY = layout.gridRect.y + layout.slotHeight / 2

    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.columns; col += 1) {
        const slotIndex = row * this.columns + col
        const x = Math.round(startX + col * (layout.slotWidth + layout.slotGapX))
        const y = Math.round(startY + row * (layout.slotHeight + layout.slotGapY))

        const rect = this.add
          .rectangle(x, y, layout.slotWidth, layout.slotHeight, 0x0d2247, 0.5)
          .setStrokeStyle(2, COLOR.borderMuted, 0.8)
          .setInteractive({ useHandCursor: true })

        rect.on('pointerdown', () => this.handleSlotPointerDown(slotIndex))

        const name = this.add
          .text(x, y - 11, '', {
            font: FONT.slotTitle,
            color: COLOR.text,
            align: 'center'
          })
          .setOrigin(0.5, 0)

        const meta = this.add
          .text(x, y + 4, '', {
            font: FONT.slotMeta,
            color: COLOR.textAccent,
            align: 'center',
            wordWrap: { width: layout.slotWidth - 10, useAdvancedWrap: true }
          })
          .setOrigin(0.5, 0)

        const badge = this.add
          .text(x + layout.slotWidth / 2 - 5, y - layout.slotHeight / 2 + 3, '', {
            font: FONT.slotMeta,
            color: '#0b1220',
            backgroundColor: '#d1d9e8',
            padding: { x: 3, y: 1 }
          })
          .setOrigin(1, 0)
          .setVisible(false)

        this.slots.push(new Phaser.Math.Vector2(x, y))
        this.slotEntries.push({ rect, name, meta, badge, stageIndex: null })
      }
    }
  }

  private createPreviewPanel(): void {
    const layout = this.layout!

    this.add
      .rectangle(
        layout.previewRect.centerX,
        layout.previewRect.centerY,
        layout.previewRect.width,
        layout.previewRect.height,
        COLOR.panel,
        0.9
      )
      .setStrokeStyle(2, COLOR.border, 0.85)

    this.previewTitle = this.add
      .text(layout.previewRect.centerX, layout.previewRect.y + 8, '', {
        font: FONT.panelTitle,
        color: COLOR.textAccent,
        align: 'center',
        wordWrap: { width: layout.previewRect.width - 20, useAdvancedWrap: true }
      })
      .setOrigin(0.5, 0)

    this.bossNameText = this.add
      .text(layout.previewRect.centerX, layout.previewRect.y + 24, '', {
        font: FONT.panelName,
        color: COLOR.text,
        align: 'center'
      })
      .setOrigin(0.5, 0)

    this.infoText = this.add
      .text(layout.previewRect.centerX, layout.previewRect.y + 50, '', {
        font: FONT.panelBody,
        color: COLOR.textMuted,
        align: 'center',
        wordWrap: { width: layout.previewRect.width - 18, useAdvancedWrap: true },
        lineSpacing: 2
      })
      .setOrigin(0.5, 0)

    this.detailsText = this.add
      .text(layout.previewRect.centerX, layout.previewRect.y + 92, '', {
        font: FONT.panelBody,
        color: COLOR.text,
        align: 'center',
        wordWrap: { width: layout.previewRect.width - 18, useAdvancedWrap: true },
        lineSpacing: 2
      })
      .setOrigin(0.5, 0)
  }

  private createFooter(): void {
    const layout = this.layout!

    this.add
      .rectangle(layout.footerRect.centerX, layout.footerRect.centerY, layout.footerRect.width, layout.footerRect.height, COLOR.panel, 0.86)
      .setStrokeStyle(1, COLOR.borderMuted, 0.8)

    this.add
      .text(layout.footerRect.centerX, layout.footerRect.y + 7, 'Arrows move • Click select • Enter deploy • T tutorial • F final route', {
        font: FONT.footer,
        color: COLOR.textMuted,
        align: 'center'
      })
      .setOrigin(0.5, 0)

    this.footerStatus = this.add
      .text(layout.footerRect.centerX, layout.footerRect.bottom - 6, '', {
        font: FONT.footer,
        color: COLOR.textAccent,
        align: 'center'
      })
      .setOrigin(0.5, 1)
  }

  private refreshPage(): void {
    const totalPages = Math.max(1, Math.ceil(this.stages.length / this.pageSize))
    this.currentPage = Phaser.Math.Clamp(this.currentPage, 0, totalPages - 1)
    const start = this.currentPage * this.pageSize

    this.slotEntries.forEach((slot, slotIndex) => {
      const stage = this.stages[start + slotIndex]
      if (!stage) {
        slot.stageIndex = null
        slot.rect.setVisible(false).disableInteractive()
        slot.name.setVisible(false)
        slot.meta.setVisible(false)
        slot.badge.setVisible(false)
        return
      }

      slot.stageIndex = start + slotIndex
      slot.rect.setVisible(true).setInteractive({ useHandCursor: true })
      slot.name.setVisible(true)
      slot.meta.setVisible(true)

      const bossEntry = ORDERED_BOSSES.find((entry) => entry.id === stage.bossId)
      const stageId = stage.id
      const weaponId = stage.rewardWeaponId ?? bossEntry?.blueprint.weaponReward?.id ?? stageId
      const unlocked = this.saveData.weaponsUnlocked.includes(weaponId) ? 'UNLOCKED' : 'LOCKED'
      const cleared = this.saveData.clearedBosses.includes(stageId)
      const goCount = this.saveData.gameOverCounts[stageId] ?? 0

      slot.name.setText(truncateLabel(stage.selectLabel, 12))
      slot.name.setColor(cleared ? COLOR.textCleared : COLOR.text)
      slot.meta.setText(`${cleared ? 'CLEARED' : unlocked}  •  GO:${goCount}`)
      slot.meta.setColor(cleared ? '#8793ad' : unlocked === 'UNLOCKED' ? '#9ec2ff' : '#6f8cb8')
      slot.badge.setText(cleared ? 'DEFEATED' : '')
      slot.badge.setVisible(cleared)

      this.layoutSlotText(slot)
    })

    const clearedRobotMasters = countClearedRobotMasters(this.saveData)
    const finalState = this.saveData.gameCompleted
      ? 'FINAL • COMPLETE'
      : isFinalRouteUnlocked(this.saveData)
        ? 'FINAL • READY (F)'
        : `FINAL • LOCKED ${clearedRobotMasters}/8`
    this.footerStatus?.setText(finalState)
    this.updateSelectionVisuals()
  }

  private layoutSlotText(slot: SlotEntry): void {
    const slotWidth = slot.rect.width
    const slotHeight = slot.rect.height
    slot.name.setPosition(slot.rect.x, slot.rect.y - 12)
    slot.meta.setPosition(slot.rect.x, slot.rect.y + 4)
    slot.badge.setPosition(slot.rect.x + slotWidth / 2 - 5, slot.rect.y - slotHeight / 2 + 3)
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
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T)?.on('down', () => this.launchCampaignStage(TUTORIAL_STAGE_ID))
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F)?.on('down', () => this.launchFinalRoute())
    const enterHandler = (event: KeyboardEvent) => {
      event.preventDefault()
      this.handleKeyboardConfirm()
    }
    const numpadEnterHandler = (event: KeyboardEvent) => {
      event.preventDefault()
      this.handleKeyboardConfirm()
    }
    const escHandler = (event: KeyboardEvent) => {
      event.preventDefault()
      if (!this.scene.isActive('SystemMenu')) {
        AudioService.unlock()
        AudioService.playSfx('ui_cancel')
        this.scene.launch('SystemMenu', { sourceScene: 'StageSelect' })
      }
    }

    keyboard.on('keydown-ENTER', enterHandler)
    keyboard.on('keydown-NUMPAD_ENTER', numpadEnterHandler)
    keyboard.on('keydown-SPACE', enterHandler)
    keyboard.on('keydown-ESC', escHandler)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      try {
        keyboard.off('keydown-ENTER', enterHandler)
        keyboard.off('keydown-NUMPAD_ENTER', numpadEnterHandler)
        keyboard.off('keydown-SPACE', enterHandler)
        keyboard.off('keydown-ESC', escHandler)
      } catch {
        // Keyboard plugin may already be torn down during scene shutdown.
      }
    })
  }

  onSystemMenuAction(action: SystemMenuAction): void {
    if (action === 'back' || action === 'resume') {
      return
    }

    if (action === 'load_game') {
      const run = Save.loadActiveRun()
      if (!run) {
        this.toastHandle?.destroy(true)
        this.toastHandle = showToast(this, 'No saved game found.', 1200)
        return
      }
      this.scene.start('Game', {
        bossId: run.bossId,
        stageId: run.stageId,
        loadFromSave: true
      })
      return
    }

    if (action === 'new_game') {
      Save.startNewCampaign()
      this.scene.start('Title')
      return
    }

    if (action === 'clear_save') {
      Save.clearAll()
      this.saveData = Save.load()
      this.refreshPage()
      this.setSelection(0)
      this.toastHandle?.destroy(true)
      this.toastHandle = showToast(this, 'Save data cleared.', 1200)
    }
  }

  private installScrollGuards(): void {
    const keyboard = this.input.keyboard
    if (!keyboard || this.preventScrollHandler) {
      return
    }

    const blockedCodes = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const handler = (event: KeyboardEvent) => {
      if (blockedCodes.has(event.code)) {
        event.preventDefault()
      }
    }

    this.preventScrollHandler = handler
    keyboard.on('keydown', handler)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', handler)
      if (this.preventScrollHandler === handler) {
        this.preventScrollHandler = undefined
      }
      this.toastHandle?.destroy(true)
      this.toastHandle = undefined
    })
  }

  private move(delta: number): void {
    const total = this.stages.length
    if (total === 0) {
      return
    }

    const next = (this.index + delta + total) % total
    if (next !== this.index) {
      AudioService.unlock()
      AudioService.playSfx('ui_move')
    }
    this.manualSelectionRequired = false
    this.setSelection(next)
  }

  private changePage(delta: number): void {
    const totalPages = Math.max(1, Math.ceil(this.stages.length / this.pageSize))
    this.currentPage = (this.currentPage + delta + totalPages) % totalPages
    AudioService.unlock()
    AudioService.playSfx('ui_move')
    this.manualSelectionRequired = false

    const start = this.currentPage * this.pageSize
    const end = Math.min(start + this.pageSize - 1, this.stages.length - 1)
    const next = Phaser.Math.Clamp(this.index, start, end)

    this.refreshPage()
    this.setSelection(next)
  }

  private handleSlotPointerDown(slotIndex: number): void {
    const slot = this.slotEntries[slotIndex]
    if (!slot || slot.stageIndex == null) {
      return
    }

    const resolution = resolveSlotClick(this.index, slot.stageIndex)
    AudioService.unlock()
    if (this.manualSelectionRequired) {
      AudioService.playSfx('ui_move')
      this.manualSelectionRequired = false
      this.setSelection(resolution.nextIndex)
      return
    }
    AudioService.playSfx(resolution.shouldConfirm ? 'ui_confirm' : 'ui_move')
    this.setSelection(resolution.nextIndex)

    if (resolution.shouldConfirm) {
      this.confirmSelection()
    }
  }

  private setSelection(nextIndex: number): void {
    this.index = Phaser.Math.Clamp(nextIndex, 0, Math.max(this.stages.length - 1, 0))
    this.logic.setIndex(this.index)
    this.ensurePageForIndex()
    this.updateSelectionVisuals()
    this.updatePreview()
    this.updateDebugSelectionState()
  }

  private ensurePageForIndex(): void {
    const targetPage = Math.floor(this.index / this.pageSize)
    if (targetPage !== this.currentPage) {
      this.currentPage = targetPage
      this.refreshPage()
    }
  }

  private updateSelectionVisuals(): void {
    const selectedSlotIndex = this.slotEntries.findIndex((slot) => slot.stageIndex === this.index)

    this.slotEntries.forEach((slot) => {
      if (slot.stageIndex == null) {
        return
      }

      const stage = this.stages[slot.stageIndex]
      const entry = ORDERED_BOSSES.find((boss) => boss.id === stage?.bossId)
      const primary = entry?.blueprint.theme.primary ?? COLOR.borderMuted
      const isSelected = slot.stageIndex === this.index
      const isCleared = stage ? this.saveData.clearedBosses.includes(stage.id) : false
      slot.rect
        .setStrokeStyle(
          isSelected ? 2 : 1,
          isSelected ? 0xffffff : isCleared ? COLOR.clearedStroke : primary,
          isSelected ? 1 : 0.85
        )
        .setFillStyle(
          isSelected ? (isCleared ? 0x3b465f : 0x2a57a6) : isCleared ? COLOR.clearedFill : 0x0d2247,
          isSelected ? 0.6 : isCleared ? 0.65 : 0.5
        )
    })

    if (!this.cursor || selectedSlotIndex === -1) {
      this.cursor?.setVisible(false)
      return
    }

    const slotPos = this.slots[selectedSlotIndex]
    if (!slotPos) {
      this.cursor.setVisible(false)
      return
    }

    this.cursor.setVisible(true)
    this.cursor.setPosition(slotPos.x, slotPos.y)
  }

  private updatePreview(): void {
    const stage = this.stages[this.index]
    const entry = stage ? ORDERED_BOSSES.find((boss) => boss.id === stage.bossId) : null
    if (!stage || !entry || !this.previewTitle || !this.bossNameText || !this.infoText || !this.detailsText) {
      return
    }

    const blueprint = entry.blueprint
    const reward = stage.rewardWeaponId ? blueprint.weaponReward : null
    const goCount = this.saveData.gameOverCounts[stage.id] ?? 0
    const isCleared = this.saveData.clearedBosses.includes(stage.id)

    this.previewTitle.setText(truncateLabel(stage.introCallout, 26))
    this.bossNameText.setText(blueprint.codename)
    this.infoText.setText(
      `Element: ${blueprint.element}   Weak: ${entry.weakTo}\nArena: ${stage.arenaLabel}   Status: ${isCleared ? 'CLEARED' : 'ACTIVE'}`
    )
    this.detailsText.setText(
      `Reward: ${truncateLabel(reward?.displayName ?? 'Tutorial intel', 20)}\n${truncateLabel(stage.description, 26)}\nGame Overs: ${goCount}`
    )
  }

  private updateDebugSelectionState(): void {
    const stage = this.stages[this.index]
    this.selectedBossId = stage?.bossId ?? null
    this.canConfirm = Boolean(stage)
  }

  private applyPostReturnState(): void {
    const toastMessage = this.registry.get('ui.stageSelect.toast') as string | undefined
    const focusBossId = this.registry.get('ui.stageSelect.focusBossId') as string | null | undefined
    const requireConfirmRelease = Boolean(this.registry.get('ui.stageSelect.requireConfirmRelease'))
    const returnReason = this.registry.get('ui.stageSelect.returnReason') as string | undefined

    this.armConfirmAfterRelease = requireConfirmRelease
    this.confirmArmed = !requireConfirmRelease
    this.confirmArmAvailableAt = requireConfirmRelease ? this.time.now + 120 : 0
    this.manualSelectionRequired = returnReason === 'victory'

    if (focusBossId) {
      const focusIndex = this.stages.findIndex((entry) => entry.id === focusBossId || entry.bossId === focusBossId)
      if (focusIndex >= 0) {
        const next = this.findNextUnclearedIndex(focusIndex)
        this.setSelection(next ?? focusIndex)
      }
    }

    if (toastMessage && toastMessage.trim().length > 0) {
      this.toastHandle?.destroy(true)
      this.toastHandle = showToast(this, toastMessage.trim(), 1800)
    }

    this.registry.remove('ui.stageSelect.toast')
    this.registry.remove('ui.stageSelect.focusBossId')
    this.registry.remove('ui.stageSelect.returnReason')
    this.registry.remove('ui.stageSelect.requireConfirmRelease')
  }

  private findNextUnclearedIndex(fromIndex: number): number | null {
    if (this.stages.length === 0) {
      return null
    }
    for (let offset = 1; offset < this.stages.length; offset += 1) {
      const index = (fromIndex + offset) % this.stages.length
      const stageId = this.stages[index]?.id
      if (stageId && !this.saveData.clearedBosses.includes(stageId)) {
        return index
      }
    }
    return null
  }

  private confirmSelection(): void {
    this.logic.setIndex(this.index)
    const transition = this.logic.confirm()
    if (!transition) {
      return
    }

    AudioService.unlock()
    AudioService.playSfx('ui_confirm')
    this.startSceneTransition(transition.scene, transition.data as Record<string, unknown>)
  }

  private handleKeyboardConfirm(): void {
    if (!this.confirmArmed || this.scene.isActive('SystemMenu')) {
      return
    }
    if (this.manualSelectionRequired) {
      this.manualSelectionRequired = false
      this.toastHandle?.destroy(true)
      this.toastHandle = showToast(this, 'Choose a stage, then confirm.', 900)
      AudioService.playSfx('ui_move')
      return
    }
    this.confirmSelection()
  }

  private launchCampaignStage(stageId: string): void {
    const stage = getCampaignStage(stageId)
    AudioService.unlock()
    AudioService.playSfx('ui_confirm')
    this.startSceneTransition('Game', {
      stageId: stage.id,
      bossId: stage.bossId,
      runtimeBossConfigId: stage.runtimeBossConfigId
    })
  }

  private launchFinalRoute(): void {
    if (!isFinalRouteUnlocked(this.saveData)) {
      this.toastHandle?.destroy(true)
      AudioService.playSfx('ui_cancel')
      this.toastHandle = showToast(this, 'Final route locked. Clear all 8 robot masters first.', 1400)
      return
    }
    this.launchCampaignStage(FINAL_STAGE_ID)
  }

  private startSceneTransition(scene: string, data: Record<string, unknown>): void {
    this.requestedTransition = { scene, data }
    this.transitionRequestedAt = performance.now()
    this.scene.start(scene, data)
  }
}
