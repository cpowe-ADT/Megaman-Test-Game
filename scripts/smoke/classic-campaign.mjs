import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

export async function runClassicCampaignScenario(name, { outputDir, titleUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir=path.join(outputDir,name);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true})
  const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']})
  const page=await browser.newPage({viewport:{width:448,height:252}});const errors=[];const evidence={}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const capture=async label=> {await page.locator('canvas').screenshot({path:path.join(dir,`shot-${label}.png`)});fs.writeFileSync(path.join(dir,`state-${label}.json`),JSON.stringify(await readState(page),null,2))}
  try {
    await page.goto(`${titleUrl}&seed=explicit-randomizer-seed`)
    await waitForState(page,s=>s.scene==='Title')
    await tapKey(page,'Escape');await tapKey(page,'Enter')
    const choice=await waitForState(page,s=>s.scene==='NewCampaign'||s.scene==='Game')
    evidence.freshTitleEscape={scene:choice.scene,stored:await page.evaluate(()=>localStorage.getItem('save.v1'))}
    await capture('fresh-title-escape')
    fs.writeFileSync(path.join(dir,'fresh-title-escape.json'),JSON.stringify(evidence.freshTitleEscape,null,2))
    assert.equal(choice.scene,'NewCampaign','fresh Title Escape must not bypass the difficulty chooser')
    assert.equal(evidence.freshTitleEscape.stored,null,'clearing no active run must not create a campaign')
    assert.equal(choice.newCampaign.mode,'classic');assert.equal(choice.newCampaign.seed,'classic');assert.equal(choice.newCampaign.difficulty,'normal');assert.equal(choice.newCampaign.randomizerAvailable,false)
    await capture('chooser-normal')
    await tapKey(page,'Escape');await waitForState(page,s=>s.scene==='Title')
    assert.equal(await page.evaluate(()=>localStorage.getItem('save.v1')),null)
    await page.keyboard.down('Shift');await tapKey(page,'n');await page.keyboard.up('Shift')
    await waitForState(page,s=>s.newCampaign?.randomizerAvailable===true)
    const focus = () => page.evaluate(() => {
      const scene=window.__phaserGame.scene.getScene('NewCampaign')
      return {row:scene.row,mode:scene.model.mode,lines:scene.lines.map(line=>({text:line.text,visible:line.visible}))}
    })
    await tapKey(page,'ArrowDown');assert.equal((await focus()).row,1)
    await tapKey(page,'ArrowDown');evidence.classicFocus=await focus()
    await capture('chooser-focus-classic')
    fs.writeFileSync(path.join(dir,'focus-evidence.json'),JSON.stringify(evidence.classicFocus,null,2))
    assert.equal(evidence.classicFocus.row,3,'eligible Classic navigation must skip the absent seed row')
    assert.equal(evidence.classicFocus.lines[2].visible,false,'Classic seed row must be hidden')
    await tapKey(page,'ArrowDown');assert.equal((await focus()).row,0)
    await tapKey(page,'ArrowUp');assert.equal((await focus()).row,3)
    await tapKey(page,'ArrowUp');assert.equal((await focus()).row,1)
    await tapKey(page,'ArrowRight')
    assert.equal((await readState(page)).newCampaign.seed,'explicit-randomizer-seed')
    await tapKey(page,'ArrowDown');evidence.randomizerFocus=await focus()
    await capture('chooser-focus-randomizer')
    assert.equal(evidence.randomizerFocus.row,2);assert.equal(evidence.randomizerFocus.lines[2].visible,true)
    assert.ok(evidence.randomizerFocus.lines[2].text.startsWith('SEED '))
    await tapKey(page,'ArrowDown');assert.equal((await focus()).row,3)
    await tapKey(page,'ArrowDown');assert.equal((await focus()).row,0)
    await tapKey(page,'ArrowUp');assert.equal((await focus()).row,3)
    await tapKey(page,'ArrowUp');assert.equal((await focus()).row,2)
    await tapKey(page,'ArrowUp');assert.equal((await focus()).row,1)
    await tapKey(page,'ArrowLeft');await tapKey(page,'ArrowDown')
    assert.equal((await focus()).row,3,'switching back to Classic must keep navigation on visible rows')
    await tapKey(page,'Escape');await waitForState(page,s=>s.scene==='Title')
    await tapKey(page,'Enter');await waitForState(page,s=>s.scene==='NewCampaign')
    await advanceFrames(page,3);await tapKey(page,'Enter')
    await waitForState(page,s=>s.scene==='Game'&&s.stageRuntime?.stageId==='tutorial_sentinel')
    await page.evaluate(()=>{window.stageDebug.crossBossGate();window.bossDebug.unlockIntro()})
    await advanceFrames(page,12)
    await page.evaluate(()=>{window.bossDebug.damage(999);window.stageDebug.skipDialogue()})
    await waitForState(page,s=>s.victory?.modalOpen===true)
    await tapKey(page,'Enter');await waitForState(page,s=>s.scene==='StageSelect')
    await page.waitForFunction(()=>!window.__phaserGame.scene.getScene('StageSelect').toastHandle?.scene,{},{timeout:6000})
    let state=await readState(page)
    assert.equal(state.stageSelect.progressionMode,'classic');assert.equal(state.stageSelect.rewardLabel,'Flame Serpent');assert.equal(state.stageSelect.weaknessLabel,'???')
    const pyro=state.stageSelect.tiles.find(t=>t.stageId==='pyro_maw');assert.equal(pyro.difficultyRating,1)
    for(const tile of state.stageSelect.tiles) {
      assert.ok(!tile.title.includes('…'))
      assert.ok(tile.nameBounds.x+tile.nameBounds.width<=tile.tileBounds.x+tile.tileBounds.width+1,`${tile.title} overflows right`)
      assert.ok(tile.nameBounds.y+tile.nameBounds.height<=tile.tileBounds.y+27,`${tile.title} overlaps pips`)
      assert.equal(tile.portraitBounds.width,32);assert.equal(tile.portraitBounds.height,32)
      assert.ok(tile.weaknessBounds.x+tile.weaknessBounds.width<=tile.tileBounds.x+tile.tileBounds.width+1,`${tile.title} weakness overflows`)
    }
    const panel=state.stageSelect.panels
    assert.ok(pyro.nameBounds.y>=panel.selectionOutline.y+1,'selection outline crosses title')
    assert.ok(pyro.weaknessBounds.y+pyro.weaknessBounds.height<=panel.selectionOutline.y+panel.selectionOutline.height-1,'selection outline crosses weakness')
    assert.ok(panel.description.y+panel.description.height<=panel.details.y)
    assert.ok(panel.details.y+panel.details.height<=panel.preview.y+panel.preview.height)
    assert.ok(panel.footerStatus.y>=panel.footerControls.y+panel.footerControls.height)
    assert.ok(panel.footerStatus.y+panel.footerStatus.height<=panel.footer.y+panel.footer.height)
    await capture('stage-select-hidden')
    assert.equal(await page.evaluate(()=>window.stageDebug.grantWeapon('HydroLance')),true)
    await waitForState(page,s=>s.stageSelect?.weaknessLabel==='Hydro Lance')
    await capture('stage-select-revealed')
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('save.v1')))
    assert.ok(stored.upgradeUnlocks.includes('arc_slash'));assert.ok(!stored.weaponsUnlocked.includes('ArcSlash'));assert.ok(stored.stats.clearTimeMsByStage.tutorial_sentinel>=0)
    // Replacing an existing campaign is transactional even after changing every choice.
    const before=await page.evaluate(()=>localStorage.getItem('save.v1'))
    await tapKey(page,'Escape')
    await page.waitForFunction(()=>window.__phaserGame.scene.isActive('SystemMenu'),{},{timeout:4000})
    const newGameSteps=await page.evaluate(()=>{const menu=window.__phaserGame.scene.getScene('SystemMenu');const target=menu.options.findIndex(o=>o.id==='new_game');return (target-menu.index+menu.options.length)%menu.options.length})
    for(let step=0;step<newGameSteps;step++)await tapKey(page,'ArrowDown')
    await page.keyboard.down('Shift');await tapKey(page,'Enter');await page.keyboard.up('Shift')
    await waitForState(page,s=>s.scene==='NewCampaign'&&s.newCampaign.randomizerAvailable===true);await tapKey(page,'ArrowRight');await tapKey(page,'Escape')
    assert.equal(await page.evaluate(()=>localStorage.getItem('save.v1')),before)
    await page.goto(`${titleUrl}&seed=${'W'.repeat(64)}`)
    await waitForState(page,s=>s.scene==='Title')
    await page.keyboard.down('Shift');await tapKey(page,'n');await page.keyboard.up('Shift')
    await waitForState(page,s=>s.newCampaign?.randomizerAvailable)
    await tapKey(page,'ArrowDown');await tapKey(page,'ArrowRight')
    assert.equal((await readState(page)).newCampaign.seed.length,64)
    const bounds=await page.evaluate(()=>window.__phaserGame.scene.getScene('NewCampaign').lines.map(line=>({x:line.getBounds().x,y:line.getBounds().y,width:line.width,height:line.height})))
    for(const b of bounds) assert.ok(b.x>=8&&b.x+b.width<=440&&b.y+b.height<210)
    await capture('chooser-long-seed')
    await tapKey(page,'Escape')
    assert.equal(await page.evaluate(()=>localStorage.getItem('save.v1')),before)
    evidence.stored=stored;evidence.final=await readState(page)
    assert.deepEqual(errors,[])
    fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(evidence,null,2))
    return evidence.final
  } catch(error) { await capture('failure');fs.writeFileSync(path.join(dir,'errors.json'),JSON.stringify(errors,null,2));throw error }
  finally {await browser.close()}
}

