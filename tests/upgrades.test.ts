import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveUpgradeModifiers } from '../src/progression/upgrades'
import { createFreshProgressionState } from '../src/progression/state'
import { PlayerCombat } from '../src/player/PlayerCombat'
import { PLAYER_GAMEPLAY_CONFIG } from '../src/player/config'
import { DEFAULT_PLAYER_FEATURE_FLAGS } from '../src/player/featureFlags'
import { resolvePlayerShot, energyAfterPlayerShot, canAffordPlayerShot } from '../src/projectiles/playerShot'
import type { PlayerIntent } from '../src/player/types'
const mods = (...upgradeUnlocks: string[]) => resolveUpgradeModifiers({ ...createFreshProgressionState('classic','classic'), upgradeUnlocks })
const intent = (partial: Partial<PlayerIntent> = {}): PlayerIntent => ({moveAxis:0,jumpPressed:false,jumpHeld:false,jumpReleased:false,dashPressed:false,dashHeld:false,dashReleased:false,shootPressed:false,shootHeld:false,shootReleased:false,slashPressed:false,slashReleased:false,crouchHeld:false,aim:{x:1,y:0},...partial})
function combat(upgrades: string[]) {
  const accepted: number[] = []
  const player = { scene:{time:{now:0}}, setFlipX:()=>{} } as any
  const c = new PlayerCombat(player,{...DEFAULT_PLAYER_FEATURE_FLAGS,enableChargeShot:true},PLAYER_GAMEPLAY_CONFIG.blaster,PLAYER_GAMEPLAY_CONFIG.sword,PLAYER_GAMEPLAY_CONFIG.damage,{onDamageAccepted:d=>accepted.push(d),onKnockback:()=>{}})
  c.setUpgradeModifiers(mods(...upgrades)); return {c,player,accepted}
}

test('Classic resolver has exact independent effects and no baseline air dash or tier four', () => {
  const base = mods(); assert.equal(base.allowAirDash,false); assert.equal(base.maxChargeLevel,3)
  const all = mods('armor_helmet','armor_body','armor_arms','armor_legs','chip_quick_charge','chip_speedster','chip_weapon_plus','chip_buster_plus','arc_slash')
  assert.equal(all.contactHitstun,false);assert.equal(all.damageTakenMultiplier,.75);assert.equal(all.maxChargeLevel,4)
  assert.equal(all.allowAirDash,true);assert.equal(all.chargeTimeMultiplier,.7);assert.equal(all.movementSpeedMultiplier,1.12)
  assert.equal(all.wallJumpSpeedMultiplier,1);assert.equal(all.specialEnergyDiscount,1);assert.equal(all.busterPelletDamage,2);assert.equal(all.arcSlash,true)
})

test('combat applies every quick-charge threshold and caps held/released levels without arms', () => {
  for (const arms of [false,true]) {
    for (let i=0;i<4;i++) {
      const {c,player}=combat(['chip_quick_charge',...(arms?['armor_arms']:[])])
      c.update(intent({shootPressed:true,shootHeld:true}),0,0,1,true,false)
      const t=PLAYER_GAMEPLAY_CONFIG.blaster.chargeThresholdsMs[i]*.7
      player.scene.time.now=t-1
      assert.equal(c.update(intent({shootHeld:true}),t-1,0,1,true,false).snapshot.chargeLevel,Math.min(i,arms?4:3))
      player.scene.time.now=t
      assert.equal(c.update(intent({shootHeld:true}),t,0,1,true,false).snapshot.chargeLevel,Math.min(i+1,arms?4:3))
      const release=c.update(intent({shootReleased:true}),t,0,1,true,false)
      assert.equal(release.events.find(e=>e.type==='projectile')?.request.chargeLevel,Math.min(i+1,arms?4:3))
    }
  }
})

