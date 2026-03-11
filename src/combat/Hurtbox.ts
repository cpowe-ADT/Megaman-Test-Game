import type { HitboxShape } from './Hitbox'

export type Hurtbox = {
  id: string
  ownerId: string
  shape: HitboxShape
  enabled: boolean
}
