import test from 'node:test'
import assert from 'node:assert/strict'
import { getBossDefinitionById, validateBossDefinition } from '../src/boss/config/index'
import { BossBase } from '../src/boss/framework/BossBase'
import type { BossContext, BossDefinition } from '../src/boss/framework/types'
import {
  BOSS_DEATH_TIMING,
  BOSS_INTRO_TIMING,
  barFillAt,
  bossDeathTimeline,
  deathBeatAt,
  introBeatAt,
  paletteFlashColor,
  resolveDesperationArena,
  warningVisibleAt
} from '../src/boss/fightBeats'
import { NORMAL_CLEAR_TARGET_SECONDS, attackIdFromName, estimateNormalClearSeconds, resolvePhaseKits } from '../src/boss/phaseKit'
import { BOSS_COMBAT_PROFILES, getBossAttackCombatProfile } from '../src/bosses/bossCombatProfiles'
import { BOSS_ROSTER } from '../src/bosses/roster'
import { BOSS_HIT_FLASH_MS, BOSS_PLAYER_HIT_IFRAME_MS, bossHitReaction, bossPhaseHudText } from '../src/scenes/game/combatRules'

const bosses = Object.values(BOSS_ROSTER)

test('phase two retires one attack, retimes one and adds one for every warden and the Core', () => {
  bosses.forEach((boss) => {
    const kits = resolvePhaseKits(boss)
    const phaseTwo = kits[1]
    assert.equal(phaseTwo.retired.length, 1, `${boss.id} retires one attack in phase two`)
    assert.equal(Object.keys(phaseTwo.retimed).length, 1, `${boss.id} retimes one attack in phase two`)
    assert.equal(phaseTwo.added.length, 1, `${boss.id} adds one attack in phase two`)
    const retimedId = Object.keys(phaseTwo.retimed)[0]
    assert.notEqual(retimedId, phaseTwo.retired[0], `${boss.id} does not retime the attack it retires`)
    const ids = boss.attacks.map((attack) => attackIdFromName(attack.name))
    assert.ok(ids.includes(phaseTwo.retired[0]) && ids.includes(retimedId), `${boss.id} kit names its own attacks`)
    const definition = getBossDefinitionById(boss.id) as BossDefinition
    assert.deepEqual(validateBossDefinition(definition), [])
    const mapped = definition.phases[1]
    assert.equal(mapped.attackEnabled?.[phaseTwo.retired[0]], false, `${boss.id} flips the retired attack's enabled`)
    assert.equal(mapped.attackWeightOverrides?.[phaseTwo.retired[0]], 0)
    assert.equal(mapped.attackWeightOverrides?.[phaseTwo.added[0]], 3)
    const authored = definition.attacks.find((attack) => attack.id === retimedId)!
    const retime = mapped.attackTiming?.[retimedId]
    assert.ok(retime && retime.windupTime! < authored.windupTime && retime.cooldown! < authored.cooldown, `${boss.id} retime is quicker`)
  })
})

