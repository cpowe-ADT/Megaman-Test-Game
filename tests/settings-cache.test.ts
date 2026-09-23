import test from 'node:test'
import assert from 'node:assert/strict'
import { SettingsStore } from '../src/systems/Settings'

function countingStorage(initial: string | null) {
  let raw = initial
  let parses = 0
  const originalParse = JSON.parse
  return {
    storage: {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value
      }
    },
    write: (value: string) => {
      raw = value
    },
    countParses<T>(fn: () => T): T {
      JSON.parse = ((text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown) => {
        parses += 1
        return originalParse(text, reviver)
      }) as typeof JSON.parse
      try {
        return fn()
      } finally {
        JSON.parse = originalParse
      }
    },
    parses: () => parses
  }
}

test('settings are parsed once per stored string, not on every read', () => {
  const fake = countingStorage(JSON.stringify({ musicVolume: 3 }))
  const store = new SettingsStore(fake.storage)
  const reads = fake.countParses(() => Array.from({ length: 50 }, () => store.get()))
  assert.equal(fake.parses(), 1, 'fifty reads of an unchanged value parse once')
  assert.equal(reads[49].musicVolume, 3)
  assert.equal(reads[0], reads[49], 'the same validated object is served')
})

test('an outside write to storage is still picked up (smoke fixtures write settings.v1 directly)', () => {
  const fake = countingStorage(JSON.stringify({ storyReplay: false }))
  const store = new SettingsStore(fake.storage)
  assert.equal(store.get().storyReplay, false)
  fake.write(JSON.stringify({ storyReplay: true }))
  assert.equal(store.get().storyReplay, true)
})

test('update writes through and the next read does not parse again', () => {
  const fake = countingStorage(null)
  const store = new SettingsStore(fake.storage)
  store.update({ sfxVolume: 2 })
  const value = fake.countParses(() => store.get())
  assert.equal(value.sfxVolume, 2)
  assert.equal(fake.parses(), 0)
})
