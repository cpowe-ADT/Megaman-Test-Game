// npm run agents:map                   regenerate docs/MAP.md, the one file a model reads to find code
// npm run agents:map -- --check        exit 1 when docs/MAP.md is out of date (writes nothing)
// npm run agents:map -- --no-header    src files with no top-of-file comment, most-imported first
//
// Reads the tree (never git, never the clock), so two runs on the same tree write the same bytes.
// Lists every src/ file with its line count and header sentence, scripts/ shortly, tests/ by area,
// and the smoke scenarios (scripts/smoke-test.mjs registrations, scripts/smoke/tiers.json, TESTING.md).
// agents:check warns when a src/ file is missing from the map (checks.mjs: mapDrift).
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SRC_HEADER_MAX = 36
const SCRIPT_HEADER_MAX = 32
const SCENARIO_NOTE_MAX = 44
const CODE_EXT = /\.(ts|mjs|js|py|sh)$/

const byCodepoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** Every file under `dir` (repo-relative, forward slashes), sorted by codepoint. */
export function walk(root, dir) {
  const out = []
  const visit = (rel) => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile()) out.push(child)
    }
  }
  visit(dir)
  return out.sort(byCodepoint)
}

export function countLines(text) {
  if (text === '') return 0
  const parts = text.split('\n')
  return text.endsWith('\n') ? parts.length - 1 : parts.length
}

