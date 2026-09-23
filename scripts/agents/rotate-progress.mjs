// npm run agents:rotate-progress [-- --cap 16000]
// Moves the oldest entries under "## Log" in progress.md into docs/archive/progress/<YYYY-MM>.md (appended
// verbatim) until progress.md is under the cap (80% of its budget in tests/agent-budget.json). An entry runs from a
// top-level "- " line to the next, fences and blank lines included; the three newest entries always stay.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const file = path.join(root, 'progress.md')
const budgetBytes = JSON.parse(fs.readFileSync(path.join(root, 'tests/agent-budget.json'), 'utf8')).docs['progress.md'].maxBytes
const capIndex = process.argv.indexOf('--cap')
// Rotate down to 80% of the budget in tests/agent-budget.json so the next few entries fit.
const cap = capIndex > -1 ? Number(process.argv[capIndex + 1]) : Math.floor(budgetBytes * 0.8)
const text = fs.readFileSync(file, 'utf8')
const marker = '## Log'
const logAt = text.indexOf(marker)
if (logAt === -1) throw new Error('progress.md has no "## Log" section')
const headEnd = text.indexOf('\n', logAt) + 1
const head = text.slice(0, headEnd)
const body = text.slice(headEnd)

// An entry runs from a top-level "- " line to the next one; fenced blocks and blank lines stay inside it.
const entries = []
let inFence = false
for (const line of body.split('\n')) {
  const startsEntry = !inFence && line.startsWith('- ')
  if (startsEntry || entries.length === 0) entries.push([line])
  else entries[entries.length - 1].push(line)
  if (/^\s*```/.test(line)) inFence = !inFence
}
const render = (list) => list.map((entry) => entry.join('\n')).join('\n').replace(/\n*$/, '\n')
// Anything before the first entry (the blank line under the heading) stays where it is.
const lead = []
while (entries.length && !entries[0][0].startsWith('- ')) lead.push(entries.shift())

const moved = []
while (entries.length > 3 && Buffer.byteLength(head + render([...lead, ...entries])) > cap) moved.push(entries.shift())
if (moved.length === 0) {
  console.log(`progress.md is ${Buffer.byteLength(text)} bytes (cap ${cap}); nothing to rotate.`)
  process.exit(0)
}
const month = new Date().toISOString().slice(0, 7)
const archive = path.join(root, 'docs/archive/progress', `${month}.md`)
fs.mkdirSync(path.dirname(archive), { recursive: true })
if (!fs.existsSync(archive)) fs.writeFileSync(archive, `# Progress archive: ${month}\n\nEntries rotated out of \`progress.md\` by \`npm run agents:rotate-progress\`, verbatim, oldest first.\n\n`)
fs.appendFileSync(archive, render(moved))
fs.writeFileSync(file, head + render([...lead, ...entries]))
console.log(`Moved ${moved.length} entries to ${path.relative(root, archive)}; progress.md is now ${fs.statSync(file).size} bytes.`)
