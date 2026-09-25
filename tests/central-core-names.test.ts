import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { FINAL_STAGE_ID, getCampaignStage } from '../src/content/campaign.ts'
import { BOSS_ROSTER } from '../src/bosses/roster.ts'
import { PROGRESSION_LOCATIONS, getLocationCheckId } from '../src/progression/catalog.ts'

// Part 12g (prompt 07 section 7.6 A.6, EVAL-P7-007): the text pass named the last stage the Central Core in every
// line; the code strings follow. Ids stay (`omega_fortress`, `omega_core`) so saves and routes hold.

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|json)$/.test(entry.name) ? [full] : []
  })
}

test('the last stage is the Central Core in code, with its ids unchanged', () => {
  const core = getCampaignStage(FINAL_STAGE_ID)
  assert.equal(FINAL_STAGE_ID, 'omega_fortress')
  assert.equal(core.title, 'Central Core')
  assert.equal(core.district, 'Central Core')
  assert.equal(core.arenaLabel, 'Core Command Vault')
  assert.equal(core.bossId, 'omega_core')
  assert.equal(BOSS_ROSTER.omega_core.arena, 'Central Core Command Vault')
  const clear = PROGRESSION_LOCATIONS.find((location) => location.id === getLocationCheckId(FINAL_STAGE_ID, 'boss_clear'))
  assert.equal(clear?.label, 'Central Core Boss Clear')
  for (const file of sourceFiles('src')) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /Omega (Fortress|Citadel)/i, file)
  }
})
