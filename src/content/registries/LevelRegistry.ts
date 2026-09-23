import { Registry } from './Registry'

export type LevelConfigEntry = {
  id: string
  displayName: string
}

export class LevelRegistry extends Registry<LevelConfigEntry> {}
