import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { normalizedId, resolveAttackDamage, toBossDefinition } from '../src/boss/framework/bossDefinitionMapper'
import { bossBoxRect, resolveBossBodies, type BossContactAttack } from '../src/bosses/bossBodies'
import { BOSS_COMBAT_PROFILES } from '../src/bosses/bossCombatProfiles'
import { BOSS_ROSTER } from '../src/bosses/roster'
import type { BossBlueprint } from '../src/bosses/types'

// Prompt 07 phase 7.0 (EVAL-P7-010): a floor body, a hurtbox and a hitbox per attack phase.
const bosses = Object.values(BOSS_ROSTER) as BossBlueprint[]
const attacksOf = (boss: BossBlueprint) => [...boss.attacks, ...(boss.desperation ? [boss.desperation.attack] : [])]
const contactAttacks = (boss: BossBlueprint): BossContactAttack[] =>
  attacksOf(boss).map((attack) => ({ id: normalizedId(attack.name), hitbox: attack.hitbox, damage: resolveAttackDamage(attack) }))

test('a box sits on the feet and mirrors with the facing', () => {
  const box = { width: 20, height: 30, offsetX: 6, offsetY: 2 }
  assert.deepEqual(bossBoxRect(box, { x: 100, y: 200 }, 1), { x: 96, y: 168, width: 20, height: 30 })
  assert.deepEqual(bossBoxRect(box, { x: 100, y: 200 }, -1), { x: 84, y: 168, width: 20, height: 30 })
})

test('every warden authors a hurtbox and an idle hitbox inside its floor body: the floor body alone never hurts', () => {
  for (const boss of bosses) {
    assert.ok(boss.bodies, `${boss.id} authors bodies`)
    const floor = boss.spritePlan.frame
    const { hurtbox, hitbox } = boss.bodies!
    assert.ok(hitbox.width < floor.x && hitbox.height <= floor.y, `${boss.id}: the hitbox is inside the floor body`)
    assert.ok(hurtbox.width > hitbox.width, `${boss.id}: the hurtbox is wider than the hitbox, so a saber reaches it without contact`)
    assert.ok(hurtbox.width <= floor.x && hurtbox.height <= floor.y, `${boss.id}: the hurtbox is inside the floor body`)
    assert.equal(boss.baseStats.contactDamage, 2, `${boss.id}: idle contact keeps today's 2 (the hero has 8 HP)`)
  }
})

test('idle contact uses the roster contactDamage; an active strike uses its own box and damage; wind-up and recovery do not', () => {
  const pyro = BOSS_ROSTER.pyro_maw as BossBlueprint
  const input = { plan: pyro.bodies!, contactDamage: 2, feet: { x: 200, y: 180 }, facing: -1 as const, attacks: contactAttacks(pyro) }
  const idle = resolveBossBodies({ ...input, activeAttackId: null, lifecycle: null })
  assert.equal(idle.attack, null)
  assert.equal(idle.damage, 2)
  assert.deepEqual(idle.hitbox, { x: 186, y: 150, width: 28, height: 30 })
  const dashing = resolveBossBodies({ ...input, activeAttackId: 'ignition_dash', lifecycle: 'active' })
  assert.equal(dashing.attack, 'ignition_dash')
  assert.equal(dashing.damage, 2, "the dash's own hit damage")
  assert.deepEqual(dashing.hitbox, { x: 174, y: 152, width: 40, height: 28 }, '40px wide, 6px ahead of the feet (facing west)')
  assert.equal(resolveBossBodies({ ...input, activeAttackId: 'ignition_dash', lifecycle: 'windup' }).attack, null)
  assert.equal(resolveBossBodies({ ...input, activeAttackId: 'ignition_dash', lifecycle: 'recovery' }).attack, null)
  assert.equal(resolveBossBodies({ ...input, activeAttackId: 'serpent_stream', lifecycle: 'active' }).attack, null, 'a shot keeps the idle box')
  const rook = BOSS_ROSTER.sentinel_rook as BossBlueprint
  const hop = resolveBossBodies({ ...input, plan: rook.bodies!, attacks: contactAttacks(rook), activeAttackId: 'giga_hop', lifecycle: 'active' })
  assert.equal(hop.damage, 2, 'an authored hitbox damage wins over the hop\'s hit damage of 1')
})

test('every dash that crosses the hero strikes with a hitbox on the boss (the dash_strike bullet is retired)', () => {
  for (const boss of bosses) {
    const profile = BOSS_COMBAT_PROFILES[boss.id as keyof typeof BOSS_COMBAT_PROFILES]
    for (const attack of attacksOf(boss)) {
      const motion = profile?.attacks[normalizedId(attack.name)]?.motion
      if (motion?.crossPlayer || attack.state === 'dash') {
        assert.ok(attack.hitbox, `${boss.id}: ${attack.name} carries a hitbox while it is active`)
      }
    }
  }
})

test('the mapper passes blueprint defense and resistances through (none authored, so behaviour is unchanged)', () => {
  const pyro = BOSS_ROSTER.pyro_maw as BossBlueprint
  assert.equal(toBossDefinition(pyro).defense, 0)
  assert.deepEqual(toBossDefinition(pyro).resistances, {})
  const authored = toBossDefinition({ ...pyro, defense: 1, resistances: { water: 0.5 } })
  assert.equal(authored.defense, 1)
  assert.deepEqual(authored.resistances, { water: 0.5 })
})

test('no dash_strike injection and no watchdog bullet are left in src', () => {
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (/\.(ts|json)$/.test(entry.name) && /dash_strike|Watchdog/.test(fs.readFileSync(file, 'utf8'))) hits.push(file)
    }
  }
  walk(path.resolve('src'))
  assert.deepEqual(hits, [])
})
