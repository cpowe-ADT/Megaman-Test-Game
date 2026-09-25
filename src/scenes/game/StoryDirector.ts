import type Phaser from 'phaser'
import { AUTOMATION } from '../../config/automation'
import { getCampaignStage, resolveCheckpointRadioId, type CampaignStageId } from '../../content/campaign'
import {
  DIALOGUE_REGISTRY,
  resolveDialogueText,
  type DialogueInterpolationValues,
  type DialogueLineDefinition,
  type DialogueTrigger
} from '../../content/dialogue/index'
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
 * checkpoint, boss intro and defeat playback, the first-weakness hint, and seen flags.
 * It never grants rewards, writes completion, or changes scenes.
 */
export class StoryDirector {
  private readonly intro: StageIntroPresenter
  private introRunning = false

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
    const lane = this.deps.lane()
    const sequence = DIALOGUE_REGISTRY.getSequence(this.deps.stageId, 'miniboss_callout')
    if (!lane || !sequence || !shouldPlayStory(Save.load().storyFlags, sequence.id, currentStoryPolicy())) return
    Save.markStorySeen(sequence.id)
    for (const line of resolvePlaybackLines(sequence.id, sequence.lines, this.deps.values())) {
      lane.enqueue({ kind: 'radio', speaker: line.speakerName, text: line.text, durationMs: RADIO_LINE_MS })
    }
  }

  /** Boss dialogue ignores the automation switch (existing smoke contracts) but honors seen flags. */
  playBossIntro(then: () => void): void {
    this.playBlocking(`${this.deps.stageId}_intro`, 'boss_intro', then)
  }

  playBossDefeat(then: () => void): void {
    this.playBlocking(`${this.deps.stageId}_defeat`, 'boss_defeat', then)
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

  getDebugState(): { intro: ReturnType<StageIntroPresenter['snapshot']>; policy: StoryPolicy; flags: string[] } {
    return { intro: this.intro.snapshot(), policy: currentStoryPolicy(), flags: Save.load().storyFlags }
  }

  private playBlocking(sequenceId: string, trigger: DialogueTrigger, then: () => void): void {
    const overlay = this.deps.overlay()
    const policy: StoryPolicy = { enabled: true, replay: Settings.get().storyReplay }
    const lines = shouldPlayStory(Save.load().storyFlags, sequenceId, policy)
      ? this.buildLines(this.deps.stageId, trigger)
      : []
    if (lines.length === 0 || !overlay) {
      then()
      return
    }
    Save.markStorySeen(sequenceId)
    this.deps.freeze()
    overlay.play(lines, () => {
      this.deps.resume()
      then()
    })
  }
}

/** Milestone selection for the Stage Select return: the count milestone that has not been seen yet. */
export function pendingMilestoneId(clearedCount: number): string | null {
  const milestone = DIALOGUE_REGISTRY.getMilestone(clearedCount)
  if (!milestone) return null
  return shouldPlayStory(Save.load().storyFlags, milestone.id, currentStoryPolicy()) ? milestone.id : null
}
