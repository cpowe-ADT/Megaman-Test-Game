// Every part of every live prompt must build a context pack: its phases found (or a section named after it),
// under the token budget. A new part whose table row or sessions sentence the pack cannot read fails here,
// not in the middle of someone's session.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { partPhases } from '../scripts/agents/checks.mjs'

const run = promisify(execFile)
const promptsDir = path.resolve('docs/prompts')
const live = fs.readdirSync(promptsDir).filter((file) => /^(0[5-9]|1\d)-.*\.md$/.test(file))

function partsOf(markdown: string, number: string): string[] {
  const parts = new Set<string>()
  for (const match of markdown.matchAll(new RegExp('`(' + number + '[a-z])`', 'g'))) parts.add(match[1])
  for (const line of markdown.split('\n')) {
    const first = line.startsWith('|') ? line.split('|')[1]?.trim() ?? '' : ''
    first.split(/[,\s]+/).filter((cell) => new RegExp('^' + number + '[a-z]$').test(cell)).forEach((cell) => parts.add(cell))
  }
  return [...parts].sort()
}

test('every part of every live prompt names its phases or has a section of its own', () => {
  for (const file of live) {
    const number = file.slice(0, 2)
    const markdown = fs.readFileSync(path.join(promptsDir, file), 'utf8')
    const parts = partsOf(markdown, number)
    assert.ok(parts.length > 0, `${file} lists no parts`)
    for (const part of parts) {
      const hasSection = markdown.split('\n').some((line) => line.startsWith('## ') && line.includes(part))
      assert.ok(partPhases(markdown, part).length > 0 || hasSection, `${file}: part ${part} has no phases and no section`)
    }
  }
})

test('every part builds a context pack under its token budget', async () => {
  const parts = live.flatMap((file) => partsOf(fs.readFileSync(path.join(promptsDir, file), 'utf8'), file.slice(0, 2)))
  const results = await Promise.all(
    parts.map((part) =>
      run(process.execPath, ['scripts/agents/context-pack.mjs', '--part', part], { encoding: 'utf8' }).then(
        ({ stdout }) => ({ part, stdout, failed: false }),
        (error: { stdout?: string; stderr?: string }) => ({ part, stdout: `${error.stdout ?? ''}${error.stderr ?? ''}`, failed: true })
      )
    )
  )
  for (const result of results) {
    assert.equal(result.failed, false, `pack for ${result.part} failed: ${result.stdout}`)
    const tokens = Number(result.stdout.match(/~(\d+) tokens \(budget (\d+)\)/)?.[1])
    assert.ok(tokens > 0 && tokens < 30000, `pack for ${result.part} is ~${tokens} tokens`)
  }
  assert.ok(results.length >= 20, `expected every part of 05 to 10, built ${results.length}`)
})
