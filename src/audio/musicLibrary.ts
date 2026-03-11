export type MusicCueId = 'title' | 'stage_select' | 'stage' | 'boss' | 'final' | 'completion'

export type MusicAssetDefinition = {
  key: string
  path: string
  volume: number
}

export const MUSIC_ASSETS: Record<MusicCueId, MusicAssetDefinition> = {
  title: {
    key: 'bgm_stage_select',
    path: 'assets/audio/music/stage_select.ogg',
    volume: 0.28
  },
  stage_select: {
    key: 'bgm_stage_select',
    path: 'assets/audio/music/stage_select.ogg',
    volume: 0.38
  },
  stage: {
    key: 'bgm_stage_loop',
    path: 'assets/audio/music/stage_loop.ogg',
    volume: 0.34
  },
  boss: {
    key: 'bgm_boss_loop',
    path: 'assets/audio/music/boss_loop.ogg',
    volume: 0.32
  },
  final: {
    key: 'bgm_boss_loop',
    path: 'assets/audio/music/boss_loop.ogg',
    volume: 0.34
  },
  completion: {
    key: 'bgm_stage_select',
    path: 'assets/audio/music/stage_select.ogg',
    volume: 0.3
  }
}

export function getMusicAssetEntries(): MusicAssetDefinition[] {
  return Array.from(new Map(Object.values(MUSIC_ASSETS).map((entry) => [entry.key, entry])).values())
}
