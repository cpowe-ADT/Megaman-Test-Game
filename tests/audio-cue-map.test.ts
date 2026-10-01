// The audio cue map (prompt 04 EVAL-P4-001, prompt 08 8.1, part 12h): every stage and boss has its own music,
// every file the libraries name exists and is credited, and every SFX string the code plays resolves to a
// sound (or a deliberate silence), so the development-build throw in resolveSfxKey never fires in play.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BOSS_MUSIC, MUSIC_ASSETS, STAGE_MUSIC, getMusicAssetEntries, resolveMusicTrack } from '../src/audio/musicLibrary'
import { SFX_ALIASES, SFX_ASSETS, resolveSfxKey } from '../src/audio/sfxLibrary'
import { BOSS_ROSTER } from '../src/bosses/roster'
import { CAMPAIGN_STAGES } from '../src/content/campaign'

function filesUnder(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).split('\\').join('/')
    if (entry.isDirectory()) return filesUnder(path, pattern)
    return pattern.test(entry.name) ? [path] : []
  })
}

test('every stage has its own music track on disk, distinct from the shared stage loop', () => {
  const keys = new Set<string>()
  for (const stageId of Object.keys(CAMPAIGN_STAGES)) {
    const track = resolveMusicTrack('stage', { stageId })
    assert.notEqual(track.key, MUSIC_ASSETS.stage.key, `${stageId} falls back to the shared stage loop`)
    assert.ok(existsSync(track.path), `${stageId}: ${track.path} is missing`)
    keys.add(track.key)
  }
  assert.equal(keys.size, Object.keys(CAMPAIGN_STAGES).length, 'two stages share a track')
  assert.equal(Object.keys(STAGE_MUSIC).length, Object.keys(CAMPAIGN_STAGES).length)
})

test('every boss fight has its own loop and a phase-two track on disk', () => {
  const keys = new Set<string>()
  for (const bossId of Object.keys(BOSS_ROSTER)) {
    const track = resolveMusicTrack('boss', { bossId })
    assert.notEqual(track.key, MUSIC_ASSETS.boss.key, `${bossId} falls back to the shared boss loop`)
    assert.ok(track.phaseTwo, `${bossId} has no phase-two track`)
    for (const asset of [track, track.phaseTwo!]) {
      assert.ok(existsSync(asset.path), `${bossId}: ${asset.path} is missing`)
      keys.add(asset.key)
    }
  }
  assert.equal(keys.size, Object.keys(BOSS_ROSTER).length * 2, 'two boss tracks share a file')
  assert.equal(Object.keys(BOSS_MUSIC).length, Object.keys(BOSS_ROSTER).length)
})

test('a cue without a known stage or boss id plays its shared track', () => {
  assert.equal(resolveMusicTrack('stage'), MUSIC_ASSETS.stage)
  assert.equal(resolveMusicTrack('final'), MUSIC_ASSETS.final)
  assert.equal(resolveMusicTrack('boss', { bossId: 'not_a_boss' }), MUSIC_ASSETS.boss)
  assert.equal(resolveMusicTrack('title', { stageId: 'pyro_maw' }), MUSIC_ASSETS.title)
  // The final stage's own loop plays for the `final` cue once Game passes its id.
  assert.equal(resolveMusicTrack('final', { stageId: 'omega_fortress' }).key, STAGE_MUSIC.omega_fortress.key)
})

test('every music and SFX file the libraries name exists', () => {
  for (const entry of getMusicAssetEntries()) assert.ok(existsSync(entry.path), `music ${entry.key}: ${entry.path} is missing`)
  for (const entry of Object.values(SFX_ASSETS)) assert.ok(existsSync(entry.path), `sfx ${entry.key}: ${entry.path} is missing`)
})

test('every SFX string the code plays resolves to a sound or a deliberate silence', () => {
  const played = new Set<string>(['shot_charge_lv1', 'shot_charge_lv2', 'shot_charge_lv3', 'shot_charge_lv4', 'ui_move'])
  for (const file of filesUnder('src', /\.ts$/)) {
    const text = readFileSync(file, 'utf8')
    for (const call of text.matchAll(/playSfx\(([^)]*)\)/g)) for (const quoted of call[1].matchAll(/'([a-z0-9_]+)'/g)) played.add(quoted[1])
    for (const event of text.matchAll(/type: 'sfx', key: ([^}]*)\}/g)) for (const quoted of event[1].matchAll(/'([a-z0-9_]+)'/g)) played.add(quoted[1])
    for (const outcome of text.matchAll(/\bsfx: '([a-z0-9_]+)'/g)) played.add(outcome[1])
    for (const hit of text.matchAll(/playMechanicHit\([^)]*'([a-z0-9_]+)'\)/g)) played.add(hit[1])
  }
  assert.ok(played.size >= 25, `the source scan found only ${played.size} keys`)
  for (const key of played) assert.doesNotThrow(() => resolveSfxKey(key, true), `'${key}' is played but has no sound`)
  // Boss attack telegraphs reach playSfx as attack display names (BossProjectileController.onBossAttack).
  for (const [bossId, blueprint] of Object.entries(BOSS_ROSTER)) {
    // The desperation attack sits outside `attacks` and reaches playSfx the same way.
    for (const attack of [...blueprint.attacks, ...(blueprint.desperation ? [blueprint.desperation.attack] : [])]) {
      assert.ok(Object.prototype.hasOwnProperty.call(SFX_ALIASES, attack.name), `${bossId} attack '${attack.name}' is missing from SFX_ALIASES`)
    }
  }
})

test('the credits name every audio file on disk, and every credited audio path exists', () => {
  const credits = readFileSync('assets/audio/credits/README.md', 'utf8')
  const credited = new Set([...credits.matchAll(/`(assets\/audio\/[^`]+\.(?:ogg|wav))`/gi)].map((match) => match[1]))
  for (const path of filesUnder('assets/audio', /\.(ogg|wav)$/i)) assert.ok(credited.has(path), `${path} is not in assets/audio/credits/README.md`)
  for (const path of credited) assert.ok(existsSync(path), `${path} is credited but missing`)
})
