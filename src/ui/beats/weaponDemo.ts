import { getChargedFormConfig, getWeaponConfig } from '../../content/weapons'
import { resolvePlayerShot } from '../../projectiles/playerShot'

// The weapon demo (prompt 13 part 13g item 2, EVAL-P13-013): after the WEAPON GET card, before results.
// Craig, 2026-09-30: "an animation explaining the new weapon for each that you got." Pure script here (no
// Phaser, so it is unit-testable); StageClearCards.ts is the Phaser-aware presenter that reads it.

export type WeaponDemoPhase = 'name' | 'plain' | 'charge' | 'charged' | 'useLine' | 'done'

/** Beats, ms from the demo's start: 4.6 s total, inside the 4 to 5 s band. Enter skips at any time. */
export const WEAPON_DEMO_BEAT_MS = {
  name: 0,
  plain: 700,
  charge: 1700,
  charged: 2500,
  useLine: 3400,
  done: 4600
} as const

export const WEAPON_DEMO_TOTAL_MS = WEAPON_DEMO_BEAT_MS.done

export function weaponDemoPhaseAt(elapsedMs: number): WeaponDemoPhase {
  if (elapsedMs >= WEAPON_DEMO_BEAT_MS.done) return 'done'
  if (elapsedMs >= WEAPON_DEMO_BEAT_MS.useLine) return 'useLine'
  if (elapsedMs >= WEAPON_DEMO_BEAT_MS.charged) return 'charged'
  if (elapsedMs >= WEAPON_DEMO_BEAT_MS.charge) return 'charge'
  if (elapsedMs >= WEAPON_DEMO_BEAT_MS.plain) return 'plain'
  return 'name'
}

export type WeaponDemoShotView = { artGroup: string; damage: number; onHitTag: string }

export type WeaponDemoView = {
  weaponId: string
  name: string
  useLine: string
  plain: WeaponDemoShotView
  /** Null only for a weapon with no charged form (none today: every demo-eligible special has one). */
  charged: (WeaponDemoShotView & { moveName: string }) | null
}

/**
 * The demo's script for a weapon: the plain and charged shots resolved through the real weapon code
 * (`resolvePlayerShot`, scripted input, x/y discarded) so the demo can never drift from actual play --
 * sandboxed because it is a pure call, never reaching the live ProjectileSystem or spending real energy
 * or granting anything (rule 8).
 */
export function buildWeaponDemoView(weaponId: string): WeaponDemoView {
  const weapon = getWeaponConfig(weaponId)
  const chargedForm = getChargedFormConfig(weaponId)
  const plainShot = resolvePlayerShot({ weaponId, intent: { chargeLevel: 0, facing: 1 }, x: 0, y: 0 })
  const chargedShot = chargedForm
    ? resolvePlayerShot({
        weaponId,
        intent: { chargeLevel: 4, facing: 1, forceCharge: weapon.behavior === 'hold_stream' },
        x: 0,
        y: 0
      })
    : null
  return {
    weaponId,
    name: weapon.displayName.toUpperCase(),
    useLine: weapon.useLine ?? '',
    plain: { artGroup: weapon.artGroup ?? 'arc_slash', damage: plainShot.weapon.damage, onHitTag: plainShot.onHitTag },
    charged:
      chargedShot && chargedForm
        ? { artGroup: chargedForm.artGroup, moveName: chargedForm.name, damage: chargedForm.damage, onHitTag: chargedShot.onHitTag }
        : null
  }
}
