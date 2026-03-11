import { getRobotMasterStages } from '../../content/campaign'
import { BossId } from '../../bosses/types'

export type StageSelectTransition = {
  scene: 'Game'
  data: { stageId: string; bossId: BossId; runtimeBossConfigId?: string }
}

export class StageSelectLogic {
  private index = 0

  setIndex(index: number): void {
    this.index = index
  }

  confirm(): StageSelectTransition | null {
    const stage = getRobotMasterStages()[this.index]
    if (!stage) {
      return null
    }

    const transition: StageSelectTransition = {
      scene: 'Game',
      data: {
        stageId: stage.id,
        bossId: stage.bossId,
        runtimeBossConfigId: stage.runtimeBossConfigId
      }
    }
    return transition
  }
}
