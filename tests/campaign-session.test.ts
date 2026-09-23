import test from 'node:test'
import assert from 'node:assert/strict'
import { CampaignSessionStatistics, freshStatistics } from '../src/progression/statistics'
import { NewCampaignModel } from '../src/scenes/menu/newCampaignModel'
import { Save } from '../src/systems/Save'

test('session clock survives flush/reload boundaries and deduplicates defeats and secret claims', () => {
  Save.startNewCampaign()
  const session=new CampaignSessionStatistics()
  session.tick(100,true); session.tick(1000,false)
  Save.save(session.flush(Save.load()))
  Save.unlockCheckpoint('pyro_maw','pyro_mid')
  session.tick(200,true);session.defeat();session.defeat()
  Save.save(session.claim(Save.load(),'pyro_maw:heart_tank',false))
  Save.save(session.claim(Save.load(),'pyro_maw:heart_tank',true))
  assert.equal(Save.load().stats.playTimeMs,300);assert.equal(Save.load().stats.deaths,1)
  assert.equal(Save.load().stats.secretsFoundByStage.pyro_maw,1)
  session.respawn();session.defeat();session.tick(50,true)
  Save.save(session.claim(Save.load(),'pyro_maw:boss_clear',false))
  assert.equal(Save.load().stats.deaths,2);assert.equal(Save.load().stats.clearTimeMsByStage.pyro_maw,350)
  const resumed=new CampaignSessionStatistics(350);resumed.tick(10,true)
  assert.equal(resumed.stageElapsedMs,360)
})

test('chooser is pure, Normal/Classic by default and URL seed only affects Randomizer', () => {
  Save.startNewCampaign();const before=JSON.stringify(Save.load())
  const locked=new NewCampaignModel(false,'url-seed',()=> 'generated')
  locked.toggleMode();assert.deepEqual(locked.selection(),{mode:'classic',difficulty:'normal',seed:'classic'})
  const open=new NewCampaignModel(true,'url-seed',()=> 'generated')
  open.cycleDifficulty(1);open.toggleMode();assert.equal(open.selection().seed,'url-seed')
  open.reroll();assert.equal(open.selection().seed,'generated')
  open.toggleMode();assert.equal(open.selection().seed,'classic')
  assert.equal(JSON.stringify(Save.load()),before)
})

test('same-mode transport resets target stats without carrying old mission timing', () => {
  Save.startNewCampaign();Save.save({...Save.load(),stats:{...freshStatistics(),playTimeMs:1234,deaths:7}})
  Save.importProgression(Save.exportProgression())
  assert.deepEqual(Save.load().stats,freshStatistics())
})
