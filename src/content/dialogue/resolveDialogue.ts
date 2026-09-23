import {
  DIALOGUE_INTERPOLATION_TOKENS,
  type DialogueInterpolationToken,
  type DialogueInterpolationValues,
  type DialogueSequenceDefinition,
  type ResolvedDialogueSequence
} from './types'

const TOKEN_PATTERN = /\{([^{}]+)\}/g

export function resolveDialogueText(
  template: string,
  values: DialogueInterpolationValues
): string {
  const malformedCheck = template.replace(TOKEN_PATTERN, '')
  if (/[{}]/.test(malformedCheck)) {
    throw new Error('Dialogue template contains malformed interpolation braces')
  }

  return template.replace(TOKEN_PATTERN, (_match, rawToken: string) => {
    if (!DIALOGUE_INTERPOLATION_TOKENS.includes(rawToken as DialogueInterpolationToken)) {
      throw new Error(`Unsupported dialogue interpolation token: ${rawToken}`)
    }
    const token = rawToken as DialogueInterpolationToken
    const value = values[token]
    if (value === undefined || value === null) {
      throw new Error(`Missing dialogue interpolation value: ${token}`)
    }
    return String(value)
  })
}

export function resolveDialogueSequence(
  sequence: DialogueSequenceDefinition,
  values: DialogueInterpolationValues
): ResolvedDialogueSequence {
  return {
    ...sequence,
    lines: sequence.lines.map((line) => ({
      ...line,
      text: resolveDialogueText(line.text, values)
    }))
  }
}
