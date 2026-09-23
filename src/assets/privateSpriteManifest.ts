import type { SpriteSheetManifestEntry, SpriteSheetManifestV1 } from './types'

export function mergeSpriteManifest(
  baseManifest: SpriteSheetManifestV1,
  overrideManifest?: SpriteSheetManifestV1 | null
): SpriteSheetManifestV1 {
  if (!overrideManifest || !Array.isArray(overrideManifest.entries) || overrideManifest.entries.length === 0) {
    return {
      version: baseManifest.version,
      generatedAt: baseManifest.generatedAt,
      entries: [...baseManifest.entries]
    }
  }

  const overrideById = new Map<string, SpriteSheetManifestEntry>()
  const overrideByAtlasKey = new Map<string, SpriteSheetManifestEntry>()
  overrideManifest.entries.forEach((entry) => {
    overrideById.set(entry.id, entry)
    overrideByAtlasKey.set(entry.atlasKey, entry)
  })

  const mergedEntries = baseManifest.entries.map(
    (entry) => overrideById.get(entry.id) ?? overrideByAtlasKey.get(entry.atlasKey) ?? entry
  )

  const seenKeys = new Set(mergedEntries.map((entry) => `${entry.id}::${entry.atlasKey}`))
  overrideManifest.entries.forEach((entry) => {
    const hasBaseMatch = baseManifest.entries.some(
      (candidate) => candidate.id === entry.id || candidate.atlasKey === entry.atlasKey
    )
    if (!hasBaseMatch && !seenKeys.has(`${entry.id}::${entry.atlasKey}`)) {
      mergedEntries.push(entry)
    }
  })

  return {
    version: baseManifest.version,
    generatedAt: overrideManifest.generatedAt || baseManifest.generatedAt,
    entries: mergedEntries
  }
}

export function countSpriteManifestOverrides(
  baseManifest: SpriteSheetManifestV1,
  mergedManifest: SpriteSheetManifestV1
): number {
  const baseByAtlasKey = new Map(baseManifest.entries.map((entry) => [entry.atlasKey, entry]))
  let overrideCount = 0
  mergedManifest.entries.forEach((entry) => {
    const baseEntry = baseByAtlasKey.get(entry.atlasKey)
    if (!baseEntry) {
      overrideCount += 1
      return
    }
    if (baseEntry.id !== entry.id) {
      overrideCount += 1
      return
    }
    if (
      baseEntry.source.runtimeImage !== entry.source.runtimeImage ||
      baseEntry.source.runtimeData !== entry.source.runtimeData ||
      baseEntry.notes !== entry.notes
    ) {
      overrideCount += 1
    }
  })
  return overrideCount
}
