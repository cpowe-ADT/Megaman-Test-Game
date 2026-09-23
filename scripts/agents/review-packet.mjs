// npm run agents:packet -- --seat qa-eval --scope "05a motor: drag removed" [--diff 1a2b3c..HEAD]
//        [--paths src/player/PlayerMotor.ts:40-120,tests/player-motor.test.ts] [--images output/x.png,output/y.png]
//        [--format review|decision] [--budget 20000] [--name 05a-motor]
//
// The one file a seat or worker reads (docs/prompts/seats/BRIEF_FORMAT.md): its seat brief, the answer format,
// the scope, the diff (stat plus hunks, capped per file), line-ranged excerpts and the images to open. Built once
// by the sender so the seat does not spend twenty tool calls, each re-reading its growing context, to find the
// same things. Fails over the token budget (bytes / 4) and names the largest parts to trim.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index > -1 ? process.argv[index + 1] : fallback
}
const seat = arg('--seat')
const scope = arg('--scope')
if (!seat || !scope || !fs.existsSync(path.join(root, `docs/prompts/seats/${seat}.md`))) {
  console.error('usage: npm run agents:packet -- --seat <seat> --scope "<one line>" [--diff a..b] [--paths p:10-80,q] [--images a.png] [--format review|decision] [--budget 20000]')
  process.exit(2)
}
const format = arg('--format', 'review')
const budget = Number(arg('--budget', 20000))
const hunkLines = Number(arg('--hunk-lines', 120))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const parts = []
const add = (title, body) => parts.push({ title, body: body.trim() })

add('Scope', `${scope}\n\nCommit ${git('rev-parse', '--short', 'HEAD').trim()}. Read this packet first; open another file only when a finding needs it, and name it under "Artifacts opened". Answer in the format below and nothing else.`)
add(`Seat brief (docs/prompts/seats/${seat}.md)`, read(`docs/prompts/seats/${seat}.md`))
add(`Answer format (docs/prompts/seats/${format === 'decision' ? 'DECISION' : 'REVIEW'}_FORMAT.md)`, read(`docs/prompts/seats/${format === 'decision' ? 'DECISION' : 'REVIEW'}_FORMAT.md`))

const range = arg('--diff')
if (range) {
  const stat = git('diff', '--stat', range)
  // Lockfiles, archives and generated catalogs are noise for a reviewer.
  const files = git('diff', '--name-only', range)
    .split('\n')
    .filter(Boolean)
    .filter((file) => !/package-lock\.json|docs\/archive\/|\.generated\.|\.png$|\.jpg$/.test(file))
  const hunks = files
    .map((file) => {
      const lines = git('diff', '--unified=2', range, '--', file).split('\n')
      const kept = lines.slice(0, hunkLines)
      const cut = lines.length > hunkLines ? `\n... ${lines.length - hunkLines} more lines: git diff ${range} -- ${file}` : ''
      return kept.join('\n') + cut
    })
    .join('\n')
  add(`Diff ${range}`, `\`\`\`\n${stat}\`\`\`\n\n\`\`\`diff\n${hunks}\n\`\`\``)
}

for (const spec of (arg('--paths', '') || '').split(',').filter(Boolean)) {
  const [file, span] = spec.split(':')
  const lines = read(file).split('\n')
  const [from, to] = span ? span.split('-').map(Number) : [1, Math.min(lines.length, 150)]
  const excerpt = lines.slice(from - 1, to).map((line, index) => `${from + index}: ${line}`).join('\n')
  add(`${file}:${from}-${to}`, `\`\`\`\n${excerpt}\n\`\`\``)
}

const images = (arg('--images', '') || '').split(',').filter(Boolean)
if (images.length) {
  const missing = images.filter((image) => !fs.existsSync(path.join(root, image)))
  if (missing.length) {
    console.error(`missing images: ${missing.join(', ')}`)
    process.exit(1)
  }
  add('Images to open (only these)', images.map((image) => `- \`${image}\``).join('\n'))
}

const packet = `# Packet: ${seat}\n\n` + parts.map((part) => `## ${part.title}\n\n${part.body}`).join('\n\n') + '\n'
const tokens = Math.round(Buffer.byteLength(packet) / 4)
const name = arg('--name', new Date().toISOString().slice(0, 16).replace(/[:T]/g, ''))
const outDir = path.join(root, 'output/packets')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `${name}-${seat}.md`)
fs.writeFileSync(outFile, packet)
console.log(`${path.relative(root, outFile)}: ~${tokens} tokens (budget ${budget})`)
if (tokens > budget) {
  const largest = parts
    .map((part) => ({ title: part.title, tokens: Math.round(Buffer.byteLength(part.body) / 4) }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 3)
  console.error(`over budget; largest parts: ${largest.map((part) => `${part.title} ~${part.tokens}`).join(', ')}. Narrow --paths or --diff, or lower --hunk-lines.`)
  process.exit(1)
}
