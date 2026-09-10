import Phaser from 'phaser'
import AudioService from '../audio'
import { ORDERED_BOSSES } from '../bosses/roster'
import {
  FINAL_STAGE_ID,
  getCampaignStage,
  getSelectableBossStages,
  isCampaignStageCleared,
  TUTORIAL_STAGE_ID
} from '../content/campaign'
import { DEBUG_UI } from '../config/debug'
import { showToast } from '../core/navigation'
import InputActions from '../input/InputActions'
import { Save, SaveData } from '../systems/Save'
import { DebugOverlay } from '../ui/DebugOverlay'
import {
  evaluateFinalGate,
  formatCheckpointLabel,
  getAccessibleCheckpointIds,
  getBossWeaknessLabel,
  getFinalGateProgressLabel,
  getFinalGateStatusLabel,
  getSelectedCheckpointId,
  getStageBossRewardLabel,
  getStageAccessRequirementLabel,
  getStageLocationDefinitions,
  isStageAccessible
} from '../progression'
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
  title: '22px monospace',
  subtitle: '8px monospace',
  slotTitle: '8px monospace',
  slotMeta: '7px monospace',
  panelTitle: '9px monospace',
  panelName: '13px monospace',
  panelBody: '8px monospace',
  footer: '7px monospace'
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
  private readonly stages = getSelectableBossStages()

  private layout?: Layout
  private slots: Phaser.Math.Vector2[] = []
  private slotEntries: SlotEntry[] = []

  private index = 0
  private currentPage = 0

  public selectedBossId: string | null = null
  public canConfirm = false
  public confirmArmed = true
  public selectedCheckpointId: string | null = null
  public selectedWeaknessLabel: string | null = null
  public selectedRewardLabel: string | null = null
  public finalGateText: string | null = null

  private saveData: SaveData = Save.load()

  private cursor?: Phaser.GameObjects.Rectangle
  private previewTitle?: Phaser.GameObjects.Text
  private bossNameText?: Phaser.GameObjects.Text
  private infoText?: Phaser.GameObjects.Text
  private detailsText?: Phaser.GameObjects.Text
  private previewGlow?: Phaser.GameObjects.Ellipse
  private previewSprite?: Phaser.GameObjects.Sprite
  private previewMaskShape?: Phaser.GameObjects.Graphics
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
    this.events.on(Phaser.Scenes.Events.RESUME, this.refreshFromSave, this)

    this.registerKeyboardShortcuts()
    InputActions.init(this)

    InputActions.forScene(this).onPressed('debugOverlay', () => this.debugOverlay?.toggle())

    if (DEBUG_UI) {
      this.debugOverlay = new DebugOverlay(this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.debugOverlay?.destroy())
    }
  }

  update(): void {
    if (this.armConfirmAfterRelease && !this.confirmArmed) {
      if (this.time.now >= this.confirmArmAvailableAt && InputActions.forScene(this).confirmReleased()) {
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
    const outerPad = 8
    const headerHeight = 36
    const footerHeight = 28
    const contentGap = 5
    const previewWidth = 160

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

    const slotGapX = 4
    const slotGapY = 4
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
      .text(layout.headerRect.centerX, layout.headerRect.y + 1, 'ROBOT MASTER SELECT', {
        font: FONT.title,
        color: COLOR.text,
        letterSpacing: 1
      })
      .setOrigin(0.5, 0)

    this.add
      .text(layout.headerRect.centerX, layout.headerRect.bottom - 3, '8 ROBOT MASTERS + OMEGA  •  T TUTORIAL  •  F FINAL', {
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
          .text(x, y - 10, '', {
            font: FONT.slotTitle,
            color: COLOR.text,
            align: 'center'
          })
          .setOrigin(0.5, 0)

        const meta = this.add
          .text(x, y + 2, '', {
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
      .text(layout.previewRect.centerX, layout.previewRect.y + 5, '', {
        font: FONT.panelTitle,
        color: COLOR.textAccent,
        align: 'center',
        wordWrap: { width: layout.previewRect.width - 20, useAdvancedWrap: true }
      })
      .setOrigin(0.5, 0)

    this.bossNameText = this.add
      .text(layout.previewRect.centerX, layout.previewRect.y + 17, '', {
        font: FONT.panelName,
        color: COLOR.text,
        align: 'center'
      })
      .setOrigin(0.5, 0)

    this.previewGlow = this.add
      .ellipse(layout.previewRect.centerX, layout.previewRect.y + 72, 88, 64, COLOR.border, 0.16)
      .setStrokeStyle(2, COLOR.borderMuted, 0.35)

    this.previewSprite = this.add
      .sprite(layout.previewRect.centerX, layout.previewRect.y + 75, 'atlas_sentinel_rook', 'sentinel_rook/idle/000')
      .setVisible(false)

    this.previewMaskShape = this.add.graphics().setVisible(false)
    this.previewMaskShape.fillStyle(0xffffff)
    this.previewMaskShape.fillRect(
      layout.previewRect.x + 4,
      layout.previewRect.y + 33,
      layout.previewRect.width - 8,
      76
    )
    this.previewSprite.setMask(this.previewMaskShape.createGeometryMask())

    this.infoText = this.add
      .text(layout.previewRect.centerX, layout.previewRect.y + 109, '', {
        font: FONT.panelBody,
        color: COLOR.textMuted,
        align: 'center',
        wordWrap: { width: layout.previewRect.width - 18, useAdvancedWrap: true },
        lineSpacing: 1
      })
      .setOrigin(0.5, 0)

    this.detailsText = this.add
      .text(layout.previewRect.centerX, layout.previewRect.y + 132, '', {
        font: FONT.panelBody,
        color: COLOR.text,
        align: 'center',
        wordWrap: { width: layout.previewRect.width - 18, useAdvancedWrap: true },
        lineSpacing: 1
      })
      .setOrigin(0.5, 0)
  }

  private createFooter(): void {
    const layout = this.layout!

    this.add
      .rectangle(layout.footerRect.centerX, layout.footerRect.centerY, layout.footerRect.width, layout.footerRect.height, COLOR.panel, 0.86)
      .setStrokeStyle(1, COLOR.borderMuted, 0.8)

    this.add
      .text(layout.footerRect.centerX, layout.footerRect.y + 5, 'ARROWS MOVE  •  L/R CHECKPOINT  •  ENTER DEPLOY', {
        font: FONT.footer,
        color: COLOR.textMuted,
        align: 'center'
      })
      .setOrigin(0.5, 0)

    this.footerStatus = this.add
      .text(layout.footerRect.centerX, layout.footerRect.bottom - 4, '', {
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
      const accessible = isStageAccessible(this.saveData, stageId)
      const cleared = isCampaignStageCleared(this.saveData, stageId)
      const checkProgress = this.getStageCheckProgress(stage.id)
      slot.name.setText(truncateLabel(stage.selectLabel, 11))
      slot.name.setColor(cleared ? COLOR.textCleared : COLOR.text)
      slot.meta.setText(
        `${cleared ? 'CLEARED' : accessible ? 'OPEN' : 'LOCKED'}  •  CHECKS ${checkProgress.collected}/${checkProgress.total}`
      )
      slot.meta.setColor(cleared ? '#8793ad' : accessible ? '#9ec2ff' : '#6f8cb8')
      slot.badge.setText(cleared ? 'DEFEATED' : '')
      slot.badge.setVisible(cleared)

      this.layoutSlotText(slot)
    })

    const finalState = getFinalGateStatusLabel(this.saveData)
    this.finalGateText = finalState
    this.footerStatus?.setText(finalState)
    this.updateSelectionVisuals()
  }

  private layoutSlotText(slot: SlotEntry): void {
    const slotWidth = slot.rect.width
    const slotHeight = slot.rect.height
    slot.name.setPosition(slot.rect.x, slot.rect.y - 8)
    slot.meta.setPosition(slot.rect.x, slot.rect.y + 6)
    slot.badge.setPosition(slot.rect.x + slotWidth / 2 - 5, slot.rect.y - slotHeight / 2 + 3)
  }

  private registerKeyboardShortcuts(): void {
    const actions = InputActions.forScene(this)
    actions.onPressed('moveLeft', () => this.move(-1))
    actions.onPressed('moveRight', () => this.move(1))
    actions.onPressed('aimUp', () => this.move(-this.columns))
    actions.onPressed('aimDown', () => this.move(this.columns))
    actions.onPressed('pagePrev', () => this.changePage(-1))
    actions.onPressed('pageNext', () => this.changePage(1))
    actions.onPressed('checkpointNext', () => this.cycleCheckpoint(1))
    actions.onPressed('checkpointPrev', () => this.cycleCheckpoint(-1))
    actions.onPressed('tutorial', () => this.launchCampaignStage(TUTORIAL_STAGE_ID))
    actions.onPressed('finalRoute', () => this.launchFinalRoute())
    actions.onPressed('confirm', () => this.handleKeyboardConfirm())
    actions.onPressed('cancel', () => {
      if (!this.scene.isActive('SystemMenu')) {
        AudioService.playSfx('ui_cancel')
        this.scene.launch('SystemMenu', { sourceScene: 'StageSelect' })
      }
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.refreshFromSave, this)
      this.toastHandle?.destroy(true)
      this.toastHandle = undefined
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
        this.toastHandle = showToast(this, 'No valid saved game found.', 1200)
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

  refreshFromSave(): void {
    this.saveData = Save.load()
    this.refreshPage()
    this.setSelection(this.index)
    this.updatePreview()
    this.updateDebugSelectionState()
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
    this.logic.setCheckpointId(this.getSelectedCheckpointForStage(this.stages[this.index]?.id ?? ''))
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
      const isCleared = stage ? isCampaignStageCleared(this.saveData, stage.id) : false
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
    if (
      !stage ||
      !entry ||
      !this.previewTitle ||
      !this.bossNameText ||
      !this.infoText ||
      !this.detailsText ||
      !this.previewGlow ||
      !this.previewSprite
    ) {
      return
    }

    const blueprint = entry.blueprint
    const isCleared = isCampaignStageCleared(this.saveData, stage.id)
    const accessible = isStageAccessible(this.saveData, stage.id)
    const checkpointIds = this.getAccessibleCheckpointIdsForStage(stage.id)
    const checkpointId = this.getSelectedCheckpointForStage(stage.id)
    const checkpointLabel = formatCheckpointLabel(checkpointId)
    const checkProgress = this.getStageCheckProgress(stage.id)
    const finalGate = stage.id === FINAL_STAGE_ID ? evaluateFinalGate(this.saveData) : null
    const weaknessLabel = getBossWeaknessLabel(this.saveData, stage.bossId, entry.weakTo)
    const rewardLabel = getStageBossRewardLabel(
      this.saveData,
      stage.id,
      stage.rewardWeaponId ? blueprint.weaponReward?.displayName ?? stage.rewardWeaponId : 'Tutorial intel'
    )
    const requirementLabel =
      !accessible && stage.id !== FINAL_STAGE_ID ? getStageAccessRequirementLabel(stage.id) : null

    this.previewTitle.setText(truncateLabel(stage.introCallout, 24))
    this.bossNameText.setText(blueprint.codename)
    this.previewGlow.setFillStyle(blueprint.theme.glow, 0.18)
    this.previewGlow.setStrokeStyle(2, blueprint.theme.primary, 0.55)
    this.updatePreviewSprite(stage.bossId)
    this.infoText.setText(
      `${blueprint.element.toUpperCase()}  •  WEAK: ${truncateLabel(weaknessLabel, 14).toUpperCase()}\n${truncateLabel(stage.arenaLabel, 14).toUpperCase()}  •  ${
        isCleared ? 'CLEARED' : accessible ? 'OPEN' : 'LOCKED'
      }`
    )
    this.detailsText.setText(
      `REWARD: ${truncateLabel(rewardLabel, 18)}\nCHECKPOINT: ${truncateLabel(checkpointLabel, 16)} (${checkpointIds.length})\nCHECKS ${checkProgress.collected}/${checkProgress.total}\n${
        finalGate
          ? truncateLabel(`Gate: ${getFinalGateProgressLabel(this.saveData)}`, 26)
          : requirementLabel
            ? truncateLabel(`Needs: ${requirementLabel}`, 26)
          : isCleared
            ? 'MISSION RECORD COMPLETE'
            : 'READY FOR DEPLOYMENT'
      }`
    )
  }

  private updatePreviewSprite(bossId: string): void {
    if (!this.previewSprite) {
      return
    }

    const atlasKey = `atlas_${bossId}`
    if (!this.textures.exists(atlasKey)) {
      this.previewSprite.setVisible(false)
      return
    }

    const idleFrames = this.getPreviewFrames(atlasKey, `${bossId}/idle/`)
    const fallbackFrames =
      idleFrames.length > 0
        ? idleFrames
        : this.textures
            .get(atlasKey)
            .getFrameNames()
            .filter((name) => name !== '__BASE')
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const frameNames = fallbackFrames.length > 0 ? fallbackFrames : ['__BASE']
    if (frameNames.length === 0 || frameNames[0] === '__BASE') {
      this.previewSprite.setVisible(false)
      return
    }

    const animationKey = `stage-select-preview-${bossId}`
    if (!this.anims.exists(animationKey)) {
      this.anims.create({
        key: animationKey,
        frames: frameNames.map((frame) => ({ key: atlasKey, frame })),
        frameRate: Math.min(8, Math.max(4, frameNames.length * 2)),
        repeat: -1
      })
    }

    this.previewSprite.setVisible(true)
    this.previewSprite.setTexture(atlasKey, frameNames[0])
    const previewFrame = this.textures.getFrame(atlasKey, frameNames[0])
    const scale = previewFrame ? Math.min(1.5, 58 / Math.max(previewFrame.width, previewFrame.height)) : 1.15
    this.previewSprite.setScale(scale)
    this.previewSprite.play(animationKey, true)
  }

  private getPreviewFrames(atlasKey: string, prefix: string): string[] {
    return this.textures
      .get(atlasKey)
      .getFrameNames()
      .filter((name) => name !== '__BASE' && name.startsWith(prefix))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }

  private updateDebugSelectionState(): void {
    const stage = this.stages[this.index]
    this.selectedBossId = stage?.bossId ?? null
    this.selectedCheckpointId = stage ? this.getSelectedCheckpointForStage(stage.id) : null
    this.canConfirm = Boolean(stage && isStageAccessible(this.saveData, stage.id))
    this.selectedWeaknessLabel = stage ? getBossWeaknessLabel(this.saveData, stage.bossId) : null
    this.selectedRewardLabel = stage ? getStageBossRewardLabel(this.saveData, stage.id) : null
    this.finalGateText = getFinalGateStatusLabel(this.saveData)
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
      if (stageId && !isCampaignStageCleared(this.saveData, stageId) && isStageAccessible(this.saveData, stageId)) {
        return index
      }
    }
    return null
  }

  private confirmSelection(): void {
    this.logic.setIndex(this.index)
    this.logic.setCheckpointId(this.selectedCheckpointId)
    const transition = this.logic.confirm()
    if (!transition) {
      return
    }
    if (!isStageAccessible(this.saveData, transition.data.stageId)) {
      this.toastHandle?.destroy(true)
      AudioService.playSfx('ui_cancel')
      this.toastHandle = showToast(this, 'Stage locked. Clear more checks first.', 1300)
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
    if (!isStageAccessible(this.saveData, stage.id)) {
      this.toastHandle?.destroy(true)
      AudioService.playSfx('ui_cancel')
      this.toastHandle = showToast(this, 'Stage locked. Find the access code first.', 1400)
      return
    }
    const checkpointId = this.getSelectedCheckpointForStage(stage.id)
    AudioService.unlock()
    AudioService.playSfx('ui_confirm')
    this.startSceneTransition('Game', {
      stageId: stage.id,
      bossId: stage.bossId,
      runtimeBossConfigId: stage.runtimeBossConfigId,
      checkpointId
    })
  }

  private launchFinalRoute(): void {
    const gate = evaluateFinalGate(this.saveData)
    if (!gate.unlocked) {
      this.toastHandle?.destroy(true)
      AudioService.playSfx('ui_cancel')
      this.toastHandle = showToast(
        this,
        `Final route locked. ${gate.rules.map((rule) => `${rule.category} ${gate.counts[rule.category]}/${rule.required}`).join(' • ')}`,
        1800
      )
      return
    }
    this.launchCampaignStage(FINAL_STAGE_ID)
  }

  private startSceneTransition(scene: string, data: Record<string, unknown>): void {
    this.requestedTransition = { scene, data }
    this.transitionRequestedAt = performance.now()
    this.scene.start(scene, data)
  }

  private getAccessibleCheckpointIdsForStage(stageId: string): string[] {
    const stage = this.stages.find((entry) => entry.id === stageId) ?? getCampaignStage(stageId)
    return getAccessibleCheckpointIds(
      this.saveData,
      stage.id,
      stage.arena.checkpoints.map((checkpoint) => checkpoint.id)
    )
  }

  private getSelectedCheckpointForStage(stageId: string): string | null {
    if (!stageId) {
      return null
    }
    const accessible = this.getAccessibleCheckpointIdsForStage(stageId)
    if (accessible.length === 0) {
      return null
    }
    const saved = getSelectedCheckpointId(this.saveData, stageId)
    const selected = saved && accessible.includes(saved) ? saved : accessible[0]
    if (selected && saved !== selected) {
      this.saveData = Save.load()
      Save.setSelectedCheckpoint(stageId, selected)
      this.saveData = Save.load()
    }
    return selected
  }

  private getStageCheckProgress(stageId: string): { collected: number; total: number } {
    const locations = getStageLocationDefinitions(stageId)
    const collected = locations.filter((location) => this.saveData.collectedChecks.includes(location.id)).length
    return {
      collected,
      total: locations.length
    }
  }

  private cycleCheckpoint(delta: number): void {
    const stage = this.stages[this.index]
    if (!stage) {
      return
    }
    const accessible = this.getAccessibleCheckpointIdsForStage(stage.id)
    if (accessible.length <= 1) {
      return
    }
    const current = this.getSelectedCheckpointForStage(stage.id)
    const currentIndex = Math.max(0, accessible.indexOf(current ?? accessible[0]))
    const nextIndex = Phaser.Math.Wrap(currentIndex + delta, 0, accessible.length)
    const nextCheckpointId = accessible[nextIndex] ?? accessible[0]
    Save.setSelectedCheckpoint(stage.id, nextCheckpointId)
    this.saveData = Save.load()
    this.logic.setCheckpointId(nextCheckpointId)
    this.updatePreview()
    this.updateDebugSelectionState()
    AudioService.unlock()
    AudioService.playSfx('ui_move')
  }
}
