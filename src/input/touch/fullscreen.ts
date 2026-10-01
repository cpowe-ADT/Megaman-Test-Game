/**
 * Phone full screen (final-fixes lane, 2026-10-01): a phone or tablet player tapping the "TAP TO
 * START" card also enters full screen and, where the browser allows it, locks the screen to landscape;
 * a small corner button toggles it afterwards. A desktop browser never enters full screen by itself.
 * Pure over an injected document/screen (no Phaser), so `tests/touch-fullscreen.test.ts` runs it with
 * plain fakes; `TouchOverlay` is the only caller. Every browser call here may reject or be missing
 * (iPhone Safari has no Fullscreen API and no orientation lock), and every failure is swallowed:
 * full screen is a convenience, never a gate on playing.
 */

export type FullscreenEnvironment = Readonly<{ coarsePointer: boolean; maxTouchPoints: number }>

/**
 * A phone or tablet: the primary pointer is coarse AND the device reports touch points. A touch-screen
 * laptop reports touch points but its primary pointer is fine, so it stays "desktop" and is never put
 * in full screen on a tap.
 */
export function isPhoneOrTablet(env: FullscreenEnvironment): boolean {
  return env.coarsePointer && env.maxTouchPoints > 0
}

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
/** `screen`: the DOM lib's `ScreenOrientation` has no `lock`, so it is read through a local type below. */
type OrientationScreen = { orientation?: unknown }
type LockableOrientation = { lock?: (orientation: string) => Promise<void> }

/** The document's current full-screen element, unprefixed or webkit-prefixed. */
export function fullscreenElementOf(doc: FullscreenDocument): Element | null {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function isFullscreen(doc: FullscreenDocument): boolean {
  return fullscreenElementOf(doc) !== null
}

/** True when the page can request full screen at all (false on iPhone Safari). */
export function fullscreenSupported(doc: FullscreenDocument): boolean {
  const root = doc.documentElement as FullscreenElement | undefined
  return typeof root?.requestFullscreen === 'function' || typeof root?.webkitRequestFullscreen === 'function'
}

/**
 * Requests full screen on the document element, then tries to lock the screen to landscape (Chrome on
 * Android allows the lock only while full screen). Resolves `true` when a full-screen request was
 * made and accepted; `false` when unsupported or refused. The orientation lock is best effort.
 */
export async function enterFullscreen(doc: FullscreenDocument, screenRef: OrientationScreen | undefined): Promise<boolean> {
  const root = doc.documentElement as FullscreenElement | undefined
  if (!root || isFullscreen(doc)) return isFullscreen(doc)
  try {
    if (typeof root.requestFullscreen === 'function') await root.requestFullscreen()
    else if (typeof root.webkitRequestFullscreen === 'function') await root.webkitRequestFullscreen()
    else return false
  } catch {
    return false
  }
  try {
    await (screenRef?.orientation as LockableOrientation | undefined)?.lock?.('landscape')
  } catch {
    /* iOS Safari has no lock; a desktop or a non-fullscreen page refuses it */
  }
  return true
}

export async function exitFullscreen(doc: FullscreenDocument): Promise<void> {
  try {
    if (typeof doc.exitFullscreen === 'function') await doc.exitFullscreen()
    else if (typeof doc.webkitExitFullscreen === 'function') await doc.webkitExitFullscreen()
  } catch {
    /* already out */
  }
}

/** The corner button: out when in, in when out. */
export async function toggleFullscreen(doc: FullscreenDocument, screenRef: OrientationScreen | undefined): Promise<void> {
  if (isFullscreen(doc)) await exitFullscreen(doc)
  else await enterFullscreen(doc, screenRef)
}

/**
 * The start card's tap: enters full screen only on a phone or tablet. Resolves `false` without touching
 * the browser on anything else, so a desktop browser (a mouse, or a touch-screen laptop) is never taken
 * full screen by a tap.
 */
export async function autoFullscreenOnStartTap(
  env: FullscreenEnvironment,
  doc: FullscreenDocument,
  screenRef: OrientationScreen | undefined
): Promise<boolean> {
  if (!isPhoneOrTablet(env)) return false
  return enterFullscreen(doc, screenRef)
}
