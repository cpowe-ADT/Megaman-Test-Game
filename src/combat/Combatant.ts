import { IFrameController } from './IFrameController'

export type Combatant = {
  id: string
  getHp: () => number
  getMaxHp: () => number
  setHp: (value: number) => void
  iFrames: IFrameController
}

export class CombatantRegistry {
  private readonly combatants = new Map<string, Combatant>()

  register(combatant: Combatant): void {
    this.combatants.set(combatant.id, combatant)
  }

  get(id: string): Combatant | undefined {
    return this.combatants.get(id)
  }

  unregister(id: string): void {
    this.combatants.delete(id)
  }

  clear(): void {
    this.combatants.clear()
  }
}
