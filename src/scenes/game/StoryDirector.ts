import type Phaser from 'phaser'
import { AUTOMATION } from '../../config/automation'
import { getCampaignStage, resolveCheckpointRadioId, type CampaignStageId } from '../../content/campaign'
import {
  DIALOGUE_REGISTRY,
  resolveDialogueText,
  type DialogueInterpolationValues,
  type DialogueLineDefinition,
  type DialogueSequenceDefinition,
  type DialogueTrigger
} from '../../content/dialogue/index'
import {
  buildWeaponGetCard,
  capsuleCacheStageId,
  gainedWeaponIds,
  gameOverLineIndex,
  hasAllCapsuleCaches,
  type WeaponGetCardData
} from '../../content/dialogue/storyTriggers'
import type { DialoguePlaybackLine } from '../../narrative/DialoguePlayback'
import { shouldPlayStory, type StoryPolicy } from '../../narrative/storyFlags'
import { Save } from '../../systems/Save'
import { Settings } from '../../systems/Settings'
import type { DialogueOverlayController } from '../../ui/DialogueOverlayController'
import { StageIntroPresenter } from '../../ui/StageIntroPresenter'
import type { ToastLane, ToastLaneItem } from '../../ui/ToastLane'

export const RADIO_LINE_MS = 4500
export const CHECKPOINT_TOAST_MS = 900
export const KEY_HINT_MS = 2400
export const COACH_LANE_CHANNEL = 'tutorial_coach'

export type StoryDirectorDeps = {
  scene: Phaser.Scene
  stageId: CampaignStageId
  overlay: () => DialogueOverlayController | undefined
  lane: () => ToastLane | undefined
  values: () => DialogueInterpolationValues
  freeze: () => void
  resume: () => void
}

/** Builds resolved playback lines from registry lines; narration lines carry no speaker. */
export function resolvePlaybackLines(
  groupId: string,
  lines: DialogueLineDefinition[],
  values: DialogueInterpolationValues
): DialoguePlaybackLine[] {
  return lines.map((line) => {
    const speaker = DIALOGUE_REGISTRY.getSpeaker(line.speakerId)
    return {
      sequenceId: groupId,
      speakerId: line.speakerId ?? '',
      speakerName: speaker ? resolveDialogueText(speaker.displayName, values) : '',
      text: resolveDialogueText(line.text, values)
    }
  })
}

export function currentStoryPolicy(): StoryPolicy {
  return { enabled: AUTOMATION.storyIntro, replay: Settings.get().storyReplay }
}

/**
 * Owns story policy inside a stage: the intro card and briefing, the radio pair at the mid
 * checkpoint, boss intro and defeat playback, the first-weakness hint, the capsule cache log, OMEGA's
 * phase-two line, the weapon-get registry line, and seen flags.
 * It never grants rewards, writes completion, or changes scenes.
 */
export class StoryDirector {
  private readonly intro: StageIntroPresenter
  private introRunning = false
  private lastWeaponGetCard: WeaponGetCardData | null = null

  constructor(private readonly deps: StoryDirectorDeps) {
    this.intro = new StageIntroPresenter(deps.scene)
  }

  /**
   * Stage entry. A resumed active run skips the card and briefing; a fresh entry shows the card,
   * and the briefing only when the stage starts at its first checkpoint.
   */
  beginStage(options: { resumedFromRun: boolean; startCheckpointIndex: number }, onControl: () => void): void {
    const policy = currentStoryPolicy()
    const stage = getCampaignStage(this.deps.stageId)
    const briefingId = `${this.deps.stageId}_briefing`
    const showCard = policy.enabled && !options.resumedFromRun
    const showBriefing = showCard && options.startCheckpointIndex === 0 && shouldPlayStory(Save.load().storyFlags, briefingId, policy)
    if (!showCard) {
      onControl()
      return
    }
    const briefingLines = showBriefing ? this.buildLines(this.deps.stageId, 'stage_briefing') : []
    if (showBriefing) Save.markStorySeen(briefingId)
    this.introRunning = true
    this.deps.freeze()
    this.intro.start({
      callout: stage.introCallout,
      title: stage.title,
      card: true,
      briefingLines,
      overlay: this.deps.overlay(),
      onDone: () => {
        this.introRunning = false
        this.deps.resume()
        onControl()
      }
    })
  }

  update(deltaMs: number): void {
    if (this.introRunning) this.intro.update(deltaMs)
  }

  isBlocking(): boolean {
    return this.introRunning && this.intro.isActive()
  }

  advanceIntro(): void { this.intro.advance() }
  skipIntro(): void { this.intro.skip() }

