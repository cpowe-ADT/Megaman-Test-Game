// Evals of the agent system itself: one failing fixture (and one passing case) per rule in
// scripts/agents/checks.mjs, so a check that silently stops catching things fails here first.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkCodeBudget,
  checkDecisions,
  checkDocBudgets,
  checkEntry,
  checkHandoff,
  checkLedger,
  handoffStatus,
  missingDocPaths,
  openBlockers,
  parseDecisionFile,
  parseLedger,
  parseReview,
  parseTokens,
  partPhases,
  tallyDecisions
} from '../scripts/agents/checks.mjs'

const ledger = (rows: string[]) => `## Prompt 05\n\n| Id | Kind | What passes | Status | Evidence | Commit |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`
const known = (sha: string) => sha === 'abc1234'
const errors = (issues: Array<{ level: string }>) => issues.filter((issue) => issue.level === 'error')

test('ledger: a valid PASS row with a known commit passes, and lowercase suffix ids parse', () => {
  const rows = parseLedger(ledger(['| EVAL-P5-001 | gate | x | PASS | `npm run test` -> # pass 268 (output/x.log) | `abc1234` |', '| EVAL-P5-003a | gate | x | PENDING | | |']))
  assert.equal(rows.length, 2)
  assert.deepEqual(errors(checkLedger(rows, { commitExists: known })), [])
})

test('ledger: an unknown status word fails', () => {
  const rows = parseLedger(ledger(['| EVAL-P5-001 | gate | x | DONE | evidence long enough to count | `abc1234` |']))
  assert.match(errors(checkLedger(rows, { commitExists: known }))[0].message, /not PASS, FAIL, PENDING or SKIPPED/)
})

test('ledger: PASS without a commit, with an unknown commit, or without evidence fails', () => {
  const rows = parseLedger(
    ledger([
      '| EVAL-P5-001 | gate | x | PASS | evidence long enough to count | uncommitted |',
      '| EVAL-P5-002 | gate | x | PASS | evidence long enough to count | `def5678` |',
      '| EVAL-P5-003 | gate | x | PASS | short | `abc1234` |'
    ])
  )
  const messages = errors(checkLedger(rows, { commitExists: known })).map((issue: { message: string }) => issue.message)
  assert.ok(messages.some((message: string) => /without a commit hash/.test(message)))
  assert.ok(messages.some((message: string) => /git does not know/.test(message)))
  assert.ok(messages.some((message: string) => /evidence needs an artifact path/.test(message)))
})

test('ledger: status words are anchored (PASSABLE is not PASS) and evidence without an artifact fails', () => {
  const rows = parseLedger(
    ledger([
      '| EVAL-P5-001 | gate | x | PASSABLE maybe | `npm run test` -> ok (output/x.log) | `abc1234` |',
      '| EVAL-P5-002 | gate | x | PASS | trust me, it passed nicely | `abc1234` |'
    ])
  )
  const messages = errors(checkLedger(rows, { commitExists: known })).map((issue: { message: string }) => issue.message)
  assert.ok(messages.some((message: string) => /not PASS, FAIL, PENDING or SKIPPED/.test(message)))
  assert.ok(messages.some((message: string) => /evidence needs an artifact path/.test(message)))
})

test('ledger: duplicate ids fail; rows before prompt 05 only warn', () => {
  const duplicate = parseLedger(ledger(['| EVAL-P5-001 | gate | x | PENDING | | |', '| EVAL-P5-001 | gate | x | PENDING | | |']))
  assert.match(errors(checkLedger(duplicate, { commitExists: known }))[0].message, /duplicate/)
  const legacy = parseLedger(ledger(['| EVAL-P1-001 | gate | x | PASS | evidence long enough to count | 1.4 commit |']))
  const issues = checkLedger(legacy, { commitExists: known })
  assert.equal(errors(issues).length, 0)
  assert.ok(issues.length >= 1 && issues.every((issue: { level: string }) => issue.level === 'warn'), 'legacy rows warn, never fail')
})

