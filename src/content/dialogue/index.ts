import { IDENTITY } from '../identity'
import bundledDialogueJson from './dialogue.v2.json' with { type: 'json' }
import { createDialogueRegistry, type DialogueContentRegistry } from './DialogueRegistry'
import { validateDialogueContent } from './validateDialogueContent'

const speakerNames: Record<string, string> = {
  ...IDENTITY.WARDEN_NAMES,
  director_iona: IDENTITY.OPERATOR_NAME,
  omega_core: IDENTITY.ANTAGONIST_NAME
}

function loadDialogueContent(json: unknown) {
  const loadedContent = validateDialogueContent(json)
  if (!loadedContent.valid) {
    throw new Error(`Invalid dialogue content:\n- ${loadedContent.errors.join('\n- ')}`)
  }
  return {
    ...loadedContent.data,
    speakers: loadedContent.data.speakers.map(speaker => ({
      ...speaker, displayName: speakerNames[speaker.id] ?? speaker.displayName
    }))
  }
}

/**
 * A production build leaves the lines out of the JavaScript (prompt 09 `jsGzipKB`): `Preload` fetches
 * `dialogue.v2.json` and calls `installDialogueContent`, and Rollup drops the bundled import below. Development,
 * smoke and unit tests read the bundled file here. Every reader runs after `Preload`; these are live bindings.
 */
const bundledContent = import.meta.env?.PROD ? null : loadDialogueContent(bundledDialogueJson)
export let DIALOGUE_CONTENT = bundledContent as ReturnType<typeof loadDialogueContent>
export let DIALOGUE_REGISTRY = (bundledContent ? createDialogueRegistry(bundledContent) : null) as DialogueContentRegistry

export function dialogueContentInstalled(): boolean {
  return DIALOGUE_REGISTRY != null
}

/** Validates fetched dialogue (the production path from `Preload`) and makes it the content every reader sees. */
export function installDialogueContent(json: unknown): void {
  DIALOGUE_CONTENT = loadDialogueContent(json)
  DIALOGUE_REGISTRY = createDialogueRegistry(DIALOGUE_CONTENT)
}

export * from './types'
export * from './validateDialogueContent'
export * from './DialogueRegistry'
export * from './resolveDialogue'
