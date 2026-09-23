// npm run -s gate -- test agents:check build [test:smoke] [perf:footprint]
//
// Runs npm scripts in order, writes each full log to output/gates/<script>.log and prints one result line per
// script, so a model reads three lines instead of a whole log (docs/prompts/11-token-efficiency.md). Stops at the
// first failure unless --all. Exit code is the first failing script's.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const all = args.includes('--all')
const scripts = args.filter((arg) => arg !== '--all')
if (scripts.length === 0) {
  console.error('usage: npm run -s gate -- <npm script> [<npm script> ...] [--all]')
  process.exit(2)
}
const outDir = path.resolve('output/gates')
fs.mkdirSync(outDir, { recursive: true })

// The line that says pass or fail, per script; anything else falls back to the last non-empty lines.
const resultLine = {
  test: /^# (pass|fail) \d+/,
  build: /built in|error|Error/,
  'agents:check': /agents:check:|errors?,/,
  'test:smoke': /smoke|passed|failed|PASS|FAIL/,
  'perf:footprint': /budget|PASS|FAIL/
}

let exitCode = 0
for (const script of scripts) {
  const started = Date.now()
  const run = spawnSync('npm', ['run', '-s', script], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const log = `${run.stdout ?? ''}${run.stderr ?? ''}`
  const logFile = path.join(outDir, `${script.replace(/[:/]/g, '-')}.log`)
  fs.writeFileSync(logFile, log)
  const lines = log.split('\n').map((line) => line.trim()).filter(Boolean)
  const pattern = resultLine[script]
  const picked = pattern ? lines.filter((line) => pattern.test(line)).slice(-3) : []
  const summary = (picked.length ? picked : lines.slice(-2)).join(' | ').slice(0, 300)
  const status = run.status === 0 ? 'PASS' : 'FAIL'
  console.log(`${status} ${script} (${Math.round((Date.now() - started) / 1000)}s): ${summary} (${path.relative(process.cwd(), logFile)})`)
  if (run.status !== 0) {
    exitCode ||= run.status ?? 1
    if (!all) break
  }
}
process.exit(exitCode)
