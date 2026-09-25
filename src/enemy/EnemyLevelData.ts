import { EnemyLevelMarker } from './types'
import { CAMPAIGN_STAGES } from '../content/campaign'
import { MINIBOSS_LAB_ENEMIES, MINIBOSS_LAB_STAGE_ID } from '../content/stages/minibossLab'

export const ENEMY_LEVEL_MARKERS: Record<string, EnemyLevelMarker[]> = {
  tutorial_sentinel: CAMPAIGN_STAGES.tutorial_sentinel.enemyMarkers,
  pyro_maw: CAMPAIGN_STAGES.pyro_maw.enemyMarkers,
  tide_reaver: CAMPAIGN_STAGES.tide_reaver.enemyMarkers,
  volt_hopper: CAMPAIGN_STAGES.volt_hopper.enemyMarkers,
  basalt_titan: CAMPAIGN_STAGES.basalt_titan.enemyMarkers,
  ferro_blade: CAMPAIGN_STAGES.ferro_blade.enemyMarkers,
  mire_wraith: CAMPAIGN_STAGES.mire_wraith.enemyMarkers,
  gale_vixen: CAMPAIGN_STAGES.gale_vixen.enemyMarkers,
  glacier_ronin: CAMPAIGN_STAGES.glacier_ronin.enemyMarkers,
  omega_fortress: CAMPAIGN_STAGES.omega_fortress.enemyMarkers,
  // The developer mechanics lab has no enemies (unknown ids fall back to Heat Works' roster).
  mechanics_lab: [],
  // The developer mini-boss lab (12c): one mini-boss per locked room.
  [MINIBOSS_LAB_STAGE_ID]: MINIBOSS_LAB_ENEMIES,
  enemy_test_range: [
    {
      id: 'marker_gunner_1',
      typeKey: 'enemy_gunner_bot',
      x: 300,
      y: 185,
      patrolMinX: 260,
      patrolMaxX: 360
    },
    {
      id: 'marker_rocket_1',
      typeKey: 'enemy_rocket_bot',
      x: 340,
      y: 185
    }
  ]
}

export function resolveLevelEnemyMarkers(stageId: string): EnemyLevelMarker[] {
  if (ENEMY_LEVEL_MARKERS[stageId]) {
    return ENEMY_LEVEL_MARKERS[stageId] ?? []
  }
  return ENEMY_LEVEL_MARKERS.pyro_maw ?? []
}
