// npm run agents:reviews -- docs/prompts/reviews/<YYYY-MM-DD>-<slice>
// Validates every seat review in the folder against docs/prompts/seats/REVIEW_FORMAT.md, writes MERGED.md
// (BLOCK, MAJOR, MINOR; AGREED when two seats cite the same file), and appends each seat's verdict and mean
// score to docs/prompts/reviews/SCORES.md. Exits 1 if any review breaks the format: an unevidenced finding
// never reaches the orchestrator as if it were real.
import fs from 'node:fs'
import path from 'node:path'
import { parseReview } from './checks.mjs'

const folder = process.argv[2]
const expectIndex = process.argv.indexOf('--expect')
const expected = expectIndex > -1 ? process.argv[expectIndex + 1].split(',').filter(Boolean) : []
if (!folder || !fs.existsSync(folder)) {
  console.error('usage: npm run agents:reviews -- docs/prompts/reviews/<YYYY-MM-DD>-<slice> [--expect seat,seat]')
  process.exit(2)
}
const files = fs.readdirSync(folder).filter((file) => file.endsWith('.md') && file !== 'MERGED.md')
const reviews = files.map((file) => ({ file, ...parseReview(fs.readFileSync(path.join(folder, file), 'utf8'), file) }))
const issues = reviews.flatMap((review) => review.issues)
// A seat that failed or never answered must not look like a clean review.
if (files.length === 0) issues.push({ id: folder, message: 'no reviews in the folder' })
expected
  .filter((seat) => !files.includes(`${seat}.md`) || fs.statSync(path.join(folder, `${seat}.md`)).size === 0)
  .forEach((seat) => issues.push({ id: seat, message: 'expected seat review is missing or empty' }))

const order = { BLOCK: 0, MAJOR: 1, MINOR: 2 }
const locationOf = (evidence) => {
  const match = evidence.match(/([\w./-]+\.\w+)(?::(\d+))?/)
  return match ? { file: match[1].toLowerCase(), line: match[2] ? Number(match[2]) : null } : null
}
// Two seats agree when they cite the same file within ten lines (or the same file with no line on either side).
const sameSpot = (a, b) =>
  a && b && a.file === b.file && (a.line === null || b.line === null ? a.line === b.line : Math.abs(a.line - b.line) <= 10)
const findings = reviews
  .flatMap((review) => review.findings.filter((finding) => finding.cited).map((finding) => ({ ...finding, seat: review.seat || review.file })))
  .sort((a, b) => order[a.severity] - order[b.severity])
findings.forEach((finding) => {
  const here = locationOf(finding.evidence)
  finding.agreed = findings.some((other) => other !== finding && other.seat !== finding.seat && sameSpot(here, locationOf(other.evidence)))
})

const slice = path.basename(folder)
const verdictWord = (verdict) => verdict.match(/^(SHIP|FIX|STOP)/)?.[1] ?? '?'
const mean = (scores) => (scores.length ? (scores.reduce((sum, row) => sum + row.score, 0) / scores.length).toFixed(1) : '-')
const merged = [
  `# Merged review: ${slice}`,
  '',
  `Seats: ${reviews.map((review) => `${review.seat || review.file} (${verdictWord(review.verdict)}, mean ${mean(review.scores)})`).join(', ')}`,
  '',
  '| Severity | Seat | Finding | Evidence | Fix | Agreed |',
  '| --- | --- | --- | --- | --- | --- |',
  ...findings.map((f) => `| ${f.severity} | ${f.seat} | ${f.claim} | ${f.evidence} | ${f.fix ?? ''} | ${f.agreed ? 'AGREED' : ''} |`),
  '',
  issues.length ? `Rejected (format): ${issues.map((issue) => `${issue.id}: ${issue.message}`).join('; ')}` : 'All reviews valid.'
].join('\n')
fs.writeFileSync(path.join(folder, 'MERGED.md'), merged + '\n')

const scoresFile = path.join('docs/prompts/reviews/SCORES.md')
if (!fs.existsSync(scoresFile)) {
  fs.writeFileSync(scoresFile, '# Seat scores\n\nOne row per seat review, appended by `npm run agents:reviews`. Mean is the mean rubric score (1 to 5).\n\n| Date and slice | Seat | Verdict | Mean | BLOCK | MAJOR | MINOR | Valid |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n')
}
const scoreRows = reviews.map((review) => {
  const countOf = (severity) => review.findings.filter((finding) => finding.severity === severity).length
  return `| ${slice} | ${review.seat || review.file} | ${verdictWord(review.verdict)} | ${mean(review.scores)} | ${countOf('BLOCK')} | ${countOf('MAJOR')} | ${countOf('MINOR')} | ${review.issues.length ? 'no' : 'yes'} |`
})
// Re-running the merge for a slice replaces its rows instead of appending duplicates.
const kept = fs.readFileSync(scoresFile, 'utf8').split('\n').filter((line) => !line.startsWith(`| ${slice} |`))
fs.writeFileSync(scoresFile, kept.join('\n').replace(/\n*$/, '\n') + scoreRows.join('\n') + '\n')

console.log(`${reviews.length} reviews, ${findings.length} evidenced findings (${findings.filter((f) => f.severity === 'BLOCK').length} BLOCK), ${issues.length} format problems -> ${path.join(folder, 'MERGED.md')}`)
issues.forEach((issue) => console.log(`  ${issue.id}: ${issue.message}`))
process.exit(issues.length ? 1 : 0)
