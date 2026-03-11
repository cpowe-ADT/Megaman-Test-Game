import test from 'node:test'
import assert from 'node:assert/strict'
import { BossProjectileController, buildBossSpreadAngles } from '../src/boss/framework/BossProjectileController'

function createProjectileGroup() {
  const members: any[] = []
  return {
    members,
    getTotalUsed() {
      return members.length
    },
    getLength() {
      return 80
    },
    children: {
      iterate(callback: (child: any) => unknown) {
        members.forEach((member) => callback(member))
      }
    }
  }
}

function createControllerHarness(options: {
  isControllerDriven: boolean
  spawnSequence?: Array<any | null>
}) {
  let now = 0
  const requests: any[] = []
  const group = createProjectileGroup()
  const origin = { x: 96, y: 64, active: true }
  const body = { velocityX: 0, setVelocityX(value: number) { body.velocityX = value } }
  const spawnSequence = [...(options.spawnSequence ?? [{}, {}])]

  const controller = new BossProjectileController({
    projectileSystem: {
      spawn(request: any) {
        requests.push(request)
        const result = spawnSequence.length > 0 ? spawnSequence.shift() ?? null : {}
        if (result) {
          group.members.push(result)
        }
        return result as any
      }
    } as any,
    projectileGroup: group as any,
    getNow: () => now,
    isEncounterActive: () => true,
    isControllerDriven: () => options.isControllerDriven,
    getPlayerPosition: () => ({ x: 24, y: 64 }),
    getBossOrigin: () => origin as any,
    getBossMovementBody: () => body as any,
    getTrailTint: () => 0x55ccff,
    createTrailEmitter: () => null,
    spawnGroundSlamHazard: () => {}
  })

  return {
    controller,
    requests,
    body,
    setNow(value: number) {
      now = value
    }
  }
}

test('buildBossSpreadAngles returns a centered spread', () => {
  assert.deepEqual(buildBossSpreadAngles(3, 0.3), [-0.15, 0, 0.15])
  assert.deepEqual(buildBossSpreadAngles(1, 0.3), [0])
})

test('BossProjectileController fires watchdog fallback when an attack fails to spawn a projectile', () => {
  const harness = createControllerHarness({
    isControllerDriven: true,
    spawnSequence: [null, {}]
  })

  harness.controller.startLoop()
  harness.controller.onBossAttack(
    {
      name: 'spark shot',
      state: 'shoot',
      description: 'Projectile attack',
      telegraph: { telegraphMs: 200, warningFx: 'glow', anchor: 'self' },
      executeMs: 3000,
      cooldownMs: 0
    },
    { hit: { damageAmount: 1 } }
  )

  harness.setNow(1700)
  harness.controller.update(1700, 16)

  assert.equal(harness.requests.length, 2)
  assert.equal(harness.requests[1].direction, -1)
  assert.equal(harness.requests[1].speed, 220)
})

test('BossProjectileController timer loop does not fire while paused and resumes on unpause', () => {
  const harness = createControllerHarness({
    isControllerDriven: false,
    spawnSequence: [{}]
  })

  harness.controller.startLoop()
  harness.controller.onPauseChanged(true)
  harness.setNow(1300)
  harness.controller.update(1300, 16)
  assert.equal(harness.requests.length, 0)

  harness.controller.onPauseChanged(false)
  harness.setNow(1499)
  harness.controller.update(1499, 16)
  assert.equal(harness.requests.length, 0)

  harness.setNow(1501)
  harness.controller.update(1501, 16)
  assert.equal(harness.requests.length, 1)
  assert.equal(harness.requests[0].direction, -1)
  assert.equal(harness.requests[0].speed, 260)
})
