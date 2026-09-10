import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/** Exercise real Arcade postUpdate ordering with a controlled pending body delta. */
export async function assertBossBoundaryLifecycle(page, scenarioDir) {
  const evidence = await page.evaluate(() => {
    const scene=window.__phaserGame.scene.getScene('Game'), boss=scene.bossController, body=boss.body
    scene.scene.pause()
    const bounds=boss.getSafeMovementBounds(), cases=[]
    const flush=()=>{ scene.physics.world.stepsLastFrame=1;scene.physics.world.emit('worldstep');scene.events.emit('postupdate') }
    for(const direction of [-1,1]) {
      boss.x=direction===1?bounds.maxX-1:bounds.minX+1;boss.y=180
      body.updateFromGameObject();const offsetX=body.x-boss.x
      body.prevFrame.copy(body.position);body.position.x+=direction*320/60;body.position.y-=3
      body.setVelocity(direction*320,-180)
      scene.physics.world.emit('worldstep')
      boss.update(scene.time.now,1000/60)
      const verticalBefore={y:boss.y,vy:body.velocity.y}
      flush()
      const bounded={x:boss.x,y:boss.y,bodyX:body.x,vx:body.velocity.x,vy:body.velocity.y}
      body.prevFrame.copy(body.position);body.position.x-=direction*2;body.setVelocityX(-direction*120)
      flush()
      cases.push({direction,bounds,offsetX,verticalBefore,bounded,inward:{x:boss.x,bodyX:body.x,vx:body.velocity.x}})
    }
    const beforeDestroy=scene.events.listenerCount('postupdate')
    boss.destroy()
    return {cases,beforeDestroy,afterDestroy:scene.events.listenerCount('postupdate')}
  })
  fs.writeFileSync(path.join(scenarioDir,'boundary-lifecycle.json'),JSON.stringify(evidence,null,2))
  for(const c of evidence.cases) {
    assert.ok(c.bounded.x>=c.bounds.minX&&c.bounded.x<=c.bounds.maxX,'boss must remain inside safe bounds after Arcade postUpdate')
    assert.ok(Math.abs(c.bounded.bodyX-c.bounded.x-c.offsetX)<1e-8,'body and container must remain synchronized')
    assert.equal(c.bounded.vx,0)
    assert.equal(c.bounded.y,c.verticalBefore.y-3);assert.equal(c.bounded.vy,c.verticalBefore.vy)
    assert.equal(c.inward.x,c.bounded.x-c.direction*2);assert.equal(c.inward.vx,-c.direction*120)
  }
  assert.equal(evidence.afterDestroy,evidence.beforeDestroy-1,'destroy must remove the post-physics guard')
  return evidence
}
