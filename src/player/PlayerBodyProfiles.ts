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
  keepBodyUnscaled(body as unknown as ScaleLockableBody, profile)
}

/** The parts of an Arcade body the scale lock reads and writes (a structural type, so tests need no scene). */
export type ScaleLockableBody = {
  sourceWidth: number
  sourceHeight: number
  width: number
  height: number
  halfWidth: number
  halfHeight: number
  offset: { x: number; y: number }
  transform: { scaleX: number; scaleY: number; displayOriginX: number; displayOriginY: number }
  updateBounds: () => void
  updateCenter: () => void
}

type ScaleLockState = { profileOffset: { x: number; y: number } }
const SCALE_LOCKS = new WeakMap<object, ScaleLockState>()

/**
 * Squash, stretch and the respawn beam-in scale the hero sprite (VfxSfxRouter `tweenPlayerScale`), and an
 * Arcade body follows its sprite's scale: size times scale, offset times scale. The beam-in (0.2 x 1.8) made
 * the standing body 40px tall with its top on the respawn line, 14px inside the floor, so the hero sank
 * through and died again (Craig: "kept on spawning in the lava and dying"); the landing squash (0.78) lifted
 * the body 5px off the floor on every landing. Scale is a look, not a hitbox: after Arcade syncs the bounds,
 * the body goes back to the profile's size, and the offset is divided by the scale so the body keeps its
 * unscaled place under the sprite. Installed once per body; the profile offset follows every profile change.
 */
export function keepBodyUnscaled(body: ScaleLockableBody, profile: { offsetX: number; offsetY: number }): void {
  const existing = SCALE_LOCKS.get(body)
  if (existing) {
    existing.profileOffset = { x: profile.offsetX, y: profile.offsetY }
    return
  }
  const state: ScaleLockState = { profileOffset: { x: profile.offsetX, y: profile.offsetY } }
  SCALE_LOCKS.set(body, state)
  const syncBounds = body.updateBounds.bind(body)
  body.updateBounds = () => {
    syncBounds()
    const { scaleX, scaleY, displayOriginX, displayOriginY } = body.transform
    const sx = Math.abs(scaleX) || 1
    const sy = Math.abs(scaleY) || 1
    body.offset.x = displayOriginX + (state.profileOffset.x - displayOriginX) / sx
    body.offset.y = displayOriginY + (state.profileOffset.y - displayOriginY) / sy
    if (body.width !== body.sourceWidth || body.height !== body.sourceHeight) {
      body.width = body.sourceWidth
      body.height = body.sourceHeight
      body.halfWidth = Math.abs(body.width / 2)
      body.halfHeight = Math.abs(body.height / 2)
      body.updateCenter()
    }
  }
}

export function getPlayerBodyProfileBottom(profileKey: PlayerBodyProfileKey): number {
  const profile = PLAYER_BODY_PROFILES[profileKey]
  return profile.offsetY + profile.height
}
