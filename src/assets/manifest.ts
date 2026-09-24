import { LoadableAtlasEntry, SpriteSheetManifestV1 } from './types'

/** Atlases Preload loads for every scene; entries scoped to the Game scene are left to its stage queue. */
export function getLoadableAtlasEntries(manifest: SpriteSheetManifestV1): LoadableAtlasEntry[] {
  return getReadyAtlasEntries(manifest, 'preload')
}

/** Atlases the Game scene queues itself (loadScope 'game'); they stay resident once loaded. */
export function getGameSceneAtlasEntries(manifest: SpriteSheetManifestV1): LoadableAtlasEntry[] {
  return getReadyAtlasEntries(manifest, 'game')
}

function getReadyAtlasEntries(manifest: SpriteSheetManifestV1, scope: 'preload' | 'game'): LoadableAtlasEntry[] {
  return manifest.entries
    .filter(
      (entry) =>
        (entry.loadScope ?? 'preload') === scope &&
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
