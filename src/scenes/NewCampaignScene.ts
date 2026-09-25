import { IDENTITY } from '../content/identity'
import Phaser from 'phaser'
import InputActions from '../input/InputActions'
import { Profiles, Save } from '../systems/Save'
import { AUTOMATION } from '../config/automation'
import AudioService from '../audio'
import { getCampaignStage, TUTORIAL_STAGE_ID } from '../content/campaign'
import { NewCampaignModel } from './menu/newCampaignModel'
import { shouldPlayStory } from '../narrative/storyFlags'
import { currentStoryPolicy } from './game/StoryDirector'
import { addMenuBackdrop, addMenuPanel, MENU_FONT_CODE } from '../ui/menu/menuTheme'

type Entry = { source: string; randomizerAvailable: boolean; onCancel?: () => void }
/** The slot picker, name entry and first-run controls page show in play; automation opts in with `?profiles=on`. */
export function profileScreensEnabled(): boolean {
  if (!AUTOMATION.enabled) return true
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('profiles') === 'on'
}
/** The first-run controls page shows once per profile (`controlsSeen`) before the tutorial briefing. */
export function startWithFirstRunControls(scene: Phaser.Scene, key: string, data: object): void {
  const pilot = Profiles.active()
  if (profileScreensEnabled() && pilot && !pilot.controlsSeen) scene.scene.start('Controls', { firstRun: true, next: { key, data } })
  else scene.scene.start(key, data)
}
export function openNewCampaign(source: Phaser.Scene, onCancel?: () => void): void {
  const randomizerAvailable = Save.load().gameCompleted || InputActions.forScene(source).isHeld('modifier')
  source.scene.launch('NewCampaign', { source: source.scene.key, randomizerAvailable, onCancel })
  source.scene.pause()
}
export class NewCampaignScene extends Phaser.Scene {
  model!: NewCampaignModel
  confirmArmed = false
  private entry!: Entry
  private row = 0
  private committed = false
  private lines: Phaser.GameObjects.Text[] = []
  constructor() { super('NewCampaign') }
  create(entry: Entry): void {
    this.entry = entry; this.row = 0; this.committed = false; this.confirmArmed = false
    const urlSeed = new URLSearchParams(window.location.search).get('seed')
    this.model = new NewCampaignModel(entry.randomizerAvailable, urlSeed)
    addMenuBackdrop(this); addMenuPanel(this,224,126,432,236)
    this.add.text(224,22,'NEW CAMPAIGN',{fontFamily:MENU_FONT_CODE,fontSize:'18px',color:'#f5f8ff'}).setOrigin(.5)
    const pending = Profiles.pending()
    const replaces = pending ? !Profiles.cards()[pending.slot - 1]?.empty : Save.exists()
    const note = replaces ? 'Starting replaces the current campaign and saved mission.' : `Choose difficulty. The eight ${IDENTITY.WARDEN_TERM_PLURAL.toLowerCase()} await.`
    this.add.text(224,50, pending ? `PILOT ${pending.pilotName}  ·  SLOT ${pending.slot}.  ${note}` : note, {fontFamily:MENU_FONT_CODE,fontSize:'8px',color:'#a9c9f2'}).setOrigin(.5)
    this.lines = [80,108,136,173].map((y,index) => this.add.text(224,y,'',{fontFamily:MENU_FONT_CODE,fontSize:'11px',color:'#ffffff',align:'center',wordWrap:{width:400,useAdvancedWrap:true}}).setOrigin(.5).setInteractive({useHandCursor:true}).on('pointerdown',()=> { this.row=index; if(index===3) this.start(); else this.change(1); this.render() }))
    this.add.text(224,220,'ARROWS CHOOSE   ENTER START   ESC CANCEL',{fontFamily:MENU_FONT_CODE,fontSize:'8px',color:'#a9c9f2'}).setOrigin(.5)
    const actions=InputActions.forScene(this)
    actions.onPressed('moveLeft',()=>this.change(-1));actions.onPressed('moveRight',()=>this.change(1))
    actions.onPressed('aimUp',()=>this.move(-1));actions.onPressed('aimDown',()=>this.move(1))
    actions.onPressed('confirm',()=> { if(this.confirmArmed) this.start() })
    actions.onPressed('cancel',()=>this.cancel())
    this.render()
  }
  update(): void { if(InputActions.forScene(this).confirmReleased()) this.confirmArmed=true }
  private activeRows(): number[] { return this.model.randomizerAvailable ? (this.model.mode === 'classic' ? [0,1,3] : [0,1,2,3]) : [0,3] }
  private move(delta: number): void { const rows=this.activeRows();this.row=rows[(rows.indexOf(this.row)+delta+rows.length)%rows.length];this.render() }
  private change(delta: number): void { if(this.row===0)this.model.cycleDifficulty(delta);else if(this.row===1)this.model.toggleMode();else if(this.row===2)this.model.reroll();this.render() }
  private render(): void {
    const active=this.activeRows();if(!active.includes(this.row))this.row=3
    const rows=[`DIFFICULTY   < ${this.model.difficulty.toUpperCase()} >`, `MODE   < ${this.model.mode === 'classic'?'CLASSIC':'RELAY RANDOMIZER'} >`,this.model.mode==='relay_randomizer'?`SEED ${this.model.seed}   REROLL`:'','START CAMPAIGN']
    this.lines.forEach((line,index)=>line.setFontSize(index===2?8:11).setText(rows[index]).setVisible(active.includes(index)).setColor(index===this.row?'#5de1ff':'#a9c9f2'))
  }
  private start(): void {
    if(this.committed)return
    this.committed=true;Profiles.commitNewCampaign();Save.startNewCampaign(this.model.selection());AudioService.playSfx('ui_confirm')
    this.scene.stop(this.entry.source)
    const stage=getCampaignStage(TUTORIAL_STAGE_ID)
    const next={stageId:stage.id,bossId:stage.bossId,runtimeBossConfigId:stage.runtimeBossConfigId}
    if(shouldPlayStory(Save.load().storyFlags,'prologue',currentStoryPolicy()))startWithFirstRunControls(this,'Prologue',{next});else startWithFirstRunControls(this,'Game',next)
  }
  private cancel(): void { if(this.committed)return;this.scene.resume(this.entry.source);this.entry.onCancel?.();this.scene.stop() }
}
