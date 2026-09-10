/** Pure story-flag policy shared by every narrative surface. */
export type StoryPolicy = {
  /** False when the automation switch `storyIntro=off` is set: surfaces neither play nor mark. */
  enabled: boolean
  /** The player's "replay story" option. */
  replay: boolean
}

export function shouldPlayStory(flags: readonly string[], id: string, policy: StoryPolicy): boolean {
  if (!policy.enabled) return false
  return policy.replay || !flags.includes(id)
}

export function markStorySeen(flags: readonly string[], ...ids: string[]): string[] {
  const next = [...flags]
  for (const id of ids) if (id && !next.includes(id)) next.push(id)
  return next
}

export function sanitizeStoryFlags(flags: unknown, knownIds: readonly string[]): string[] {
  if (!Array.isArray(flags)) return []
  const known = new Set(knownIds)
  return [...new Set(flags.filter((id): id is string => typeof id === 'string' && known.has(id)))]
}
