// npm run agents:rotate-progress [-- --cap 16000]
// Moves the oldest entries under "## Log" in progress.md into docs/archive/progress/<YYYY-MM>.md (appended
// verbatim) until progress.md is under the cap. An entry is a top-level "- " line plus its indented lines.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const file = path.join(root, 'progress.md')
const capIndex = process.argv.indexOf('--cap')
const cap = capIndex > -1 ? Number(process.argv[capIndex + 1]) : 16000
const text = fs.readFileSync(file, 'utf8')
const marker = '## Log'
const logAt = text.indexOf(marker)
if (logAt === -1) throw new Error('progress.md has no "## Log" section')
const headEnd = text.indexOf('\n', logAt) + 1
const head = text.slice(0, headEnd)
const body = text.slice(headEnd)

const entries = []
for (const line of body.split('\n')) {
  if (line.startsWith('- ')) entries.push([line])
  else if (entries.length && (line.startsWith('  ') || line === '')) entries[entries.length - 1].push(line)
  else if (line.trim()) entries.push([line])
}
const render = (list) => list.map((entry) => entry.join('\n').replace(/\n+$/, '')).join('\n') + '\n'

const moved = []
while (entries.length > 3 && Buffer.byteLength(head + '\n' + render(entries)) > cap) moved.push(entries.shift())
if (moved.length === 0) {
  console.log(`progress.md is ${Buffer.byteLength(text)} bytes (cap ${cap}); nothing to rotate.`)
  process.exit(0)
}
const month = new Date().toISOString().slice(0, 7)
const archive = path.join(root, 'docs/archive/progress', `${month}.md`)
fs.mkdirSync(path.dirname(archive), { recursive: true })
if (!fs.existsSync(archive)) fs.writeFileSync(archive, `# Progress archive: ${month}\n\nEntries rotated out of \`progress.md\` by \`npm run agents:rotate-progress\`, verbatim, oldest first.\n\n`)
fs.appendFileSync(archive, render(moved))
fs.writeFileSync(file, head + '\n' + render(entries))
console.log(`Moved ${moved.length} entries to ${path.relative(root, archive)}; progress.md is now ${fs.statSync(file).size} bytes.`)
