// Pure checks for the agent system: the ledger, handoffs, the prompt chain, code and doc budgets,
// doc paths, the decisions log and review files. No file or git access here: scripts/agents/check.mjs
// gathers inputs and tests/agents-checks.test.ts feeds fixtures. Every rule has a failing fixture.

/** Rows of every Markdown table whose first cell is an eval id. */
export function parseLedger(markdown) {
  const rows = []
  let section = ''
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim()
    const cells = splitRow(line)
    if (!cells || !/^EVAL-[A-Za-z0-9-]+$/.test(cells[0])) continue
    rows.push({ id: cells[0], kind: cells[1] ?? '', what: cells[2] ?? '', status: cells[3] ?? '', evidence: cells[4] ?? '', commit: cells[5] ?? '', section })
  }
  return rows
}

function splitRow(line) {
  if (!line.startsWith('|') || /^\|\s*-{3}/.test(line)) return null
  return line
    .slice(1, line.endsWith('|') ? -1 : undefined)
    .split('|')
    .map((cell) => cell.trim())
}

export const STATUS_PATTERN = /^(?:(?:PASS|FAIL|PENDING)(?![A-Za-z])|SKIPPED \(.+\))/

/** Prompt number of an eval id (EVAL-P9-003 -> 9), or null for ART/REVIEW rows. */
export function promptOf(id) {
  const match = /^EVAL-P(\d+)-/.exec(id)
  return match ? Number(match[1]) : null
}

export function shasIn(text) {
  return [...new Set((text.match(/\b[0-9a-f]{7,40}\b/g) ?? []).filter((sha) => /[a-f]/.test(sha) && /\d/.test(sha)))]
}

/**
 * Ledger rules. Rows for prompts at or above `enforceFrom` fail the check; older rows only warn, because
 * they predate the rules. `commitExists(sha)` answers whether git knows a commit.
 */
export function checkLedger(rows, { commitExists, enforceFrom = 5 }) {
  const issues = []
  const seen = new Set()
  for (const row of rows) {
    const prompt = promptOf(row.id)
    const level = prompt !== null && prompt >= enforceFrom ? 'error' : 'warn'
    if (seen.has(row.id)) issues.push({ level: 'error', id: row.id, message: 'duplicate eval id' })
    seen.add(row.id)
    if (!STATUS_PATTERN.test(row.status)) {
      issues.push({ level, id: row.id, message: `status "${row.status.slice(0, 40)}" is not PASS, FAIL, PENDING or SKIPPED (reason)` })
      continue
    }
    if (row.status.startsWith('PASS')) {
      const shas = shasIn(row.commit)
      if (shas.length === 0) {
        issues.push({ level, id: row.id, message: `PASS without a commit hash in the Commit cell ("${row.commit.slice(0, 40)}")` })
      } else if (!shas.some((sha) => commitExists(sha))) {
        issues.push({ level, id: row.id, message: `PASS cites ${shas.join(', ')}, which git does not know` })
      }
      if (!hasArtifact(row.evidence) || !hasResult(row.evidence)) {
        issues.push({ level, id: row.id, message: 'PASS evidence needs an artifact path (output/..., a test file) and a result (a backticked command or line, or "->")' })
      }
    }
  }
  return issues
}

/**
 * Phase ids a prompt part covers, from the prompt's sessions sentence (`05b` (5.3, 5.4 and 5.7)) and its
 * top table (rows whose first cell lists the part, e.g. "06e, 06f"; every id in the phase cell counts).
 * "9.0 to 9.4" expands to each phase between. Returns [] when the prompt names none.
 */
