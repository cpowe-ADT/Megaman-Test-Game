/**
 * Which district's return debrief plays (part 13g, `EVAL-P13-014`): the extended `district_restored`
 * exchange on the way back to Stage Select, before any milestone line. Pure and Save-free so it is
 * unit-testable without a scene; the caller still gates on the sequence's own seen flag
 * (`shouldPlayStory`) so a replay clear never repeats it.
 */
export type DistrictDebriefInput = {
  /** `registry.get('ui.stageSelect.returnReason')`: only a fresh victory return qualifies. */
  returnReason: string | undefined
  /** `registry.get('ui.stageSelect.focusBossId')`: the stage that was just cleared. */
  focusStageId: string | null | undefined
  /** The stages that carry a `district_restored` sequence (every warden; never the tutorial). */
  wardenStageIds: readonly string[]
}

/** The stage id whose debrief should play this return, or null when none does. */
export function resolveDistrictDebriefStageId(input: DistrictDebriefInput): string | null {
  if (input.returnReason !== 'victory') return null
  if (!input.focusStageId) return null
  return input.wardenStageIds.includes(input.focusStageId) ? input.focusStageId : null
}
