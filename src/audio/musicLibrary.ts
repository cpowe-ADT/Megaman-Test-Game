import type { BossId } from '../bosses/types'
import type { CampaignStageId } from '../content/campaign'

export type MusicCueId = 'title' | 'stage_select' | 'stage' | 'boss' | 'final' | 'completion'

export type MusicAssetDefinition = {
  key: string
  path: string
  volume: number
}

/** A cue resolved to its track; a boss track also names its phase-two track (same song, driving layer). */
export type ResolvedMusicTrack = MusicAssetDefinition & { phaseTwo?: MusicAssetDefinition }

/** Which stage or boss a cue plays for. Without one, a cue falls back to its shared track below. */
export type MusicContext = { stageId?: string | null; bossId?: string | null }

/**
 * Every music file is normalized to one loudness target (-16 LUFS, scripts/audio/audio-lib.mjs), so every
 * cue plays at one volume; the per-cue volumes before 12h were compensating for files 5.8 LU apart.
 */
export const MUSIC_VOLUME = 0.4

/** The shared tracks: menus, and the fallback when a stage or boss has no id (or no track of its own). */
export const MUSIC_ASSETS: Record<MusicCueId, MusicAssetDefinition> = {
  title: {
    key: 'bgm_stage_select',
    path: 'assets/audio/music/stage_select.ogg',
    volume: MUSIC_VOLUME
  },
  stage_select: {
    key: 'bgm_stage_select',
    path: 'assets/audio/music/stage_select.ogg',
    volume: MUSIC_VOLUME
  },
  stage: {
    key: 'bgm_stage_loop',
    path: 'assets/audio/music/stage_loop.ogg',
    volume: MUSIC_VOLUME
  },
  boss: {
    key: 'bgm_boss_loop',
    path: 'assets/audio/music/boss_loop.ogg',
    volume: MUSIC_VOLUME
  },
  final: {
    key: 'bgm_boss_loop',
    path: 'assets/audio/music/boss_loop.ogg',
    volume: MUSIC_VOLUME
  },
  completion: {
    key: 'bgm_stage_select',
    path: 'assets/audio/music/stage_select.ogg',
    volume: MUSIC_VOLUME
  }
}

const GENERATED = 'assets/audio/music/generated'

function generatedTrack(name: string): MusicAssetDefinition {
  return { key: `bgm_${name}`, path: `${GENERATED}/${name}.ogg`, volume: MUSIC_VOLUME }
}

const STAGE_IDS: readonly CampaignStageId[] = [
  'tutorial_sentinel',
  'pyro_maw',
  'tide_reaver',
  'volt_hopper',
  'basalt_titan',
  'ferro_blade',
  'mire_wraith',
  'gale_vixen',
  'glacier_ronin',
  'omega_fortress'
]

const BOSS_IDS: readonly BossId[] = [
  'sentinel_rook',
  'pyro_maw',
  'tide_reaver',
  'volt_hopper',
  'basalt_titan',
  'ferro_blade',
  'mire_wraith',
  'gale_vixen',
  'glacier_ronin',
  'omega_core'
]

/** One loop per stage (scripts/audio/compose.mjs, seeds in assets/audio/credits/README.md). */
export const STAGE_MUSIC = Object.fromEntries(STAGE_IDS.map((id) => [id, generatedTrack(`stage_${id}`)])) as Record<CampaignStageId, MusicAssetDefinition>

/** One loop per boss fight, and its phase-two track crossfaded in at the phase change. */
export const BOSS_MUSIC = Object.fromEntries(
  BOSS_IDS.map((id) => [id, { base: generatedTrack(`boss_${id}`), phaseTwo: generatedTrack(`boss_${id}_phase2`) }])
) as Record<BossId, { base: MusicAssetDefinition; phaseTwo: MusicAssetDefinition }>

function hasOwn<T extends object>(record: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(record, key)
}

/**
 * The track a cue plays: `stage` and `final` with a stage id play that stage's loop, `boss` with a boss id
 * plays that boss's loop (and names its phase-two track); anything else plays the cue's shared track.
 */
export function resolveMusicTrack(cue: MusicCueId, context: MusicContext = {}): ResolvedMusicTrack {
  const { stageId, bossId } = context
  if ((cue === 'stage' || cue === 'final') && stageId && hasOwn(STAGE_MUSIC, stageId)) {
    return STAGE_MUSIC[stageId]
  }
  if (cue === 'boss' && bossId && hasOwn(BOSS_MUSIC, bossId)) {
    const tracks = BOSS_MUSIC[bossId]
    return { ...tracks.base, phaseTwo: tracks.phaseTwo }
  }
  return MUSIC_ASSETS[cue]
}

/** Every music file the game can decode, once per cache key. */
export function getMusicAssetEntries(): MusicAssetDefinition[] {
  const all = [
    ...Object.values(MUSIC_ASSETS),
    ...Object.values(STAGE_MUSIC),
    ...Object.values(BOSS_MUSIC).flatMap((tracks) => [tracks.base, tracks.phaseTwo])
  ]
  return Array.from(new Map(all.map((entry) => [entry.key, entry])).values())
}
