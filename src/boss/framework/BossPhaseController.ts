import { BossPhaseDefinition } from './types'

export interface PhaseTransitionResult {
  previous: number
  current: number
  phase: BossPhaseDefinition
}

export class BossPhaseController {
  private readonly phases: BossPhaseDefinition[]
  private currentIndex = 0

  constructor(phases: BossPhaseDefinition[]) {
    this.phases = [...phases].sort((a, b) => b.threshold - a.threshold)
  }

  get index(): number {
    return this.currentIndex
  }

  get currentPhase(): BossPhaseDefinition {
    return this.phases[this.currentIndex]
  }

  evaluate(hpRatio: number): PhaseTransitionResult | undefined {
    let targetIndex = this.currentIndex
    for (let i = 0; i < this.phases.length; i += 1) {
      if (hpRatio <= this.phases[i].threshold) {
        targetIndex = i
      }
    }

    if (targetIndex === this.currentIndex) {
      return undefined
    }

    const previous = this.currentIndex
    this.currentIndex = targetIndex
    return {
      previous,
      current: this.currentIndex,
      phase: this.currentPhase
    }
  }

  getAttackSpeedMultiplier(): number {
    return this.currentPhase.speedMultiplier ?? 1
  }

  getThinkMultiplier(): number {
    return this.currentPhase.thinkTimeMultiplier ?? 1
  }
}
