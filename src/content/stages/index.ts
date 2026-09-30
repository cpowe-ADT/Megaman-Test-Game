import type { CampaignStageId, StageExtensionPatch } from '../campaign'
import { GLACIER_RONIN_PATCH } from './glacierRonin'
import { HEAT_WORKS_PATCH } from './heatWorks'
import { MIRE_WRAITH_PATCH } from './mireWraith'
import { TIDE_REAVER_PATCH } from './tideReaver'
import { VOLT_HOPPER_PATCH } from './voltHopper'

/**
 * Stages rebuilt to the Heat Works standard (prompt 12 part 12d, `docs/prompts/12-finish-the-game.md`): each stage's
 * route is one file in this folder exporting its `StageExtensionPatch`, and one line here. A stage listed here
 * replaces its inline patch in `src/content/campaign.ts`; its lane deletes that inline block.
 */
export const REBUILT_STAGE_PATCHES: Partial<Record<CampaignStageId, StageExtensionPatch>> = {
  pyro_maw: HEAT_WORKS_PATCH,
  tide_reaver: TIDE_REAVER_PATCH,
  mire_wraith: MIRE_WRAITH_PATCH,
  volt_hopper: VOLT_HOPPER_PATCH,
  glacier_ronin: GLACIER_RONIN_PATCH
}
