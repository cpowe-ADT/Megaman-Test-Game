import { BossId } from '../bosses/types'
import { SpriteAnimationMapping, SpriteSheetManifestEntry, SpriteSheetManifestV1 } from './types'

export type ManifestValidationResult =
  | { valid: true; manifest: SpriteSheetManifestV1; errors: [] }
  | { valid: false; errors: string[] }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

const BOSS_IDS = new Set<BossId>([
  'sentinel_rook',
  'pyro_maw',
  'tide_reaver',
  'volt_hopper',
  'basalt_titan',
  'ferro_blade',
  'mire_wraith',
  'gale_vixen',
  'glacier_ronin'
])

function asBossId(value: unknown): BossId | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  return BOSS_IDS.has(value as BossId) ? (value as BossId) : undefined
}

function validateAnimations(value: unknown, path: string, errors: string[]): SpriteAnimationMapping[] | undefined {
  if (value == null) {
    return undefined
  }
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array when provided`)
    return undefined
  }

  const mappings: SpriteAnimationMapping[] = []
  value.forEach((candidate, index) => {
    const itemPath = `${path}[${index}]`
    if (!isObject(candidate)) {
      errors.push(`${itemPath} must be an object`)
      return
    }

    const key = candidate.key
    const frames = candidate.frames
    const fps = candidate.fps
    const repeat = candidate.repeat

    if (typeof key !== 'string' || key.length === 0) {
      errors.push(`${itemPath}.key must be a non-empty string`)
    }
    if (!Array.isArray(frames) || frames.some((frame) => typeof frame !== 'string' || frame.length === 0)) {
      errors.push(`${itemPath}.frames must be a non-empty string array`)
    }
    if (!isPositiveNumber(fps)) {
      errors.push(`${itemPath}.fps must be a positive number`)
    }
    if (typeof repeat !== 'number' || !Number.isFinite(repeat)) {
      errors.push(`${itemPath}.repeat must be a finite number`)
    }

    if (
      typeof key === 'string' &&
      key.length > 0 &&
      Array.isArray(frames) &&
      frames.length > 0 &&
      frames.every((frame) => typeof frame === 'string' && frame.length > 0) &&
      isPositiveNumber(fps) &&
      typeof repeat === 'number' &&
      Number.isFinite(repeat)
    ) {
      mappings.push({ key, frames, fps, repeat })
    }
  })

  return mappings
}

export function validateSpriteManifest(value: unknown): ManifestValidationResult {
  const errors: string[] = []

  if (!isObject(value)) {
    return { valid: false, errors: ['Manifest must be an object'] }
  }

  const version = value.version
  const generatedAt = value.generatedAt
  const entries = value.entries

  if (version !== '1') {
    errors.push('version must be "1"')
  }

  if (typeof generatedAt !== 'string' || generatedAt.length === 0) {
    errors.push('generatedAt must be a non-empty string')
  }

  if (!Array.isArray(entries)) {
    errors.push('entries must be an array')
  }

  if (errors.length > 0 || !Array.isArray(entries)) {
    return { valid: false, errors }
  }

  const normalizedEntries = entries.map((entry, index) => {
    const path = `entries[${index}]`
    if (!isObject(entry)) {
      errors.push(`${path} must be an object`)
      return null
    }

    const id = entry.id
    const atlasKey = entry.atlasKey
    const status = entry.status
    const frame = entry.frame
    const source = entry.source

    if (typeof id !== 'string' || id.length === 0) {
      errors.push(`${path}.id must be a non-empty string`)
    }

    if (typeof atlasKey !== 'string' || atlasKey.length === 0) {
      errors.push(`${path}.atlasKey must be a non-empty string`)
    }

    if (status !== 'planned' && status !== 'ready') {
      errors.push(`${path}.status must be "planned" or "ready"`)
    }

    if (!isObject(frame) || !isPositiveNumber(frame.width) || !isPositiveNumber(frame.height)) {
      errors.push(`${path}.frame.width and frame.height must be positive numbers`)
    }

    if (!isObject(source)) {
      errors.push(`${path}.source must be an object`)
    }

    const animations = validateAnimations(entry.animations, `${path}.animations`, errors)

    if (
      typeof id !== 'string' ||
      id.length === 0 ||
      typeof atlasKey !== 'string' ||
      atlasKey.length === 0 ||
      (status !== 'planned' && status !== 'ready') ||
      !isObject(frame) ||
      !isPositiveNumber(frame.width) ||
      !isPositiveNumber(frame.height) ||
      !isObject(source)
    ) {
      return null
    }

    const normalized: SpriteSheetManifestEntry = {
      id,
      bossId: asBossId(entry.bossId),
      atlasKey,
      frame: { width: frame.width, height: frame.height },
      status,
      source: {
        runtimeImage: typeof source.runtimeImage === 'string' ? source.runtimeImage : undefined,
        runtimeData: typeof source.runtimeData === 'string' ? source.runtimeData : undefined,
        localImagePath: typeof source.localImagePath === 'string' ? source.localImagePath : undefined,
        localDataPath: typeof source.localDataPath === 'string' ? source.localDataPath : undefined,
        remoteImageUrl: typeof source.remoteImageUrl === 'string' ? source.remoteImageUrl : undefined,
        remoteDataUrl: typeof source.remoteDataUrl === 'string' ? source.remoteDataUrl : undefined
      },
      animations,
      notes: typeof entry.notes === 'string' ? entry.notes : undefined
    }

    if (
      normalized.status === 'ready' &&
      !(normalized.source.runtimeImage && normalized.source.runtimeData)
    ) {
      errors.push(`${path} with status "ready" requires source.runtimeImage and source.runtimeData`)
    }

    return normalized
  })

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    manifest: {
      version: '1',
      generatedAt: generatedAt as string,
      entries: normalizedEntries.filter((entry): entry is SpriteSheetManifestEntry => entry !== null)
    },
    errors: []
  }
}
