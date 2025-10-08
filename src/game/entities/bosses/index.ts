import { Boss } from '../Boss';
import { BossId } from '../../types';
import { SimpleBoss } from './SimpleBoss';
import { FXSystem } from '../../fx/FXSystem';

const bossTypes: Record<BossId, { type: import('../../types').Element; name: string }> = {
  Rook: { type: 'Normal', name: 'Sentinel ROOK' },
  PyroMaw: { type: 'Fire', name: 'Pyro Maw' },
  TideReaver: { type: 'Water', name: 'Tide Reaver' },
  VoltHopper: { type: 'Lightning', name: 'Volt Hopper' },
  BasaltTitan: { type: 'Earth', name: 'Basalt Titan' },
  FerroBlade: { type: 'Metal', name: 'Ferro Blade' },
  MireWraith: { type: 'Toxic', name: 'Mire Wraith' },
  GaleVixen: { type: 'Wind', name: 'Gale Vixen' },
  GlacierRonin: { type: 'Ice', name: 'Glacier Ronin' }
};

export function createBoss(id: BossId, fx: FXSystem): Boss {
  const cfg = bossTypes[id];
  return new SimpleBoss(id, cfg.type, cfg.name, fx);
}