test('desperation at 20% adds one new attack with a combat contract, the arena change its room allows, and a palette', () => {
  const arenaByBoss: Record<string, string> = {}
  bosses.forEach((boss) => {
    const desperation = boss.desperation
    assert.ok(desperation, `${boss.id} has a desperation plan`)
    assert.equal(desperation.threshold, 0.2)
    assert.ok(desperation.name.length <= 12, `${boss.id} desperation HUD label fits`)
    assert.ok(desperation.flashPalette.length >= 2)
    const id = attackIdFromName(desperation.attack.name)
    assert.ok(!boss.attacks.some((attack) => attackIdFromName(attack.name) === id), `${boss.id} desperation attack is new`)
    assert.ok(getBossAttackCombatProfile(boss.id, id), `${boss.id}.${id} has a combat contract`)
    assert.ok((desperation.attack.spawns ?? []).length > 0, `${boss.id}.${id} spawns something`)
    const definition = getBossDefinitionById(boss.id) as BossDefinition
    const last = definition.phases[definition.phases.length - 1]
    assert.equal(last.desperation, true)
    assert.equal(last.threshold, 0.2)
    assert.deepEqual(last.unlockAttacks, [id])
    assert.ok(!definition.phases[0].unlockAttacks?.includes(id), `${boss.id} desperation attack is locked until 20%`)
    arenaByBoss[boss.id] = resolveDesperationArena(BOSS_COMBAT_PROFILES[boss.id].room).kind
  })
  assert.equal(arenaByBoss.pyro_maw, 'vents_all_on')
  assert.equal(arenaByBoss.volt_hopper, 'mines_everywhere')
  assert.equal(arenaByBoss.basalt_titan, 'pillars_rising')
  assert.equal(arenaByBoss.tide_reaver, 'anchors_shifting')
  assert.equal(arenaByBoss.ferro_blade, 'anchors_shifting')
  assert.equal(arenaByBoss.sentinel_rook, 'none')
  const omega = getBossDefinitionById('omega_core')!
  assert.deepEqual(omega.phases[3].patternDeck?.[0], 'final_directive', 'the Core keeps a deterministic deck in desperation')
})

function xorshift(seed: number) {
  let value = seed >>> 0 || 1
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    return (value >>> 0) / 0x100000000
  }
}

/** Drives the pure boss brain through its phases and returns attack starts grouped by the phase they started in. */
function traceFight(bossId: string) {
  const definition = getBossDefinitionById(bossId) as BossDefinition
  const started: Array<{ phase: number; id: string; windup: number }> = []
  const brain = new BossBase(definition, {
    onAttackStarted: (attack) => started.push({ phase: brain.currentPhaseIndex, id: attack.id, windup: attack.windupTime })
  })
  brain.OnFightStart()
  brain.unlockIntro()
  const rng = xorshift(0x5eed)
  const distances = [24, 60, 110, 170, 210]
  let now = 0
  const run = (frames: number) => {
    for (let frame = 0; frame < frames; frame += 1) {
      now += 16
      const distance = distances[Math.floor(now / 1500) % distances.length]
      const ctx: BossContext = {
        nowMs: now,
        dtMs: 16,
        bossPosition: { x: 300, y: 0 },
        playerPosition: { x: 300 - distance, y: 0 },
        distanceToPlayer: distance,
        lineOfSight: true,
        rng,
        phaseIndex: brain.currentPhaseIndex,
        speedMultiplier: 1,
        thinkTimeMultiplier: 1,
        bossGrounded: true,
        activeHazardCount: 0
      }
      brain.TickAI(ctx)
    }
  }
  const damageTo = (ratio: number) => {
    const hp = brain.hpSnapshot
    brain.ApplyDamage({ amount: hp.current - Math.floor(hp.max * ratio), type: 'normal', source: 'test', iFrameMs: 0 })
  }
  run(2400)
  damageTo(0.5)
  run(3600)
  damageTo(0.15)
  run(3600)
  return { definition, started }
}

