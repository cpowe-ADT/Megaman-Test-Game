import test from 'node:test'
import assert from 'node:assert/strict'
import {
  autoFullscreenOnStartTap,
  enterFullscreen,
  fullscreenSupported,
  isFullscreen,
  isPhoneOrTablet,
  toggleFullscreen
} from '../src/input/touch/fullscreen'

// Final fixes (2026-10-01), phone full screen. The browser is faked with plain objects: the module only
// reads `documentElement.requestFullscreen` (or the webkit name), `fullscreenElement`, `exitFullscreen`
// and `screen.orientation.lock`.

type FakeDoc = Parameters<typeof isFullscreen>[0]

function fakeDoc(options: { prefixed?: boolean; unsupported?: boolean; rejects?: boolean } = {}) {
  const calls = { request: 0, exit: 0 }
  const doc: Record<string, unknown> = { fullscreenElement: null, webkitFullscreenElement: null }
  const request = async () => {
    calls.request += 1
    if (options.rejects) throw new TypeError('not allowed')
    doc[options.prefixed ? 'webkitFullscreenElement' : 'fullscreenElement'] = doc.documentElement
  }
  const root: Record<string, unknown> = {}
  if (!options.unsupported) root[options.prefixed ? 'webkitRequestFullscreen' : 'requestFullscreen'] = request
  doc.documentElement = root
  doc[options.prefixed ? 'webkitExitFullscreen' : 'exitFullscreen'] = async () => {
    calls.exit += 1
    doc.fullscreenElement = null
    doc.webkitFullscreenElement = null
  }
  return { doc: doc as unknown as FakeDoc, calls }
}

function fakeScreen(lock?: () => Promise<void>) {
  const locks: string[] = []
  return {
    locks,
    screen: { orientation: lock === undefined ? undefined : { lock: async (kind: string) => { locks.push(kind); await lock() } } }
  }
}

test('a phone or tablet is a coarse primary pointer with touch points; a mouse, or a touch-screen laptop, is not', () => {
  assert.equal(isPhoneOrTablet({ coarsePointer: true, maxTouchPoints: 5 }), true)
  assert.equal(isPhoneOrTablet({ coarsePointer: false, maxTouchPoints: 10 }), false, 'a touch-screen laptop keeps a fine primary pointer')
  assert.equal(isPhoneOrTablet({ coarsePointer: true, maxTouchPoints: 0 }), false)
  assert.equal(isPhoneOrTablet({ coarsePointer: false, maxTouchPoints: 0 }), false, 'a desktop mouse')
})

test('the start card tap enters full screen and locks landscape on a phone', async () => {
  const { doc, calls } = fakeDoc()
  const { screen, locks } = fakeScreen(async () => {})
  assert.equal(await autoFullscreenOnStartTap({ coarsePointer: true, maxTouchPoints: 5 }, doc, screen), true)
  assert.equal(calls.request, 1)
  assert.deepEqual(locks, ['landscape'])
  assert.equal(isFullscreen(doc), true)
})

test('a desktop browser never auto-enters full screen: the browser is not even asked', async () => {
  const { doc, calls } = fakeDoc()
  const { screen, locks } = fakeScreen(async () => {})
  assert.equal(await autoFullscreenOnStartTap({ coarsePointer: false, maxTouchPoints: 0 }, doc, screen), false)
  assert.equal(await autoFullscreenOnStartTap({ coarsePointer: false, maxTouchPoints: 10 }, doc, screen), false)
  assert.equal(calls.request, 0)
  assert.deepEqual(locks, [])
})

test('iOS Safari: the webkit-prefixed request is used and a missing orientation lock is ignored', async () => {
  const { doc, calls } = fakeDoc({ prefixed: true })
  assert.equal(fullscreenSupported(doc), true)
  assert.equal(await enterFullscreen(doc, { orientation: undefined }), true)
  assert.equal(calls.request, 1)
  assert.equal(isFullscreen(doc), true)
})

test('failure is ignored: a refused request, a rejected lock and a browser with no full screen all resolve without throwing', async () => {
  const refused = fakeDoc({ rejects: true })
  assert.equal(await enterFullscreen(refused.doc, undefined), false)
  const noLock = fakeDoc()
  const { screen } = fakeScreen(async () => { throw new Error('NotSupportedError') })
  assert.equal(await enterFullscreen(noLock.doc, screen), true, 'a rejected lock does not undo full screen')
  const none = fakeDoc({ unsupported: true })
  assert.equal(fullscreenSupported(none.doc), false)
  assert.equal(await enterFullscreen(none.doc, undefined), false)
  assert.equal(none.calls.request, 0)
})

test('the corner toggle enters when out and exits when in', async () => {
  const { doc, calls } = fakeDoc()
  await toggleFullscreen(doc, undefined)
  assert.equal(isFullscreen(doc), true)
  await toggleFullscreen(doc, undefined)
  assert.equal(isFullscreen(doc), false)
  assert.deepEqual(calls, { request: 1, exit: 1 })
})
