import type { CampaignStageId, StageExtensionPatch } from '../campaign'
import { HEAT_WORKS_PATCH } from './heatWorks'

/**
 * Stages rebuilt to the Heat Works standard (prompt 12 part 12d, `docs/prompts/12-finish-the-game.md`): each stage's
 * route is one file in this folder exporting its `StageExtensionPatch`, and one line here. A stage listed here
 * replaces its inline patch in `src/content/campaign.ts`; its lane deletes that inline block.
 */
export const REBUILT_STAGE_PATCHES: Partial<Record<CampaignStageId, StageExtensionPatch>> = {
  pyro_maw: HEAT_WORKS_PATCH
}