const SKIP_LINE = /^(#!|#\s*-\*-|\/\/\s*@ts-(no)?check|\/\/\s*eslint|\/\/\/\s*<reference|\/\/\s*@vitest|\/\/\s*\[REGION|['"]use strict['"])/

function cleanComment(raw) {
  return raw
    .replace(/^\/\*+!?/, '')
    .replace(/\*+\/\s*$/, '')
    .replace(/^\s*\*+ ?/, '')
    .replace(/^\s*(\/\/+|#+) ?/, '')
    .replace(/^@(file|fileoverview|module|description)\s*/, '')
    .trim()
}

/** Cleaned lines of the comment block that starts at line `start` (none: null). */
function commentAt(lines, start, hash) {
  const first = (lines[start] ?? '').trim()
  const collected = []
  if (hash && /^("""|''')/.test(first)) {
    const quote = first.slice(0, 3)
    let rest = first.slice(3)
    for (let j = start; j < lines.length; j++) {
      const closing = rest.indexOf(quote)
      collected.push(closing >= 0 ? rest.slice(0, closing) : rest)
      if (closing >= 0) break
      rest = lines[j + 1] ?? ''
    }
  } else if (!hash && first.startsWith('/*')) {
    for (let j = start; j < lines.length; j++) {
      collected.push(cleanComment(lines[j].trim()))
      if (lines[j].includes('*/')) break
    }
  } else if ((hash && first.startsWith('#')) || (!hash && first.startsWith('//'))) {
    for (let j = start; j < lines.length; j++) {
      const line = lines[j].trim()
      if (SKIP_LINE.test(line)) continue
      if (!(hash ? line.startsWith('#') : line.startsWith('//'))) break
      collected.push(cleanComment(line))
    }
  } else {
    return null
  }
  return collected.map((line) => line.trim())
}

/** Cleaned lines of the comment at the very top of a file (before any code), or null when the file opens with code. */
export function topComment(text, file) {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length && (lines[i].trim() === '' || SKIP_LINE.test(lines[i].trim()))) i++
  return commentAt(lines, i, /\.(py|sh)$/.test(file))
}

/** First paragraph of cleaned comment lines, joined, minus tag lines and a leading file name. */
function firstParagraph(lines) {
  const kept = []
  for (const line of lines) {
    if (line === '') {
      if (kept.length) break
      continue
    }
    if (/^@\w+/.test(line)) {
      if (kept.length) break
      continue
    }
    kept.push(line)
  }
  return kept
    .join(' ')
    .replace(/`/g, '')
    .replace(/^[\w./-]+\.(ts|mjs|js|py|sh)\s*[-:—]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** First sentence of `text`, trailing period dropped, cut to `max` characters at a word boundary. */
export function firstSentence(text, max) {
  let end = text.length
  const stop = /[.!?](?=\s|$)/g
  let match
  while ((match = stop.exec(text))) {
    const before = text.slice(0, match.index)
    if (/(\be\.g|\bi\.e|\betc|\bvs|\bno|\bfig)$/i.test(before)) continue
    const open = (before.match(/\(/g) ?? []).length - (before.match(/\)/g) ?? []).length
    if (open > 0) continue
    end = match.index + 1
    break
  }
  let sentence = text.slice(0, end).replace(/[.:;,]+$/, '').trim()
  if (sentence.length > max) {
    const cut = sentence.slice(0, max - 3)
    const space = cut.lastIndexOf(' ')
    let kept = space > max / 2 ? cut.slice(0, space) : cut
    if ((kept.match(/\(/g) ?? []).length > (kept.match(/\)/g) ?? []).length) kept = kept.slice(0, kept.lastIndexOf('('))
    sentence = `${kept.replace(/[\s,;:(\-]+$/, '')}...`
  }
  return sentence
}

/** { header, top }: the first sentence of the comment at the top of the file ('' when the file opens with code). */
export function headerOf(text, file, max) {
  if (file.endsWith('.json')) return { header: '', top: true }
  const top = topComment(text, file)
  const topText = top ? firstParagraph(top) : ''
  return { header: topText ? firstSentence(topText, max) : '', top: Boolean(topText) }
}

function describe(root, file, max) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  const { header, top } = headerOf(text, file, max)
  const note = file.endsWith('.json') ? '(json)' : header || '(no header)'
  return { file, lines: countLines(text), note, top, text }
}

function groupByDir(files) {
  const groups = new Map()
  for (const file of files) {
    const dir = path.posix.dirname(file)
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir).push(file)
  }
  return [...groups.entries()].sort((a, b) => byCodepoint(a[0], b[0]))
}

/** `### dir` headings, then one `name lines: header` line per file (the format mapListedPaths in checks.mjs reads). */
function section(root, files, max) {
  const out = []
  for (const [dir, members] of groupByDir(files)) {
    out.push(`### ${dir}`)
    for (const file of members) {
      const { lines, note } = describe(root, file, max)
      out.push(`${path.posix.basename(file)} ${lines}: ${note}`)
    }
  }
  return out
}

/** Relative `from '..'`, `import '..'` and `import('..')` targets of one src file, resolved to src paths. */
export function importTargets(file, text, exists) {
  const targets = []
  for (const match of text.matchAll(/(?:from\s+|import\s*\(?\s*)['"](\.{1,2}\/[^'"]*)['"]/g)) {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]))
    const hit = [`${base}.ts`, `${base}/index.ts`, base].find(exists)
    if (hit) targets.push(hit)
  }
  return targets
}

/** Map of src file -> number of src files that import it. */
export function importCounts(root, srcFiles) {
  const known = new Set(srcFiles)
  const counts = new Map()
  for (const file of srcFiles) {
    if (!file.endsWith('.ts')) continue
    const text = fs.readFileSync(path.join(root, file), 'utf8')
    for (const target of new Set(importTargets(file, text, (candidate) => known.has(candidate)))) {
      counts.set(target, (counts.get(target) ?? 0) + 1)
    }
  }
  return counts
}

function testsSection(root) {
  const files = fs.readdirSync(path.join(root, 'tests'), { withFileTypes: true })
  const tests = files.filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts')).map((entry) => entry.name.replace(/\.test\.ts$/, ''))
  const others = files.filter((entry) => !entry.name.endsWith('.test.ts')).map((entry) => entry.name + (entry.isDirectory() ? '/' : ''))
  const areaOf = (name) => {
    const dash = name.split('-')[0]
    return dash.replace(/([a-z0-9])([A-Z]).*$/, '$1')
  }
  const groups = new Map()
  for (const name of tests.sort(byCodepoint)) {
    const area = areaOf(name)
    if (!groups.has(area)) groups.set(area, [])
    groups.get(area).push(name)
  }
  const multi = [...groups.entries()].filter(([, names]) => names.length > 1).sort((a, b) => byCodepoint(a[0], b[0]))
  const single = [...groups.entries()].filter(([, names]) => names.length === 1).map(([, names]) => names[0])
  const out = [
    '## tests/',
    `${tests.length} \`tests/*.test.ts\` files; names drop \`.test.ts\` and the area prefix. Run one: \`node --import ./tools/register-ts-loader.mjs --test tests/<name>.test.ts\`. Also here: ${others.sort(byCodepoint).join(', ')}.`
  ]
  for (const [area, names] of multi) {
    out.push(`${area} (${names.length}): ${names.map((name) => (name === area ? name : name.startsWith(`${area}-`) ? name.slice(area.length + 1) : name)).join(', ')}`)
  }
  if (single.length) out.push(`other (${single.length}): ${single.join(', ')}`)
  out.push('')
  return out
}

/** One row per registered smoke scenario: { name, file ('' when inline), tier, note }. */
export function scenarioRows(root) {
  const smoke = fs.readFileSync(path.join(root, 'scripts/smoke-test.mjs'), 'utf8')
  const tiers = JSON.parse(fs.readFileSync(path.join(root, 'scripts/smoke/tiers.json'), 'utf8'))
  const testing = fs.readFileSync(path.join(root, 'TESTING.md'), 'utf8').split('\n')
  const fast = new Set(tiers.fast ?? [])
  const long = new Set(tiers.long ?? [])

  const importedFrom = new Map()
  for (const match of smoke.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/smoke\/([^']+)'/g)) {
    for (const name of match[1].split(',')) importedFrom.set(name.trim().split(/\s+as\s+/).pop(), match[2])
  }

  const marks = [...smoke.matchAll(/executeSmokeScenario\(\s*summary,\s*'([^']+)'/g)]
  const rows = marks.map((match, index) => {
    const name = match[1]
    const body = smoke.slice(match.index, marks[index + 1]?.index ?? smoke.length)
    const dynamic = body.match(/import\('\.\/smoke\/([^']+)'\)/)
    const call = [...body.matchAll(/\b(\w+)\(/g)].map((fn) => fn[1]).find((fn) => importedFrom.has(fn))
    const file = dynamic?.[1] ?? (call ? importedFrom.get(call) : '')
    const number = name.split('-')[0]
    const tier = long.has(name) || long.has(number) ? ' (long)' : fast.has(name) || fast.has(number) ? ' (fast)' : ''
    const line = testing.find((candidate) => candidate.includes(`Scenario \`${name}\``))
    let note = ''
    if (line) {
      const after = line.slice(line.indexOf(`Scenario \`${name}\``) + `Scenario \`${name}\``.length)
      const text = after
        .replace(/^\s*\([^)]*\)\s*/, '')
        .replace(/`/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (/^[a-z]/.test(text) && !/^and\b/.test(text)) note = firstSentence(text, SCENARIO_NOTE_MAX)
    }
    return { name, file, tier, note }
  })

  return rows
}

function scenarioSection(rows) {
  const out = [
    '## Smoke scenarios',
    `${rows.length} in \`scripts/smoke-test.mjs\` (\`executeSmokeScenario(summary, '<name>', ...)\`), run order. \`(fast)\` is \`SMOKE_TIER=fast\` (\`scripts/smoke/tiers.json\`), \`(long)\` needs \`SMOKE_LONG=1\`; \`SMOKE_ONLY=<name or number>\` runs one. Then its runner under \`scripts/smoke/\` (none: inline in \`smoke-test.mjs\`) and a TESTING.md note where one exists (\`grep -n '<name>' TESTING.md\`).`
  ]
  for (const row of rows) {
    out.push(`${row.name}${row.tier}${row.file ? ` ${row.file}` : ''}${row.note ? `: ${row.note}` : ''}`)
  }
  out.push('')
  return out
}

const INTRO = [
  '# MAP: where the code is',
  '',
  'Generated by `npm run agents:map`; do not edit. After adding or moving a file, run it again (`agents:check` warns when a `src/` file is missing). Entries are `file lines: first sentence of its header`, under the `###` directory heading.',
  '',
  '1. `grep -n -i <word> docs/MAP.md` finds the file.',
  '2. Pick a range from the line count (never read a file over 20KB, about 500 lines, whole): `grep -n <symbol> <file>`, then Read with offset and limit.',
  '3. Its tests are under `tests/` by area (below); the scenario that plays it is in the smoke index.',
  '4. `npm run agents:map -- --no-header` lists src files with no header: add one sentence when you touch one.',
  ''
]

export function buildMap(root) {
  const srcFiles = walk(root, 'src')
  const allScripts = walk(root, 'scripts')
  const scriptFiles = allScripts.filter((file) => CODE_EXT.test(file) && !file.startsWith('scripts/smoke/'))
  const smokeFiles = allScripts.filter((file) => CODE_EXT.test(file) && file.startsWith('scripts/smoke/'))
  const dataDirs = [...new Set(allScripts.filter((file) => file.endsWith('.json')).map((file) => path.posix.dirname(file)))].sort(byCodepoint)
  const dirs = new Set(srcFiles.map((file) => path.posix.dirname(file)))
  const out = [...INTRO, `## src/ (${srcFiles.length} files, ${dirs.size} directories)`, ...section(root, srcFiles, SRC_HEADER_MAX), '']

  const rows = scenarioRows(root)
  const runners = new Set(rows.map((row) => row.file))
  const helpers = smokeFiles.map((file) => path.posix.basename(file)).filter((name) => !runners.has(name))
  out.push(`## scripts/ (${allScripts.length} files)`, ...section(root, scriptFiles, SCRIPT_HEADER_MAX))
  out.push(`### scripts/smoke (${smokeFiles.length} files: one runner per scenario below, plus ${helpers.join(' ')})`)
  const data = dataDirs.map((dir) => `${dir}/ (${allScripts.filter((file) => file.endsWith('.json') && path.posix.dirname(file) === dir).length} json)`)
  if (data.length) out.push(`Data only: ${data.join(', ')}.`)
  out.push('', ...testsSection(root), ...scenarioSection(rows))
  return `${out.join('\n').replace(/\n+$/, '')}\n`
}

function main() {
  const root = path.resolve('.')
  const args = process.argv.slice(2)
  if (args.includes('--no-header')) {
    const srcFiles = walk(root, 'src').filter((file) => file.endsWith('.ts'))
    const counts = importCounts(root, walk(root, 'src'))
    const missing = srcFiles
      .filter((file) => !headerOf(fs.readFileSync(path.join(root, file), 'utf8'), file, SRC_HEADER_MAX).top)
      .map((file) => ({ file, imports: counts.get(file) ?? 0 }))
      .sort((a, b) => b.imports - a.imports || byCodepoint(a.file, b.file))
    console.log(`${missing.length} of ${srcFiles.length} src/*.ts files have no top-of-file header (imported-by count, most first):`)
    for (const { file, imports } of missing.slice(0, 40)) console.log(`${String(imports).padStart(4)}  ${file}`)
    if (missing.length > 40) console.log(`  ... ${missing.length - 40} more`)
    return
  }
  const next = buildMap(root)
  const target = path.join(root, 'docs/MAP.md')
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
  if (args.includes('--check')) {
    console.log(current === next ? 'docs/MAP.md is current' : 'docs/MAP.md is out of date: run npm run agents:map')
    process.exit(current === next ? 0 : 1)
  }
  fs.writeFileSync(target, next)
  console.log(`docs/MAP.md ${Buffer.byteLength(next)} bytes, ${next.split('\n').length - 1} lines${current === next ? ' (unchanged)' : ''}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
