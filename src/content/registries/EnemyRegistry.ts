import { Registry } from './Registry'

export type EnemyConfigEntry = {
  id: string
  displayName: string
}

export class EnemyRegistry extends Registry<EnemyConfigEntry> {}
