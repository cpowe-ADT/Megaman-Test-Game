// Generates docs/story/script.md from src/content/dialogue/dialogue.v2.json so the document
// and the game share one source. Run with `npm run story:script`; tests assert the file is in sync.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DIALOGUE_PATH = path.join(root, 'src/content/dialogue/dialogue.v2.json')
export const SCRIPT_PATH = path.join(root, 'docs/story/script.md')

/** Campaign order for the document; must match CAMPAIGN_STAGES in src/content/campaign.ts. */
export const STAGE_ORDER = [
  'tutorial_sentinel', 'pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan',
  'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin', 'omega_fortress'
]
const STAGE_TITLES = {
  tutorial_sentinel: 'Tutorial: Drill Hangar (Sentinel Rook)',
  pyro_maw: 'Heat Works (Pyro Maw)', tide_reaver: 'Water District (Tide Reaver)',
  volt_hopper: 'Power District (Volt Hopper)', basalt_titan: 'Structural Works (Basalt Titan)',
  ferro_blade: 'Transit Security (Ferro Blade)', mire_wraith: 'Medicine District (Mire Wraith)',
  gale_vixen: 'Weather District (Gale Vixen)', glacier_ronin: 'Public Archives (Glacier Ronin)',
  omega_fortress: 'Central Core (OMEGA CORE)'
}
const STAGE_TRIGGER_ORDER = ['stage_briefing', 'tutorial_coach', 'radio', 'miniboss_callout', 'boss_intro', 'boss_defeat', 'district_restored']
const TRIGGER_LABELS = {
  stage_briefing: 'Briefing (before control)', tutorial_coach: 'Coach (ticker as each teach lock arms, non-blocking)', radio: 'Radio (mid-stage checkpoint, non-blocking)',
  miniboss_callout: 'Mini-boss callout (gate lock, ticker)', boss_intro: 'Boss intro (blocking)',
  boss_defeat: 'Boss defeat (blocking, before the weapon card)', district_restored: 'District restored (Stage Select tile)'
}

function speakerLabel(content, line) {
  if (!line.speakerId) return line.card ? `CARD ${line.card}` : 'NARRATION'
  const speaker = content.speakers.find((entry) => entry.id === line.speakerId)
  const name = speaker?.displayName ?? line.speakerId
  return name === '{hero}' ? 'WREN' : name
}

function renderLines(content, entry, out) {
  if (entry.staging) out.push(`_Staging: ${entry.staging}_`, '')
  for (const line of entry.lines) out.push(`- **${speakerLabel(content, line)}:** ${line.text}`)
  out.push('')
}

export function buildScript(content) {
  const out = []
  const total = content.sequences.reduce((n, s) => n + s.lines.length, 0) + content.milestones.reduce((n, m) => n + m.lines.length, 0)
  out.push('# OMEGA Relay: Script', '',
    'Generated from `src/content/dialogue/dialogue.v2.json` by `npm run story:script`. Do not edit by hand; edit the JSON and regenerate. Tokens in braces are resolved at runtime: `{hero}` is the callsign from `src/content/identity.ts`, `{rewardLabel}` the reward the location placed, `{clearedCount}` and `{remainingCount}` the warden tally, `{districtName}` and `{wardenName}` the current stage.', '',
    `Line count: ${total}. Every line is at most 180 characters. Warden stages are order-independent: no warden line names another warden.`, '')
  const byTrigger = (trigger, stageId) => content.sequences.find((s) => s.trigger === trigger && s.stageId === stageId)
  const global = (trigger) => content.sequences.find((s) => s.trigger === trigger && !s.stageId)

  out.push('## Prologue', '')
  renderLines(content, global('prologue'), out)

  for (const stageId of STAGE_ORDER) {
    out.push(`## ${STAGE_TITLES[stageId]}`, '')
    for (const trigger of STAGE_TRIGGER_ORDER) {
      const sequence = byTrigger(trigger, stageId)
      if (!sequence) continue
      out.push(`### ${TRIGGER_LABELS[trigger]}`, '')
      renderLines(content, sequence, out)
      if (stageId === 'omega_fortress' && trigger === 'boss_intro') {
        for (const phase of [1, 2, 3]) {
          const finale = content.sequences.find((s) => s.trigger === 'finale_phase' && s.phase === phase)
          out.push(`### Core phase ${phase} (ticker at the phase transition)`, '')
          renderLines(content, finale, out)
        }
      }
    }
    if (stageId === 'tutorial_sentinel') {
      out.push('## Milestones (any order; play on the Stage Select return)', '')
      const ordered = [...content.milestones].sort((a, b) => (a.clearedBossCount ?? 2) - (b.clearedBossCount ?? 2))
      for (const milestone of ordered) {
        const label = milestone.kind === 'first_weakness' ? 'First weakness hit' : `${milestone.clearedBossCount} warden${milestone.clearedBossCount === 1 ? '' : 's'} freed`
        out.push(`### ${label}`, '')
        renderLines(content, milestone, out)
      }
    }
  }

  out.push('## Epilogue', '')
  renderLines(content, global('epilogue'), out)
  out.push('## Credits (authored lines; asset credits follow from the generated file)', '')
  renderLines(content, global('credits'), out)
  return out.join('\n')
}

export function readContent() {
  return JSON.parse(fs.readFileSync(DIALOGUE_PATH, 'utf8'))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const markdown = buildScript(readContent())
  fs.mkdirSync(path.dirname(SCRIPT_PATH), { recursive: true })
  fs.writeFileSync(SCRIPT_PATH, markdown)
  console.log(`Wrote ${path.relative(root, SCRIPT_PATH)} (${markdown.split('\n').length} lines).`)
}
