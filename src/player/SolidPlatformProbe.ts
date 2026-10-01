import type { MotorTerrainProbe } from './PlayerMotor'

type ProbeBody = { gameObject?: { data?: { get(key: string): unknown } | null } | null }

/** The members of the scene and the hero the probe reads; plain values so tests need no Phaser. */
export interface SolidProbeScene {
  readonly physics?: {
    readonly world?: { readonly isPaused?: boolean } | null
    overlapRect?(
      x: number,
      y: number,
      width: number,
      height: number,
      includeDynamic?: boolean,
      includeStatic?: boolean
    ): ReadonlyArray<ProbeBody>
  } | null
}
export interface SolidProbeOwner {
  readonly body?: { readonly enable?: boolean } | null
}

/**
 * Solid stage platforms (tagged `platformType: 'solid'` by PlatformCollisionSystem) as the motor's
 * terrain probe. The query rect is inset so edge contact (standing on a floor) is not overlap.
 * A disabled hero body (death, respawn) or a paused world (hit-stop) reports no solid and does not
 * query Arcade (prompt 05 §5.1 QA review).
 */
export function createSolidPlatformProbe(scene: SolidProbeScene, owner: SolidProbeOwner): MotorTerrainProbe {
  const inset = 0.05
  return {
    isSolid(x: number, y: number, width: number, height: number): boolean {
      const physics = scene.physics
      if (!owner.body?.enable || !physics || physics.world?.isPaused) {
        return false
      }
      if (typeof physics.overlapRect !== 'function' || width <= inset * 2 || height <= inset * 2) {
        return false
      }
      const bodies = physics.overlapRect(x + inset, y + inset, width - inset * 2, height - inset * 2, false, true)
      for (const body of bodies) {
        if (body.gameObject?.data?.get('platformType') === 'solid') {
          return true
        }
      }
      return false
    }
  }
}
