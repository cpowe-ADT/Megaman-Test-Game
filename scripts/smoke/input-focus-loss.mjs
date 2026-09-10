import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

export async function runInputFocusLossScenario(name, { outputDir, titleUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir=path.join(outputDir,name);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true})
  const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']})
  const page=await browser.newPage({viewport:{width:448,height:252}});const errors=[];const evidence={}
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await page.addInitScript(()=>localStorage.setItem('save.v1',JSON.stringify({tutorialCleared:true,progressionWorld:{progressionMode:'classic'}})))
  const capture=async label=>{await page.locator('canvas').screenshot({path:path.join(dir,`shot-${label}.png`)});fs.writeFileSync(path.join(dir,`state-${label}.json`),JSON.stringify(await readState(page),null,2))}
  const blur=()=>page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'))})
  try {
    await page.goto(`${titleUrl}&startScene=StageSelect&touchControls=1`)
    await waitForState(page,s=>s.scene==='StageSelect');await tapKey(page,'Enter')
    await waitForState(page,s=>s.scene==='Game'&&s.newPlayer?.locomotion?.grounded)
    await page.evaluate(()=>window.__phaserGame.scene.getScene('Game').newPlayerRuntime.resetForRespawn(30000))
    await page.evaluate(()=>{
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyX',key:'x'}))
      window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'))
    })
    await advanceFrames(page,3);evidence.unsampled=await readState(page);await capture('unsampled-blur')
    assert.equal(evidence.unsampled.newPlayer.combat.charging,false,'focus loss must discard an unsampled charge press')
    assert.equal(evidence.unsampled.combatDebug.player.shotsFiredTotal,0)
    await page.keyboard.down('x');await waitForState(page,s=>s.newPlayer?.combat?.charging)
    evidence.activeBefore=await readState(page);await blur();await page.keyboard.up('x');await advanceFrames(page,2)
    evidence.activeAfter=await readState(page);await capture('active-blur')
    assert.equal(evidence.activeAfter.newPlayer.combat.charging,false)
    assert.equal(evidence.activeAfter.combatDebug.player.shotsFiredTotal,0)
    assert.equal(evidence.activeAfter.playerState.hp,evidence.activeBefore.playerState.hp)
    // Use real touch shape handlers, including a reused pointer id after focus loss.
    const touch=await page.evaluate(()=>{
      const scene=window.__phaserGame.scene.getScene('Game'),controls=scene.touchControls
      const node=controls.root.list.find(child=>child.getData('layout')?.key==='shoot')
      node.list[0].emit('pointerdown',{id:71,isDown:true})
      window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'))
      const reset={held:scene.virtualButtons.isHeld('shoot'),bindings:controls.pointerBindings.size,glow:node.list[1].visible}
      node.list[0].emit('pointerdown',{id:71,isDown:true})
      return {reset,freshHeld:scene.virtualButtons.isHeld('shoot')}
    })
    evidence.touch=touch;assert.deepEqual(touch.reset,{held:false,bindings:0,glow:false});assert.equal(touch.freshHeld,true)
    await waitForState(page,s=>s.newPlayer?.combat?.charging)
    await page.evaluate(()=>{
      const controls=window.__phaserGame.scene.getScene('Game').touchControls
      const node=controls.root.list.find(child=>child.getData('layout')?.key==='shoot')
      node.list[0].emit('pointerup',{id:71,isDown:false})
    })
    await waitForState(page,s=>s.combatDebug?.player?.shotsFiredTotal===1)
    await advanceFrames(page,10);await tapKey(page,'x',2)
    await waitForState(page,s=>s.combatDebug?.player?.shotsFiredTotal===2)
    await capture('fresh-input');evidence.final=await readState(page)
    assert.deepEqual(errors,[])
    fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(evidence,null,2));return evidence.final
  } catch(error) {await capture('failure');fs.writeFileSync(path.join(dir,'evidence-failure.json'),JSON.stringify({evidence,errors},null,2));throw error}
  finally {await browser.close()}
}