const handoff = (status: string, omit?: string) =>
  ['# Handoff', `## Status: ${status}`, '## Branch and final commit', '## What changed', '## Decisions made', '## Content inventory', '## Evidence', '## Open risks and known debt', '## Inputs for prompt 06']
    .filter((line) => !omit || !line.includes(omit))
    .join('\n\n')

test('handoff: all sections in order with a real status pass', () => {
  assert.deepEqual(checkHandoff(handoff('COMPLETE'), 'h'), [])
  assert.equal(handoffStatus(handoff('COMPLETE')), 'COMPLETE')
})

test('handoff: the template placeholder, a missing section, or an unknown status fails', () => {
  assert.match(checkHandoff(handoff('PARTIAL (list what is missing and why)'), 'h')[0].message, /placeholder/)
  assert.equal(handoffStatus(handoff('PARTIAL (list what is missing and why)')), 'PLACEHOLDER')
  assert.match(checkHandoff(handoff('COMPLETE', 'Evidence'), 'h')[0].message, /Evidence/)
  assert.match(checkHandoff(handoff('DONE'), 'h')[0].message, /COMPLETE or PARTIAL/)
})

test('entry: prompt chaining blocks a prompt whose previous handoff or evals are not done', () => {
  const chain = { '6': { handoffs: ['05-feel'], evals: ['P5'] } }
  const rows = parseLedger(ledger(['| EVAL-P5-001 | gate | x | PASS | e | `abc1234` |', '| EVAL-P5-002 | gate | x | PENDING | | |']))
  const blocked = checkEntry(6, { chain, handoffs: { '05-feel': 'PLACEHOLDER' }, rows })
  assert.ok(blocked.some((issue: { message: string }) => /PLACEHOLDER, not COMPLETE/.test(issue.message)))
  assert.ok(blocked.some((issue: { message: string }) => /EVAL-P5-002 is PENDING/.test(issue.message)))
  const passRows = parseLedger(ledger(['| EVAL-P5-001 | gate | x | PASS | e | `abc1234` |', '| EVAL-P5-002 | gate | x | SKIPPED (Craig accepted) | | |']))
  assert.deepEqual(checkEntry(6, { chain, handoffs: { '05-feel': 'COMPLETE' }, rows: passRows }), [])
  assert.match(checkEntry(11, { chain, handoffs: {}, rows })[0].message, /no chain rule/)
})

test('code budget: Game.ts over its ceiling or a new @ts-nocheck file fails', () => {
  const budget = { gameTsMaxLines: 3639, tsNocheckAllowed: ['src/scenes/Game.ts'] }
  assert.deepEqual(checkCodeBudget({ gameTsLines: 3639, tsNocheckFiles: ['src/scenes/Game.ts'] }, budget), [])
  assert.match(checkCodeBudget({ gameTsLines: 3640, tsNocheckFiles: [] }, budget)[0].message, /ceiling 3639/)
  assert.match(checkCodeBudget({ gameTsLines: 10, tsNocheckFiles: ['src/new.ts'] }, budget)[0].message, /@ts-nocheck/)
})

test('doc budgets: an always-read file over its bytes or lines, or missing, fails', () => {
  const budgets = { 'AGENTS.md': { maxLines: 150, maxBytes: 12000 } }
  assert.deepEqual(checkDocBudgets({ 'AGENTS.md': { bytes: 9000, lines: 90 } }, budgets), [])
  assert.match(checkDocBudgets({ 'AGENTS.md': { bytes: 13000, lines: 90 } }, budgets)[0].message, /budget 12000/)
  assert.match(checkDocBudgets({ 'AGENTS.md': { bytes: 100, lines: 151 } }, budgets)[0].message, /budget 150/)
  assert.match(checkDocBudgets({}, budgets)[0].message, /missing/)
})

test('doc paths: a named repo path that does not exist is reported; placeholders and planned lines are not', () => {
  const exists = (file: string) => file === 'src/main.ts'
  const doc = [
    'Read `src/main.ts:12` and `src/gone.ts`.',
    'Pattern `docs/prompts/<NN>-name.md` and glob `.claude/agents/game-*.md` are skipped.',
    'Evidence (planned): `scripts/agents/snapshot-evidence.mjs`.',
    'Bare names like `START.md` are relative mentions.'
  ].join('\n')
  assert.deepEqual(missingDocPaths(doc, exists), ['src/gone.ts'])
})

