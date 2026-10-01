// Part 13c (EVAL-P13-006, EVAL-P6-012): the warden curve, computed from the roster's own numbers, not
// taste. For each boss (campaign order, from `src/content/campaign.ts`):
//   - "time to kill": `estimateNormalClearSeconds(maxHp)`, the same 1.6 HP/s Normal reference the roster
//     tests already hold every boss to (`src/boss/phaseKit.ts`).
//   - "damage/min to an idle hero": for every phase-one attack, its authored hit damage (the hitbox's own
//     `damage` if it has one, else the mapper's per-state default — the same resolution `BossController`
//     uses for contact) divided by a full cycle (telegraph + execute + cooldown), averaged across the
//     boss's phase-one attacks. An idle hero eats every attack that comes off cooldown; this is an upper
//     bound (no dodging), not a play-clocked number.
//
// Usage: node --import ./tools/register-ts-loader.mjs scripts/content/warden-curve.mjs
//        node --import ./tools/register-ts-loader.mjs scripts/content/warden-curve.mjs --write
//        (--write replaces the table in docs/design/difficulty-curve.md; without it, prints only)
import fs from 'node:fs'
import path from 'node:path'

async function main() {
  const { BOSS_ROSTER } = await import('../../src/bosses/roster.ts')
  const { CAMPAIGN_STAGES } = await import('../../src/content/campaign.ts')
  const { estimateNormalClearSeconds, NORMAL_REFERENCE_DPS } = await import('../../src/boss/phaseKit.ts')
  const { resolveAttackDamage } = await import('../../src/boss/framework/bossDefinitionMapper.ts')

  const order = [...new Set(Object.values(CAMPAIGN_STAGES).map((stage) => stage.bossId))]
  const hitDamage = (attack) => attack.hitbox?.damage ?? resolveAttackDamage(attack)
  const cycleMs = (attack) => attack.telegraph.telegraphMs + attack.executeMs + attack.cooldownMs

  const rows = order.map((bossId) => {
    const boss = BOSS_ROSTER[bossId]
    const phaseOne = boss.attacks
    const dpmPerAttack = phaseOne.map((attack) => (hitDamage(attack) / cycleMs(attack)) * 60000)
    const damagePerMinute = dpmPerAttack.reduce((sum, value) => sum + value, 0) / dpmPerAttack.length
    return {
      bossId,
      role: bossId === 'sentinel_rook' ? 'tutorial' : bossId === 'omega_core' ? 'final' : 'warden',
      maxHp: boss.baseStats.maxHp,
      timeToKillS: estimateNormalClearSeconds(boss.baseStats.maxHp),
      damagePerMinute: Math.round(damagePerMinute * 10) / 10,
      contactDamage: boss.baseStats.contactDamage
    }
  })

  const header = '| Boss | Role | HP | Time to kill (Normal ref, 1.6 HP/s) | Damage/min to an idle hero (phase one) | Contact |\n| --- | --- | --- | --- | --- | --- |'
  const body = rows
    .map((row) => `| ${row.bossId} | ${row.role} | ${row.maxHp} | ${row.timeToKillS}s | ${row.damagePerMinute} | ${row.contactDamage} |`)
    .join('\n')
  const table = `${header}\n${body}`

  console.log(table)
  console.log(`\n(reference DPS: ${NORMAL_REFERENCE_DPS} HP/s)`)

  if (process.argv.includes('--write')) {
    const docPath = path.resolve('docs/design/difficulty-curve.md')
    const doc = fs.readFileSync(docPath, 'utf8')
    const marker = { start: '<!-- warden-curve:start -->', end: '<!-- warden-curve:end -->' }
    const startIndex = doc.indexOf(marker.start)
    const endIndex = doc.indexOf(marker.end)
    if (startIndex === -1 || endIndex === -1) {
      console.error(`[warden-curve] markers not found in ${docPath}`)
      process.exit(1)
    }
    const next = `${doc.slice(0, startIndex + marker.start.length)}\n${table}\n${doc.slice(endIndex)}`
    fs.writeFileSync(docPath, next, 'utf8')
    console.log(`\n[warden-curve] wrote the table into ${docPath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
