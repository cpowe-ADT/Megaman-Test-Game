/**
 * Which decoded music tracks may stay in memory.
 *
 * Decoded music is raw PCM: about 384KB per second of stereo at 48kHz, so the 152s boss loop alone
 * holds about 58MB. Tracks are therefore decoded when their cue is asked for and dropped as soon as
 * nothing will play them: the track that is playing stays, the track that was asked for stays (it may
 * still be loading while the previous one plays on), everything else goes.
 */
export function musicKeysToEvict(
  residentKeys: readonly string[],
  playingKey: string | null | undefined,
  requestedKey: string | null | undefined
): string[] {
  return residentKeys.filter((key) => key !== playingKey && key !== requestedKey)
}

/** Bytes a decoded AudioBuffer holds (Float32 samples per channel). */
export function decodedAudioBytes(buffer: { length: number; numberOfChannels: number }): number {
  return buffer.length * buffer.numberOfChannels * 4
}
