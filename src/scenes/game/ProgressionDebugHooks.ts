import type Phaser from 'phaser'
import { AUTOMATION } from '../../config/automation'
import { Profiles, Save, type SaveData } from '../../systems/Save'
import { ALL_UPGRADE_IDS, ROBOT_MASTER_WEAPON_IDS, applyProgressionItem } from '../../progression'
import type { ProgressionItemId } from '../../progression/types'

type DebugWindow = Window & { stageDebug?: Record<string, unknown> }
export function installProgressionDebugHooks(scene: Phaser.Scene, refresh: (previous: SaveData, next: SaveData, itemId: string) => void): void {
  if (!AUTOMATION.enabled || typeof window === 'undefined') return
  const target = window as DebugWindow
  const existing = target.stageDebug ?? {}
  const grant = (id: string, allowed: readonly string[]) => {
    if (!allowed.includes(id)) return false
    const previous = Save.load()
    Save.save(applyProgressionItem(previous, id as ProgressionItemId))
    refresh(previous, Save.load(), id)
    return true
  }
  // 5.6: in the Game scene only (Stage Select's hook set is a smoke 13e contract), make a slot active,
  // creating or renaming its pilot; payload `profiles` shows the result.
  const setProfile = (options: { slot?: unknown; pilotName?: unknown }) => ({ ...Profiles.debugSetProfile(options), profiles: Profiles.debugState() })
  const hooks = { ...existing, grantWeapon: (id: string) => grant(id, ROBOT_MASTER_WEAPON_IDS), grantUpgrade: (id: string) => grant(id, [...ALL_UPGRADE_IDS, 'arc_slash']),
    ...(scene.scene.key === 'Game' ? { setProfile } : {}) }
  target.stageDebug = hooks
  scene.events.once('shutdown', () => { if (target.stageDebug === hooks) delete target.stageDebug })
}
