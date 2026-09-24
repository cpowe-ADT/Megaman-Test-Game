import {
  FINAL_STAGE_ID,
  ROBOT_MASTER_STAGE_IDS,
  TUTORIAL_STAGE_ID,
  getCampaignStage,
  type CampaignStageId
} from '../campaign'
import {
  DIALOGUE_INTERPOLATION_TOKENS,
  DIALOGUE_LINE_LIMITS,
  DIALOGUE_MAX_LINE_LENGTH,
  DIALOGUE_MILESTONE_LINE_LIMITS,
  DIALOGUE_SCHEMA_VERSION,
  DIALOGUE_SPEAKER_IDS,
  FINALE_PHASES,
  GLOBAL_DIALOGUE_TRIGGERS,
  NARRATION_TRIGGERS,
  ROBOT_MASTER_MILESTONE_COUNTS,
  STAGE_DIALOGUE_TRIGGERS,
  type DialogueContentDocument,
  type DialogueLineDefinition,
  type DialogueTrigger,
  type StageDialogueTrigger
} from './types'

export type DialogueContentValidationResult =
  | { valid: true; data: DialogueContentDocument; errors: [] }
  | { valid: false; errors: string[] }

const CAMPAIGN_STAGE_IDS: readonly CampaignStageId[] = [
  TUTORIAL_STAGE_ID,
  ...ROBOT_MASTER_STAGE_IDS,
  FINAL_STAGE_ID
]
const WARDEN_STAGE_IDS: readonly CampaignStageId[] = [...ROBOT_MASTER_STAGE_IDS]
const ALL_TRIGGERS: readonly DialogueTrigger[] = [...STAGE_DIALOGUE_TRIGGERS, ...GLOBAL_DIALOGUE_TRIGGERS]
const SPEAKER_ROLES = ['operator', 'protagonist', 'warden', 'antagonist'] as const
const ORDER_INDEPENDENT_MILESTONE_SPEAKERS = ['director_iona', 'hero'] as const
const TOKEN_PATTERN = /\{([^{}]+)\}/g
/** A defeat line acknowledges a reward; it never performs the grant. */
const DEFEAT_FORBIDDEN_VERBS = /\b(grant|grants|granted|granting|unlock|unlocks|unlocked|unlocking|receive|receives|received|receiving)\b/i

/** Which stages each stage-bound trigger must cover exactly once. */
export const STAGE_TRIGGER_COVERAGE: Record<StageDialogueTrigger, readonly CampaignStageId[]> = {
  stage_briefing: CAMPAIGN_STAGE_IDS,
  radio: CAMPAIGN_STAGE_IDS,
  miniboss_callout: WARDEN_STAGE_IDS,
  boss_intro: CAMPAIGN_STAGE_IDS,
  boss_defeat: CAMPAIGN_STAGE_IDS,
  district_restored: WARDEN_STAGE_IDS,
  tutorial_coach: [TUTORIAL_STAGE_ID]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown, maxLength = 80): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function validateTemplate(text: string, path: string, errors: string[]): void {
  const stripped = text.replace(TOKEN_PATTERN, (_match, rawToken: string) => {
    if (!DIALOGUE_INTERPOLATION_TOKENS.includes(rawToken as any)) {
      errors.push(`${path} uses unsupported interpolation token {${rawToken}}`)
    }
    return ''
  })
  if (/[{}]/.test(stripped)) {
    errors.push(`${path} contains malformed interpolation braces`)
  }
}

type LineRules = {
  min: number
  max: number
  allowNarration: boolean
  allowCard: boolean
}

