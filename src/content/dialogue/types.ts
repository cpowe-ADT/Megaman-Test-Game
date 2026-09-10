import type { CampaignStageId } from '../campaign'

export const DIALOGUE_SCHEMA_VERSION = '1' as const

export const DIALOGUE_SPEAKER_IDS = [
  'director_iona',
  'hero',
  'sentinel_rook',
  'pyro_maw',
  'tide_reaver',
  'volt_hopper',
  'basalt_titan',
  'ferro_blade',
  'mire_wraith',
  'gale_vixen',
  'glacier_ronin',
  'omega_core'
] as const

export const DIALOGUE_INTERPOLATION_TOKENS = [
  'hero',
  'rewardLabel',
  'clearedCount',
  'remainingCount'
] as const

export const ROBOT_MASTER_MILESTONE_COUNTS = [1, 4, 8] as const

export type DialogueSpeakerId = (typeof DIALOGUE_SPEAKER_IDS)[number]
export type DialogueInterpolationToken = (typeof DIALOGUE_INTERPOLATION_TOKENS)[number]
export type RobotMasterMilestoneCount = (typeof ROBOT_MASTER_MILESTONE_COUNTS)[number]
export type DialogueTrigger = 'boss_intro' | 'boss_defeat'
export type DialogueSpeakerRole = 'operator' | 'protagonist' | 'warden' | 'antagonist'

export type DialogueSpeakerDefinition = {
  id: DialogueSpeakerId
  displayName: string
  role: DialogueSpeakerRole
}

export type DialogueLineDefinition = {
  speakerId: DialogueSpeakerId
  text: string
}

export type DialogueSequenceDefinition = {
  id: string
  stageId: CampaignStageId
  trigger: DialogueTrigger
  lines: DialogueLineDefinition[]
}

export type DialogueMilestoneDefinition = {
  id: string
  kind: 'robot_master_clear_count'
  clearedBossCount: RobotMasterMilestoneCount
  lines: DialogueLineDefinition[]
}

export type DialogueContentDocument = {
  schemaVersion: typeof DIALOGUE_SCHEMA_VERSION
  speakers: DialogueSpeakerDefinition[]
  sequences: DialogueSequenceDefinition[]
  milestones: DialogueMilestoneDefinition[]
}

export type DialogueInterpolationValues = Partial<
  Record<DialogueInterpolationToken, string | number>
>

export type ResolvedDialogueLine = Omit<DialogueLineDefinition, 'text'> & { text: string }
export type ResolvedDialogueSequence = Omit<DialogueSequenceDefinition, 'lines'> & {
  lines: ResolvedDialogueLine[]
}
