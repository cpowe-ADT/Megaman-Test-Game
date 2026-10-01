import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHeroEnvironment } from '../src/mechanics/heroEnvironment.ts'
import { iceFloorBox, iceFloorUnder } from '../src/mechanics/iceFloor.ts'
import { iceTileFrameIndex } from '../src/mechanics/mechanicsV2Visuals.ts'
import { stageMechanicPlatforms } from '../src/mechanics/stageMechanics.ts'

const ice = { id: 'i', x: 100, y: 244, width: 160 }
const standingAt = (x: number) => ({ left: x - 8, right: x + 8, top: 206, bottom: 236 })

test('ice floor: the ice under a grounded hero is found; airborne or off it, none; it is a solid 16px platform', () => {
  assert.deepEqual(iceFloorBox(ice), { left: 20, right: 180, top: 236, bottom: 252 })
  assert.equal(iceFloorUnder([ice], standingAt(100), true), 'i')
  assert.equal(iceFloorUnder([ice], standingAt(100), false), null)
  assert.equal(iceFloorUnder([ice], standingAt(260), true), null)
  const [platform] = stageMechanicPlatforms({ iceFloors: [ice] })
  assert.deepEqual([platform.type, platform.height], ['solid', 16])
})

test('ice floor feeds the motor surface: ice under the feet, ground elsewhere; the tiles shimmer', () => {
  const on = resolveHeroEnvironment({ hero: standingAt(100), grounded: true, clockMs: 0, conveyors: [], iceFloors: [ice], currents: [], winds: [] })
  assert.deepEqual([on.environment.surface, on.iceId], ['ice', 'i'])
  const off = resolveHeroEnvironment({ hero: standingAt(300), grounded: true, clockMs: 0, conveyors: [], iceFloors: [ice], currents: [], winds: [] })
  assert.deepEqual([off.environment.surface, off.iceId], ['ground', null])
  assert.deepEqual([iceTileFrameIndex(0), iceTileFrameIndex(900), iceTileFrameIndex(1800)], [0, 1, 0])
})