  /** Checkpoint reached: the toast always shows; the radio pair fires once at the mid checkpoint. */
  onCheckpoint(index: number, checkpoint: { id: string; radioSequenceId?: string }): void {
    const lane = this.deps.lane()
    lane?.enqueue({ kind: 'toast', text: `Checkpoint ${index + 1}`, durationMs: CHECKPOINT_TOAST_MS })
    const radioId = checkpoint.radioSequenceId ?? resolveCheckpointRadioId(this.deps.stageId, index, getCampaignStage(this.deps.stageId).arena.checkpoints)
    if (!radioId || !lane) return
    const policy = currentStoryPolicy()
    if (!shouldPlayStory(Save.load().storyFlags, radioId, policy)) return
    const sequence = DIALOGUE_REGISTRY.getSequenceById(radioId)
    if (!sequence) return
    Save.markStorySeen(radioId)
    for (const line of resolvePlaybackLines(sequence.id, sequence.lines, this.deps.values())) {
      lane.enqueue({ kind: 'radio', speaker: line.speakerName, text: line.text, durationMs: RADIO_LINE_MS })
    }
  }

  /**
   * A tutorial room lock armed: the lane shows the key hint (UI, from the bindings), then Rook's
   * recorded intake prompt for that lock by position (the validator binds line N to lock N) when story is
   * on. Both replace any coach items still queued, so the lane never trails the hero by a segment.
   * Neither opens the gate; only the verb does.
   */
  onRoomLockArmed(lockIndex: number, keyHint: string): void {
    const lane = this.deps.lane()
    if (!lane) return
    const items: ToastLaneItem[] = [{ kind: 'hint', text: keyHint, durationMs: KEY_HINT_MS }]
    const sequence = DIALOGUE_REGISTRY.getSequence(this.deps.stageId, 'tutorial_coach')
    const line = sequence?.lines[lockIndex]
    if (sequence && line && currentStoryPolicy().enabled) {
      const [resolved] = resolvePlaybackLines(sequence.id, [line], this.deps.values())
      items.push({ kind: 'radio', speaker: resolved.speakerName, text: resolved.text, durationMs: RADIO_LINE_MS })
    }
    lane.supersede(COACH_LANE_CHANNEL, items)
  }

  /** The mid-boss room locked: the stage's `miniboss_callout` plays on the radio lane once (never blocks, grants nothing). */
  onMiniBossLock(): void {
    this.playTickerOnce(DIALOGUE_REGISTRY.getSequence(this.deps.stageId, 'miniboss_callout'))
  }

  /** A warden entered phase two: OMEGA's `warden_phase` line on the radio lane once. The Core's phases are `finale_phase`. */
  onBossPhaseTwo(): void {
    this.playTickerOnce(DIALOGUE_REGISTRY.getStageSequence(this.deps.stageId, 'warden_phase'))
  }

  /**
   * An item location was claimed. A warden stage's capsule cache makes the capsule card: the warden's recorded
   * cache log above the effect label, one lane item (story on). Returns false when the caller shows its plain
   * toast instead. The claim already granted the item; this only presents it.
   */
  showCapsuleCard(locationId: string, effectLabel: string, durationMs: number): boolean {
    const lane = this.deps.lane()
    const stageId = capsuleCacheStageId(locationId)
    const sequence = stageId ? DIALOGUE_REGISTRY.getStageSequence(stageId, 'capsule_pickup') : undefined
    if (!lane || !sequence || !currentStoryPolicy().enabled) return false
    const [log] = resolvePlaybackLines(sequence.id, sequence.lines, this.deps.values())
    Save.markStorySeen(sequence.id)
    lane.enqueue({ kind: 'radio', speaker: `${log.speakerName} · CACHE LOG`, text: `${log.text}\n${effectLabel}`, durationMs: Math.max(RADIO_LINE_MS, durationMs) })
    return true
  }

  /** The weapon-get card's data for one weapon (prompt 08 draws the card); keyed by the weapon's source stage. */
  buildWeaponGetCard(weaponId: string): WeaponGetCardData {
    return buildWeaponGetCard(DIALOGUE_REGISTRY, weaponId, this.deps.values())
  }

  /** Boss dialogue ignores the automation switch (existing smoke contracts) but honors seen flags. */
  playBossIntro(then: () => void): void {
    this.playBlocking(`${this.deps.stageId}_intro`, 'boss_intro', then)
  }

  /**
   * The defeat lines, then (story on) Iona's registry line for each weapon gained since `previousWeapons`: until
   * prompt 08's weapon-get card exists, the line closes the defeat dialogue, so one skip covers both.
   */
  playBossDefeat(then: () => void, previousWeapons?: readonly string[]): void {
    this.playBlocking(`${this.deps.stageId}_defeat`, 'boss_defeat', then, previousWeapons ? this.weaponGetLines(previousWeapons) : [])
  }

