import { BOSS_ROSTER } from '../../bosses/roster'
import type { WeaponGetCardData } from '../../content/dialogue/storyTriggers'
import { SPECIAL_WEAPON_ORDER, getWeaponConfig, getWeaponDisplayName } from '../../content/weapons'
import { getProgressionItemLabel } from '../../progression/presentation'
import { upgradeEffectLabel } from '../../progression/upgrades'

// The weapon-get card's view (prompt 04 phase 4.2 item 3 with prompt 08's names, part 12i, EVAL-P8-004). Presentation
// only: the boss-clear claim already granted the item; this describes whatever the placement gave.

export const WEAPON_SWITCH_HINT = 'Q / E TO SWITCH'
/** A procedural sting (13d, `EVAL-P13-013`; seed 12305, `assets/audio/sfx/generated/sfx-params.json`), replacing the borrowed `pickup_bonus`. */
export const WEAPON_GET_STING_SFX = 'weapon_get'

export type WeaponGetView = {
  kind: 'weapon' | 'item'
  itemId: string
  title: 'WEAPON GET' | 'ITEM GET'
  name: string
  /** The weapon's full energy (`getWeaponConfig(id).maxEnergy`); null for an item. */
  energy: number | null
  switchHint: string | null
  /** The roster's `weaponReward.tutorial` line for the weapon (or the tutorial's technique). */
  tutorial: string | null
  /** An upgrade's effect line; null for a weapon. */
  effect: string | null
  /** Iona's registry line (`buildWeaponGetCard`, the `weapon_get` sequence), story on only. */
  registry: { sequenceId: string; speakerName: string; text: string } | null
}

const squash = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, '')

export function isSpecialWeaponId(itemId: string): boolean {
  return (SPECIAL_WEAPON_ORDER as readonly string[]).includes(itemId)
}

/** The roster's tutorial line for a reward id; `arc_slash` (the upgrade) matches the tutorial's `ArcSlash` reward. */
export function rosterTutorialLine(itemId: string): string | null {
  const key = squash(itemId)
  const blueprint = Object.values(BOSS_ROSTER).find((entry) => entry.weaponReward && squash(entry.weaponReward.id) === key)
  return blueprint?.weaponReward?.tutorial ?? null
}

export function buildWeaponGetView(
  itemId: string,
  options: { card?: WeaponGetCardData | null; storyOn?: boolean; classic?: boolean } = {}
): WeaponGetView {
  if (isSpecialWeaponId(itemId)) {
    const line = options.storyOn ? options.card?.registry : null
    return {
      kind: 'weapon',
      itemId,
      title: 'WEAPON GET',
      name: (options.card?.weaponName ?? getWeaponDisplayName(itemId)).toUpperCase(),
      energy: getWeaponConfig(itemId).maxEnergy,
      switchHint: WEAPON_SWITCH_HINT,
      tutorial: rosterTutorialLine(itemId),
      effect: null,
      registry: line ? { sequenceId: line.sequenceId, speakerName: line.speakerName, text: line.text } : null
    }
  }
  return {
    kind: 'item',
    itemId,
    title: 'ITEM GET',
    name: getProgressionItemLabel(itemId).toUpperCase(),
    energy: null,
    switchHint: null,
    tutorial: rosterTutorialLine(itemId),
    effect: upgradeEffectLabel(itemId, options.classic !== false),
    registry: null
  }
}
