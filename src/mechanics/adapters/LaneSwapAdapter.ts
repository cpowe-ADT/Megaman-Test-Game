import Phaser from 'phaser'
import type { ConveyorDefinition } from '../conveyor'
import { laneSwapAlpha, laneSwapAt, laneSwapCarriers, type LaneSwapDefinition, type LaneSwapState } from '../laneSwap'

export type LaneSwapDeps = {
  platforms: () => { findPlatformVisual(id: string): Phaser.GameObjects.GameObject | undefined } | undefined
}

type Movable = Phaser.GameObjects.GameObject & { x: number; setAlpha(value: number): unknown }
type SwapEntry = { def: LaneSwapDefinition; state: LaneSwapState; visuals: Array<Movable | undefined> }

/**
 * Phaser edge of the lane-swapping `carry` platforms (`laneSwap.ts`, 12d Volt). The platforms stand in the
 * platform list (`stageMechanicPlatforms`); once per frame this moves each drawn platform and its static body
 * to where the stage clock puts it, blinks the pair during the arming tell, and hands the platforms to the
 * hero environment as belts, so a hero standing on one rides with it. Owned by `MotionMechanicsAdapter`.
 */
export class LaneSwapAdapter {
  private readonly entries: SwapEntry[]

  constructor(private readonly deps: LaneSwapDeps, definitions: readonly LaneSwapDefinition[]) {
    this.entries = definitions.map((def) => ({
      def,
      state: laneSwapAt(def, 0),
      visuals: def.lanes.map((lane) => deps.platforms()?.findPlatformVisual(lane.id) as Movable | undefined)
    }))
  }

  get count(): number {
    return this.entries.length
  }

  update(clockMs: number): void {
    for (const entry of this.entries) {
      entry.state = laneSwapAt(entry.def, clockMs)
      const alpha = laneSwapAlpha(entry.state.phase, clockMs)
      entry.state.platforms.forEach((platform, index) => {
        const visual = entry.visuals[index]
        if (!visual) return
        visual.x = platform.x
        visual.setAlpha(alpha)
        const body = (visual as Phaser.Types.Physics.Arcade.GameObjectWithBody).body
        if (body instanceof Phaser.Physics.Arcade.StaticBody) body.updateFromGameObject()
      })
    }
  }

  /** The platforms as belts this frame (their speed is their slide velocity, 0 while they hold). */
  carriers(): ConveyorDefinition[] {
    return this.entries.flatMap((entry) => laneSwapCarriers(entry.def, entry.state))
  }

  getDebugState(riddenId: string | null) {
    return {
      laneSwaps: this.entries.map(({ def, state }) => ({
        id: def.id,
        phase: state.phase,
        swapped: state.swapped,
        untilMoveMs: Math.round(state.untilMoveMs),
        platforms: state.platforms.map((platform) => ({
          id: platform.id,
          x: Math.round(platform.x * 10) / 10,
          top: platform.top,
          velocityX: Math.round(platform.velocityX),
          heroOn: riddenId === platform.id
        }))
      }))
    }
  }
}
