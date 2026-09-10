import type {
  DialogueContentDocument,
  DialogueMilestoneDefinition,
  DialogueSequenceDefinition,
  DialogueSpeakerDefinition,
  DialogueSpeakerId,
  DialogueTrigger,
  FinalePhase,
  RobotMasterMilestoneCount,
  StageDialogueTrigger
} from './types'
import type { CampaignStageId } from '../campaign'
import { validateDialogueContent } from './validateDialogueContent'

type GlobalSequenceTrigger = 'prologue' | 'epilogue' | 'credits'

export class DialogueContentRegistry {
  private readonly speakers = new Map<DialogueSpeakerId, DialogueSpeakerDefinition>()
  private readonly sequencesById = new Map<string, DialogueSequenceDefinition>()
  private readonly stageSequences = new Map<string, DialogueSequenceDefinition>()
  private readonly globalSequences = new Map<string, DialogueSequenceDefinition>()
  private readonly milestones = new Map<RobotMasterMilestoneCount, DialogueMilestoneDefinition>()
  private firstWeakness: DialogueMilestoneDefinition | undefined

  constructor(content: DialogueContentDocument) {
    for (const speaker of content.speakers) this.speakers.set(speaker.id, speaker)
    for (const sequence of content.sequences) {
      this.sequencesById.set(sequence.id, sequence)
      if (sequence.stageId) {
        this.stageSequences.set(`${sequence.stageId}:${sequence.trigger}`, sequence)
      } else if (sequence.trigger === 'finale_phase') {
        this.globalSequences.set(`finale_phase:${sequence.phase}`, sequence)
      } else {
        this.globalSequences.set(sequence.trigger, sequence)
      }
    }
    for (const milestone of content.milestones) {
      if (milestone.kind === 'first_weakness') this.firstWeakness = milestone
      else if (milestone.clearedBossCount) this.milestones.set(milestone.clearedBossCount, milestone)
    }
  }

  getSpeaker(id: DialogueSpeakerId | undefined): DialogueSpeakerDefinition | undefined {
    return id ? this.speakers.get(id) : undefined
  }

  getSpeakers(): DialogueSpeakerDefinition[] {
    return [...this.speakers.values()]
  }

  /** Stage-bound lookup; the trigger type is kept wide so existing callers compile. */
  getSequence(stageId: CampaignStageId, trigger: DialogueTrigger): DialogueSequenceDefinition | undefined {
    return this.stageSequences.get(`${stageId}:${trigger}`)
  }

  getStageSequence(stageId: CampaignStageId, trigger: StageDialogueTrigger): DialogueSequenceDefinition | undefined {
    return this.stageSequences.get(`${stageId}:${trigger}`)
  }

  getGlobalSequence(trigger: GlobalSequenceTrigger): DialogueSequenceDefinition | undefined {
    return this.globalSequences.get(trigger)
  }

  getFinalePhase(phase: FinalePhase): DialogueSequenceDefinition | undefined {
    return this.globalSequences.get(`finale_phase:${phase}`)
  }

  getSequenceById(id: string): DialogueSequenceDefinition | undefined {
    return this.sequencesById.get(id)
  }

  getSequences(): DialogueSequenceDefinition[] {
    return [...this.sequencesById.values()]
  }

  getMilestone(clearedBossCount: number): DialogueMilestoneDefinition | undefined {
    return this.milestones.get(clearedBossCount as RobotMasterMilestoneCount)
  }

  getMilestones(): DialogueMilestoneDefinition[] {
    return [...this.milestones.values()].sort((a, b) => (a.clearedBossCount ?? 0) - (b.clearedBossCount ?? 0))
  }

  getFirstWeaknessMilestone(): DialogueMilestoneDefinition | undefined {
    return this.firstWeakness
  }

  /** Every id a complete playthrough marks as seen; story-flag parity checks compare against this. */
  getRequiredStoryIds(): string[] {
    const ids = [...this.sequencesById.keys(), ...this.getMilestones().map((entry) => entry.id)]
    if (this.firstWeakness) ids.push(this.firstWeakness.id)
    return ids
  }
}

export function createDialogueRegistry(value: unknown): DialogueContentRegistry {
  const result = validateDialogueContent(value)
  if (!result.valid) {
    throw new Error(`Invalid dialogue content:\n- ${result.errors.join('\n- ')}`)
  }
  return new DialogueContentRegistry(result.data)
}
