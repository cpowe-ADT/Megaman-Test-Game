import Phaser from 'phaser'
import type { PlayerResolvedState } from './types'

export type PlayerBodyProfileKey = 'stand' | 'crouch' | 'dash'

export type PlayerBodyProfile = {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

export const PLAYER_BODY_PROFILES: Record<PlayerBodyProfileKey, PlayerBodyProfile> = {
  stand: { width: 16, height: 22, offsetX: 16, offsetY: 24 },
  crouch: { width: 18, height: 18, offsetX: 15, offsetY: 28 },
  dash: { width: 20, height: 14, offsetX: 14, offsetY: 32 }
}

export function resolvePlayerBodyProfileKey(state: Pick<PlayerResolvedState, 'locomotion'>): PlayerBodyProfileKey {
  switch (state.locomotion) {
    case 'crouch':
      return 'crouch'
    case 'dash':
    case 'air_dash':
      return 'dash'
    default:
      return 'stand'
  }
}

export function applyPlayerBodyProfile(
  player: Phaser.Physics.Arcade.Sprite,
  profileKey: PlayerBodyProfileKey
): void {
  const body = player.body as Phaser.Physics.Arcade.Body | undefined
  if (!body) {
    return
  }
  const profile = PLAYER_BODY_PROFILES[profileKey]
  body.setSize(profile.width, profile.height)
  body.setOffset(profile.offsetX, profile.offsetY)
}

export function getPlayerBodyProfileBottom(profileKey: PlayerBodyProfileKey): number {
  const profile = PLAYER_BODY_PROFILES[profileKey]
  return profile.offsetY + profile.height
}
