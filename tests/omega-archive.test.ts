import test from 'node:test'
import assert from 'node:assert/strict'

// EVAL-P6-011 / EVAL-P2-007 (12e): the Warden Archive's rules and the rematch config, without a scene.
const store = new Map<string, string>()
;(globalThis as any).window = {
  location: { search: '' },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 }
}
const { CAMPAIGN_STAGES, ROBOT_MASTER_STAGE_IDS } = await import('../src/content/campaign.ts')
const { BOSS_ROSTER } = await import('../src/bosses/roster.ts')
const { getBossDefinitionById } = await import('../src/boss/config/index.ts')
const { resolvePhaseKits, NORMAL_CLEAR_TARGET_SECONDS } = await import('../src/boss/phaseKit.ts')
const { DIALOGUE_REGISTRY } = await import('../src/content/dialogue/index.ts')
const { Save, validateActiveRun } = await import('../src/systems/Save.ts')
const archive = await import('../src/content/omegaArchive.ts')
const rematch = await import('../src/content/omegaRematch.ts')
const { OMEGA_HUB, OMEGA_HUB_GATE } = await import('../src/content/stages/omegaFortress.ts')

const RUN = { version: 2 as const, savedAt: 1, stageId: 'omega_fortress', bossId: 'omega_core', playerHp: 5, playerMaxHp: 8, playerLives: 2, currentWeaponIndex: 0, weaponEnergyById: {}, checkpointId: 'omega_archive', checkpointIndex: 2 }

test('archive: eight doors, one per warden in campaign order, labelled by element only', () => {
  assert.equal(archive.OMEGA_DOORS.length, 8)
  assert.deepEqual(archive.OMEGA_DOORS.map((door) => door.bossId), [...ROBOT_MASTER_STAGE_IDS])
  for (const door of archive.OMEGA_DOORS) {
    assert.equal(CAMPAIGN_STAGES[door.bossId].bossId, door.bossId)
    assert.equal(door.label, BOSS_ROSTER[door.bossId].element.toUpperCase())
    assert.ok(!door.label.includes(BOSS_ROSTER[door.bossId].codename.toUpperCase()), 'no name on the door')
    assert.ok(door.x - archive.OMEGA_DOOR_REACH > OMEGA_HUB.x && door.x + archive.OMEGA_DOOR_REACH < OMEGA_HUB_GATE.x)
  }
  const xs = archive.OMEGA_DOORS.map((door) => door.x)
  for (let index = 1; index < xs.length; index += 1) assert.ok(xs[index] - xs[index - 1] > 2 * archive.OMEGA_DOOR_REACH + 32)
  assert.equal(new Set(archive.OMEGA_DOORS.map((door) => door.label)).size, 8)
})

test('archive: a door opens in any order until its warden is cleared; the exit opens at eight', () => {
  const [fire, water] = archive.OMEGA_DOORS
  assert.equal(archive.doorAt(fire.x + archive.OMEGA_DOOR_REACH, [])?.bossId, 'pyro_maw')
  assert.equal(archive.doorAt(fire.x + archive.OMEGA_DOOR_REACH + 1, []), null)
  assert.equal(archive.doorAt(water.x, ['pyro_maw']), archive.OMEGA_DOORS[1])
  assert.equal(archive.doorAt(fire.x, ['pyro_maw']), null, 'a cleared door stays shut')
  assert.equal(archive.isArchiveExitOpen(archive.OMEGA_REMATCH_BOSS_IDS.slice(0, 7)), false)
  assert.equal(archive.isArchiveExitOpen([...archive.OMEGA_REMATCH_BOSS_IDS].reverse()), true)
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(archive.isRematchCheckpoint), [false, true, false, true, false, true, false, true])
  assert.equal(archive.isRematchCheckpoint(0), false)
})

test('archive: a game over keeps the fortress run from act 2 on, except on Veteran (its continue is the stage start)', () => {
  const expected: Record<string, [boolean, boolean, boolean]> = { assist: [false, true, true], normal: [false, true, true], veteran: [false, false, false] }
  for (const [difficulty, acts] of Object.entries(expected)) {
    assert.deepEqual(([1, 2, 3] as const).map((act) => archive.keepRunOnGameOver(difficulty as any, act)), acts, difficulty)
  }
})