  /** First weakness hit: one radio line, once per campaign. */
  onWeaknessHit(): void {
    const milestone = DIALOGUE_REGISTRY.getFirstWeaknessMilestone()
    const lane = this.deps.lane()
    if (!milestone || !lane) return
    const policy = currentStoryPolicy()
    if (!shouldPlayStory(Save.load().storyFlags, milestone.id, policy)) return
    Save.markStorySeen(milestone.id)
    for (const line of resolvePlaybackLines(milestone.id, milestone.lines, this.deps.values())) {
      lane.enqueue({ kind: 'radio', speaker: line.speakerName, text: line.text, durationMs: RADIO_LINE_MS })
    }
  }

  buildLines(stageId: string, trigger: DialogueTrigger): DialoguePlaybackLine[] {
    const sequence = DIALOGUE_REGISTRY.getSequence(stageId as CampaignStageId, trigger)
    return sequence ? resolvePlaybackLines(sequence.id, sequence.lines, this.deps.values()) : []
  }

  getDebugState(): { intro: ReturnType<StageIntroPresenter['snapshot']>; policy: StoryPolicy; flags: string[]; weaponGetCard: WeaponGetCardData | null } {
    return { intro: this.intro.snapshot(), policy: currentStoryPolicy(), flags: Save.load().storyFlags, weaponGetCard: this.lastWeaponGetCard }
  }

  /** One non-blocking sequence on the radio lane, once per its seen flag (story on). */
  private playTickerOnce(sequence: DialogueSequenceDefinition | undefined): void {
    const lane = this.deps.lane()
    if (!lane || !sequence || !shouldPlayStory(Save.load().storyFlags, sequence.id, currentStoryPolicy())) return
    Save.markStorySeen(sequence.id)
    for (const line of resolvePlaybackLines(sequence.id, sequence.lines, this.deps.values())) {
      lane.enqueue({ kind: 'radio', speaker: line.speakerName, text: line.text, durationMs: RADIO_LINE_MS })
    }
  }

  /** Registry lines for the weapons gained since `previousWeapons` (story on, unseen); the last card stays in the debug state. */
  private weaponGetLines(previousWeapons: readonly string[]): DialoguePlaybackLine[] {
    const save = Save.load()
    const cards = gainedWeaponIds(previousWeapons, save.weaponsUnlocked).map((weaponId) => this.buildWeaponGetCard(weaponId))
    if (cards.length > 0) this.lastWeaponGetCard = cards[cards.length - 1]
    const policy = currentStoryPolicy()
    return cards.flatMap((card) => (card.registry && shouldPlayStory(save.storyFlags, card.registry.sequenceId, policy) ? [card.registry] : []))
  }

  private playBlocking(sequenceId: string, trigger: DialogueTrigger, then: () => void, trailing: DialoguePlaybackLine[] = []): void {
    const overlay = this.deps.overlay()
    const policy: StoryPolicy = { enabled: true, replay: Settings.get().storyReplay }
    const own = shouldPlayStory(Save.load().storyFlags, sequenceId, policy)
      ? this.buildLines(this.deps.stageId, trigger)
      : []
    const lines = [...own, ...trailing]
    if (lines.length === 0 || !overlay) {
      then()
      return
    }
    if (own.length > 0) Save.markStorySeen(sequenceId)
    if (trailing.length > 0) Save.markStorySeen(...trailing.map((line) => line.sequenceId))
    this.deps.freeze()
    overlay.play(lines, () => {
      this.deps.resume()
      then()
    })
  }
}

/** The game-over screen's line (story on): the rotation by the save's game-over count, over the Continue row. */
export function gameOverLine(gameOverCount: number, values: DialogueInterpolationValues): (DialoguePlaybackLine & { index: number }) | null {
  const sequence = DIALOGUE_REGISTRY.getGlobalSequence('game_over')
  const index = sequence ? gameOverLineIndex(gameOverCount, sequence.lines.length) : -1
  if (!sequence || index < 0 || !currentStoryPolicy().enabled) return null
  Save.markStorySeen(sequence.id)
  return { ...resolvePlaybackLines(sequence.id, [sequence.lines[index]], values)[0], index }
}

/** The epilogue secret (story on, every warden capsule cache collected): the Drill Hangar card caption, then Iona's line. */
export function epilogueSecret(collectedChecks: readonly string[], values: DialogueInterpolationValues): { card: string; line: DialoguePlaybackLine } | null {
  const sequence = DIALOGUE_REGISTRY.getGlobalSequence('epilogue_secret')
  if (!sequence || !currentStoryPolicy().enabled || !hasAllCapsuleCaches(collectedChecks)) return null
  const [card, line] = resolvePlaybackLines(sequence.id, sequence.lines, values)
  Save.markStorySeen(sequence.id)
  return { card: card.text, line }
}

/** Milestone selection for the Stage Select return: the count milestone that has not been seen yet. */
export function pendingMilestoneId(clearedCount: number): string | null {
  const milestone = DIALOGUE_REGISTRY.getMilestone(clearedCount)
  if (!milestone) return null
  return shouldPlayStory(Save.load().storyFlags, milestone.id, currentStoryPolicy()) ? milestone.id : null
}
