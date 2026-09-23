// Clean generated artifacts that nothing cites. Dry run by default.
//
// Usage: npm run clean:artifacts            (lists what would move and why; changes nothing)
//        npm run clean:artifacts -- --yes   (moves those paths into ~/.Trash/omega-relay-clean-<stamp>/)
//
// Candidates: everything in tmp/ (gitignored scratch), and top-level entries of output/ that no tracked
// Markdown file mentions. Anything under output/ that a ledger row, handoff or doc cites is kept, because
// it is evidence. Files go to the Trash, not away, so a mistake is recoverable.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve('.')
const apply = process.argv.includes('--yes')
// Runs younger than this are kept: they are usually evidence a ledger row or handoff has not cited yet.
const KEEP_DAYS = 3
const MB = 1e6

function du(target) {
  const stat = fs.lstatSync(target)
  if (stat.isSymbolicLink() || !stat.isDirectory()) return stat.size
  return fs.readdirSync(target).reduce((sum, name) => sum + du(path.join(target, name)), 0)
}

// Tracked and untracked (not ignored) Markdown: a handoff being written today cites evidence too.
const markdown = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '*.md'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n')

const candidates = []
const kept = []
const tmp = path.join(root, 'tmp')
if (fs.existsSync(tmp)) {
  fs.readdirSync(tmp).forEach((name) => candidates.push({ rel: `tmp/${name}`, reason: 'tmp/ scratch' }))
}
const output = path.join(root, 'output')
if (fs.existsSync(output)) {
  fs.readdirSync(output).forEach((name) => {
    const rel = `output/${name}`
    // The latest smoke, sweep and perf runs are what the next session compares against.
    const ageDays = (Date.now() - fs.statSync(path.join(output, name)).mtimeMs) / 86400000
    if (['web-game-smoke', 'mission-visual-sweep', 'perf', 'context'].includes(name) || markdown.includes(rel) || ageDays < KEEP_DAYS) {
      kept.push(rel)
    } else {
      candidates.push({ rel, reason: 'not cited in any tracked .md' })
    }
  })
}

const sized = candidates.map((entry) => ({ ...entry, bytes: du(path.join(root, entry.rel)) })).sort((a, b) => b.bytes - a.bytes)
const total = sized.reduce((sum, entry) => sum + entry.bytes, 0)
sized.forEach((entry) => console.log(`${(entry.bytes / MB).toFixed(2).padStart(8)}MB  ${entry.rel}  (${entry.reason})`))
console.log(`\n${sized.length} paths, ${(total / MB).toFixed(1)}MB. Kept as evidence or latest runs: ${kept.join(', ') || 'none'}.`)

if (!apply) {
  console.log('Dry run: nothing moved. Re-run with `npm run clean:artifacts -- --yes` to move these to the Trash.')
  process.exit(0)
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const trash = path.join(os.homedir(), '.Trash', `omega-relay-clean-${stamp}`)
fs.mkdirSync(trash, { recursive: true })
sized.forEach((entry) => {
  const target = path.join(trash, entry.rel)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.renameSync(path.join(root, entry.rel), target)
})
console.log(`Moved ${sized.length} paths to ${trash}.`)
