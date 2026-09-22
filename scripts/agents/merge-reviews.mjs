// npm run agents:reviews -- docs/prompts/reviews/<YYYY-MM-DD>-<slice>
// Validates every seat review in the folder against docs/prompts/seats/REVIEW_FORMAT.md, writes MERGED.md
// (BLOCK, MAJOR, MINOR; AGREED when two seats cite the same file), and appends each seat's verdict and mean
// score to docs/prompts/reviews/SCORES.md. Exits 1 if any review breaks the format: an unevidenced finding
// never reaches the orchestrator as if it were real.
import fs from 'node:fs'
import path from 'node:path'
import { parseReview } from './checks.mjs'

const folder = process.argv[2]
if (!folder || !fs.existsSync(folder)) {
  console.error('usage: npm run agents:reviews -- docs/prompts/reviews/<YYYY-MM-DD>-<slice>')
  process.exit(2)
}
const files = fs.readdirSync(folder).filter((file) => file.endsWith('.md') && file !== 'MERGED.md')
const reviews = files.map((file) => ({ file, ...parseReview(fs.readFileSync(path.join(folder, file), 'utf8'), file) }))
const issues = reviews.flatMap((review) => review.issues)

const order = { BLOCK: 0, MAJOR: 1, MINOR: 2 }
const fileOf = (evidence) => (evidence.match(/[\w./-]+\.\w+/)?.[0] ?? '').toLowerCase()
const findings = reviews
  .flatMap((review) => review.findings.filter((finding) => finding.cited).map((finding) => ({ ...finding, seat: review.seat || review.file })))
  .sort((a, b) => order[a.severity] - order[b.severity])
findings.forEach((finding) => {
  const key = fileOf(finding.evidence)
  finding.agreed = Boolean(key) && findings.some((other) => other !== finding && other.seat !== finding.seat && fileOf(other.evidence) === key)
})

const slice = path.basename(folder)
const mean = (scores) => (scores.length ? (scores.reduce((sum, row) => sum + row.score, 0) / scores.length).toFixed(1) : '-')
const merged = [
  `# Merged review: ${slice}`,
  '',
  `Seats: ${reviews.map((review) => `${review.seat || review.file} (${review.verdict.split(' ')[0] || '?'}, mean ${mean(review.scores)})`).join(', ')}`,
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
  return `| ${slice} | ${review.seat || review.file} | ${review.verdict.split(' ')[0] || '?'} | ${mean(review.scores)} | ${countOf('BLOCK')} | ${countOf('MAJOR')} | ${countOf('MINOR')} | ${review.issues.length ? 'no' : 'yes'} |`
})
fs.appendFileSync(scoresFile, scoreRows.join('\n') + '\n')

console.log(`${reviews.length} reviews, ${findings.length} evidenced findings (${findings.filter((f) => f.severity === 'BLOCK').length} BLOCK), ${issues.length} format problems -> ${path.join(folder, 'MERGED.md')}`)
issues.forEach((issue) => console.log(`  ${issue.id}: ${issue.message}`))
process.exit(issues.length ? 1 : 0)