export function partPhases(promptMarkdown, part) {
  const ids = new Set()
  const add = (text) => {
    for (const range of text.matchAll(/(\d+)\.(\d+) to (\d+)\.(\d+)/g)) {
      if (range[1] === range[3]) for (let minor = Number(range[2]); minor <= Number(range[4]); minor += 1) ids.add(`${range[1]}.${minor}`)
    }
    for (const id of text.matchAll(/\b(\d+\.\d+)\b/g)) ids.add(id[1])
  }
  const sentence = promptMarkdown.match(new RegExp('`' + part + '`[^(]*\\(([^)]*)\\)'))
  if (sentence) add(sentence[1])
  for (const line of promptMarkdown.split('\n')) {
    const cells = splitRow(line)
    if (!cells || cells.length < 2) continue
    const parts = cells[0].split(/[,\s]+/).filter(Boolean)
    if (parts.includes(part)) add(cells[1])
  }
  return [...ids].sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]))
}

/**
 * Sections of other prompts that a text cites, e.g. `prompt 04 "Phase 4.1"`, `prompt 02 section "Phase 2.1"`,
 * or a path to `docs/prompts/03-art-animation-bosses.md` followed by `section "Phase 3.3"`. The context pack
 * includes exactly these instead of asking a session to read the superseded prompt in full.
 */
