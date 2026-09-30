import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getSelectableBossStages, TUTORIAL_STAGE_ID } from '../src/content/campaign'
import { STAGE_BACKGROUND_ASSETS } from '../src/content/stageBackgroundCatalog'
import { getHudLayout } from '../src/ui/hudLayout'
import { bossPortraitFrameForLabel, hudBossPortraitPlacement } from '../src/ui/hudBossPortrait'
import { cameraFlashAlpha, chargeRingStyle, deathBurstStyle, styleExplosion } from '../src/ui/effects/flashSafety'
import { firstVisitControlsLines, loadingBarFill, showsFirstVisitNote } from '../src/ui/loading/loadingScreenModel'
import { districtPreviewPlan, previewKeysToEvict, tileFlipScaleX, TILE_FLIP_MS } from '../src/ui/stageSelect/districtPreview'
import {
  endingCardPanel, endingClosePanel, EPILOGUE_PANEL_IDS, PROLOGUE_PANEL_IDS, prologuePanel, STORY_PANEL_IDS, storyPanelPath
} from '../src/ui/story/storyPanels'
import {
  ATTRACT_CYCLE_MS, ATTRACT_STAGE_IDS, attractFrame, attractKeysToEvict, districtLayerKeys, pressStartAlpha
} from '../src/ui/title/titleAttract'

/** Width, height, colour type and palette size from a PNG's IHDR and PLTE chunks. */
function pngInfo(path: string): { width: number; height: number; colourType: number; paletteSize: number | null } {
  const bytes = fs.readFileSync(path)
  let paletteSize: number | null = null
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset)
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'PLTE') paletteSize = length / 3
    offset += length + 12
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25], paletteSize }
}

test('attract cycle: the relay district, then three districts, 20 s in all, each fading over the last', () => {
  assert.equal(ATTRACT_CYCLE_MS, 20000)
  assert.equal(ATTRACT_STAGE_IDS.length, 4)
  assert.equal(ATTRACT_STAGE_IDS[0], TUTORIAL_STAGE_ID)
  assert.deepEqual(districtLayerKeys(TUTORIAL_STAGE_ID), ['bg_relay_far', 'bg_relay_mid'])
  assert.deepEqual(attractFrame(0), { beat: 0, stageId: TUTORIAL_STAGE_ID, previous: 0, fade: 1, resident: [TUTORIAL_STAGE_ID] })
  assert.deepEqual(attractFrame(2999).resident, [TUTORIAL_STAGE_ID], 'nothing loads ahead before the load-ahead window')
  assert.deepEqual(attractFrame(3000).resident, [TUTORIAL_STAGE_ID, 'pyro_maw'], 'Heat Works loads 2 s before its beat')
  const fading = attractFrame(5450)
  assert.equal(fading.stageId, 'pyro_maw')
  assert.equal(fading.previous, 0)
  assert.equal(fading.fade, 0.5)
  assert.equal(attractFrame(5900).fade, 1)
  const wrap = attractFrame(ATTRACT_CYCLE_MS + 450)
  assert.deepEqual([wrap.beat, wrap.previous, wrap.fade], [0, 3, 0.5], 'the cycle wraps: the Archives fade back to the relay district')
  assert.ok(wrap.resident.includes('glacier_ronin'))
})

test('attract cycle drops a district once its beat has faded out, and never the relay district', () => {
  const loaded = ['bg_relay_far', 'bg_relay_mid', 'bg_pyro_far', 'bg_pyro_mid', 'bg_tide_far', 'bg_tide_mid', 'atlas_player_main']
  assert.deepEqual(attractKeysToEvict(loaded, 11000), ['bg_pyro_far', 'bg_pyro_mid'])
  assert.deepEqual(attractKeysToEvict(loaded, 10400), [], 'Heat Works stays while it fades out under the Water District')
})

test('PRESS START blinks at 1 Hz; under Reduced Flashing it swells and never goes dark', () => {
  assert.equal(pressStartAlpha(100, false), 1)
  assert.equal(pressStartAlpha(700, false), 0)
  assert.equal(pressStartAlpha(1100, false), 1)
  for (let t = 0; t < 4000; t += 50) assert.ok(pressStartAlpha(t, true) >= 0.55 - 1e-9, `reduced at ${t} ms`)
})

test('loading screen: the first-visit note names each default key, and only a first visit shows it', () => {
  assert.deepEqual(firstVisitControlsLines(), ['ARROWS MOVE · SPACE JUMP · X SHOOT · C SABER', 'Z DASH · Q/E WEAPON · ESC PAUSE'])
  assert.equal(showsFirstVisitNote(null), true)
  assert.equal(showsFirstVisitNote({ campaignStarted: false }), true)
  assert.equal(showsFirstVisitNote({ campaignStarted: true }), false)
  assert.equal(loadingBarFill(0.5, 201), 101)
  assert.equal(loadingBarFill(Number.NaN, 200), 0)
  assert.equal(loadingBarFill(3, 200), 200)
})

test('the logo is a keyed RGBA image that fits the Title rail (x 58 to 390)', () => {
  const logo = pngInfo('assets/ui/logo/omega_relay_logo.png')
  assert.equal(logo.colourType, 6, 'RGBA: the magenta is keyed to transparency')
  assert.ok(logo.width <= 332, `logo ${logo.width}px must fit the 332px rail`)
  assert.ok(logo.height <= 72, 'the subtitle must fit under it')
})

