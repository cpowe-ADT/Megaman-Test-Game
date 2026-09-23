// Which code a run measured: the commit, and how many runtime paths were uncommitted at the time.
// Written into every smoke, sweep and footprint summary so a ledger row cannot cite a run for a commit
// it did not test.
import { execFileSync } from 'node:child_process'

export function provenance(paths = ['src', 'scripts', 'tests', 'assets', 'index.html', 'package.json', 'vite.config.ts']) {
  try {
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
    const dirty = execFileSync('git', ['status', '--porcelain', '--', ...paths], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean).length
    return { commit, dirty }
  } catch {
    return { commit: null, dirty: null }
  }
}