test('decisions: a row needs a question, a recommendation, OPEN or DECIDED, and a reply when DECIDED', () => {
  const head = '| Id | Raised | Question | Recommendation | Panel | Blocks | Status | Reply | Date |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n'
  assert.deepEqual(checkDecisions(head + '| D-001 | STOP 5.2 | Ship? | Yes | qa-eval | | OPEN | | |'), [])
  assert.deepEqual(checkDecisions(head + '| D-001 | STOP 5.2 | Ship? | Yes | qa-eval | entry 6 | DECIDED | "yes ship it" | 2026-09-23 |'), [])
  assert.match(checkDecisions(head + '| D-001 | STOP 5.2 | Ship? | | qa-eval | | OPEN | | |')[0].message, /recommendation/)
  assert.match(checkDecisions(head + '| D-001 | STOP 5.2 | Ship? | Yes | qa-eval | | MAYBE | | |')[0].message, /OPEN or DECIDED/)
  assert.match(checkDecisions(head + '| D-001 | STOP 5.2 | Ship? | Yes | qa-eval | | DECIDED | | |')[0].message, /reply/)
  assert.match(checkDecisions(head)[0].message, /no decision rows/)
})

test('human checkpoints: an OPEN decision that blocks entry N stops prompt N; answering it clears the block', () => {
  const head = '| Id | Raised | Question | Recommendation | Panel | Blocks | Status | Reply | Date |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n'
  const open = head + '| D-001 | STOP 1.2 | Approve the title? | Approve | qa-eval | entry 5 | OPEN | | |'
  assert.deepEqual(openBlockers(open, 5).map((row: { id: string }) => row.id), ['D-001'])
  assert.deepEqual(openBlockers(open, 15), [], 'entry 5 does not block entry 15')
  const chain = { '5': { handoffs: [], evals: [] } }
  assert.match(checkEntry(5, { chain, handoffs: {}, rows: [], decisions: open })[0].message, /D-001 is OPEN and blocks entry 5/)
  const decided = head + '| D-001 | STOP 1.2 | Approve the title? | Approve | qa-eval | entry 5 | DECIDED | "approved" | 2026-09-23 |'
  assert.deepEqual(checkEntry(5, { chain, handoffs: {}, rows: [], decisions: decided }), [])
})

test('context packs: every part finds its phases from the sessions sentence and the table', () => {
  const prompt = [
    'Sessions: `06a` (6.1), `06e` and `06f` (6.6 batches), `06h` (6.8 and 6.9), `09a` (9.0 to 9.2).',
    '| Part | Phase |',
    '| --- | --- |',
    '| 06e, 06f | 6.6 Seven wardens |',
    '| 06h | 6.8 Difficulty; 6.9 Automation |',
    '| 06a | 6.1 Level format |'
  ].join('\n')
  assert.deepEqual(partPhases(prompt, '06f'), ['6.6'])
  assert.deepEqual(partPhases(prompt, '06h'), ['6.8', '6.9'])
  assert.deepEqual(partPhases(prompt, '09a'), ['9.0', '9.1', '9.2'])
  assert.deepEqual(partPhases(prompt, '06z'), [])
})

const review = (verdict: string, findingEvidence: string, severity = 'MAJOR') => `Seat: qa-eval
Commit: abc1234
Scope: the 05a motor slice
Artifacts opened: output/web-game-smoke/13d-movement-feel/shot-0.png

| Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- |
| ${severity} | Dash-jump loses speed after the lockout | ${findingEvidence} | clear drag in the motor |

| Rubric | Score |
| --- | --- |
| Each ledger claim has command, result line, artifact and commit | 4 |

Verdict: ${verdict}
`

