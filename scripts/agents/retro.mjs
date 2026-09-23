// npm run agents:retro -- --prompt 09
//
// The retro at a prompt's exit (EVAL-P10-009): gathers what the prompt produced about the agent system itself
// (ledger rows by status, seat scores and verdicts, decisions it raised, its progress entries, check warnings)
// into output/retro/<NN>.md for the docs-steward seat, which proposes at most ONE rule change as a
// docs/prompts/DECISIONS.md row. One change per prompt keeps the rules stable enough to learn from.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseDecisions, parseLedger } from './checks.mjs'

const index = process.argv.indexOf('--prompt')
const number = index > -1 ? String(process.argv[index + 1]).padStart(2, '0') : null
if (!number || !/^\d{2}$/.test(number)) {
  console.error('usage: npm run agents:retro -- --prompt 09')
  process.exit(2)
}
const root = path.resolve('.')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const n = Number(number)

const ledgerFiles = ['docs/prompts/EVAL_LEDGER.md', ...fs.readdirSync(path.join(root, 'docs/prompts/archive')).filter((file) => file.startsWith('EVAL_LEDGER')).map((file) => `docs/prompts/archive/${file}`)]
const rows = ledgerFiles.flatMap((file) => parseLedger(read(file))).filter((row) => row.id.startsWith(`EVAL-P${n}-`))
const byStatus = rows.reduce((counts, row) => {
  const word = row.status.split(/[\s(;]/)[0] || 'BLANK'
  counts[word] = (counts[word] ?? 0) + 1
  return counts
}, {})

const scores = read('docs/prompts/reviews/SCORES.md')
  .split('\n')
  .filter((line) => /^\| \d{4}-\d{2}-\d{2}/.test(line))
const decisions = parseDecisions(read('docs/prompts/DECISIONS.md')).filter((row) => new RegExp(`(prompt|Prompt|STOP) ?${n}\\b|\\b${number}[a-z]\\b|\\b0?${n}\\.\\d`).test(row.raised))
const progress = read('progress.md')
  .split('\n- ')
  .slice(1)
  .filter((entry) => new RegExp(`prompt ${n}\\b|prompt ${number}\\b|\\b${number}[a-z]\\b`).test(entry))
  .map((entry) => `- ${entry.split('\n')[0]}`)
const check = (() => {
  try {
    return execFileSync(process.execPath, ['scripts/agents/check.mjs', '--verbose'], { cwd: root, encoding: 'utf8' })
  } catch (error) {
    return `${error.stdout ?? ''}`
  }
})()

const report = `# Retro: prompt ${number}

Generated ${new Date().toISOString().slice(0, 16)}Z by \`npm run agents:retro -- --prompt ${number}\`. For the docs-steward seat: read this, then propose **at most one** change to the rules, prompts, seats or checks, as a row in \`docs/prompts/DECISIONS.md\` (question, recommendation, panel). Prefer a change a program can check over a sentence an agent must remember.

## Ledger (prompt ${number})

${Object.entries(byStatus).map(([status, count]) => `${status} ${count}`).join(', ') || 'no rows'}

${rows.map((row) => `- ${row.id}: ${row.status.slice(0, 60)}`).join('\n')}

## Seat reviews and scores (all slices)

| Date and slice | Seat | Verdict | Mean | BLOCK | MAJOR | MINOR | Valid |
| --- | --- | --- | --- | --- | --- | --- | --- |
${scores.join('\n')}

## Decisions this prompt raised

${decisions.map((row) => `- ${row.id} (${row.status}): ${row.question.slice(0, 120)}`).join('\n') || 'none'}

## Progress entries for this prompt

${progress.join('\n') || 'none in the current log (see docs/archive/progress/)'}

## agents:check

\`\`\`
${check.trim()}
\`\`\`
`
const outDir = path.join(root, 'output/retro')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `${number}.md`)
fs.writeFileSync(outFile, report)
console.log(`${path.relative(root, outFile)}: ${rows.length} ledger rows, ${scores.length} score rows, ${decisions.length} decisions, ${progress.length} progress entries`)
