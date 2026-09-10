import type {
  DialogueContentDocument,
  DialogueMilestoneDefinition,
  DialogueSequenceDefinition,
  DialogueSpeakerDefinition,
  DialogueSpeakerId,
  DialogueTrigger,
  RobotMasterMilestoneCount
} from './types'
import type { CampaignStageId } from '../campaign'
import { validateDialogueContent } from './validateDialogueContent'

export class DialogueContentRegistry {
  private readonly speakers = new Map<DialogueSpeakerId, DialogueSpeakerDefinition>()
  private readonly sequences = new Map<string, DialogueSequenceDefinition>()
  private readonly milestones = new Map<RobotMasterMilestoneCount, DialogueMilestoneDefinition>()

  constructor(content: DialogueContentDocument) {
    for (const speaker of content.speakers) this.speakers.set(speaker.id, speaker)
    for (const sequence of content.sequences) {
      this.sequences.set(`${sequence.stageId}:${sequence.trigger}`, sequence)
    }
    for (const milestone of content.milestones) {
      this.milestones.set(milestone.clearedBossCount, milestone)
    }
  }

  getSpeaker(id: DialogueSpeakerId): DialogueSpeakerDefinition | undefined {
    return this.speakers.get(id)
  }

  getSpeakers(): DialogueSpeakerDefinition[] {
    return [...this.speakers.values()]
  }

  getSequence(
    stageId: CampaignStageId,
    trigger: DialogueTrigger
  ): DialogueSequenceDefinition | undefined {
    return this.sequences.get(`${stageId}:${trigger}`)
  }

  getSequences(): DialogueSequenceDefinition[] {
    return [...this.sequences.values()]
  }

  getMilestone(clearedBossCount: number): DialogueMilestoneDefinition | undefined {
    return this.milestones.get(clearedBossCount as RobotMasterMilestoneCount)
  }

  getMilestones(): DialogueMilestoneDefinition[] {
    return [...this.milestones.values()].sort((a, b) => a.clearedBossCount - b.clearedBossCount)
  }
}

export function createDialogueRegistry(value: unknown): DialogueContentRegistry {
  const result = validateDialogueContent(value)
  if (!result.valid) {
    throw new Error(`Invalid dialogue content:\n- ${result.errors.join('\n- ')}`)
  }
  return new DialogueContentRegistry(result.data)
}