test('story panels: eight 448x252 stills quantized to at most 48 colours', () => {
  assert.equal(STORY_PANEL_IDS.length, 8)
  assert.deepEqual([...PROLOGUE_PANEL_IDS, ...EPILOGUE_PANEL_IDS].sort(), [...STORY_PANEL_IDS].sort())
  for (const id of STORY_PANEL_IDS) {
    const info = pngInfo(storyPanelPath(id))
    assert.deepEqual([info.width, info.height, info.colourType], [448, 252, 3], `${id}: 448x252 indexed`)
    assert.ok(info.paletteSize !== null && info.paletteSize <= 48, `${id}: ${info.paletteSize} colours`)
  }
})

test('story panels: every prologue page and every epilogue page shows a panel its own scene loads', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((page) => prologuePanel(page)),
    ['prologue_city', 'prologue_city', 'prologue_override', 'prologue_hangar', 'prologue_vale', 'prologue_vale', 'prologue_override'])
  assert.equal(prologuePanel(1, 'director_iona'), 'prologue_vale', "Vale's lines show her operations room")
  assert.equal(prologuePanel(12), 'prologue_override', 'a longer prologue keeps its last panel')
  const cards = ['pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin', TUTORIAL_STAGE_ID]
  for (const stageId of cards) assert.ok(EPILOGUE_PANEL_IDS.includes(endingCardPanel(stageId)), stageId)
  assert.equal(endingCardPanel(TUTORIAL_STAGE_ID), 'epilogue_archive', 'the Drill Hangar secret is about the public record')
  assert.deepEqual([0, 1, 2].map((page) => endingClosePanel(page, 3)), ['epilogue_archive', 'epilogue_choice', 'epilogue_choice'])
  assert.deepEqual([0, 1, 2, 3].map((page) => endingClosePanel(page, 4)), ['epilogue_archive', 'epilogue_archive', 'epilogue_choice', 'epilogue_choice'])
})

test("district preview: every warden's stage composes from its own catalog layers", () => {
  const catalog = new Set(STAGE_BACKGROUND_ASSETS.map((asset) => asset.key))
  for (const stage of [...getSelectableBossStages(), { id: TUTORIAL_STAGE_ID }]) {
    const plan = districtPreviewPlan(stage.id)
    assert.ok(plan.layers.length > 0, `${stage.id}: has layers`)
    for (const layer of plan.layers) assert.ok(catalog.has(layer.key), `${stage.id}: ${layer.key} is a catalog layer`)
    assert.match(plan.baseColor, /^#[0-9a-f]{6}$/i)
  }
})

test('district preview drops what it loaded except the district on screen and the stage being launched', () => {
  const loaded = ['bg_pyro_far', 'bg_pyro_mid', 'bg_tide_far', 'bg_tide_mid']
  assert.deepEqual(previewKeysToEvict(loaded, ['tide_reaver', null]), ['bg_pyro_far', 'bg_pyro_mid'])
  assert.deepEqual(previewKeysToEvict(loaded, []), loaded)
  assert.deepEqual([0, TILE_FLIP_MS / 2, TILE_FLIP_MS].map(tileFlipScaleX), [1, 0, 1])
})

test('HUD: the boss portrait comes from the boss label and hangs beside the bar inside the HUD band', () => {
  assert.equal(bossPortraitFrameForLabel('PYRO MAW'), 'pyro_maw')
  assert.equal(bossPortraitFrameForLabel('Sentinel ROOK'), 'rook')
  assert.equal(bossPortraitFrameForLabel('OMEGA CORE'), 'omega_core')
  assert.equal(bossPortraitFrameForLabel('??'), null)
  assert.equal(bossPortraitFrameForLabel(''), null)
  const layout = getHudLayout(448)
  const badge = hudBossPortraitPlacement(layout)
  assert.equal(badge.size, 24, 'the 48px portrait at exactly half scale')
  assert.ok(badge.y + badge.size <= layout.height, 'inside the 58px HUD band')
  assert.ok(badge.y >= layout.bossBar.y + layout.bossBar.height, 'below the bar, never over it')
  assert.ok(badge.x >= layout.bossPanel.x && badge.x + badge.size <= layout.bossBar.x + layout.bossBar.width, 'under the boss panel')
  assert.ok(badge.x + badge.size < layout.livesLabel.x - 60, 'clear of the LIVES readout')
})

test('Reduced Flashing dims the charge ring, the boss death flash and bursts, and the enemy explosion', () => {
  assert.equal(cameraFlashAlpha(false), 1)
  assert.ok(cameraFlashAlpha(true) <= 0.25)
  assert.deepEqual(deathBurstStyle(false, 0), { color: 0xffffff, alpha: 1 })
  const reduced = deathBurstStyle(true, 0)
  assert.notEqual(reduced.color, 0xffffff)
  assert.ok(reduced.alpha < 1)
  assert.equal(chargeRingStyle(true).additive, false)
  assert.equal(chargeRingStyle(false).additive, true)
  const alphas: number[] = []
  const sprite = { setAlpha(value: number) { alphas.push(value); return sprite } }
  assert.equal(styleExplosion(sprite, false), sprite)
  assert.deepEqual(alphas, [], 'unchanged without Reduced Flashing')
  styleExplosion(sprite, true)
  assert.deepEqual(alphas, [0.55])
})