test('combat armor accepts fractional contact damage without hurt state; fall remains fatal', () => {
  const {c,accepted}=combat(['armor_body','armor_helmet'])
  c.receiveDamage(1,true,1,'light',{sourceType:'enemy_contact'})
  assert.deepEqual(accepted,[.75])
  const state=c.update(intent(),16,0,1,true,false).snapshot
  assert.equal(state.hitstunRemainingMs,0);assert.equal(state.pendingDamageTier,undefined)
  c.receiveDamage(8,true,1,'heavy',{sourceType:'fall',bypassIFrames:true})
  assert.equal(accepted[1],8)
})

test('ArcSlash requires owned saber release, uses explicit identity and emits once', () => {
  for (const owned of [false,true]) {
    const {c}=combat(owned?['arc_slash']:[])
    assert.equal(c.update(intent({slashPressed:true}),0,0,1,true,false).events.filter(e=>e.type==='projectile').length,0)
    const events=c.update(intent({slashReleased:true}),16,16,1,true,false).events.filter(e=>e.type==='projectile')
    assert.equal(events.length,owned?1:0)
    if(owned) assert.equal(events[0].request.weaponId,'ArcSlash')
    assert.equal(c.update(intent(),32,16,1,true,false).events.filter(e=>e.type==='projectile').length,0)
  }
})

test('actual shot resolution discounts before affordability and upgrades only ordinary Buster', () => {
  const upgraded=mods('chip_buster_plus','chip_weapon_plus')
  const shot=(weaponId:string,level:0|1=0)=>resolvePlayerShot({weaponId,intent:{chargeLevel:level,facing:1},x:0,y:0,modifiers:upgraded})
  assert.equal(shot('Buster').spawnRequest.damage,2)
  assert.equal(shot('Buster',1).spawnRequest.damage,undefined)
  const special=shot('HydroLance'), base=resolvePlayerShot({weaponId:'HydroLance',intent:{chargeLevel:0,facing:1},x:0,y:0})
  assert.equal(special.energyCost,Math.max(1,base.energyCost-1))
  assert.equal(canAffordPlayerShot(special.energyCost,special.energyCost),true)
  assert.equal(energyAfterPlayerShot(special.energyCost,special.energyCost,false),special.energyCost)
  assert.equal(shot('Buster').energyCost,0)
  assert.equal(shot('ArcSlash').weapon.speed,260)
  assert.equal(shot('ArcSlash').weapon.projectile.lifetimeMs,600)
})

test('fire adapter accepts exact discounted energy, zero-cost arc and no spend on pool failure', async () => {
  const {firePlayerShot} = await import('../src/projectiles/firePlayerShot')
  const base = resolvePlayerShot({weaponId:'HydroLance',intent:{chargeLevel:0,facing:1},x:0,y:0})
  const availableEnergy = Math.max(1,base.energyCost-1)
  const options = { request:{type:'pellet' as const,chargeLevel:0 as const,facing:1 as const}, equippedWeaponId:'HydroLance',availableEnergy,x:0,y:0,activeBusterCount:0,modifiers:mods('chip_weapon_plus','arc_slash'),spawn:()=>({live:true}) }
  assert.equal(firePlayerShot(options)?.remainingEnergy,0)
  assert.equal(firePlayerShot({...options,spawn:()=>null}),null)
  const arc=firePlayerShot({...options,request:{...options.request,weaponId:'ArcSlash'}})
  assert.equal(arc?.shot.weapon.id,'ArcSlash');assert.equal(arc?.remainingEnergy,availableEnergy)
})

test('ArcSlash orphan, rejected dash press, active-slash re-press and pause cancellation cannot fire', () => {
  const {c,player}=combat(['arc_slash'])
  const step=(n:number,p:Partial<PlayerIntent>,dash=false)=> { player.scene.time.now=n;return c.update(intent(p),n,16,1,true,dash).events.filter(e=>e.type==='projectile') }
  assert.equal(step(0,{slashReleased:true}).length,0)
  step(16,{slashPressed:true},true);assert.equal(step(32,{slashReleased:true}).length,0)
  step(48,{slashPressed:true});assert.equal(step(64,{slashReleased:true}).length,1)
  step(80,{slashPressed:true});assert.equal(step(96,{slashReleased:true}).length,0)
  c.resetForRespawn();step(112,{slashPressed:true});c.cancelPendingCharge();assert.equal(step(128,{slashReleased:true}).length,0)
})