test('the trace proves the retired attack never starts in phase two, the retime plays, and desperation fires its attack', () => {
  ;['pyro_maw', 'tide_reaver'].forEach((bossId) => {
    const { definition, started } = traceFight(bossId)
    const kit = resolvePhaseKits(BOSS_ROSTER[bossId as keyof typeof BOSS_ROSTER])
    const retired = kit[1].retired[0]
    const retimedId = Object.keys(kit[1].retimed)[0]
    const phaseOne = started.filter((entry) => entry.phase === 0)
    const phaseTwo = started.filter((entry) => entry.phase === 1)
    const desperation = started.filter((entry) => entry.phase === 2)
    assert.ok(phaseOne.some((entry) => entry.id === retired), `${bossId}: ${retired} fires in phase one`)
    assert.ok(phaseTwo.length >= 6, `${bossId}: phase two attacks (${phaseTwo.length})`)
    assert.ok(!phaseTwo.some((entry) => entry.id === retired), `${bossId}: ${retired} never starts in phase two`)
    assert.ok(!desperation.some((entry) => entry.id === retired), `${bossId}: ${retired} stays retired in desperation`)
    assert.ok(phaseTwo.some((entry) => entry.id === kit[1].added[0]), `${bossId}: phase two adds ${kit[1].added[0]}`)
    const authoredWindup = definition.attacks.find((attack) => attack.id === retimedId)!.windupTime
    phaseOne.filter((entry) => entry.id === retimedId).forEach((entry) => assert.equal(entry.windup, authoredWindup))
    const retimedStarts = phaseTwo.filter((entry) => entry.id === retimedId)
    assert.ok(retimedStarts.length > 0 && retimedStarts.every((entry) => entry.windup === kit[1].retimed[retimedId].windupTime), `${bossId}: retimed wind-up`)
    assert.ok(desperation.some((entry) => entry.id === kit[2].added[0]), `${bossId}: desperation fires ${kit[2].added[0]}`)
  })
})

test('a weakness hit stuns 200 ms, flashes white twice as long, interrupts a wind-up, and cannot stun-lock', () => {
  const weak = bossHitReaction(1.75)
  assert.equal(weak.weakness, true)
  assert.equal(weak.stunMs, 200)
  assert.equal(weak.interruptWindup, true)
  assert.equal(weak.whiteFlashMs, BOSS_HIT_FLASH_MS * 2)
  assert.equal(weak.iFrameMs, 120)
  assert.equal(weak.sfx, 'boss_hit_weak')
  const plain = bossHitReaction(1)
  assert.deepEqual([plain.weakness, plain.stunMs, plain.interruptWindup, plain.whiteFlashMs, plain.iFrameMs], [false, undefined, false, 0, 120])
  assert.equal(BOSS_PLAYER_HIT_IFRAME_MS, 120)
  assert.equal(bossHitReaction(1.4).weakness, true)

  const definition = getBossDefinitionById('pyro_maw') as BossDefinition
  const interrupted: string[] = []
  const brain = new BossBase(definition, { onAttackInterrupted: (attack) => interrupted.push(attack.id) })
  brain.OnFightStart()
  brain.unlockIntro()
  const rng = xorshift(7)
  const tick = (distance = 100) =>
    brain.TickAI({ nowMs: 0, dtMs: 16, bossPosition: { x: 0, y: 0 }, playerPosition: { x: distance, y: 0 }, distanceToPlayer: distance, lineOfSight: true, rng, phaseIndex: 0, speedMultiplier: 1, thinkTimeMultiplier: 1, bossGrounded: true })
  let guard = 0
  while (brain.activeAttackLifecycle !== 'windup' && guard < 400) {
    tick()
    guard += 1
  }
  assert.equal(brain.activeAttackLifecycle, 'windup')
  const attackId = brain.activeAttackId!
  const hit = brain.ApplyDamage({ amount: 2, type: 'normal', source: 'player', iFrameMs: weak.iFrameMs, stunMs: weak.stunMs, stunLockoutMs: weak.stunLockoutMs, interruptWindup: true })
  assert.equal(hit.interruptedAttackId, attackId)
  assert.deepEqual(interrupted, [attackId])
  assert.equal(brain.state, 'HURT_INVULN')
  assert.equal(brain.activeAttackId, undefined)
  for (let frame = 0; frame < 12; frame += 1) tick()
  assert.equal(brain.state, 'HURT_INVULN', 'still stunned at 192 ms')
  for (let frame = 0; frame < 2; frame += 1) tick()
  assert.notEqual(brain.state, 'HURT_INVULN', 'the 200 ms stun ends')
  // Inside the 1 s lockout a second weakness hit damages but interrupts nothing.
  guard = 0
  while (brain.activeAttackLifecycle !== 'windup' && guard < 400) {
    tick()
    guard += 1
  }
  const second = brain.ApplyDamage({ amount: 2, type: 'normal', source: 'player', iFrameMs: 120, stunMs: 200, stunLockoutMs: 1000, interruptWindup: true })
  assert.equal(second.accepted, true)
  // 14 stun frames plus the wait for the next wind-up, all inside the 1 s lockout from the first stun.
  assert.ok((14 + guard) * 16 < 1000, `the second wind-up came inside the lockout (${(14 + guard) * 16} ms)`)
  assert.equal(second.interruptedAttackId, undefined)
})

