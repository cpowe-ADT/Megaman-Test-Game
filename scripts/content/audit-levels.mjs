// Content audit (13h.1, prompt 06 §6.9: EVAL-P6-002, the rest of EVAL-P13-002's family): a report-only
// table over the compiled campaign stages (`getCampaignStage`), plus every `content:lint` rule's
// findings. Never fails the run (a genuine script crash still exits 1; content findings never do).
// Usage: node --import ./tools/register-ts-loader.mjs scripts/content/audit-levels.mjs
import fs from 'node:fs'
import path from 'node:path'
import { runAllChecks, summarizeStage } from './stageChecks.mjs'

async function main() {
  const {
    TUTORIAL_STAGE_ID,
    FINAL_STAGE_ID,
    ROBOT_MASTER_STAGE_IDS,
    getCampaignStage,
    getStageContentRetentionReport
  } = await import('../../src/content/campaign.ts')

  const stageIds = [TUTORIAL_STAGE_ID, ...ROBOT_MASTER_STAGE_IDS, FINAL_STAGE_ID]

  const rows = stageIds.map((stageId) => {
    const stage = getCampaignStage(stageId)
    const report = getStageContentRetentionReport(stageId)
    const summary = summarizeStage(stage, report)
    const checks = runAllChecks(stage, report)
    const failing = Object.entries(checks)
      .filter(([, result]) => !result.ok)
      .map(([rule]) => rule)
    return { summary, checks, failing }
  })

  const header =
    '| Stage | Screens | Secrets | Checkpoints | Mechanics | Enemies | Rules failing |\n| --- | --- | --- | --- | --- | --- | --- |'
  const body = rows
    .map(
      ({ summary, failing }) =>
        `| ${summary.stageId} | ${summary.screens} | ${summary.secrets} | ${summary.checkpoints} | ${summary.mechanicsCount} (${summary.mechanicsTypes.join(', ') || 'none'}) | ${summary.enemies} | ${failing.length > 0 ? failing.join(', ') : 'none'} |`
    )
    .join('\n')
  const table = `${header}\n${body}`

  const findingLines = rows.flatMap(({ summary, checks }) =>
    Object.entries(checks)
      .filter(([, result]) => !result.ok)
      .map(([rule, result]) => `- ${summary.stageId} / ${rule}: ${JSON.stringify(result.offenders)}`)
  )

  const report = [
    '# Content audit (report-only, 13h.1)',
    '',
    `Generated ${new Date().toISOString()} over ${rows.length} campaign stages (\`getCampaignStage\`). \`npm run content:lint\` runs the same rules and fails the build on them; this report never does.`,
    '',
    table,
    '',
    '## Findings',
    findingLines.length > 0 ? findingLines.join('\n') : '- none',
    ''
  ].join('\n')

  const outPath = path.resolve('output/content/audit.md')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, report)

  console.log(table)
  console.log(`\n${findingLines.length} finding(s) across ${rows.length} stages (report-only). Wrote ${outPath}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
