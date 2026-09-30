import test from 'node:test'
import assert from 'node:assert/strict'
import { getBossById } from '../src/bosses/roster'
import { ROOK_CLEAR_TARGET_SECONDS, estimateNormalClearSeconds } from '../src/boss/phaseKit'
import { bossDamageScale, scaleBossHitDamage } from '../src/scenes/game/combatRules'
import { PLAYER_GAMEPLAY_CONFIG } from '../src/player/config'

const sentinelId = 'sentinel_rook' as const

function getGuardShot() {
  const blueprint = getBossById(sentinelId)
  const guardShot = blueprint.attacks.find((attack) => attack.name === 'Guard Shot')

  assert.ok(guardShot, 'Sentinel Rook is expected to have a Guard Shot attack defined')
  return guardShot
}

test('Sentinel Rook Guard Shot remains a projectile attack', () => {
  const guardShot = getGuardShot()
  assert.equal(guardShot.state, 'shoot')
})

test('Sentinel Rook Guard Shot fires the slow bullet projectile', () => {
  const guardShot = getGuardShot()
  assert.deepEqual(guardShot.spawns, ['slow_bullet'])
})

// Part 13c (EVAL-P13-006): Craig's first-boss note. Every number below matches the part's Decision
// table; every wind-up (including the phase-two retime) stays at or above 300 ms.
test('Sentinel Rook: the 13c balance pass lands every Decision number', () => {
  const rook = getBossById(sentinelId)
  assert.equal(rook.baseStats.maxHp, 60)
  assert.equal(rook.baseStats.contactDamage, 1)

  const gigaHop = rook.attacks.find((attack) => attack.name === 'Giga Hop')!
  assert.equal(gigaHop.hitbox?.damage, 1, 'Hop damage 2 -> 1')

  const guardShot = getGuardShot()
  assert.equal(guardShot.telegraph.telegraphMs, 400)
  assert.equal(guardShot.cooldownMs, 700)

  const stompShock = rook.attacks.find((attack) => attack.name === 'Stomp Shock')!
  assert.equal(stompShock.telegraph.telegraphMs, 520)

  const phaseTwo = rook.phases[1]
  assert.equal(phaseTwo.threshold, 0.4)
  assert.equal(phaseTwo.cadenceMultiplier, 1.1)
  const guardShotRetime = phaseTwo.retimeAttacks?.['Guard Shot']
  assert.deepEqual(guardShotRetime, { telegraphMs: 300, cooldownMs: 560 })

  assert.ok(rook.desperation, 'Rook keeps a desperation phase')
  assert.equal(rook.desperation!.threshold, 0.15)
  assert.equal(rook.desperation!.cadenceMultiplier, 1.15)

  const windups = [
    gigaHop.telegraph.telegraphMs,
    guardShot.telegraph.telegraphMs,
    guardShotRetime!.telegraphMs!,
    stompShock.telegraph.telegraphMs,
    rook.desperation!.attack.telegraph.telegraphMs
  ]
  windups.forEach((ms) => assert.ok(ms >= 300, `wind-up ${ms}ms stays at or above 300ms`))
})

// The automated fight: the Normal-reference model is weapon-agnostic (a Buster-only fight "keeps its
// length", `combatRules.ts`'s `bossDamageScale` comment), so time to kill is the same 30-40s target for
// both tiers; the tiers differ in the hit count needed, which is what the Decision table records
// alongside the time ("about 38s, 8 lv4 shots"). Measured from the real player and combat-rule constants,
// not re-guessed. Charged shots may still vanish before landing until part 13b's shot-contract fix lands
// (a separate lane): this measures hits-to-kill and the reference clear time, not a full projectile-flight sim.
test('Sentinel Rook automated fight: 30 to 40s to kill, 60 buster pellets or 8 lv4 charged shots', () => {
  const rook = getBossById(sentinelId)
  const seconds = estimateNormalClearSeconds(rook.baseStats.maxHp)
  assert.ok(
    seconds >= ROOK_CLEAR_TARGET_SECONDS.min && seconds <= ROOK_CLEAR_TARGET_SECONDS.max,
    `time to kill: ${seconds}s`
  )

  const blaster = PLAYER_GAMEPLAY_CONFIG.blaster
  const pelletDamage = scaleBossHitDamage(blaster.pelletDamage, 0, bossDamageScale('Buster', 0))
  const lv4Damage = scaleBossHitDamage(blaster.perLevelProjectile[4].damage, 0, bossDamageScale('Buster', 4))
  assert.equal(pelletDamage, 1, 'a plain pellet keeps its damage against a boss')
  assert.equal(lv4Damage, 8, 'a held lv4 shot deals double against a boss')

  const busterOnlyShots = Math.ceil(rook.baseStats.maxHp / pelletDamage)
  const chargedOnlyShots = Math.ceil(rook.baseStats.maxHp / lv4Damage)
  assert.equal(busterOnlyShots, 60, `buster only: ${busterOnlyShots} pellets, ${seconds}s`)
  assert.equal(chargedOnlyShots, 8, `charged only: ${chargedOnlyShots} lv4 shots, ${seconds}s`)
})