function validateLines(
  value: unknown,
  path: string,
  registeredSpeakers: Set<string>,
  rules: LineRules,
  errors: string[]
): value is DialogueLineDefinition[] {
  if (!Array.isArray(value) || value.length < rules.min || value.length > rules.max) {
    errors.push(`${path} must contain ${rules.min} to ${rules.max} lines`)
    return false
  }
  value.forEach((line, index) => {
    const linePath = `${path}[${index}]`
    if (!isObject(line)) {
      errors.push(`${linePath} must be an object`)
      return
    }
    if (line.speakerId === undefined) {
      if (!rules.allowNarration) {
        errors.push(`${linePath} must name a speaker`)
      }
    } else if (!isNonEmptyString(line.speakerId) || !registeredSpeakers.has(line.speakerId)) {
      errors.push(`${linePath} references unregistered speaker ${String(line.speakerId)}`)
    }
    if (line.card !== undefined) {
      if (!rules.allowCard) {
        errors.push(`${linePath} may not carry a district card`)
      } else if (!WARDEN_STAGE_IDS.includes(line.card as CampaignStageId)) {
        errors.push(`${linePath}.card is not a warden stage`)
      }
    }
    if (!isNonEmptyString(line.text, DIALOGUE_MAX_LINE_LENGTH)) {
      errors.push(`${linePath}.text must be 1 to ${DIALOGUE_MAX_LINE_LENGTH} characters`)
      return
    }
    validateTemplate(line.text, `${linePath}.text`, errors)
  })
  return true
}

function collectWardenNames(value: Record<string, unknown>): Array<{ id: string; name: string }> {
  if (!Array.isArray(value.speakers)) return []
  return value.speakers
    .filter((speaker): speaker is Record<string, unknown> => isObject(speaker))
    .filter((speaker) => speaker.role === 'warden' && typeof speaker.displayName === 'string')
    .map((speaker) => ({ id: String(speaker.id), name: String(speaker.displayName) }))
}

function mentionsOtherWarden(
  text: string,
  ownSpeakerId: string | null,
  wardens: Array<{ id: string; name: string }>
): string | null {
  const lower = text.toLowerCase()
  for (const warden of wardens) {
    if (warden.id === ownSpeakerId) continue
    if (lower.includes(warden.name.toLowerCase())) return warden.name
  }
  return null
}

