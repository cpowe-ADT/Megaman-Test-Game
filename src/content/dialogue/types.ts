import type { CampaignStageId } from '../campaign'

export const DIALOGUE_SCHEMA_VERSION = '2' as const

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
  'remainingCount',
  'districtName',
  'wardenName'
] as const

export const ROBOT_MASTER_MILESTONE_COUNTS = [1, 4, 8] as const

/** Triggers bound to one campaign stage. */
export const STAGE_DIALOGUE_TRIGGERS = [
  'stage_briefing',
  'radio',
  'miniboss_callout',
  'boss_intro',
  'boss_defeat',
  'district_restored',
  /** Tutorial only: Rook's recorded intake prompts, one per teach lock, on the ticker as each lock arms. */
  'tutorial_coach'
] as const

/** Triggers that belong to the campaign as a whole. */
export const GLOBAL_DIALOGUE_TRIGGERS = ['prologue', 'epilogue', 'credits', 'finale_phase'] as const

export const FINALE_PHASES = [1, 2, 3] as const

/** Triggers whose lines may be narration (no speaker). */
export const NARRATION_TRIGGERS = ['prologue', 'epilogue', 'credits'] as const

export type DialogueSpeakerId = (typeof DIALOGUE_SPEAKER_IDS)[number]
export type DialogueInterpolationToken = (typeof DIALOGUE_INTERPOLATION_TOKENS)[number]
export type RobotMasterMilestoneCount = (typeof ROBOT_MASTER_MILESTONE_COUNTS)[number]
export type StageDialogueTrigger = (typeof STAGE_DIALOGUE_TRIGGERS)[number]
export type GlobalDialogueTrigger = (typeof GLOBAL_DIALOGUE_TRIGGERS)[number]
export type DialogueTrigger = StageDialogueTrigger | GlobalDialogueTrigger
export type FinalePhase = (typeof FINALE_PHASES)[number]
export type DialogueSpeakerRole = 'operator' | 'protagonist' | 'warden' | 'antagonist'
export type DialogueMilestoneKind = 'robot_master_clear_count' | 'first_weakness'

/** Line-count limits per trigger; the validator enforces them. */
export const DIALOGUE_LINE_LIMITS: Record<DialogueTrigger, { min: number; max: number }> = {
  stage_briefing: { min: 2, max: 3 },
  radio: { min: 1, max: 2 },
  miniboss_callout: { min: 1, max: 1 },
  boss_intro: { min: 2, max: 4 },
  boss_defeat: { min: 2, max: 4 },
  district_restored: { min: 1, max: 1 },
  tutorial_coach: { min: 4, max: 6 },
  prologue: { min: 4, max: 12 },
  epilogue: { min: 9, max: 12 },
  credits: { min: 1, max: 40 },
  finale_phase: { min: 1, max: 2 }
}

export const DIALOGUE_MILESTONE_LINE_LIMITS = { min: 1, max: 4 } as const

export const DIALOGUE_MAX_LINE_LENGTH = 180

export type DialogueSpeakerDefinition = {
  id: DialogueSpeakerId
  displayName: string
  role: DialogueSpeakerRole
}

export type DialogueLineDefinition = {
  /** Omitted only on narration lines inside prologue, epilogue and credits. */
  speakerId?: DialogueSpeakerId
  text: string
  /** Epilogue only: the warden stage whose district card this line captions. */
  card?: CampaignStageId
}

export type DialogueSequenceDefinition = {
  id: string
  trigger: DialogueTrigger
  /** Required for stage triggers, forbidden for global triggers. */
  stageId?: CampaignStageId
  /** finale_phase only. */
  phase?: FinalePhase
  /** Presentation note for the script document; never shown in game. */
  staging?: string
  lines: DialogueLineDefinition[]
}

export type DialogueMilestoneDefinition = {
  id: string
  kind: DialogueMilestoneKind
  /** robot_master_clear_count only. */
  clearedBossCount?: RobotMasterMilestoneCount
  staging?: string
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