export function citedSections(text) {
  const found = new Map()
  const add = (prompt, section) => found.set(`${prompt}|${section}`, { prompt, section })
  for (const match of text.matchAll(/prompt (0\d)(?: section)? "([^"]+)"/g)) add(match[1], match[2])
  for (const match of text.matchAll(/docs\/prompts\/(0\d)-[\w-]+\.md`?,? section "([^"]+)"/g)) add(match[1], match[2])
  return [...found.values()]
}

/** An artifact path: something under output/, or a repo file with an extension. */
export function hasArtifact(text) {
  return /output\/[\w./{},*-]+|(?:src|tests|scripts|docs)\/[\w./-]+\.\w+/.test(text)
}

/** A result: a backticked command or result line, or an arrow from a command to its result. */
export function hasResult(text) {
  return /`[^`]{3,}`|->|→/.test(text)
}

export const HANDOFF_SECTIONS = ['Status:', 'Branch and final commit', 'What changed', 'Decisions made', 'Content inventory', 'Evidence', 'Open risks', 'Inputs for']

/** Handoff contract (charter section 6): the eight sections in order and a real status. */
export function checkHandoff(markdown, name) {
  const issues = []
  const headings = markdown.split('\n').filter((line) => line.startsWith('## ')).map((line) => line.slice(3).trim())
  let cursor = 0
  for (const section of HANDOFF_SECTIONS) {
    const index = headings.findIndex((heading, position) => position >= cursor && heading.startsWith(section))
    if (index === -1) {
      issues.push({ level: 'error', id: name, message: `missing or out-of-order section "## ${section}"` })
    } else {
      cursor = index + 1
    }
  }
  const status = headings.find((heading) => heading.startsWith('Status:')) ?? ''
  if (/\|\s*PARTIAL \(list what is missing and why\)|COMPLETE \| PARTIAL/.test(status) || status.includes('(list what is missing and why)')) {
    issues.push({ level: 'error', id: name, message: 'Status still holds the template placeholder' })
  } else if (status && !/^Status: (COMPLETE|PARTIAL)\b/.test(status)) {
    issues.push({ level: 'error', id: name, message: `Status must start with COMPLETE or PARTIAL ("${status.slice(0, 40)}")` })
  }
  return issues
}

export function handoffStatus(markdown) {
  const line = markdown.split('\n').find((row) => row.startsWith('## Status:')) ?? ''
  if (line.includes('(list what is missing and why)')) return 'PLACEHOLDER'
  return /^## Status: COMPLETE\b/.test(line) ? 'COMPLETE' : /^## Status: PARTIAL\b/.test(line) ? 'PARTIAL' : 'MISSING'
}

/**
 * Prompt chaining: may prompt `target` start? `chain[target]` names the handoffs that must be COMPLETE and
 * the eval ids (or `P<n>` for every row of a prompt) that must be PASS or SKIPPED.
 */
export function checkEntry(target, { chain, handoffs, rows, decisions = '' }) {
  const rule = chain[String(target)]
  if (!rule) return [{ level: 'error', id: `entry ${target}`, message: 'no chain rule for this prompt in tests/agent-budget.json' }]
  const issues = openBlockers(decisions, target).map((row) => ({
    level: 'error',
    id: `entry ${target}`,
    message: `${row.id} is OPEN and blocks entry ${target}: ${row.question.slice(0, 80)}`
  }))
  for (const handoff of rule.handoffs ?? []) {
    const status = handoffs[handoff]
    if (status !== 'COMPLETE') issues.push({ level: 'error', id: `entry ${target}`, message: `handoff ${handoff} is ${status ?? 'missing'}, not COMPLETE` })
  }
  for (const requirement of rule.evals ?? []) {
    const matching = /^P\d+$/.test(requirement) ? rows.filter((row) => row.id.startsWith(`EVAL-${requirement}-`)) : rows.filter((row) => row.id === requirement)
    if (matching.length === 0) issues.push({ level: 'error', id: `entry ${target}`, message: `${requirement} has no ledger rows` })
    matching
      .filter((row) => !/^(PASS|SKIPPED)/.test(row.status))
      .forEach((row) => issues.push({ level: 'error', id: `entry ${target}`, message: `${row.id} is ${row.status.slice(0, 30) || 'blank'}` }))
  }
  return issues
}

/** Game.ts may only shrink; @ts-nocheck only in the listed files. */
export function checkCodeBudget({ gameTsLines, tsNocheckFiles }, budget) {
  const issues = []
  if (gameTsLines > budget.gameTsMaxLines) {
    issues.push({ level: 'error', id: 'Game.ts', message: `${gameTsLines} lines, ceiling ${budget.gameTsMaxLines} (lower the ceiling when a slice shrinks it; never raise it)` })
  }
  tsNocheckFiles
    .filter((file) => !budget.tsNocheckAllowed.includes(file))
    .forEach((file) => issues.push({ level: 'error', id: file, message: 'new @ts-nocheck file (charter hard rule 3)' }))
  return issues
}

/** Size budgets keep what every session reads small. `files` maps path -> { bytes, lines }. */
export function checkDocBudgets(files, budgets) {
  const issues = []
  for (const [file, limit] of Object.entries(budgets)) {
    const actual = files[file]
    if (!actual) {
      issues.push({ level: 'error', id: file, message: 'budgeted file is missing' })
      continue
    }
    if (limit.maxBytes && actual.bytes > limit.maxBytes) {
      issues.push({ level: 'error', id: file, message: `${actual.bytes} bytes (~${Math.round(actual.bytes / 4)} tokens), budget ${limit.maxBytes}` })
    }
    if (limit.maxLines && actual.lines > limit.maxLines) {
      issues.push({ level: 'error', id: file, message: `${actual.lines} lines, budget ${limit.maxLines}` })
    }
  }
  return issues
}

/**
 * Backticked repo paths (they contain a slash and start at a top-level folder) that do not exist.
 * Placeholders (<x>, *, {a,b}, ...) are skipped, and so are lines that say the file is planned.
 */
export function missingDocPaths(markdown, exists) {
  const missing = []
  for (const line of markdown.split('\n')) {
    if (/\bplanned\b|\(10b\)/i.test(line)) continue
    for (const match of line.matchAll(/`([^`\s]+)`/g)) {
      const candidate = match[1].replace(/[),.;:]+$/, '').replace(/:\d+(-\d+)?$/, '')
      if (!/^(src|docs|scripts|tests|tools|assets|\.claude|\.github)\//.test(candidate)) continue
      if (/[<>*{}$]|\.\.\./.test(candidate)) continue
      if (!exists(candidate)) missing.push(candidate)
    }
  }
  return [...new Set(missing)]
}

/** Decisions log rows: `| D-001 | raised | question | recommendation | panel | blocks | OPEN or DECIDED | reply | date |`. */
export function parseDecisions(markdown) {
  return markdown
    .split('\n')
    .map(splitRow)
    .filter((cells) => cells && /^D-\d{3}$/.test(cells[0]))
    .map(([id, raised, question, recommendation, panel, blocks, status, reply, date]) => ({ id, raised, question, recommendation, panel: panel ?? '', blocks: blocks ?? '', status, reply, date }))
}

const VERDICTS = ['APPROVE', 'APPROVE WITH CONDITIONS', 'REJECT', 'ABSTAIN']

/** A panel seat's decision file (docs/prompts/seats/DECISION_FORMAT.md): { seat, rows, issues }. */
export function parseDecisionFile(markdown, name = 'decision') {
  const seat = (markdown.match(/^Seat:\s*(.+)$/m)?.[1] ?? '').trim()
  const round = Number(markdown.match(/^Round:\s*(\d+)/m)?.[1] ?? 1)
  const rows = []
  const issues = []
  for (const line of markdown.split('\n')) {
    const cells = splitRow(line)
    if (!cells || !/^D-\d{3}/.test(cells[0])) continue
    const [idCell, verdictCell = '', reason = '', evidence = '', conditions = ''] = cells
    const id = idCell.match(/^D-\d{3}/)[0]
    const verdict = verdictCell.replace(/[*_`]/g, '').trim().toUpperCase()
    if (!VERDICTS.includes(verdict)) issues.push({ level: 'error', id: name, message: `${id}: verdict "${verdictCell.slice(0, 30)}" is not ${VERDICTS.join(', ')}` })
    if (verdict !== 'ABSTAIN' && !/[\w./-]+\.\w+(:\d+)?|`[^`]+`\s*(->|→)/.test(evidence)) {
      issues.push({ level: 'error', id: name, message: `${id}: verdict without file or artifact evidence` })
    }
    rows.push({ id, verdict, reason, evidence, conditions })
  }
  if (!seat) issues.push({ level: 'error', id: name, message: 'missing "Seat:" header' })
  if (rows.length === 0) issues.push({ level: 'error', id: name, message: 'no decision rows' })
  return { seat, round, rows, issues, tokens: parseTokens(markdown.match(/^Tokens:\s*(.+)$/m)?.[1]) }
}

/**
 * Tally panel files. A seat's rows for a decision in a higher `Round:` replace its rows for that decision in
 * earlier rounds (a re-review after a fix); its other decisions stand. A decision is DECIDED when every seat
 * that ruled on it approved; any REJECT keeps it OPEN.
 */
export function tallyDecisions(files) {
  const bySeatAndId = new Map()
  for (const file of [...files].sort((a, b) => (a.round ?? 1) - (b.round ?? 1))) {
    const ids = new Set(file.rows.map((row) => row.id))
    ids.forEach((id) => bySeatAndId.set(`${file.seat}|${id}`, { seat: file.seat, rows: file.rows.filter((row) => row.id === id) }))
  }
  const byId = new Map()
  for (const { seat, rows } of bySeatAndId.values()) {
    for (const row of rows) {
      if (row.verdict === 'ABSTAIN') continue
      const entry = byId.get(row.id) ?? { id: row.id, verdicts: [], conditions: [] }
      entry.verdicts.push({ seat, verdict: row.verdict })
      if (row.conditions && row.conditions !== 'none') entry.conditions.push(`${seat}: ${row.conditions}`)
      byId.set(row.id, entry)
    }
  }
  return [...byId.values()]
    .map((entry) => ({ ...entry, result: entry.verdicts.some((v) => v.verdict === 'REJECT') ? 'OPEN' : 'DECIDED' }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** OPEN decisions whose Blocks cell names `entry <N>`: prompt N cannot start until Craig answers them. */
export function openBlockers(markdown, target) {
  return parseDecisions(markdown).filter(
    (row) => row.status === 'OPEN' && new RegExp(`\\bentry ${target}\\b`).test(row.blocks)
  )
}

export function checkDecisions(markdown) {
  const issues = []
  const ids = new Set()
  for (const { id, question, recommendation, status, reply } of parseDecisions(markdown)) {
    if (ids.has(id)) issues.push({ level: 'error', id, message: 'duplicate decision id' })
    ids.add(id)
    if (!question || !recommendation) issues.push({ level: 'error', id, message: 'every decision needs a question and a recommendation' })
    if (status !== 'OPEN' && status !== 'DECIDED') issues.push({ level: 'error', id, message: `status "${status}" is not OPEN or DECIDED` })
    if (status === 'DECIDED' && !reply) issues.push({ level: 'error', id, message: "DECIDED without Craig's reply recorded" })
  }
  if (ids.size === 0) issues.push({ level: 'error', id: 'DECISIONS.md', message: 'no decision rows found' })
  return issues
}

/**
 * A seat review (docs/prompts/seats/REVIEW_FORMAT.md). Returns { seat, verdict, findings, scores, issues }.
 * Findings without file:line or an artifact path are rejected: a reviewer cannot talk its way past this.
 */
export function parseReview(markdown, name = 'review') {
  const header = (key) => (markdown.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1] ?? '').trim()
  const seat = header('Seat')
  const verdict = header('Verdict')
  const findings = []
  const scores = []
  const issues = []
  let inFindings = false
  for (const line of markdown.split('\n')) {
    const cells = splitRow(line)
    if (!cells) {
      if (!/^\|\s*-{3}/.test(line)) inFindings = false
      continue
    }
    if (/^Severity$/i.test(cells[0])) {
      inFindings = true
      continue
    }
    // Emphasis must not hide a severity: **BLOCK** is a BLOCK.
    const severityCell = cells[0].replace(/[*_`]/g, '').trim().toUpperCase()
    if (inFindings && !/^(BLOCK|MAJOR|MINOR)$/.test(severityCell)) {
      issues.push({ level: 'error', id: name, message: `findings row with unknown severity "${cells[0].slice(0, 20)}"` })
      continue
    }
    if (/^(BLOCK|MAJOR|MINOR)$/.test(severityCell)) {
      const [, claim, evidence, fix] = cells
      const severity = severityCell
      // path:line, an artifact under output/, or a backticked command followed by its result ("->").
      const cited = /[\w./-]+\.\w+:\d+|output\/\S+\.(png|json|log|md|txt)|`[^`]+`\s*(->|→)\s*\S/.test(evidence ?? '')
      findings.push({ severity, claim, evidence, fix, cited })
      if (!cited) issues.push({ level: 'error', id: name, message: `${severity} finding has no file:line or artifact evidence: "${(claim ?? '').slice(0, 60)}"` })
    } else if (cells.length >= 2 && /^[1-5]$/.test(cells[1]) && cells[0] && !/^Rubric/i.test(cells[0])) {
      scores.push({ item: cells[0], score: Number(cells[1]) })
    }
  }
  if (!seat) issues.push({ level: 'error', id: name, message: 'missing "Seat:" header' })
  if (!header('Commit')) issues.push({ level: 'error', id: name, message: 'missing "Commit:" header' })
  if (!/^(SHIP|FIX|STOP)\b/.test(verdict)) issues.push({ level: 'error', id: name, message: 'Verdict must be SHIP, FIX or STOP' })
  if (scores.length === 0) issues.push({ level: 'error', id: name, message: 'no rubric scores (1 to 5)' })
  if (/^SHIP/.test(verdict) && findings.some((finding) => finding.severity === 'BLOCK')) {
    issues.push({ level: 'error', id: name, message: 'SHIP verdict with a BLOCK finding' })
  }
  return { seat, verdict, findings, scores, issues, tokens: parseTokens(header('Tokens')) }
}

/**
 * The optional "Tokens:" header on a review or decision file, written by whoever saves it from the tool's usage
 * report ("41200", "41.2K", "41,200 tokens"). Returns a number, or null when absent or "unknown".
 */
export function parseTokens(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*([kKmM]?)/)
  if (!match) return null
  const scale = { k: 1e3, m: 1e6 }[match[2].toLowerCase()] ?? 1
  return Math.round(Number(match[1]) * scale)
}