test('intro, bar fill, death and desperation beats keep their timings', () => {
  assert.equal(introBeatAt(0), 'warning')
  assert.equal(introBeatAt(BOSS_INTRO_TIMING.warningMs), 'card')
  assert.equal(introBeatAt(BOSS_INTRO_TIMING.warningMs + BOSS_INTRO_TIMING.cardMs), 'done')
  assert.equal(warningVisibleAt(0), true)
  assert.equal(warningVisibleAt(BOSS_INTRO_TIMING.warningBlinkMs), false)
  assert.equal(BOSS_INTRO_TIMING.barFillMs, 900)
  assert.deepEqual(barFillAt(0), { tick: 0, fraction: 0 })
  assert.deepEqual(barFillAt(900), { tick: BOSS_INTRO_TIMING.barFillTicks, fraction: 1 })
  let previous = -1
  for (let ms = 0; ms <= 900; ms += 10) {
    const { fraction } = barFillAt(ms)
    assert.ok(fraction >= previous)
    previous = fraction
  }
  const timeline = bossDeathTimeline()
  assert.equal(BOSS_DEATH_TIMING.hitstopFrames, 20)
  assert.equal(timeline.hitstopMs, 333)
  assert.equal(timeline.explosionEndMs - timeline.explosionStartMs, 1200)
  assert.equal(timeline.burstAtMs.length, BOSS_DEATH_TIMING.bursts)
  assert.equal(timeline.dialogueAtMs - timeline.explosionEndMs, 900)
  assert.deepEqual([deathBeatAt(0), deathBeatAt(400), deathBeatAt(1600), deathBeatAt(2500)], ['hitstop', 'explosion', 'freeze', 'dialogue'])
  assert.equal(paletteFlashColor(0, [1, 2, 3]), 1)
  assert.equal(paletteFlashColor(60, [1, 2, 3]), 2)
  assert.equal(paletteFlashColor(5000, [1, 2, 3]), null)
  const shifted = resolveDesperationArena({ kind: 'teleport_anchors', maxActiveHazards: 2, anchorFractions: [0.16, 0.5, 0.84] })
  assert.notDeepEqual(shifted.anchorFractions, [0.16, 0.5, 0.84])
  assert.ok(shifted.anchorFractions.every((fraction) => fraction >= 0.08 && fraction <= 0.92))
  assert.equal(resolveDesperationArena({ kind: 'mine_lanes', maxActiveHazards: 3, anchorFractions: [0.22, 0.5, 0.78] }).hazardFractions.length, 5)
})

test('boss HP keeps a Normal clear inside 60 to 90 seconds on the reference model', () => {
  bosses.forEach((boss) => {
    const seconds = estimateNormalClearSeconds(boss.baseStats.maxHp)
    assert.ok(seconds >= NORMAL_CLEAR_TARGET_SECONDS.min && seconds <= NORMAL_CLEAR_TARGET_SECONDS.max, `${boss.id}: ${seconds}s`)
  })
})

test('the phase panel names the desperation phase and its attack', () => {
  const basalt = BOSS_ROSTER.basalt_titan
  assert.equal(bossPhaseHudText(basalt, 'MAGMA CORE', 'ACTION • TECTONIC RIFT'), 'MAGMA CORE\nRIFT')
  assert.equal(bossPhaseHudText(basalt, 'MAGMA CORE'), 'MAGMA CORE')
})
