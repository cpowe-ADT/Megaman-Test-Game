import type { CampaignStageId, StageExtensionPatch } from '../campaign'
import { BASALT_TITAN_PATCH } from './basaltTitan'
import { FERRO_BLADE_PATCH } from './ferroBlade'
import { GALE_VIXEN_PATCH } from './galeVixen'
import { GLACIER_RONIN_PATCH } from './glacierRonin'
import { HEAT_WORKS_PATCH } from './heatWorks'
import { MIRE_WRAITH_PATCH } from './mireWraith'
import { OMEGA_FORTRESS_PATCH } from './omegaFortress'
import { TIDE_REAVER_PATCH } from './tideReaver'
import { TUTORIAL_SENTINEL_PATCH } from './tutorialSentinel'
import { VOLT_HOPPER_PATCH } from './voltHopper'

/**
 * Stages rebuilt to the Heat Works standard (prompt 12 part 12d, `docs/prompts/12-finish-the-game.md`): each stage's
 * route is one file in this folder exporting its `StageExtensionPatch`, and one line here. A stage listed here
 * replaces its inline patch in `src/content/campaign.ts`; its lane deletes that inline block.
 *
 * `tutorial_sentinel` (13h.3a, `EVAL-P6-019`) was the last stage still inline; every stage now lives here.
 */
export const REBUILT_STAGE_PATCHES: Partial<Record<CampaignStageId, StageExtensionPatch>> = {
  tutorial_sentinel: TUTORIAL_SENTINEL_PATCH,
  pyro_maw: HEAT_WORKS_PATCH,
  tide_reaver: TIDE_REAVER_PATCH,
  mire_wraith: MIRE_WRAITH_PATCH,
  volt_hopper: VOLT_HOPPER_PATCH,
  glacier_ronin: GLACIER_RONIN_PATCH,
  basalt_titan: BASALT_TITAN_PATCH,
  ferro_blade: FERRO_BLADE_PATCH,
  gale_vixen: GALE_VIXEN_PATCH,
  omega_fortress: OMEGA_FORTRESS_PATCH
}