test('archive: a hub re-entry is a checkpoint at clears 2, 4, 6 and 8, once each', () => {
  assert.equal(archive.shouldCheckpointOnReturn(2, 0), true)
  assert.equal(archive.shouldCheckpointOnReturn(2, 2), false, 'already saved (a reload at the archive)')
  assert.equal(archive.shouldCheckpointOnReturn(3, 2), false, 'an odd clear waits for the next checkpoint')
  assert.equal(archive.shouldCheckpointOnReturn(4, 2), true)
  assert.equal(archive.shouldCheckpointOnReturn(8, 6), true)
  assert.equal(archive.shouldCheckpointOnReturn(1, 0), false)
  assert.equal(archive.shouldCheckpointOnReturn(0, 0), false)
})

test('archive: a door re-enters Game as the rematch with the run in memory; a clear re-enters the hub', () => {
  const state = { cleared: ['tide_reaver'] as any[], saved: [] as any[], entry: null }
  const into = archive.buildRematchEntry({ ...RUN, playerHp: 3 }, state, 2, rematch.rematchConfigId('volt_hopper'))
  assert.deepEqual([into.stageId, into.bossId, into.runtimeBossConfigId], ['omega_fortress', 'volt_hopper', 'omega_rematch:volt_hopper'])
  const entry = archive.readOmegaEntry(into)
  assert.equal(entry?.mode, 'rematch')
  assert.equal(entry?.door, 2)
  assert.equal(archive.resolveOmegaEntryRun(into)?.bossId, 'volt_hopper', 'the resumed run names the warden, so the scene builds it')
  assert.equal(archive.resolveOmegaEntryRun(into)?.playerHp, 3, 'HP carries into the rematch')
  const back = archive.buildReturnEntry({ ...RUN, bossId: 'volt_hopper', playerHp: 2 }, { ...state, entry }, 2)
  assert.equal(back.bossId, 'omega_core')
  assert.deepEqual(back.omega.run.rematchCleared, ['tide_reaver', 'volt_hopper'])
  assert.equal(back.omega.run.checkpointId, 'omega_archive')
  assert.equal(archive.readOmegaEntry({ omega: { mode: 'rematch', door: 9, run: RUN } }), null)
  assert.equal(archive.readOmegaEntry({ stageId: 'omega_fortress' }), null)
})

test('archive: a save inside a rematch is the archive checkpoint with the Core as boss and the checkpointed clears', () => {
  const entry = { mode: 'rematch' as const, door: 3, run: RUN as any, saved: ['pyro_maw', 'tide_reaver'] as any[] }
  const state = { cleared: ['pyro_maw', 'tide_reaver', 'volt_hopper'] as any[], saved: entry.saved, entry }
  const snapshot = archive.omegaRunSnapshot({ ...RUN, bossId: 'basalt_titan', checkpointId: 'omega_archive', checkpointIndex: 4 }, state)
  assert.deepEqual([snapshot.bossId, snapshot.checkpointId, snapshot.checkpointIndex, snapshot.omegaAct], ['omega_core', 'omega_archive', 2, 2])
  assert.deepEqual(snapshot.rematchCleared, ['pyro_maw', 'tide_reaver'], 'three cleared, two saved: the third waits for the next checkpoint')
  const validated = validateActiveRun(Save.load(), snapshot)
  assert.equal(validated.valid, true)
  assert.equal(validated.run?.omegaAct, 2)
  const warden = archive.omegaRunSnapshot({ ...RUN, stageId: 'pyro_maw', bossId: 'pyro_maw' }, state)
  assert.equal(warden.omegaAct, undefined, 'other stages pass through')
})

