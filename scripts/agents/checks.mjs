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

export const STATUS_PATTERN = /^(PASS|FAIL|PENDING|SKIPPED \(.+\))/

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
      if (row.evidence.trim().length < 20) issues.push({ level, id: row.id, message: 'PASS with no evidence (command, result line, artifact)' })
    }
  }
  return issues
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
export function checkEntry(target, { chain, handoffs, rows }) {
  const rule = chain[String(target)]
  if (!rule) return [{ level: 'error', id: `entry ${target}`, message: 'no chain rule for this prompt in tests/agent-budget.json' }]
  const issues = []
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

/** Decisions log rows: `| D-001 | raised | question | recommendation | OPEN or DECIDED | Craig's reply | date |`. */
export function checkDecisions(markdown) {
  const issues = []
  const ids = new Set()
  for (const line of markdown.split('\n')) {
    const cells = splitRow(line)
    if (!cells || !/^D-\d{3}$/.test(cells[0])) continue
    const [id, , question, recommendation, status, reply] = cells
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
  for (const line of markdown.split('\n')) {
    const cells = splitRow(line)
    if (!cells) continue
    if (/^(BLOCK|MAJOR|MINOR)$/.test(cells[0])) {
      const [severity, claim, evidence, fix] = cells
      const cited = /[\w./-]+\.\w+:\d+|output\/\S+\.(png|json|log|md)|`[^`]+`/.test(evidence ?? '')
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
  return { seat, verdict, findings, scores, issues }
}
