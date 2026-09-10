import dialogueContentJson from './dialogue.v1.json' with { type: 'json' }
import { createDialogueRegistry } from './DialogueRegistry'
import { validateDialogueContent } from './validateDialogueContent'

const loadedContent = validateDialogueContent(dialogueContentJson)
if (!loadedContent.valid) {
  throw new Error(`Invalid bundled dialogue content:\n- ${loadedContent.errors.join('\n- ')}`)
}

export const DIALOGUE_CONTENT = loadedContent.data
export const DIALOGUE_REGISTRY = createDialogueRegistry(DIALOGUE_CONTENT)

export * from './types'
export * from './validateDialogueContent'
export * from './DialogueRegistry'
export * from './resolveDialogue'
