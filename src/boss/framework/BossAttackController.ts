import { TimedAttackModule } from './AttackModules'
import { AttackContext, BossAttackDefinition } from './types'

function pickWeighted<T>(items: T[], getWeight: (value: T) => number, rng: () => number): T | undefined {
  const total = items.reduce((sum, item) => sum + Math.max(0, getWeight(item)), 0)
  if (total <= 0) {
    return items[0]
  }

  let pick = rng() * total
  for (const item of items) {
    pick -= Math.max(0, getWeight(item))
    if (pick <= 0) {
      return item
    }
  }

  return items[items.length - 1]
}

export interface AttackControllerTickResult {
  active?: BossAttackDefinition
  fired?: BossAttackDefinition
  done?: BossAttackDefinition
}

export class BossAttackController {
  private readonly modules: Map<string, TimedAttackModule>
  private readonly cooldownsMs = new Map<string, number>()
  private readonly unlockedAttacks = new Set<string>()
  private readonly baseWeights = new Map<string, number>()
  private readonly weightOverrides = new Map<string, number>()

  private activeModule?: TimedAttackModule
  private lastAttackId?: string
  private selectionDeck: string[] = []
  private deckIndex = 0

  constructor(attacks: BossAttackDefinition[]) {
    this.modules = new Map(attacks.map((attack) => [attack.id, new TimedAttackModule(attack)]))
    attacks.forEach((attack) => {
      this.baseWeights.set(attack.id, attack.weight)
      this.unlockedAttacks.add(attack.id)
    })
  }

  get activeAttackId(): string | undefined {
    return this.activeModule?.id
  }

  tick(dtMs: number, ctx: AttackContext): AttackControllerTickResult {
    this.cooldownsMs.forEach((remaining, id) => {
      const next = Math.max(0, remaining - dtMs)
      if (next <= 0) {
        this.cooldownsMs.delete(id)
      } else {
        this.cooldownsMs.set(id, next)
      }
    })

    const active = this.activeModule
    if (!active) {
      return {}
    }

    const attackResult = active.Tick(dtMs * ctx.speedMultiplier, ctx)
    if (attackResult.spawnedHitbox || attackResult.spawnedProjectile || attackResult.spawnedHazard) {
      return { active: active.definition, fired: active.definition }
    }

    if (attackResult.phase === 'done') {
      active.Exit(ctx)
      this.cooldownsMs.set(active.id, active.Cooldown)
      this.lastAttackId = active.id
      const finished = active.definition
      this.activeModule = undefined
      return { done: finished }
    }

    return { active: active.definition }
  }

  tryStartAttack(ctx: AttackContext, panicDistance: number): BossAttackDefinition | undefined {
    if (this.activeModule) {
      return undefined
    }

    const candidates = this.getAvailableAttacks(ctx)
    if (candidates.length === 0) {
      return undefined
    }

    const filteredByRepeat =
      candidates.length > 1
        ? candidates.filter((module) => module.id !== this.lastAttackId)
        : candidates

    const panicCandidates =
      ctx.distanceToPlayer <= panicDistance
        ? filteredByRepeat.filter((module) => {
            const type = module.definition.type
            return type === 'melee' || type === 'dash'
          })
        : []

    const pool = panicCandidates.length > 0 ? panicCandidates : filteredByRepeat
    const selectedFromDeck = this.pickFromDeck(pool)
    const selected =
      selectedFromDeck ??
      pickWeighted(
        pool,
        (module) => {
          const id = module.id
          const base = this.weightOverrides.get(id) ?? this.baseWeights.get(id) ?? 1
          const panicBoost =
            panicCandidates.length > 0 ? (module.definition.panicWeight ?? Math.max(2, base)) : 0
          return base + panicBoost
        },
        ctx.rng
      )

    if (!selected) {
      return undefined
    }

    selected.Enter(ctx)
    this.activeModule = selected
    return selected.definition
  }

  forceEndActive(ctx: AttackContext): void {
    if (!this.activeModule) {
      return
    }
    this.activeModule.Exit(ctx)
    this.activeModule = undefined
  }

  setUnlockedAttacks(ids: string[]): void {
    this.unlockedAttacks.clear()
    ids.forEach((id) => this.unlockedAttacks.add(id))
  }

  unlockAttacks(ids: string[]): void {
    ids.forEach((id) => this.unlockedAttacks.add(id))
  }

  setWeightOverrides(overrides: Record<string, number>): void {
    this.weightOverrides.clear()
    Object.entries(overrides).forEach(([id, weight]) => this.weightOverrides.set(id, weight))
  }

  setSelectionDeck(ids: string[]): void {
    this.selectionDeck = [...ids]
    this.deckIndex = 0
  }

  private pickFromDeck(pool: TimedAttackModule[]): TimedAttackModule | undefined {
    if (this.selectionDeck.length === 0 || pool.length === 0) {
      return undefined
    }
    const available = new Map(pool.map((module) => [module.id, module]))
    for (let offset = 0; offset < this.selectionDeck.length; offset += 1) {
      const index = (this.deckIndex + offset) % this.selectionDeck.length
      const candidate = available.get(this.selectionDeck[index])
      if (!candidate) continue
      this.deckIndex = (index + 1) % this.selectionDeck.length
      return candidate
    }
    return undefined
  }

  private getAvailableAttacks(ctx: AttackContext): TimedAttackModule[] {
    const list: TimedAttackModule[] = []
    this.modules.forEach((module, id) => {
      if (!this.unlockedAttacks.has(id)) {
        return
      }
      if ((this.cooldownsMs.get(id) ?? 0) > 0) {
        return
      }
      const requirements = module.definition.requirements
      if (requirements?.grounded && ctx.bossGrounded === false) {
        return
      }
      if (requirements?.airborne && ctx.bossGrounded !== false) {
        return
      }
      if (
        requirements?.maxActiveHazards != null &&
        Number(ctx.activeHazardCount ?? 0) >= requirements.maxActiveHazards
      ) {
        return
      }
      if (!module.CanUse(ctx)) {
        return
      }
      list.push(module)
    })
    return list
  }
}
