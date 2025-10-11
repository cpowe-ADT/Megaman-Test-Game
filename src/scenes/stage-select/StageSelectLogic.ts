import { ORDERED_BOSSES } from '../../bosses/roster'
import { BossId } from '../../bosses/types'

export type StageSelectTransition = {
  scene: 'Game'
  data: { bossId: BossId }
}

export class StageSelectLogic {
  private index = 0

  setIndex(index: number): void {
    this.index = index
  }

  confirm(): StageSelectTransition | null {
    const entry = ORDERED_BOSSES[this.index]
    if (!entry) {
      return null
    }

    const transition: StageSelectTransition = { scene: 'Game', data: { bossId: entry.id } }
    return transition
  }
}
