import { IDENTITY } from '../content/identity'
import Phaser from 'phaser'
import spriteManifestData from '../../assets/sprites/manifest.v1.json'
import { getLoadableAtlasEntries } from '../assets/manifest'
import { countSpriteManifestOverrides, mergeSpriteManifest } from '../assets/privateSpriteManifest'
import type { SpriteSheetManifestV1 } from '../assets/types'
import { validateSpriteManifest } from '../assets/validateManifest'
import { getMusicAssetEntries } from '../audio/musicLibrary'
import { getSfxAssetEntries } from '../audio/sfxLibrary'
import { getStageBackgroundAssetEntries } from '../content/stageBackgroundCatalog'
import { AnimationManifest, type AnimationManifestEntry } from '../player/AnimationManifest'
import { resolvePlayerAtlasBinding } from '../player/PlayerAtlasBindings'
import { ensureGameplayTextures } from '../ui/gameplay/GameplayTextures'

const PLAYER_ATLAS_KEY = 'atlas_player_main'
const PLAYER_SWORD_FX_ATLAS_KEY = 'atlas_player_sword_fx'
const PROJECTILES_ATLAS_KEY = 'atlas_projectiles_core'
const EFFECTS_ATLAS_KEY = 'atlas_effects_core'

type AtlasAnimationOptions = {
  start?: number
  end?: number
}

export class Preload extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload(): void {
    const mergedManifest = mergeSpriteManifest(
      spriteManifestData as SpriteSheetManifestV1,
      IDENTITY.DEV_SKIN.enabled ? __PRIVATE_SPRITE_MANIFEST_DATA__ : null
    )
    const manifestValidation = validateSpriteManifest(mergedManifest)
    if (!manifestValidation.valid) {
      throw new Error(`[sprites] Manifest invalid: ${manifestValidation.errors.join('; ')}`)
    }

    const atlasEntries = getLoadableAtlasEntries(manifestValidation.manifest)
    const privateOverrideEntries = countSpriteManifestOverrides(
      spriteManifestData as SpriteSheetManifestV1,
      manifestValidation.manifest
    )
    atlasEntries.forEach((entry) => {
      if (!this.textures.exists(entry.atlasKey)) {
        this.load.atlas(entry.atlasKey, entry.runtimeImage, entry.runtimeData)
      }
    })

    getMusicAssetEntries().forEach((entry) => {
      if (!this.cache.audio.exists(entry.key)) {
        this.load.audio(entry.key, entry.path)
      }
    })

    getSfxAssetEntries().forEach((entry) => {
      if (!this.cache.audio.exists(entry.key)) {
        this.load.audio(entry.key, entry.path)
      }
    })

    getStageBackgroundAssetEntries().forEach((entry) => {
      if (!this.textures.exists(entry.key)) {
        this.load.image(entry.key, entry.path)
      }
    })

