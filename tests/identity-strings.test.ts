import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const forbidden = /\b(MEGA MAN|MEGA CORE|ROBOT MASTER|Robot Master|Mega Man|Capcom)\b/
function bannedText(source: string): string[] {
  const tree = ts.createSourceFile('scan.ts', source, ts.ScriptTarget.Latest, true)
  const matches = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) || [ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail].includes(node.kind)) {
      if (forbidden.test(node.getText(tree))) matches.add(node.getText(tree))
    }
    for (const comment of [...(ts.getLeadingCommentRanges(source, node.pos) ?? []), ...(ts.getTrailingCommentRanges(source, node.end) ?? [])]) {
      const text=source.slice(comment.pos,comment.end);if(forbidden.test(text))matches.add(text)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return [...matches]
}
function loadIdentity(publicFlag?: string) {
  const source=fs.readFileSync('src/content/identity.ts','utf8').replaceAll('import.meta.env','__testEnv')
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const exports: Record<string, any>={}
  vm.runInNewContext(code,{exports,__testEnv:{VITE_PUBLIC_BUILD:publicFlag}})
  return exports.IDENTITY
}

test('identity scan detects literals, interpolated templates and comments without matching legal boundaries',()=>{
  for(const source of ['const x="MEGA MAN"','const x=`${n}MEGA CORE`','// Robot Master','/* Capcom */','const x="Mega Man"'])assert.ok(bannedText(source).length>0,source)
  assert.deepEqual(bannedText('const x="OMEGA CORE"; const ROBOT_MASTER_STAGE_IDS=[]; // robot_master_clear_count'),[])
})
test('runtime source strings and comments have one original identity',()=>{
  const files=(dir:string):string[]=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='__tests__'?[]:e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.ts')&&e.name!=='identity.ts'?[path.join(dir,e.name)]:[])
  const hits=files('src').flatMap(file=>bannedText(fs.readFileSync(file,'utf8')).map(text=>({file,text})))
  assert.deepEqual(hits,[])
})
for(const flag of [undefined,'0','1']){
  test(`identity is the same public identity in every build (public=${flag}); the developer skin is retired`,()=>{
    const identity=loadIdentity(flag)
    assert.equal('DEV_SKIN' in identity,false)
    assert.ok(Object.isFrozen(identity));assert.ok(Object.isFrozen(identity.WARDEN_NAMES))
  })
}
test('identity uses exact original public terms and preserves eight distinct warden names',()=>{
  const i=loadIdentity()
  assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(i).filter(([key])=>!['WARDEN_NAMES'].includes(key))))),{
    GAME_TITLE:'OMEGA RELAY',GAME_SUBTITLE:'EIGHT WARDENS. ONE MANUFACTURED CRISIS.',HERO_CALLSIGN:'WREN',HERO_UNIT:'RECOVERY UNIT 09',OPERATOR_NAME:'Director Iona Vale',ANTAGONIST_NAME:'OMEGA CORE',WARDEN_TERM:'WARDEN',WARDEN_TERM_PLURAL:'WARDENS'
  })
  assert.match(i.HERO_CALLSIGN,/^[A-Z]{4,6}$/)
  assert.deepEqual(JSON.parse(JSON.stringify(i.WARDEN_NAMES)),{pyro_maw:'Pyro Maw',tide_reaver:'Tide Reaver',volt_hopper:'Volt Hopper',basalt_titan:'Basalt Titan',ferro_blade:'Ferro Blade',mire_wraith:'Mire Wraith',gale_vixen:'Gale Vixen',glacier_ronin:'Glacier Ronin'})
  assert.equal(fs.readFileSync('README.md','utf8').split('\n')[0],`# ${i.GAME_TITLE}`)
  assert.ok(fs.readFileSync('index.html','utf8').includes(`<title>${i.GAME_TITLE}</title>`))
  assert.equal(JSON.parse(fs.readFileSync('package.json','utf8')).name,'omega-relay')
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));assert.equal(lock.name,'omega-relay');assert.equal(lock.packages[''].name,'omega-relay')
  assert.equal(new Set(Object.values(i.WARDEN_NAMES)).size,8);assert.ok(!Object.values(i.WARDEN_NAMES).includes(i.HERO_CALLSIGN))
})

test('bundled dialogue adapter overrides stale proper names while preserving generic hero tokens',async()=>{
  const content=JSON.parse(fs.readFileSync('src/content/dialogue/dialogue.v2.json','utf8'))
  const identity=loadIdentity(null)
  const names={...identity.WARDEN_NAMES,director_iona:identity.OPERATOR_NAME,omega_core:identity.ANTAGONIST_NAME}
  for(const speaker of content.speakers) if(speaker.id in names)speaker.displayName='Stale bundled name'
  const registry=await import('../src/content/dialogue/DialogueRegistry')
  const validation=await import('../src/content/dialogue/validateDialogueContent')
  const modules: Record<string,unknown>={'./dialogue.v2.json':{default:content},'./DialogueRegistry':registry,'./validateDialogueContent':validation,'../identity':{IDENTITY:identity}}
  const source=fs.readFileSync('src/content/dialogue/index.ts','utf8')
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const exports: Record<string,any>={}
  vm.runInNewContext(code,{exports,require:(id:string)=>modules[id]??{}})
  for(const [id,name] of Object.entries(names))assert.equal(exports.DIALOGUE_REGISTRY.getSpeaker(id).displayName,name)
  assert.equal(exports.DIALOGUE_REGISTRY.getSpeaker('hero').displayName,'{hero}')
  assert.equal(content.speakers.find((s:any)=>s.id==='director_iona').displayName,'Stale bundled name')
})
