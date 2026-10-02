// npm run agents:check                 structure checks for the agent system (fails on errors)
// npm run agents:check -- --entry 06   also: may prompt 06 start? (previous handoff COMPLETE, its evals PASS)
//
// What it checks: the ledger (status words, PASS rows cite a commit git knows), handoffs (charter section 6),
// the prompt chain, Game.ts and @ts-nocheck budgets, size budgets for the files every session reads,
// backticked paths in the core docs, and the decisions log. Rules live in scripts/agents/checks.mjs;
// budgets in tests/agent-budget.json. Legacy ledger rows (before prompt 05) only warn.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  checkCodeBudget,
  checkDecisions,
  checkDocBudgets,
  checkEntry,
  checkHandoff,
  checkLedger,
  handoffStatus,
  mapDrift,
  missingDocPaths,
  parseLedger
} from './checks.mjs'

const root = path.resolve('.')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const budget = JSON.parse(read('tests/agent-budget.json'))
const entryIndex = process.argv.indexOf('--entry')
const entry = entryIndex > -1 ? Number(process.argv[entryIndex + 1]) : null

const commitCache = new Map()
/** The commit exists and is on this branch (an ancestor of HEAD), not just somewhere in the object store. */
function commitExists(sha) {
  if (!commitCache.has(sha)) {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: root, stdio: 'ignore' })
      commitCache.set(sha, true)
    } catch {
      commitCache.set(sha, false)
    }
  }
  return commitCache.get(sha)
}

const ledgerFiles = ['docs/prompts/EVAL_LEDGER.md', ...fs.readdirSync(path.join(root, 'docs/prompts/archive')).filter((file) => file.startsWith('EVAL_LEDGER')).map((file) => `docs/prompts/archive/${file}`)]
const rows = ledgerFiles.flatMap((file) => parseLedger(read(file)))

const handoffDir = 'docs/prompts/handoff'
const handoffFiles = fs.readdirSync(path.join(root, handoffDir)).filter((file) => /^\d/.test(file) && file.endsWith('.md'))
const handoffs = Object.fromEntries(handoffFiles.map((file) => [file.replace(/\.md$/, ''), handoffStatus(read(`${handoffDir}/${file}`))]))

// The pragma itself (a line comment at the start of a line), not the word in prose; untracked files count.
const tsNocheckFiles = (() => {
  try {
    return execFileSync('git', ['grep', '--untracked', '-lE', '^[[:space:]]*//[[:space:]]*@ts-nocheck', '--', 'src'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
  } catch (error) {
    if (error.status === 1) return [] // git grep exits 1 when nothing matches
    throw error
  }
})()
const gameTsLines = read('src/scenes/Game.ts').split('\n').length - 1

const docStats = Object.fromEntries(
  Object.keys(budget.docs).filter(exists).map((file) => {
    const text = read(file)
    return [file, { bytes: Buffer.byteLength(text), lines: text.split('\n').length }]
  })
)

/** Every file under src/ (repo-relative), for the code-map check. */
function srcFiles() {
  const out = []
  const visit = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) visit(`${dir}/${entry.name}`)
      else out.push(`${dir}/${entry.name}`)
    }
  }
  visit('src')
  return out
}

const groups = [
  ['ledger', checkLedger(rows, { commitExists, enforceFrom: budget.enforceLedgerFrom })],
  ['handoffs', handoffFiles.flatMap((file) => checkHandoff(read(`${handoffDir}/${file}`), file))],
  ['code budget', checkCodeBudget({ gameTsLines, tsNocheckFiles }, budget)],
  ['doc budgets', checkDocBudgets(docStats, budget.docs)],
  [
    'doc paths',
    budget.pathCheckedDocs.filter(exists).flatMap((file) =>
      missingDocPaths(read(file), exists).map((missing) => ({ level: 'error', id: file, message: `names \`${missing}\`, which does not exist` }))
    )
  ],
  ['decisions', checkDecisions(read('docs/prompts/DECISIONS.md'))],
  ['code map', mapDrift(srcFiles(), exists('docs/MAP.md') ? read('docs/MAP.md') : '')]
]
if (entry !== null) groups.push([`entry ${entry}`, checkEntry(entry, { chain: budget.chain, handoffs, rows, decisions: read('docs/prompts/DECISIONS.md') })])

let errors = 0
let warnings = 0
let shownWarnings = 0
for (const [name, issues] of groups) {
  const groupErrors = issues.filter((issue) => issue.level === 'error')
  const groupWarnings = issues.filter((issue) => issue.level === 'warn')
  errors += groupErrors.length
  warnings += groupWarnings.filter((issue) => !issue.show).length
  shownWarnings += groupWarnings.filter((issue) => issue.show).length
  const shown = groupWarnings.filter((issue) => issue.show)
  const legacy = groupWarnings.length - shown.length
  const label = [legacy ? `${legacy} legacy warnings` : '', shown.length ? `${shown.length} warnings` : ''].filter(Boolean).join(', ')
  console.log(`${groupErrors.length ? 'FAIL' : 'PASS'} ${name}${label ? ` (${label})` : ''}`)
  groupErrors.forEach((issue) => console.log(`  error ${issue.id}: ${issue.message}`))
  shown.slice(0, 8).forEach((issue) => console.log(`  warn  ${issue.id}: ${issue.message}`))
  if (shown.length > 8) console.log(`  warn  ... ${shown.length - 8} more`)
  if (process.argv.includes('--verbose')) groupWarnings.filter((issue) => !issue.show).forEach((issue) => console.log(`  warn  ${issue.id}: ${issue.message}`))
}
console.log(`\nagents:check: ${errors} errors, ${warnings} legacy warnings (--verbose lists them)${shownWarnings ? `, ${shownWarnings} map warnings (npm run agents:map)` : ''}; Game.ts ${gameTsLines} lines; ${rows.length} ledger rows in ${ledgerFiles.length} files.`)
process.exit(errors ? 1 : 0)
