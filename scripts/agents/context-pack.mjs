// npm run agents:context -- --part 05a [--budget 30000] [--with-files]
//
// Builds the one file a session needs before it writes anything (RAG for this repo): the hard rules, the
// charter's working loop, STOP protocol and amendments, this part's phases from the prompt, its ledger rows,
// the previous handoff's inputs and open risks, open decisions, the progress "Now" block and last three
// entries, recent git history, and the read-list with sizes. Writes output/context/<part>.md and fails when
// the pack exceeds the token budget (bytes / 4). A chat-only model gets this file pasted; a repo agent reads
// it instead of opening whole documents. --with-files appends the read-list files' full text.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))
const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index > -1 ? process.argv[index + 1] : fallback
}
const part = arg('--part')
if (!part || !/^\d{2}[a-z]?$/.test(part)) {
  console.error('usage: npm run agents:context -- --part 05a [--budget 30000] [--with-files]')
  process.exit(2)
}
const budgetTokens = Number(arg('--budget', 30000))
const promptNumber = Number(part.slice(0, 2))
const promptFile = fs.readdirSync(path.join(root, 'docs/prompts')).find((file) => file.startsWith(`${part.slice(0, 2)}-`))
if (!promptFile) throw new Error(`no docs/prompts/${part.slice(0, 2)}-*.md`)
const prompt = read(`docs/prompts/${promptFile}`)
const chain = JSON.parse(read('tests/agent-budget.json')).chain[String(promptNumber)] ?? { handoffs: [] }

/** Embedded documents sit one heading level below the pack's own sections. */
const demote = (markdown) => markdown.replace(/^(#{2,5}) /gm, '#$1 ')

/** Level-2 sections whose heading starts with any prefix, verbatim. */
function sections(markdown, prefixes) {
  const out = []
  const lines = markdown.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].startsWith('## ') ? lines[index].slice(3) : null
    if (!heading || !prefixes.some((prefix) => heading.startsWith(prefix))) continue
    let end = index + 1
    while (end < lines.length && !lines[end].startsWith('## ')) end += 1
    out.push(lines.slice(index, end).join('\n').trim())
  }
  return out.join('\n\n')
}

// Phases of this part: rows of the prompt's top table that start with the part id.
const phaseIds = prompt
  .split('\n')
  .filter((line) => line.startsWith(`| ${part} |`))
  .map((line) => line.split('|')[2]?.trim().match(/^(\d+\.\d+)/)?.[1])
  .filter(Boolean)
const intro = prompt.split('\n## ')[0].trim()
const promptBody = sections(prompt, ['Entry conditions', 'Ground truth', 'Outcome', ...phaseIds.map((id) => `Phase ${id}`), 'Exit Gate'])

const charter = read('docs/prompts/00-orchestrator-charter.md')
const amendments = charter.slice(charter.indexOf('**Amendments'), charter.indexOf('## 3.')).trim()
const charterPart = sections(charter, ['4.', '5.', '8.'])

const agentsRules = sections(read('AGENTS.md'), ['Hard rules'])
const ledgerRows = read('docs/prompts/EVAL_LEDGER.md')
  .split('\n')
  .filter((line) => line.startsWith(`| EVAL-P${promptNumber}-`))
  .join('\n')
const handoffParts = (chain.handoffs ?? [])
  .filter((name) => exists(`docs/prompts/handoff/${name}.md`))
  .map((name) => `### From handoff ${name}\n\n${demote(demote(sections(read(`docs/prompts/handoff/${name}.md`), ['Inputs for', 'Open risks'])))}`)
  .join('\n\n')
const decisions = read('docs/prompts/DECISIONS.md')
  .split('\n')
  .filter((line) => line.startsWith('| Id') || line.startsWith('| ---') || /^\| D-\d{3} \|.*\| OPEN \|/.test(line))
  .join('\n')
const progress = read('progress.md')
const progressNow = sections(progress, ['Now'])
const logText = progress.slice(progress.indexOf('## Log'))
const entries = logText.split('\n- ').slice(1).map((entry) => `- ${entry.trim()}`)
const lastEntries = entries.slice(-3).join('\n')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

const entrySection = sections(prompt, ['Entry conditions'])
const readList = [...new Set([...entrySection.matchAll(/`([^`\s]+\.(?:ts|mjs|js|md|json|py))`/g)].map((match) => match[1]))].filter(exists)
const readRows = readList.map((file) => {
  const bytes = fs.statSync(path.join(root, file)).size
  return `| \`${file}\` | ${bytes} | ~${Math.round(bytes / 4)} |`
})

let pack = `# Context pack: part ${part} (${promptFile})

Generated ${new Date().toISOString().slice(0, 16)}Z at ${git('rev-parse', '--short', 'HEAD')} on ${git('branch', '--show-current')} by \`npm run agents:context -- --part ${part}\`. Read this instead of the whole charter, prompt, ledger and progress log. Open a file from the read-list only when the slice touches it.

## Hard rules (from AGENTS.md)

${demote(agentsRules).replace(/^### Hard rules\n+/, '')}

## Charter: amendments, working loop, STOP protocol, hard rules

${amendments}

${demote(charterPart)}

## Prompt ${part.slice(0, 2)}: introduction and this part (phases ${phaseIds.join(', ') || 'none found: check the part id'})

${demote(intro.replace(/^# .*\n+/, ''))}

${demote(promptBody)}

## Ledger rows for prompt ${part.slice(0, 2)}

| Id | Kind | What passes | Status | Evidence | Commit |
| --- | --- | --- | --- | --- | --- |
${ledgerRows}

## Inputs from the previous prompt

${handoffParts || 'None required (see tests/agent-budget.json chain).'}

## Open decisions for Craig

${decisions}

## Progress: Now and the last three entries

${demote(progressNow)}

${lastEntries}

## Recent history

\`\`\`
${git('log', '--oneline', '-8')}
\`\`\`
Uncommitted paths: ${git('status', '--short').split('\n').filter(Boolean).length}. Live numbers: \`npm run agents:facts\`. Entry check: \`npm run agents:check -- --entry ${promptNumber}\`.

## Read-list from the entry conditions (open only what the slice touches)

| File | Bytes | Tokens |
| --- | ---: | ---: |
${readRows.join('\n')}
`
if (process.argv.includes('--with-files')) {
  pack += '\n## Read-list files\n\n' + readList.map((file) => `### ${file}\n\n\`\`\`\n${read(file)}\n\`\`\``).join('\n\n') + '\n'
}

const tokens = Math.round(Buffer.byteLength(pack) / 4)
const outDir = path.join(root, 'output/context')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `${part}.md`)
fs.writeFileSync(outFile, pack)
const readListTokens = readList.reduce((sum, file) => sum + Math.round(fs.statSync(path.join(root, file)).size / 4), 0)
console.log(`${path.relative(root, outFile)}: ~${tokens} tokens (budget ${budgetTokens}); read-list ${readList.length} files, ~${readListTokens} tokens if all opened.`)
if (tokens > budgetTokens) {
  console.error(`context pack over budget by ~${tokens - budgetTokens} tokens: trim the prompt's sections or the charter amendments, not the budget`)
  process.exit(1)
}