export async function runClassicUpgradeScenario(name, { outputDir, titleUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir=path.join(outputDir,name);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true})
  const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']})
  const page=await browser.newPage({viewport:{width:448,height:252}});const errors=[];const evidence={}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await page.addInitScript(()=>localStorage.setItem('save.v1',JSON.stringify({weaponsUnlocked:[],clearedBosses:[],tutorialCleared:true,finalBossCleared:false,gameCompleted:false,progressionWorld:{progressionMode:'classic'}})))
  const capture=async label=> {await page.locator('canvas').screenshot({path:path.join(dir,`shot-${label}.png`)});fs.writeFileSync(path.join(dir,`state-${label}.json`),JSON.stringify(await readState(page),null,2))}
  try {
    await page.goto(`${titleUrl}&startScene=StageSelect`);await waitForState(page,s=>s.scene==='StageSelect');await tapKey(page,'Enter')
    await waitForState(page,s=>s.scene==='Game'&&s.newPlayer?.locomotion?.grounded)
    evidence.armor=await page.evaluate(()=>{
      const scene=window.__phaserGame.scene.getScene('Game')
      window.stageDebug.grantUpgrade('armor_body');window.stageDebug.grantUpgrade('armor_helmet')
      const played=[];const original=scene.setPlayerAnimation.bind(scene);scene.setPlayerAnimation=key=>{played.push(key);original(key)}
      const result=scene.requestPlayerDamage({amount:1,sourceType:'enemy_contact',sourceId:'armor-smoke',bypassIFrames:true,knockback:{x:0,y:0}})
      const hp=scene.playerHp
      scene.setPlayerAnimation=original
      scene.onSystemMenuAction('save_game')
      return {result,hp,played,saved:JSON.parse(localStorage.getItem('save.v1'))}
    })
    assert.equal(evidence.armor.hp,7.25);assert.equal(evidence.armor.result.amount,.75);assert.ok(!evidence.armor.played.some(key=>key.includes('hurt')))
    assert.equal(evidence.armor.saved.activeRun.playerHp,7.25)
    await advanceFrames(page,25)
    await page.evaluate(()=>window.__phaserGame.scene.getScene('Game').onSystemMenuAction('load_game'))
    await waitForState(page,s=>s.scene==='Game'&&s.activeRun?.loadedFromSave===true)
    assert.equal((await readState(page)).playerState.hp,7.25)
    evidence.reloaded=await page.evaluate(()=>JSON.parse(localStorage.getItem('save.v1')))
    assert.ok(evidence.reloaded.stats.playTimeMs>evidence.armor.saved.stats.playTimeMs+100,'load discarded outgoing active time')
    assert.equal(evidence.reloaded.activeRun.stageElapsedMs,evidence.armor.saved.activeRun.stageElapsedMs)
    await capture('armor-reloaded')
    evidence.damage=await page.evaluate(()=>{
      const scene=window.__phaserGame.scene.getScene('Game')
      const values=[]
      for(let i=0;i<3;i++){scene.requestPlayerDamage({amount:1,sourceType:'enemy_contact',sourceId:'armor-smoke',bypassIFrames:true,knockback:{x:0,y:0}});values.push(scene.playerHp)}
      return values
    })
    assert.deepEqual(evidence.damage,[6.5,5.75,5])
    await page.evaluate(()=>{
      const scene=window.__phaserGame.scene.getScene('Game')
      scene.newPlayerRuntime.resetForRespawn(30000)
      scene.enemySpawner.getEntities().forEach(entity=>entity.destroy());scene.enemySpawner.enemies.clear();scene.enemySpawner.levelMarkers.clear();scene.enemySpawner.activeMarkerIds.clear();scene.enemySpawner.retiredMarkerIds.clear()
      window.stageDebug.setPlayerX(150);window.stageDebug.grantUpgrade('chip_buster_plus')
      for (const bullet of scene.bossBullets.getChildren()) if (bullet.active) scene.projectileSystem.recycle(bullet)
      const spawnOptions=scene.enemySpawner.options
      const previousOptions={enableAI:spawnOptions.enableAI,enableProjectiles:spawnOptions.enableProjectiles}
      let enemy
      try {
        spawnOptions.enableAI=false;spawnOptions.enableProjectiles=false
        enemy=window.spawnEnemyDebug('enemy_mine_bot',218,scene.player.y)
      } finally { Object.assign(spawnOptions,previousOptions) }
      window.__upgradeEnemy=enemy
    })
    await tapKey(page,'ArrowRight',3);await tapKey(page,'x',2)
    await page.waitForFunction(()=>window.__upgradeEnemy?.combat?.currentHp<5,null,{timeout:2500})
    evidence.pellet=await page.evaluate(()=>({id:window.__upgradeEnemy.id,hp:window.__upgradeEnemy.combat.currentHp,active:window.__upgradeEnemy.sprite.active}))
    assert.equal(evidence.pellet.hp,3);assert.equal(evidence.pellet.active,true)
    assert.equal((await readState(page)).combatDebug.player.lastProjectile.damage,2)
    await capture('buster-enemy')
    await page.evaluate(()=>{window.stageDebug.grantWeapon('HydroLance');window.stageDebug.grantUpgrade('chip_weapon_plus')})
    await tapKey(page,'e');await waitForState(page,s=>s.playerState?.weapon==='HydroLance')
    await page.evaluate(()=>window.stageDebug.setWeaponEnergy('HydroLance',1))
    await tapKey(page,'x',2)
    const shot=await waitForState(page,s=>s.combatDebug?.player?.lastProjectile?.weaponId==='HydroLance')
    assert.equal(shot.combatDebug.player.lastProjectile.energyCost,1);assert.equal(shot.combatDebug.player.lastProjectile.energyRemaining,0)
    evidence.discount=shot.combatDebug.player.lastProjectile
    // The boss adapter receives the same resolved pellet damage: neutral Buster is exactly two, once.
    await page.evaluate(()=>{window.stageDebug.crossBossGate();window.bossDebug.unlockIntro()});await advanceFrames(page,15)
    await page.evaluate(()=>window.bossDebug.unlockIntro());await advanceFrames(page,3)
    evidence.boss=await page.evaluate(()=>{
      const scene=window.__phaserGame.scene.getScene('Game');const before=scene.bossHp.current
      scene.applyDamageToBoss(2,{weaponId:'Buster',chargeLevel:0,kind:'bullet'})
      return {before,after:scene.bossHp.current}
    })
    assert.equal(evidence.boss.before-evidence.boss.after,2)
    // The boss intro was already seen this session; story replay must be on for it to play again after the restart.
    await page.evaluate(()=>{ localStorage.setItem('settings.v1',JSON.stringify({storyReplay:true}));window.stageDebug.grantUpgrade('arc_slash');window.__phaserGame.scene.getScene('Game').scene.restart({stageId:'pyro_maw',bossId:'pyro_maw'}) })
    await waitForState(page,s=>s.scene==='Game'&&!s.stageRuntime.bossEncounterActive&&s.newPlayer?.locomotion?.grounded)
    await page.evaluate(()=>window.__phaserGame.scene.getScene('Game').newPlayerRuntime.resetForRespawn(30000))
    if((await readState(page)).playerState.weapon!=='Buster') await tapKey(page,'q')
    await page.keyboard.down('x')
    await waitForState(page,s=>s.newPlayer?.combat?.charging===true)
    await page.evaluate(()=>window.stageDebug.crossBossGate())
    await waitForState(page,s=>s.dialogue?.active===true)
    const duringDialogue=await readState(page)
    assert.equal(duringDialogue.newPlayer.combat.charging,false,'blocking dialogue must cancel pending charge')
    await page.keyboard.up('x');await advanceFrames(page,2)
    await page.evaluate(()=>window.stageDebug.skipDialogue())
    await waitForState(page,s=>!s.dialogue?.active)
    const beforeDialogueRelease=(await readState(page)).combatDebug.player.shotsFiredTotal
    await advanceFrames(page,2)
    const afterDialogueRelease=(await readState(page)).combatDebug.player.shotsFiredTotal
    assert.equal(afterDialogueRelease,beforeDialogueRelease,'release swallowed under dialogue caused a deferred charge shot')
    evidence.dialogueChargeCancellation={beforeDialogueRelease,afterDialogueRelease}
    assert.deepEqual(errors,[])
    fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(evidence,null,2))
    return await readState(page)
  } catch(error) {await capture('failure');fs.writeFileSync(path.join(dir,'evidence-failure.json'),JSON.stringify({evidence,errors},null,2));throw error}
  finally {await browser.close()}
}