test('contact helmet leaves state machine unharmed while a projectile still causes hurt', async () => {
  const {PlayerStateMachine}=await import('../src/player/PlayerStateMachine')
  const {c}=combat(['armor_helmet'])
  const motor={grounded:true,velocityX:0,velocityY:0,facing:1,isGravityInverted:false} as any
  c.receiveDamage(1,true,1,'light',{sourceType:'boss_contact'})
  const protectedState=c.update(intent(),0,0,1,true,false).snapshot
  assert.equal(new PlayerStateMachine().resolve(intent(),motor,protectedState).action,'none')
  c.receiveDamage(1,true,1,'light',{sourceType:'enemy_projectile',bypassIFrames:true})
  assert.equal(new PlayerStateMachine().resolve(intent(),motor,c.update(intent(),0,0,1,true,false).snapshot).action,'hurt_light')
})

test('motor consumers gate one air dash and multiply run/dash without changing Classic wall jump', async () => {
  const {PlayerMotor}=await import('../src/player/PlayerMotor')
  const {resolvePlayerPhysicsLimits}=await import('../src/player/config')
  let grounded=false
  const body={velocity:{x:0,y:0},blocked:{down:false,left:false,right:false,up:false},touching:{left:false,right:false},onFloor:()=>grounded,setVelocityX(x:number){this.velocity.x=x},setVelocityY(y:number){this.velocity.y=y},setAccelerationX(){},setAcceleration(){},setVelocity(x:number,y:number){this.velocity={x,y}}}
  const motor=new PlayerMotor({body} as any,PLAYER_GAMEPLAY_CONFIG.movement,PLAYER_GAMEPLAY_CONFIG.dash)
  assert.equal(motor.update(intent({dashPressed:true}),16,mods().allowAirDash).dashing,false)
  const upgraded=mods('armor_legs','chip_speedster')
  motor.setMovementSpeedMultiplier(upgraded.movementSpeedMultiplier,upgraded.wallJumpSpeedMultiplier)
  assert.equal(motor.update(intent({dashPressed:true}),16,upgraded.allowAirDash).airDashing,true)
  assert.equal(body.velocity.x,PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed*1.12)
  motor.update(intent(),1000,true)
  assert.equal(motor.update(intent({dashPressed:true}),16,true).dashing,false)
  grounded=true;motor.update(intent(),1000,true)
  assert.equal(motor.update(intent({moveAxis:1}),1000,true).velocityX,PLAYER_GAMEPLAY_CONFIG.movement.runSpeed*1.12)
  grounded=false;body.blocked.left=true;body.velocity.y=10
  const wall=motor.update(intent({jumpPressed:true,dashHeld:true,moveAxis:-1}),16,true)
  assert.equal(wall.velocityX,PLAYER_GAMEPLAY_CONFIG.movement.wallJumpVelocityX*PLAYER_GAMEPLAY_CONFIG.movement.wallJumpBoostMultiplier)
  assert.ok(resolvePlayerPhysicsLimits(PLAYER_GAMEPLAY_CONFIG,1.12).maxVelocityX>=PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed*1.12)
})

test('same-frame saber tap consumes its accepted press and release exactly once', () => {
  const {c}=combat(['arc_slash'])
  const events=c.update(intent({slashPressed:true,slashReleased:true}),0,16,1,true,false).events.filter(e=>e.type==='projectile')
  assert.equal(events.length,1)
  assert.equal(c.update(intent({slashReleased:true}),16,16,1,true,false).events.filter(e=>e.type==='projectile').length,0)
})
