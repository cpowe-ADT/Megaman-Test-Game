import test from 'node:test'
import assert from 'node:assert/strict'
// Bare directory specifier, no /index.ts suffix: proves tools/ts-node-loader.mjs falls back to
// `<specifier>/index.ts` when `<specifier>.ts` does not exist (fixture at tests/fixtures/dir-import/).
import { DIR_IMPORT_FIXTURE_VALUE } from './fixtures/dir-import'

test('loader resolves a directory import to its index.ts', () => {
  assert.equal(DIR_IMPORT_FIXTURE_VALUE, 'dir-import-ok')
})
