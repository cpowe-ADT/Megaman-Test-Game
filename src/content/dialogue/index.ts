import { IDENTITY } from '../identity'
import dialogueContentJson from './dialogue.v1.json' with { type: 'json' }
import { createDialogueRegistry } from './DialogueRegistry'
import { validateDialogueContent } from './validateDialogueContent'

const loadedContent = validateDialogueContent(dialogueContentJson)
if (!loadedContent.valid) {
  throw new Error(`Invalid bundled dialogue content:\n- ${loadedContent.errors.join('\n- ')}`)
}

const speakerNames: Record<string, string> = {
  ...IDENTITY.WARDEN_NAMES,
  director_iona: IDENTITY.OPERATOR_NAME,
  omega_core: IDENTITY.ANTAGONIST_NAME
}
export const DIALOGUE_CONTENT = {
  ...loadedContent.data,
  speakers: loadedContent.data.speakers.map(speaker => ({
    ...speaker, displayName: speakerNames[speaker.id] ?? speaker.displayName
  }))
}
export const DIALOGUE_REGISTRY = createDialogueRegistry(DIALOGUE_CONTENT)

export * from './types'
export * from './validateDialogueContent'
export * from './DialogueRegistry'
export * from './resolveDialogue'
