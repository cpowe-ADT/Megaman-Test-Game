// Disk report: where the repository's bytes are, and what could be reclaimed. Read-only.
// Usage: npm run disk:report
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const MB = 1e6

function du(target) {
  if (!fs.existsSync(target)) return 0
  const stat = fs.lstatSync(target)
  if (stat.isSymbolicLink()) return 0
  if (!stat.isDirectory()) return stat.size
  return fs.readdirSync(target).reduce((sum, name) => sum + du(path.join(target, name)), 0)
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

const rows = fs
  .readdirSync(root)
  .filter((name) => name !== '.DS_Store')
  .map((name) => ({ name, bytes: du(path.join(root, name)) }))
  .sort((a, b) => b.bytes - a.bytes)

const objects = Object.fromEntries(
  git(['count-objects', '-v'])
    .split('\n')
    .map((line) => line.split(': '))
    .map(([key, value]) => [key, Number(value)])
)
const trackedBytes = git(['ls-files', '-z'])
  .split('\0')
  .filter(Boolean)
  .reduce((sum, file) => sum + (fs.existsSync(path.join(root, file)) ? fs.statSync(path.join(root, file)).size : 0), 0)
const sourceSheets = du(path.join(root, 'assets/sprites/source'))

console.log('# Disk report\n')
console.log('| Path | MB |')
console.log('| --- | ---: |')
rows.slice(0, 16).forEach((row) => console.log(`| ${row.name} | ${(row.bytes / MB).toFixed(1)} |`))
console.log(`| **total** | **${(rows.reduce((sum, row) => sum + row.bytes, 0) / MB).toFixed(1)}** |`)
console.log('')
console.log(`Tracked files in the working tree: ${(trackedBytes / MB).toFixed(1)}MB, of which assets/sprites/source ${(sourceSheets / MB).toFixed(1)}MB.`)
console.log(`.git: ${objects.count} loose objects (${(objects['size'] / 1024).toFixed(1)}MB), ${objects['in-pack']} packed (${(objects['size-pack'] / 1024).toFixed(1)}MB).`)
console.log('')
console.log('Reclaimable, largest first (nothing here deletes anything):')
if (objects.count > 500) console.log(`- git gc --prune=never: packs ${objects.count} loose objects without deleting any; the 2026-09-22 dry measurement packed 185MB to 111MB.`)
console.log(`- npm run clean:artifacts: lists tmp/ and uncited output/ runs; with --yes moves them to the Trash.`)
console.log('- assets/sprites/source: superseded source sheets leave the tree only on Craig\'s decision (docs/prompts/09-footprint-and-performance.md 9.7).')
console.log('- dist/ is rebuilt by npm run build; node_modules/ by npm ci.')
