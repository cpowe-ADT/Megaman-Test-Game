import { Boss } from '../Boss';
import { BossId } from '../../types';
import { SimpleBoss } from './SimpleBoss';
import { FXSystem } from '../../fx/FXSystem';
import { getBossDefinition } from '../../data/Bosses';

export function createBoss(id: BossId, fx: FXSystem): Boss {
  const definition = getBossDefinition(id);
  return new SimpleBoss(definition, fx);
}
