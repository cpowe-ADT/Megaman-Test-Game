import { LoadableAtlasEntry, SpriteSheetManifestV1 } from './types'

export function getLoadableAtlasEntries(manifest: SpriteSheetManifestV1): LoadableAtlasEntry[] {
  return manifest.entries
    .filter(
      (entry) =>
        entry.status === 'ready' &&
        typeof entry.source.runtimeImage === 'string' &&
        entry.source.runtimeImage.length > 0 &&
        typeof entry.source.runtimeData === 'string' &&
        entry.source.runtimeData.length > 0
    )
    .map((entry) => ({
      id: entry.id,
      atlasKey: entry.atlasKey,
      runtimeImage: entry.source.runtimeImage as string,
      runtimeData: entry.source.runtimeData as string
    }))
}
