// npm run agents:facts: the numbers docs used to hard-code (and let go stale), read live from the repo.
// Prints Markdown. Nothing here runs the test suites; counts are static (declared tests, registered scenarios).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { handoffStatus, parseLedger } from './checks.mjs'

const root = path.resolve('.')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const count = (text, pattern) => (text.match(pattern) ?? []).length

const testFiles = fs.readdirSync(path.join(root, 'tests')).filter((file) => file.endsWith('.test.ts'))
const declaredTests = testFiles.reduce((sum, file) => sum + count(read(`tests/${file}`), /^\s*test\(/gm), 0)
const bossSpecs = fs.readdirSync(path.join(root, 'src/boss/__tests__')).filter((file) => file.endsWith('.spec.ts')).length
const smokeScenarios = count(read('scripts/smoke-test.mjs'), /executeSmokeScenario\(summary,\s*'/g)
const sweepMissions = count(read('scripts/mission-visual-sweep.mjs'), /\{ stageId: '/g)
const gameTs = read('src/scenes/Game.ts').split('\n').length - 1
const noCheck = (() => {
  try {
    return git('grep', '--untracked', '-lE', '^[[:space:]]*//[[:space:]]*@ts-nocheck', '--', 'src').split('\n').filter(Boolean)
  } catch (error) {
    if (error.status === 1) return []
    throw error
  }
})()
const ledgerFiles = ['docs/prompts/EVAL_LEDGER.md', ...fs.readdirSync(path.join(root, 'docs/prompts/archive')).filter((file) => file.startsWith('EVAL_LEDGER')).map((file) => `docs/prompts/archive/${file}`)]
const rows = ledgerFiles.flatMap((file) => parseLedger(read(file)))
const byPrompt = {}
rows.forEach((row) => {
  const key = row.id.replace(/^EVAL-/, '').replace(/-[^-]+$/, '')
  const status = row.status.split(/[\s(;]/)[0] || 'BLANK'
  byPrompt[key] ??= {}
  byPrompt[key][status] = (byPrompt[key][status] ?? 0) + 1
})
const handoffs = fs
  .readdirSync(path.join(root, 'docs/prompts/handoff'))
  .filter((file) => /^\d/.test(file))
  .map((file) => `${file.replace(/\.md$/, '')}: ${handoffStatus(read(`docs/prompts/handoff/${file}`))}`)
const decisions = read('docs/prompts/DECISIONS.md')
const openDecisions = count(decisions, /^\| D-\d{3} \|[^\n]*\| OPEN \|/gm)
const perfRuns = fs.existsSync(path.join(root, 'output/perf'))
  ? fs.readdirSync(path.join(root, 'output/perf')).filter((file) => /^footprint-.*\.json$/.test(file))
  : []
const latestPerf = perfRuns
  .map((file) => ({ file, time: fs.statSync(path.join(root, 'output/perf', file)).mtimeMs }))
  .sort((a, b) => b.time - a.time)[0]
let perfLine = 'no footprint run in output/perf'
if (latestPerf) {
  const report = JSON.parse(read(`output/perf/${latestPerf.file}`))
  const passed = (report.checks ?? []).filter((row) => row.pass).length
  perfLine = `${latestPerf.file}: ${passed}/${(report.checks ?? []).length} within budget, commit ${report.commit}${report.dirty ? ` + ${report.dirty} dirty paths` : ''}${report.dirty === undefined ? ' (dirty state not recorded)' : ''}, ${report.at}`
}

console.log(`# Live facts (${new Date().toISOString().slice(0, 16)}Z)

| Fact | Value |
| --- | --- |
| Branch @ HEAD | ${git('branch', '--show-current')} @ ${git('rev-parse', '--short', 'HEAD')} (${git('status', '--short').split('\n').filter(Boolean).length} uncommitted paths) |
| Declared tests | ${declaredTests} in ${testFiles.length} files under tests/, plus ${bossSpecs} boss spec files |
| Smoke scenarios registered | ${smokeScenarios} |
| Sweep missions | ${sweepMissions} |
| \`src/scenes/Game.ts\` | ${gameTs} lines |
| \`@ts-nocheck\` files | ${noCheck.join(', ') || 'none'} |
| Handoffs | ${handoffs.join('; ')} |
| Open decisions | ${openDecisions} (docs/prompts/DECISIONS.md) |
| progress.md | ${fs.statSync(path.join(root, 'progress.md')).size} bytes |
| Latest footprint run | ${perfLine} |

Ledger by prompt: ${Object.entries(byPrompt)
  .map(([key, statuses]) => `${key} ${Object.entries(statuses).map(([status, n]) => `${status} ${n}`).join('/')}`)
  .join('; ')}
`)