test('archive: the session at scene start (re-entry, resumed save, a continue at the archive, act 1)', () => {
  const saved = { stageId: 'omega_fortress', rematchCleared: ['mire_wraith', 'pyro_maw'] as any[] }
  assert.deepEqual(archive.initialOmegaRunState(null, saved, 'omega_archive').cleared, ['pyro_maw', 'mire_wraith'])
  assert.deepEqual(archive.initialOmegaRunState(null, saved, 'omega_spire_mid').cleared, [], 'act 1 starts the archive over')
  assert.deepEqual(archive.initialOmegaRunState(null, { stageId: 'pyro_maw', rematchCleared: ['pyro_maw'] as any[] }, 'omega_archive').cleared, [])
  const entry = { mode: 'return' as const, door: 0, run: { ...RUN, rematchCleared: ['pyro_maw', 'volt_hopper', 'tide_reaver'] } as any, saved: ['pyro_maw', 'tide_reaver'] as any[] }
  const state = archive.initialOmegaRunState(entry, null, 'omega_archive')
  assert.deepEqual(state.cleared, ['pyro_maw', 'tide_reaver', 'volt_hopper'])
  assert.deepEqual(state.saved, ['pyro_maw', 'tide_reaver'])
})

test('rematch: each warden at phase-two cadence from the first frame, maxHp x0.7, later phases as authored', () => {
  assert.equal(rematch.OMEGA_REMATCH_HP_SCALE, 0.7)
  for (const bossId of archive.OMEGA_REMATCH_BOSS_IDS) {
    const base = getBossDefinitionById(bossId)!
    const copy = rematch.resolveBossDefinition(rematch.rematchConfigId(bossId))!
    assert.equal(copy.boss_id, bossId, 'the full profile: same id, attacks and room behaviour')
    assert.equal(copy.maxHP, Math.round(base.maxHP * 0.7))
    assert.deepEqual(copy.attacks, base.attacks)
    assert.equal(copy.phases.length, base.phases.length, 'phase indices keep their places')
    const [opening, second] = copy.phases
    const phaseTwo = base.phases[1]
    assert.equal(opening.threshold, base.phases[0].threshold)
    for (const key of ['attackWeightOverrides', 'attackEnabled', 'attackTiming', 'patternDeck', 'speedMultiplier', 'thinkTimeMultiplier'] as const) {
      assert.deepEqual(opening[key], phaseTwo[key], `${bossId}: the opening phase has phase two's ${key}`)
    }
    for (const attackId of [...(base.phases[0].unlockAttacks ?? []), ...(phaseTwo.unlockAttacks ?? [])]) assert.ok(opening.unlockAttacks?.includes(attackId))
    assert.deepEqual(second, phaseTwo)
    assert.deepEqual(copy.phases.slice(2), base.phases.slice(2))
  }
  assert.equal(rematch.resolveBossDefinition('omega_core'), getBossDefinitionById('omega_core'), 'the Core is unchanged')
  assert.equal(rematch.rematchBossOf('omega_rematch:omega_core'), null)
  assert.equal(rematch.resolveBossDefinition('omega_rematch:not_a_boss'), undefined)
})

test('rematch: 90 s a rematch and 12 minutes for the archive on the reference Normal player', () => {
  for (const bossId of archive.OMEGA_REMATCH_BOSS_IDS) {
    const seconds = rematch.estimateRematchSeconds(bossId)
    assert.ok(seconds > 0 && seconds <= NORMAL_CLEAR_TARGET_SECONDS.max, `${bossId}: ${seconds.toFixed(1)} s`)
  }
  assert.ok(rematch.estimateArchiveSeconds() <= 12 * 60, `${rematch.estimateArchiveSeconds().toFixed(0)} s`)
})

test('finale: the Core has three phase transitions and a finale_phase line for each', () => {
  assert.equal(resolvePhaseKits(BOSS_ROSTER.omega_core).length, 4)
  for (const phase of [1, 2, 3] as const) assert.ok(DIALOGUE_REGISTRY.getFinalePhase(phase)?.lines.length)
  assert.deepEqual(DIALOGUE_REGISTRY.getFinalePhase(3)?.lines.map((line) => line.speakerId), ['omega_core', 'hero'])
})
