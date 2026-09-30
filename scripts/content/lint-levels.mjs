// Content lint (13h.1, prompt 06 §6.9: EVAL-P6-003's lineage over the rebuilt stage registry): the same
// rules as `content:audit`, enforcing. Exits 1 if any stage fails any rule.
// Usage: node --import ./tools/register-ts-loader.mjs scripts/content/lint-levels.mjs
import { runAllChecks } from './stageChecks.mjs'

async function main() {
  const {
    TUTORIAL_STAGE_ID,
    FINAL_STAGE_ID,
    ROBOT_MASTER_STAGE_IDS,
    getCampaignStage,
    getStageContentRetentionReport
  } = await import('../../src/content/campaign.ts')

  const stageIds = [TUTORIAL_STAGE_ID, ...ROBOT_MASTER_STAGE_IDS, FINAL_STAGE_ID]
  let failures = 0

  for (const stageId of stageIds) {
    const stage = getCampaignStage(stageId)
    const report = getStageContentRetentionReport(stageId)
    const checks = runAllChecks(stage, report)
    for (const [rule, result] of Object.entries(checks)) {
      if (result.ok) {
        console.log(`PASS ${stageId} ${rule}`)
      } else {
        failures += 1
        console.error(`FAIL ${stageId} ${rule}: ${JSON.stringify(result.offenders)}`)
      }
    }
  }

  if (failures > 0) {
    console.error(`\ncontent:lint FAIL: ${failures} rule failure(s) across ${stageIds.length} stages.`)
    process.exit(1)
  }
  console.log(`\ncontent:lint PASS: 0 rule failures across ${stageIds.length} stages.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
