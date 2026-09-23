import { getSelectableBossStages } from '../../content/campaign'
import { BossId } from '../../bosses/types'

export type StageSelectTransition = {
  scene: 'Game'
  data: { stageId: string; bossId: BossId; runtimeBossConfigId?: string; checkpointId?: string }
}

export class StageSelectLogic {
  private index = 0
  private checkpointId: string | null = null

  setIndex(index: number): void {
    this.index = index
  }

  setCheckpointId(checkpointId: string | null): void {
    this.checkpointId = checkpointId
  }

  confirm(): StageSelectTransition | null {
    const stage = getSelectableBossStages()[this.index]
    if (!stage) {
      return null
    }

    const transition: StageSelectTransition = {
      scene: 'Game',
      data: {
        stageId: stage.id,
        bossId: stage.bossId,
        runtimeBossConfigId: stage.runtimeBossConfigId,
        checkpointId: this.checkpointId ?? undefined
      }
    }
    return transition
  }
}
