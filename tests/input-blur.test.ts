import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { EventEmitter } from 'node:events'
import ts from 'typescript'

function fixture() {
  const callbacks = new Map<string, Set<(event?: any) => void>>()
  let prevented = 0
  const fakeWindow = {
    addEventListener: (event: string, fn: (event?: any) => void) => { const list=callbacks.get(event)??new Set();list.add(fn);callbacks.set(event,list) },
    removeEventListener: (event: string, fn: (event?: any) => void) => callbacks.get(event)?.delete(fn)
  }
  const load = (file: string, dependencies: Record<string, unknown> = {}) => {
    const exports: Record<string, any> = {}
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
    vm.runInNewContext(code,{exports,window:fakeWindow,require:(id:string)=>{if(!(id in dependencies))throw new Error(`Unexpected import: ${id}`);return dependencies[id]}})
    return exports
  }
  const action=load('src/input/ActionState.ts')
  const settings=load('src/systems/Settings.ts',{'../input/ActionState':action})
  const input=load('src/input/InputActions.ts',{'../audio':{default:{unlock:()=>{}}},'../systems/Settings':settings,'./ActionState':action})
  const config=load('src/player/config.ts')
  const combatModule=load('src/player/PlayerCombat.ts',{'../progression/upgrades':load('src/progression/upgrades.ts'),'./config':config})
  const controllerModule=load('src/player/PlayerController.ts')
  const scene:any={events:new EventEmitter(),time:{now:0}}
  const scenes=[scene]
  const game={events:new EventEmitter(),loop:{frame:0},scene:{getScenes:(active:boolean)=>active?scenes.filter(s=>!s.paused):scenes}}
  scene.game=game
  const actions=input.InputActions.forScene(scene)
  const controller=new controllerModule.PlayerController(scene,actions)
  const combat=new combatModule.PlayerCombat({scene,setFlipX:()=>{}},{enableSword:true,enableChargeShot:true},config.PLAYER_GAMEPLAY_CONFIG.blaster,config.PLAYER_GAMEPLAY_CONFIG.sword,config.PLAYER_GAMEPLAY_CONFIG.damage,{onDamageAccepted:()=>{},onKnockback:()=>{}})
  actions.onCancelled?.(()=>combat.cancelPendingCharge())
  const emit=(event:string,code='',repeat=false)=>callbacks.get(event)?.forEach(fn=>fn({code,repeat,preventDefault:()=>{prevented++}}))
  const step=()=>{game.loop.frame++;scene.time.now+=16;return combat.update(controller.sampleIntent(1),scene.time.now,16,1,true,false)}
  const pad=new (load('src/input/DigitalButtonPad.ts').DigitalButtonPad)();actions.setTouchSource(pad)
  return {actions,combat,scene,scenes,game,input,callbacks,emit,step,pad,prevented:()=>prevented}
}

test('blur drops an unsampled shoot press and cached menu confirmation without firing',()=>{
  const f=fixture();f.emit('keydown','KeyX');f.emit('keydown','Enter')
  f.emit('blur');const result=f.step()
  assert.equal(result.snapshot.charging,false)
  assert.equal(result.events.filter((e:any)=>e.type==='projectile').length,0)
  assert.equal(f.actions.snapshot().confirm.pressed,false)
  f.emit('keydown','KeyX',true);assert.equal(f.step().snapshot.charging,false)
  // Prompt 05 §5.2 item 3: the pellet fires on press and charging starts the same frame;
  // a release below level 1 fires nothing more.
  f.emit('keyup','KeyX');f.emit('keydown','KeyX');const pressed=f.step()
  assert.equal(pressed.snapshot.charging,true);assert.equal(pressed.events.filter((e:any)=>e.type==='projectile').length,1)
  f.emit('keyup','KeyX');assert.equal(f.step().events.filter((e:any)=>e.type==='projectile').length,0)
})

test('blur cancels an active charge without synthetic release or changing invulnerability',()=>{
  const f=fixture();f.combat.grantInvulnerability(500);f.emit('keydown','KeyX');assert.equal(f.step().snapshot.charging,true)
  const before=f.combat.createSnapshot();f.emit('blur');const after=f.combat.createSnapshot()
  assert.equal(after.charging,false);assert.equal(after.iFramesRemainingMs,before.iFramesRemainingMs)
  assert.equal(f.step().events.filter((e:any)=>e.type==='projectile').length,0)
})

test('ordinary source handoff remains continuous; focus loss resets touch and pulses for all live adapters',()=>{
  const f=fixture();f.emit('keydown','KeyX');assert.equal(f.step().events.filter((e:any)=>e.type==='projectile').length,1)
  f.pad.setHeld('shoot',true);f.emit('keyup','KeyX')
  assert.equal(f.actions.snapshot().shoot.released,false);assert.equal(f.step().snapshot.charging,true)
  f.actions.pulse('confirm');f.scene.paused=true
  const overlay:any={events:new EventEmitter(),game:f.game};f.scenes.push(overlay);f.input.InputActions.forScene(overlay)
  f.emit('blur');assert.equal(f.pad.isHeld('shoot'),false);assert.equal(f.combat.createSnapshot().charging,false)
  f.scene.paused=false;f.scenes.pop();assert.equal(f.step().events.filter((e:any)=>e.type==='projectile').length,0)
  assert.equal(f.actions.snapshot().confirm.pressed,false)
  f.pad.setHeld('shoot',true);assert.equal(f.step().snapshot.charging,true)
  // Released after one frame of charge: below level 1, so nothing fires on release.
  f.pad.setHeld('shoot',false);assert.equal(f.step().events.filter((e:any)=>e.type==='projectile').length,0)
  let cancelled=0;f.actions.onCancelled?.(()=>cancelled++);f.scene.events.emit('shutdown');f.emit('blur');assert.equal(cancelled,0)
  f.game.events.emit('destroy');assert.equal(f.callbacks.get('blur')?.size,0)
})


test('blur invalidates the same-frame cached menu snapshot',()=>{
  const f=fixture();f.emit('keydown','Enter');assert.equal(f.actions.snapshot().confirm.pressed,true)
  f.emit('blur');assert.equal(f.actions.snapshot().confirm.pressed,false);assert.equal(f.actions.snapshot().confirm.held,false)
})


test('repeat movement keys keep browser scrolling blocked without another action edge',()=>{
  const f=fixture();f.emit('keydown','ArrowRight');f.step();assert.equal(f.prevented(),1)
  f.emit('keydown','ArrowRight',true);f.step()
  assert.equal(f.prevented(),2);assert.equal(f.actions.snapshot().moveRight.pressed,false)
})