test('reviews: an evidenced review parses with its scores and verdict', () => {
  const parsed = parseReview(review('FIX two MAJORs', '`src/player/PlayerMotor.ts:88`'))
  assert.deepEqual(parsed.issues, [])
  assert.equal(parsed.seat, 'qa-eval')
  assert.equal(parsed.findings[0].cited, true)
  assert.deepEqual(parsed.scores, [{ item: 'Each ledger claim has command, result line, artifact and commit', score: 4 }])
})

test('reviews: a finding without evidence, a SHIP with a BLOCK, or a missing verdict is rejected', () => {
  assert.match(parseReview(review('FIX', 'it feels slow')).issues[0].message, /no file:line or artifact evidence/)
  assert.match(parseReview(review('FIX', '`trust me`')).issues[0].message, /no file:line or artifact evidence/, 'backticks alone are not evidence')
  assert.ok(parseReview(review('FIX', '`npm run test` -> # fail 2')).issues.length === 0, 'a command with its result is evidence')
  const bold = parseReview(review('SHIP', '`src/a.ts:1`', '**BLOCK**'))
  assert.equal(bold.findings[0].severity, 'BLOCK', 'emphasis does not hide a severity')
  assert.ok(bold.issues.some((issue: { message: string }) => /SHIP verdict with a BLOCK/.test(issue.message)))
  assert.ok(parseReview(review('FIX', '`src/a.ts:1`', 'CRITICAL')).issues.some((issue: { message: string }) => /unknown severity/.test(issue.message)))
  assert.ok(parseReview(review('SHIP', '`src/a.ts:1`', 'BLOCK')).issues.some((issue: { message: string }) => /SHIP verdict with a BLOCK/.test(issue.message)))
  assert.ok(parseReview(review('maybe', '`src/a.ts:1`')).issues.some((issue: { message: string }) => /Verdict must be/.test(issue.message)))
})

test('decision panels: a REJECT keeps a decision OPEN; a later round replaces only the decisions it covers', () => {
  const file = (seat: string, round: number, rows: string[]) =>
    parseDecisionFile(`Seat: ${seat}\nRound: ${round}\nCommit: abc1234\n\n| Decision | Verdict | Reason | Evidence | Conditions |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`, `${seat}-${round}`)
  const first = file('game-director', 1, ['| D-001 | REJECT | text overflows | `shot.png` | wrap it |', '| D-004 | APPROVE | same | `a.png` | none |'])
  const other = file('qa-eval', 1, ['| D-001 | APPROVE WITH CONDITIONS | ok | `b.json` | note |'])
  assert.equal(tallyDecisions([first, other]).find((entry: { id: string }) => entry.id === 'D-001').result, 'OPEN')
  const second = file('game-director', 2, ['| D-001 | APPROVE | fixed | `shot2.png` | none |'])
  const tally = tallyDecisions([second, first, other])
  assert.equal(tally.find((entry: { id: string }) => entry.id === 'D-001').result, 'DECIDED', 'round 2 replaces round 1 for D-001')
  assert.equal(tally.find((entry: { id: string }) => entry.id === 'D-004').result, 'DECIDED', 'round 1 still stands for D-004')
  assert.match(parseDecisionFile('Seat: x\n\n| D-009 | MAYBE | r | `a.md` | none |').issues[0].message, /not APPROVE/)
  assert.match(parseDecisionFile('Seat: x\n\n| D-009 | APPROVE | r | trust me | none |').issues[0].message, /without file or artifact evidence/)
})

test('parseTokens reads the Tokens header written from the tool usage report', () => {
  assert.equal(parseTokens('41200'), 41200)
  assert.equal(parseTokens('41.2K'), 41200)
  assert.equal(parseTokens('1,120,000 tokens'), 1120000)
  assert.equal(parseTokens('unknown'), null)
  assert.equal(parseTokens(undefined), null)
  assert.equal(parseReview(review('FIX', '`src/player/PlayerMotor.ts:88`').replace('Scope:', 'Tokens: 52K\nScope:')).tokens, 52000)
  assert.equal(parseReview(review('FIX', '`src/player/PlayerMotor.ts:88`')).tokens, null, 'absent header is null, not zero')
})
