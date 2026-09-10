import type { SpriteSheetManifestV1 } from '../src/assets/types'

declare global {
  const __PRIVATE_SPRITE_MANIFEST_DATA__: SpriteSheetManifestV1 | null
}

export {}
