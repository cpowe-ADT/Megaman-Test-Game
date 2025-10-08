import { BossId } from '../types';
import { getAllBossDefinitions, getBossAtGrid } from '../data/Bosses';

const nodes = getAllBossDefinitions()
  .map((definition) => ({ id: definition.id, col: definition.stage.col, row: definition.stage.row }))
  .sort((a, b) => (a.row - b.row) || (a.col - b.col));

export function gridToBossId(col: number, row: number): BossId {
  const definition = getBossAtGrid(col, row);
  if (!definition) {
    throw new Error(`No boss registered at grid position (${col}, ${row})`);
  }
  return definition.id;
}

export function iterateGrid(): { id: BossId; col: number; row: number }[] {
  return nodes;
}