export function validateDialogueContent(value: unknown): DialogueContentValidationResult {
  const errors: string[] = []
  if (!isObject(value)) {
    return { valid: false, errors: ['Dialogue content must be an object'] }
  }

  if (value.schemaVersion !== DIALOGUE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${DIALOGUE_SCHEMA_VERSION}"`)
  }

  const registeredSpeakers = new Set<string>()
  if (!Array.isArray(value.speakers)) {
    errors.push('speakers must be an array')
  } else {
    value.speakers.forEach((speaker, index) => {
      const path = `speakers[${index}]`
      if (!isObject(speaker)) {
        errors.push(`${path} must be an object`)
        return
      }
      if (!isNonEmptyString(speaker.id) || !DIALOGUE_SPEAKER_IDS.includes(speaker.id as any)) {
        errors.push(`${path}.id is not a registered dialogue speaker id`)
      } else if (registeredSpeakers.has(speaker.id)) {
        errors.push(`Duplicate speaker id ${speaker.id}`)
      } else {
        registeredSpeakers.add(speaker.id)
      }
      if (!isNonEmptyString(speaker.displayName, 40)) {
        errors.push(`${path}.displayName must be 1 to 40 characters`)
      } else {
        validateTemplate(speaker.displayName, `${path}.displayName`, errors)
      }
      if (!SPEAKER_ROLES.includes(speaker.role as any)) {
        errors.push(`${path}.role is invalid`)
      }
    })
  }
  for (const speakerId of DIALOGUE_SPEAKER_IDS) {
    if (!registeredSpeakers.has(speakerId)) {
      errors.push(`Missing registered speaker ${speakerId}`)
    }
  }
  const wardens = collectWardenNames(value)

  const sequenceIds = new Set<string>()
  const stageCoverage = new Map<string, number>()
  const globalCoverage = new Map<string, number>()
  if (!Array.isArray(value.sequences)) {
    errors.push('sequences must be an array')
  } else {
    value.sequences.forEach((sequence, index) => {
      const path = `sequences[${index}]`
      if (!isObject(sequence)) {
        errors.push(`${path} must be an object`)
        return
      }
      if (!isNonEmptyString(sequence.id)) {
        errors.push(`${path}.id must be a non-empty string`)
      } else if (sequenceIds.has(sequence.id)) {
        errors.push(`Duplicate sequence id ${sequence.id}`)
      } else {
        sequenceIds.add(sequence.id)
      }
      const trigger = sequence.trigger as DialogueTrigger
      if (!ALL_TRIGGERS.includes(trigger)) {
        errors.push(`${path}.trigger is invalid`)
        return
      }
      if (sequence.staging !== undefined && !isNonEmptyString(sequence.staging, 240)) {
        errors.push(`${path}.staging must be 1 to 240 characters when present`)
      }
      const isStageTrigger = STAGE_DIALOGUE_TRIGGERS.includes(trigger as StageDialogueTrigger)
      const stageId = sequence.stageId as CampaignStageId | undefined
      if (isStageTrigger) {
        const allowedStages = STAGE_TRIGGER_COVERAGE[trigger as StageDialogueTrigger]
        if (!stageId || !allowedStages.includes(stageId)) {
          errors.push(`${path}.stageId must be one of the stages ${trigger} covers`)
        } else {
          const key = `${stageId}:${trigger}`
          stageCoverage.set(key, (stageCoverage.get(key) ?? 0) + 1)
        }
        if (sequence.phase !== undefined) errors.push(`${path}.phase belongs only to finale_phase`)
      } else {
        if (stageId !== undefined) errors.push(`${path}.stageId is not allowed on ${trigger}`)
        if (trigger === 'finale_phase') {
          if (!FINALE_PHASES.includes(sequence.phase as any)) {
            errors.push(`${path}.phase must be 1, 2, or 3`)
          } else {
            const key = `finale_phase:${sequence.phase}`
            globalCoverage.set(key, (globalCoverage.get(key) ?? 0) + 1)
          }
        } else {
          if (sequence.phase !== undefined) errors.push(`${path}.phase belongs only to finale_phase`)
          globalCoverage.set(trigger, (globalCoverage.get(trigger) ?? 0) + 1)
        }
      }
      const coachLines = (getCampaignStage(TUTORIAL_STAGE_ID).arena.roomLocks ?? []).length
      const limits = trigger === 'tutorial_coach' ? { min: coachLines, max: coachLines } : DIALOGUE_LINE_LIMITS[trigger]
      const rules: LineRules = {
        min: limits.min,
        max: limits.max,
        allowNarration: NARRATION_TRIGGERS.includes(trigger as any),
        allowCard: trigger === 'epilogue'
      }
      if (!validateLines(sequence.lines, `${path}.lines`, registeredSpeakers, rules, errors)) return

      const lines = sequence.lines as DialogueLineDefinition[]
      if (isStageTrigger && stageId !== FINAL_STAGE_ID) {
        const ownWardenId = stageId === TUTORIAL_STAGE_ID ? 'sentinel_rook' : stageId ?? null
        lines.forEach((line, lineIndex) => {
          const other = mentionsOtherWarden(line.text, ownWardenId, wardens)
          if (other) {
            errors.push(`${path}.lines[${lineIndex}] names another warden (${other}); stage dialogue must stay order-independent`)
          }
        })
      }
      if (trigger === 'tutorial_coach') {
        const lockOrder = (getCampaignStage(TUTORIAL_STAGE_ID).arena.roomLocks ?? []).map((lock) => lock.requiredInput)
        lines.forEach((line, lineIndex) => {
          if (line.speakerId !== 'sentinel_rook') {
            errors.push(`${path}.lines[${lineIndex}] must be spoken by sentinel_rook (the recorded intake prompts)`)
          }
          if (line.lock !== lockOrder[lineIndex]) {
            errors.push(`${path}.lines[${lineIndex}].lock must be ${lockOrder[lineIndex] ?? 'absent'} (the tutorial's room lock order)`)
          }
        })
      } else {
        lines.forEach((line, lineIndex) => {
          if (line.lock !== undefined) errors.push(`${path}.lines[${lineIndex}].lock belongs only to tutorial_coach`)
        })
      }
      if (trigger === 'boss_defeat') {
        lines.forEach((line, lineIndex) => {
          if (DEFEAT_FORBIDDEN_VERBS.test(line.text)) {
            errors.push(`${path}.lines[${lineIndex}] performs a reward (grant/unlock/receive); defeat lines only acknowledge it`)
          }
        })
      }
      if (trigger === 'epilogue') {
        const cards = lines.map((line) => line.card).filter((card): card is CampaignStageId => Boolean(card))
        for (const warden of WARDEN_STAGE_IDS) {
          const count = cards.filter((card) => card === warden).length
          if (count !== 1) errors.push(`${path} must caption district card ${warden} exactly once (found ${count})`)
        }
        lines.forEach((line, lineIndex) => {
          if (!line.card && line.speakerId === undefined) {
            errors.push(`${path}.lines[${lineIndex}] must be a district card or a spoken closing line`)
          }
        })
      }
    })
  }

  for (const trigger of STAGE_DIALOGUE_TRIGGERS) {
    for (const stageId of STAGE_TRIGGER_COVERAGE[trigger]) {
      const key = `${stageId}:${trigger}`
      const count = stageCoverage.get(key) ?? 0
      if (count !== 1) errors.push(`Dialogue coverage ${key} must appear exactly once (found ${count})`)
    }
  }
  for (const trigger of ['prologue', 'epilogue', 'credits'] as const) {
    const count = globalCoverage.get(trigger) ?? 0
    if (count !== 1) errors.push(`Dialogue coverage ${trigger} must appear exactly once (found ${count})`)
  }
  for (const phase of FINALE_PHASES) {
    const count = globalCoverage.get(`finale_phase:${phase}`) ?? 0
    if (count !== 1) errors.push(`Dialogue coverage finale_phase ${phase} must appear exactly once (found ${count})`)
  }

  const milestoneIds = new Set<string>()
  const milestoneCounts: number[] = []
  let firstWeaknessCount = 0
  if (!Array.isArray(value.milestones)) {
    errors.push('milestones must be an array')
  } else {
    value.milestones.forEach((milestone, index) => {
      const path = `milestones[${index}]`
      if (!isObject(milestone)) {
        errors.push(`${path} must be an object`)
        return
      }
      if (!isNonEmptyString(milestone.id)) {
        errors.push(`${path}.id must be a non-empty string`)
      } else if (milestoneIds.has(milestone.id)) {
        errors.push(`Duplicate milestone id ${milestone.id}`)
      } else {
        milestoneIds.add(milestone.id)
      }
      if (milestone.kind === 'robot_master_clear_count') {
        if (!ROBOT_MASTER_MILESTONE_COUNTS.includes(milestone.clearedBossCount as any)) {
          errors.push(`${path}.clearedBossCount must be 1, 4, or 8`)
        } else {
          milestoneCounts.push(milestone.clearedBossCount as number)
        }
      } else if (milestone.kind === 'first_weakness') {
        firstWeaknessCount += 1
        if (milestone.clearedBossCount !== undefined) {
          errors.push(`${path}.clearedBossCount belongs only to robot_master_clear_count`)
        }
      } else {
        errors.push(`${path}.kind must be robot_master_clear_count or first_weakness`)
      }
      const rules: LineRules = { ...DIALOGUE_MILESTONE_LINE_LIMITS, allowNarration: false, allowCard: false }
      if (!validateLines(milestone.lines, `${path}.lines`, registeredSpeakers, rules, errors)) return
      ;(milestone.lines as DialogueLineDefinition[]).forEach((line, lineIndex) => {
        if (!ORDER_INDEPENDENT_MILESTONE_SPEAKERS.includes(line.speakerId as any)) {
          errors.push(`${path}.lines[${lineIndex}] must use an order-independent operator or hero speaker`)
        }
        const other = mentionsOtherWarden(line.text, null, wardens)
        if (other) errors.push(`${path}.lines[${lineIndex}] names a warden (${other}); milestones must stay order-independent`)
      })
    })
  }

  const milestoneCountFrequency = new Map<number, number>()
  for (const count of milestoneCounts) {
    milestoneCountFrequency.set(count, (milestoneCountFrequency.get(count) ?? 0) + 1)
  }
  if (
    milestoneCounts.length !== ROBOT_MASTER_MILESTONE_COUNTS.length ||
    ROBOT_MASTER_MILESTONE_COUNTS.some((count) => milestoneCountFrequency.get(count) !== 1)
  ) {
    errors.push('Dialogue milestone counts must be exactly 1, 4, and 8, once each')
  }
  if (firstWeaknessCount !== 1) {
    errors.push(`Dialogue milestone first_weakness must appear exactly once (found ${firstWeaknessCount})`)
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }
  return { valid: true, data: value as DialogueContentDocument, errors: [] }
}
