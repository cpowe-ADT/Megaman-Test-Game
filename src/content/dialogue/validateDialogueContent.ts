import {
  FINAL_STAGE_ID,
  ROBOT_MASTER_STAGE_IDS,
  TUTORIAL_STAGE_ID,
  type CampaignStageId
} from '../campaign'
import {
  DIALOGUE_INTERPOLATION_TOKENS,
  DIALOGUE_SCHEMA_VERSION,
  DIALOGUE_SPEAKER_IDS,
  ROBOT_MASTER_MILESTONE_COUNTS,
  type DialogueContentDocument,
  type DialogueLineDefinition,
  type DialogueTrigger
} from './types'

export type DialogueContentValidationResult =
  | { valid: true; data: DialogueContentDocument; errors: [] }
  | { valid: false; errors: string[] }

const CAMPAIGN_STAGE_IDS: readonly CampaignStageId[] = [
  TUTORIAL_STAGE_ID,
  ...ROBOT_MASTER_STAGE_IDS,
  FINAL_STAGE_ID
]
const DIALOGUE_TRIGGERS: readonly DialogueTrigger[] = ['boss_intro', 'boss_defeat']
const SPEAKER_ROLES = ['operator', 'protagonist', 'warden', 'antagonist'] as const
const ORDER_INDEPENDENT_MILESTONE_SPEAKERS = ['director_iona', 'hero'] as const
const TOKEN_PATTERN = /\{([^{}]+)\}/g

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

function validateLines(
  value: unknown,
  path: string,
  registeredSpeakers: Set<string>,
  errors: string[]
): value is DialogueLineDefinition[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    errors.push(`${path} must contain 1 to 4 lines`)
    return false
  }

  value.forEach((line, index) => {
    const linePath = `${path}[${index}]`
    if (!isObject(line)) {
      errors.push(`${linePath} must be an object`)
      return
    }
    if (!isNonEmptyString(line.speakerId) || !registeredSpeakers.has(line.speakerId)) {
      errors.push(`${linePath} references unregistered speaker ${String(line.speakerId)}`)
    }
    if (!isNonEmptyString(line.text, 180)) {
      errors.push(`${linePath}.text must be 1 to 180 characters`)
      return
    }
    validateTemplate(line.text, `${linePath}.text`, errors)
  })

  return true
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

  const sequenceIds = new Set<string>()
  const sequenceCoverage = new Map<string, number>()
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
      if (!CAMPAIGN_STAGE_IDS.includes(sequence.stageId as CampaignStageId)) {
        errors.push(`${path}.stageId is not a campaign stage`)
      }
      if (!DIALOGUE_TRIGGERS.includes(sequence.trigger as DialogueTrigger)) {
        errors.push(`${path}.trigger is invalid`)
      }
      if (
        CAMPAIGN_STAGE_IDS.includes(sequence.stageId as CampaignStageId) &&
        DIALOGUE_TRIGGERS.includes(sequence.trigger as DialogueTrigger)
      ) {
        const coverageKey = `${sequence.stageId}:${sequence.trigger}`
        sequenceCoverage.set(coverageKey, (sequenceCoverage.get(coverageKey) ?? 0) + 1)
      }
      validateLines(sequence.lines, `${path}.lines`, registeredSpeakers, errors)
    })
  }

  for (const stageId of CAMPAIGN_STAGE_IDS) {
    for (const trigger of DIALOGUE_TRIGGERS) {
      const coverageKey = `${stageId}:${trigger}`
      const count = sequenceCoverage.get(coverageKey) ?? 0
      if (count !== 1) {
        errors.push(`Dialogue coverage ${coverageKey} must appear exactly once (found ${count})`)
      }
    }
  }

  const milestoneIds = new Set<string>()
  const milestoneCounts: number[] = []
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
      if (milestone.kind !== 'robot_master_clear_count') {
        errors.push(`${path}.kind must be robot_master_clear_count`)
      }
      if (!ROBOT_MASTER_MILESTONE_COUNTS.includes(milestone.clearedBossCount as any)) {
        errors.push(`${path}.clearedBossCount must be 1, 4, or 8`)
      } else {
        milestoneCounts.push(milestone.clearedBossCount as number)
      }
      validateLines(milestone.lines, `${path}.lines`, registeredSpeakers, errors)
      if (Array.isArray(milestone.lines)) {
        milestone.lines.forEach((line, lineIndex) => {
          if (
            isObject(line) &&
            !ORDER_INDEPENDENT_MILESTONE_SPEAKERS.includes(line.speakerId as any)
          ) {
            errors.push(
              `${path}.lines[${lineIndex}] must use an order-independent operator or hero speaker`
            )
          }
        })
      }
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

  if (errors.length > 0) {
    return { valid: false, errors }
  }
  return { valid: true, data: value as DialogueContentDocument, errors: [] }
}
