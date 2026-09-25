import { ROBOT_MASTER_STAGE_IDS, getCampaignStage, type CampaignStageId } from '../campaign'
import { getWeaponDisplayName } from '../weapons'
import { getLocationCheckId } from '../../progression/catalog'
import type { DialoguePlaybackLine } from '../../narrative/DialoguePlayback'
import type { DialogueContentRegistry } from './DialogueRegistry'
import { resolveDialogueText } from './resolveDialogue'
import type { DialogueInterpolationValues } from './types'

// Pure selection rules for the prompt 07 section 7.6 B triggers (part 12g, EVAL-P7-009). The StoryDirector and the
// game-over and ending scenes consume them; nothing here grants, completes or changes a scene.

/** The warden stage whose capsule cache a claimed location is (`<stage>:capsule`), or null for any other location. */
export function capsuleCacheStageId(locationId: string): CampaignStageId | null {
  return ROBOT_MASTER_STAGE_IDS.find((stageId) => getLocationCheckId(stageId, 'capsule') === locationId) ?? null
}

/** The warden stage a special weapon belongs to (its Classic boss reward), whatever location placed it. */
export function weaponSourceStageId(weaponId: string): CampaignStageId | null {
  return ROBOT_MASTER_STAGE_IDS.find((stageId) => getCampaignStage(stageId).rewardWeaponId === weaponId) ?? null
}

/** Weapons in `next` that `previous` did not hold, in unlock order. */
export function gainedWeaponIds(previous: readonly string[], next: readonly string[]): string[] {
  return next.filter((weaponId) => !previous.includes(weaponId))
}

/** The save's game overs across every stage. */
export function totalGameOvers(counts: Readonly<Record<string, number>> | undefined): number {
  return Object.values(counts ?? {}).reduce((sum, count) => sum + (Number.isFinite(count) ? Math.max(0, count) : 0), 0)
}

/** The game-over rotation: the Nth game over on a save shows line (N - 1) mod the line count; -1 with no lines. */
export function gameOverLineIndex(gameOverCount: number, lineCount: number): number {
  if (lineCount <= 0) return -1
  return (Math.max(1, Math.floor(gameOverCount)) - 1) % lineCount
}

/** The epilogue secret's condition: every warden stage's capsule cache has been collected. */
export function hasAllCapsuleCaches(collectedChecks: readonly string[]): boolean {
  return ROBOT_MASTER_STAGE_IDS.every((stageId) => collectedChecks.includes(getLocationCheckId(stageId, 'capsule')))
}

/**
 * The weapon-get card's data contract. Prompt 08 draws the card (it replaces the victory modal); 12g supplies
 * the line. `registry` is Iona reading the district registry for the weapon's source stage, so a randomized
 * placement (another warden's weapon behind this boss) still reads the right entry; null for a weapon with no
 * warden source (the tutorial's saber).
 */
export type WeaponGetCardData = {
  weaponId: string
  /** The public weapon name (`getWeaponDisplayName`). */
  weaponName: string
  /** Where the weapon comes from, not where it was placed. */
  sourceStageId: CampaignStageId | null
  registry: DialoguePlaybackLine | null
}

export function buildWeaponGetCard(
  registry: DialogueContentRegistry,
  weaponId: string,
  values: DialogueInterpolationValues
): WeaponGetCardData {
  const sourceStageId = weaponSourceStageId(weaponId)
  const sequence = sourceStageId ? registry.getStageSequence(sourceStageId, 'weapon_get') : undefined
  const line = sequence?.lines[0]
  const speaker = registry.getSpeaker(line?.speakerId)
  return {
    weaponId,
    weaponName: getWeaponDisplayName(weaponId),
    sourceStageId,
    registry: sequence && line
      ? {
          sequenceId: sequence.id,
          speakerId: line.speakerId ?? '',
          speakerName: speaker ? resolveDialogueText(speaker.displayName, values) : '',
          text: resolveDialogueText(line.text, values)
        }
      : null
  }
}
