// npm run agents:evidence -- EVAL-P5-001 output/web-game-smoke/13d-movement-feel output/perf/footprint-05a.json [...]
//
// Copies an eval's artifacts to output/evidence/<EVAL-ID>/ (later runs overwrite output/web-game-smoke and
// output/mission-visual-sweep, so a ledger row that cites those paths goes stale) and writes a small tracked
// record, docs/prompts/evidence/<EVAL-ID>.json: commit, dirty paths, and a sha256 per file, plus the
// provenance any summary.json inside recorded. Cite `output/evidence/<EVAL-ID>/...` in the ledger row.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { provenance } from '../lib/provenance.mjs'

const [id, ...sources] = process.argv.slice(2)
if (!id || !/^EVAL-[A-Za-z0-9-]+$/.test(id) || sources.length === 0) {
  console.error('usage: npm run agents:evidence -- EVAL-P5-001 <artifact path> [<artifact path> ...]')
  process.exit(2)
}
const root = path.resolve('.')
const target = path.join(root, 'output/evidence', id)
fs.mkdirSync(target, { recursive: true })

const files = []
const summaries = []
function copy(source, destination) {
  const stat = fs.statSync(source)
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true })
    fs.readdirSync(source).forEach((name) => copy(path.join(source, name), path.join(destination, name)))
    return
  }
  fs.copyFileSync(source, destination)
  const hash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')
  files.push({ path: path.relative(root, destination), bytes: stat.size, sha256: hash })
  if (path.basename(source) === 'summary.json' || /footprint-.*\.json$/.test(source)) {
    try {
      const data = JSON.parse(fs.readFileSync(source, 'utf8'))
      summaries.push({ file: path.relative(root, source), commit: data.commit ?? null, dirty: data.dirty ?? null, status: data.status ?? null })
    } catch {
      // not JSON we understand; the hash still records it
    }
  }
}
for (const source of sources) {
  const absolute = path.resolve(source)
  if (!fs.existsSync(absolute)) {
    console.error(`missing artifact: ${source}`)
    process.exit(1)
  }
  copy(absolute, path.join(target, path.basename(absolute)))
}

const record = { id, snapshotAt: new Date().toISOString(), ...provenance(), sources, summaries, files }
const mismatched = summaries.filter((summary) => summary.commit && record.commit && summary.commit !== record.commit)
if (mismatched.length) {
  console.warn(`note: ${mismatched.map((summary) => `${summary.file} ran on ${summary.commit}`).join(', ')}, snapshot taken at ${record.commit}`)
}
const recordDir = path.join(root, 'docs/prompts/evidence')
fs.mkdirSync(recordDir, { recursive: true })
fs.writeFileSync(path.join(recordDir, `${id}.json`), JSON.stringify(record, null, 2) + '\n')
console.log(`${id}: ${files.length} files -> ${path.relative(root, target)}; record docs/prompts/evidence/${id}.json`)
