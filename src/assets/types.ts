import { BossId } from '../bosses/types'

export type SpriteAssetStatus = 'planned' | 'ready'

export interface SpriteFrameSize {
  width: number
  height: number
}

export interface SpriteAnimationMapping {
  key: string
  frames: string[]
  fps: number
  repeat: number
}

export interface SpriteSheetSource {
  runtimeImage?: string
  runtimeData?: string
  localImagePath?: string
  localDataPath?: string
  remoteImageUrl?: string
  remoteDataUrl?: string
}

export interface SpriteSheetManifestEntry {
  id: string
  bossId?: BossId
  atlasKey: string
  frame: SpriteFrameSize
  status: SpriteAssetStatus
  source: SpriteSheetSource
  animations?: SpriteAnimationMapping[]
  /**
   * Who loads it: absent or 'preload' is Preload (every scene); 'game' is the Game scene's stage queue
   * (src/scenes/game/stageBackgroundLoading.ts), resident once loaded.
   */
  /** preload: every scene; game: the Game scene, resident; stage: only stages that place it (evicted elsewhere). */
  loadScope?: 'preload' | 'game' | 'stage'
  notes?: string
}

export interface SpriteSheetManifestV1 {
  version: '1'
  generatedAt: string
  entries: SpriteSheetManifestEntry[]
}

export interface LoadableAtlasEntry {
  id: string
  atlasKey: string
  runtimeImage: string
  runtimeData: string
}
