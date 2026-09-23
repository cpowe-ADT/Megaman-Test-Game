// npm run agents:decisions -- docs/prompts/reviews/<YYYY-MM-DD>-decisions [--expect seat,seat]
// Validates each panel seat's file (docs/prompts/seats/DECISION_FORMAT.md), tallies verdicts per decision
// (a later file from the same seat replaces its earlier verdicts; any REJECT keeps a decision OPEN) and
// writes MERGED.md. The orchestrator copies the result into docs/prompts/DECISIONS.md; it never overrides it.
import fs from 'node:fs'
import path from 'node:path'
import { parseDecisionFile, tallyDecisions } from './checks.mjs'

const folder = process.argv[2]
const expectIndex = process.argv.indexOf('--expect')
const expected = expectIndex > -1 ? process.argv[expectIndex + 1].split(',').filter(Boolean) : []
if (!folder || !fs.existsSync(folder)) {
  console.error('usage: npm run agents:decisions -- docs/prompts/reviews/<YYYY-MM-DD>-decisions [--expect seat,seat]')
  process.exit(2)
}
const names = fs.readdirSync(folder).filter((file) => file.endsWith('.md') && file !== 'MERGED.md').sort()
const files = names.map((file) => ({ file, ...parseDecisionFile(fs.readFileSync(path.join(folder, file), 'utf8'), file) }))
const issues = files.flatMap((file) => file.issues)
if (files.length === 0) issues.push({ id: folder, message: 'no decision files' })
expected.filter((seat) => !files.some((file) => file.seat === seat)).forEach((seat) => issues.push({ id: seat, message: 'expected seat has no decision file' }))

const tally = tallyDecisions(files)
const merged = [
  `# Merged decisions: ${path.basename(folder)}`,
  '',
  '| Decision | Result | Verdicts | Conditions |',
  '| --- | --- | --- | --- |',
  ...tally.map((entry) => `| ${entry.id} | ${entry.result} | ${entry.verdicts.map((v) => `${v.seat} ${v.verdict}`).join('; ')} | ${entry.conditions.join(' / ').replace(/\|/g, '/') || 'none'} |`),
  '',
  issues.length ? `Format problems: ${issues.map((issue) => `${issue.id}: ${issue.message}`).join('; ')}` : 'All decision files valid.'
].join('\n')
fs.writeFileSync(path.join(folder, 'MERGED.md'), merged + '\n')
tally.forEach((entry) => console.log(`${entry.id} ${entry.result} (${entry.verdicts.map((v) => `${v.seat} ${v.verdict}`).join(', ')})`))
console.log(`${files.length} files, ${tally.length} decisions, ${issues.length} format problems -> ${path.join(folder, 'MERGED.md')}`)
issues.forEach((issue) => console.log(`  ${issue.id}: ${issue.message}`))
const panelBudget = JSON.parse(fs.readFileSync('tests/agent-budget.json', 'utf8')).tokens?.panelSeat ?? Infinity
files.forEach((file) => {
  if (file.tokens > panelBudget) console.log(`  ${file.file}: ${file.tokens} tokens, over the ${panelBudget} panel-seat budget; say why in the progress entry`)
})
process.exit(issues.length ? 1 : 0)
