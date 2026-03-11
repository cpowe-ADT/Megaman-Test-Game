import { Registry } from './Registry'

export type EffectConfigEntry = {
  id: string
  type: string
}

export class EffectRegistry extends Registry<EffectConfigEntry> {}
