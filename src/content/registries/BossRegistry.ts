import { Registry } from './Registry'

export type BossConfigEntry = {
  id: string
  displayName: string
}

export class BossRegistry extends Registry<BossConfigEntry> {}
