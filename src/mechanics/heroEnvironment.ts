/**
 * The hero's motor environment from the stage's movement mechanics (prompt 12 part 12b): the belt under
 * the feet (carry), the ice under the feet (surface) and the push zones around the body (current, wind,
 * magnet, the water's float) folded into one `PlayerEnvironment` for `NewPlayerRuntime.setEnvironment`;
 * inside a current the jump rises less (12d). Pure.
 */
import type { PlayerEnvironment } from '../player/environment'
import { conveyorCarryAt, type ConveyorDefinition } from './conveyor'
import type { Box } from './crumbleGroup'
import { currentJumpRiseScale, currentPushOn, type CurrentZoneDefinition } from './currentZone'
import { combineZonePushes, type ZonePush } from './forceZone'
import { iceFloorUnder, type IceFloorDefinition } from './iceFloor'
import { windCycleAt, windPushOn, type ResolvedWindZone } from './windZone'

export type HeroEnvironmentInput = {
  hero: Box
  grounded: boolean
  clockMs: number
  conveyors: readonly ConveyorDefinition[]
  iceFloors: readonly IceFloorDefinition[]
  currents: readonly CurrentZoneDefinition[]
  winds: readonly ResolvedWindZone[]
  /** Pushes from other mechanics this frame: the float under a water line (`waterLevelGate.ts`). */
  extraPushes?: readonly ZonePush[]
}

export type HeroEnvironment = {
  environment: PlayerEnvironment
  /** The belt and the ice under the feet, and the zones pushing the hero (for the debug state). */
  beltId: string | null
  iceId: string | null
  zoneIds: string[]
}

export function resolveHeroEnvironment(input: HeroEnvironmentInput): HeroEnvironment {
  const belt = conveyorCarryAt(input.conveyors, input.hero, input.grounded)
  const iceId = iceFloorUnder(input.iceFloors, input.hero, input.grounded)
  const pushes: ZonePush[] = []
  for (const current of input.currents) {
    const push = currentPushOn(current, input.hero)
    if (push) pushes.push(push)
  }
  for (const wind of input.winds) {
    const push = windPushOn(wind, windCycleAt(wind, input.clockMs).phase, input.hero)
    if (push) pushes.push(push)
  }
  pushes.push(...(input.extraPushes ?? []))
  const combined = combineZonePushes(pushes)
  const environment: PlayerEnvironment = {
    surface: iceId ? 'ice' : 'ground',
    carryVelocityX: belt.speed,
    forceX: combined.forceX,
    forceY: combined.forceY
  }
  if (combined.cap !== undefined) environment.pushCap = combined.cap
  const jumpRiseScale = currentJumpRiseScale(input.currents, input.hero)
  if (jumpRiseScale !== 1) environment.jumpRiseScale = jumpRiseScale
  return { environment, beltId: belt.id, iceId, zoneIds: pushes.map((push) => push.id) }
}
