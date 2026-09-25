import type { CrumblePhase } from '../mechanics/crumbleGroup'
import type { VentPhase } from '../mechanics/hazards'
import type { RisingLiquidPhase } from '../mechanics/risingLiquid'
import type { RoomLockPhase } from '../mechanics/roomLock'
import type { RailPhase } from '../mechanics/timedRailGroup'
import type { WindPhase } from '../mechanics/windZone'
import type { SfxAssetKey } from './sfxLibrary'

/**
 * Which sound a stage mechanic's state change plays (part 12h). Pure: the Phaser adapters in
 * src/mechanics/adapters/ pass the phase before and after a step and play what comes back.
 */

export function ventPhaseSfx(before: VentPhase, after: VentPhase): SfxAssetKey | null {
  if (before === after) return null
  if (after === 'arming') return 'vent_arm'
  if (after === 'firing') return 'vent_fire'
  return null
}

export function railPhaseSfx(before: RailPhase, after: RailPhase): SfxAssetKey | null {
  return after === 'arcing' && before !== 'arcing' ? 'rail_arc' : null
}

export function windPhaseSfx(before: WindPhase, after: WindPhase): SfxAssetKey | null {
  return after === 'blowing' && before !== 'blowing' ? 'wind_gust' : null
}

export function crumblePhaseSfx(before: CrumblePhase, after: CrumblePhase): SfxAssetKey | null {
  if (before === after) return null
  if (after === 'shaking') return 'crumble_shake'
  if (after === 'fallen') return 'crumble_fall'
  return null
}

export function risingLiquidPhaseSfx(before: RisingLiquidPhase, after: RisingLiquidPhase): SfxAssetKey | null {
  return before === 'dormant' && after === 'rising' ? 'slag_rise' : null
}

/** The room locks behind the hero (armed), and opens when its verb or fight is done. */
export function roomLockPhaseSfx(before: RoomLockPhase, after: RoomLockPhase): SfxAssetKey | null {
  if (before === after) return null
  if (before === 'dormant' && after === 'locked') return 'gate_close'
  if (after === 'open') return 'gate_open'
  return null
}

/** A counted hit on a breakable wall cracks it; the last one breaks it. */
export function breakableWallHitSfx(broken: boolean): SfxAssetKey {
  return broken ? 'wall_break' : 'wall_crack'
}

export type SfxArea = { left: number; right: number; top: number; bottom: number }

/** An area from rectangles whose x and y are centres (Phaser rectangles and the rail boxes). */
export function areaAroundCentres(rects: readonly { x: number; y: number; width: number; height: number }[]): SfxArea | null {
  if (rects.length === 0) return null
  return {
    left: Math.min(...rects.map((rect) => rect.x - rect.width / 2)),
    right: Math.max(...rects.map((rect) => rect.x + rect.width / 2)),
    top: Math.min(...rects.map((rect) => rect.y - rect.height / 2)),
    bottom: Math.max(...rects.map((rect) => rect.y + rect.height / 2))
  }
}

/** Off-screen mechanics are silent: vents, rails and gusts cycle for the whole stage. */
export const MECHANIC_SFX_VIEW_MARGIN = 32

export function isAreaAudible(area: SfxArea, view: { x: number; y: number; width: number; height: number }, margin = MECHANIC_SFX_VIEW_MARGIN): boolean {
  return area.right >= view.x - margin && area.left <= view.x + view.width + margin && area.bottom >= view.y - margin && area.top <= view.y + view.height + margin
}