    this.registry.set('sprite_manifest_summary', {
      valid: true,
      entries: manifestValidation.manifest.entries.length,
      readyAtlases: atlasEntries.length,
      backgroundImages: getStageBackgroundAssetEntries().length,
      privateOverrideEntries,
      manifestMode: privateOverrideEntries > 0 ? 'base+private' : 'base'
    })
  }

  create(): void {
    ensureGameplayTextures(this)
    this.assertAtlasLoaded(PLAYER_ATLAS_KEY)
    this.assertAtlasLoaded(PROJECTILES_ATLAS_KEY)
    this.assertAtlasLoaded(EFFECTS_ATLAS_KEY)

    this.createAtlasAnimation('player-idle', PLAYER_ATLAS_KEY, ['player_main/idle/'], 6, -1, {
      start: 0,
      end: 3
    })
    this.createAtlasAnimation('player-run', PLAYER_ATLAS_KEY, ['player_main/run/'], 12, -1, {
      start: 0,
      end: 5
    })
    this.createAtlasAnimation('player-shoot', PLAYER_ATLAS_KEY, ['player_main/shoot_ground/'], 12, 0, {
      start: 0,
      end: 1
    })
    this.createAtlasAnimation('player-shoot-air', PLAYER_ATLAS_KEY, ['player_main/shoot_air/'], 12, 0, {
      start: 0,
      end: 0
    })
    this.createAtlasAnimation('player-hurt', PLAYER_ATLAS_KEY, ['player_main/hurt_light/'], 12, 0, {
      start: 0,
      end: 0
    })
    this.createAtlasAnimation('player-jump', PLAYER_ATLAS_KEY, ['player_main/jump_start/'], 1, 0, {
      start: 0,
      end: 0
    })
    this.createAtlasAnimation('player-fall', PLAYER_ATLAS_KEY, ['player_main/fall/'], 1, 0, {
      start: 0,
      end: 0
    })
    this.createAtlasAnimation('player-slide', PLAYER_ATLAS_KEY, ['player_main/dash_loop/'], 1, 0, {
      start: 0,
      end: 0
    })

    this.createAtlasAnimation('dummy-explode', EFFECTS_ATLAS_KEY, ['effects_core/core/'], 16, 0, {
      start: 0,
      end: 3
    })

    if (this.textures.exists(PLAYER_SWORD_FX_ATLAS_KEY)) {
      this.createAtlasAnimation('player-sword-fx', PLAYER_SWORD_FX_ATLAS_KEY, ['player_sword_fx/core/'], 24, 0, {
        start: 0,
        end: 3
      })
    }

    Object.values(AnimationManifest.animations).forEach((entry) => {
      const binding = this.resolveManifestBinding(entry)
      this.createAtlasAnimation(
        entry.key,
        PLAYER_ATLAS_KEY,
        binding.prefixes,
        Math.max(1, entry.frameRate),
        entry.repeat,
        {
          start: binding.start,
          end: binding.end
        }
      )
    })

    this.scene.start('Title')
  }

  private assertAtlasLoaded(atlasKey: string): void {
    if (!this.textures.exists(atlasKey)) {
      throw new Error(`[Preload] Missing required atlas '${atlasKey}'`)
    }
  }

  private createAtlasAnimation(
    key: string,
    atlasKey: string,
    prefixes: string[],
    frameRate: number,
    repeat: number,
    options: AtlasAnimationOptions
  ): void {
    if (this.anims.exists(key)) {
      return
    }

    const resolved = this.resolveFrameNames(atlasKey, prefixes)
    if (resolved.length === 0) {
      throw new Error(
        `[Preload] No frames found for animation '${key}' in atlas '${atlasKey}' using prefixes: ${prefixes.join(', ')}`
      )
    }

    const maxIndex = resolved.length - 1
    const start = Math.max(0, Math.min(options.start ?? 0, maxIndex))
    const end = Math.max(start, Math.min(options.end ?? maxIndex, maxIndex))
    const selected = resolved.slice(start, end + 1)

    this.anims.create({
      key,
      frames: selected.map((frame) => ({ key: atlasKey, frame })),
      frameRate,
      repeat
    })
  }

  private resolveFrameNames(atlasKey: string, prefixes: string[]): string[] {
    const texture = this.textures.get(atlasKey)
    for (const prefix of prefixes) {
      const frames = texture
        .getFrameNames()
        .filter((name) => name !== '__BASE' && name.startsWith(prefix))
        .sort((a, b) => this.compareFrameNames(a, b))
      if (frames.length > 0) {
        return frames
      }
    }
    return []
  }

  private compareFrameNames(a: string, b: string): number {
    const suffixA = Number(a.match(/(\d+)(?!.*\d)/)?.[1] ?? NaN)
    const suffixB = Number(b.match(/(\d+)(?!.*\d)/)?.[1] ?? NaN)
    if (Number.isFinite(suffixA) && Number.isFinite(suffixB)) {
      return suffixA - suffixB
    }
    return a.localeCompare(b, undefined, { numeric: true })
  }

  private resolveManifestBinding(entry: AnimationManifestEntry): {
    prefixes: string[]
    start: number
    end: number
  } {
    const binding = resolvePlayerAtlasBinding(entry.key)
    return {
      prefixes: binding.prefixes,
      start: binding.start ?? 0,
      end: binding.end ?? 0
    }
  }
}
