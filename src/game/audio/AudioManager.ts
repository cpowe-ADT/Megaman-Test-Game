interface AudioManifestItem {
  id: string;
  url: string;
  loop?: boolean;
  volume?: number;
}

export type AudioManifest = AudioManifestItem[];

type PlayingEntry = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  loop: boolean;
};

export class AudioManager {
  private ctx?: AudioContext;
  private masterGain?: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private playing = new Map<string, PlayingEntry>();
  private masterVolume = 1;

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
  }

  async load(manifest: AudioManifest): Promise<void> {
    this.ensureContext();
    if (!this.ctx) return;
    const promises = manifest.map(async (item) => {
      const res = await fetch(item.url);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = await this.ctx!.decodeAudioData(arrayBuffer);
      this.buffers.set(item.id, buffer);
    });
    await Promise.all(promises);
  }

  play(id: string, opts?: { volume?: number; loop?: boolean; detune?: number }) {
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;
    const buffer = this.buffers.get(id);
    if (!buffer) return;

    const existing = this.playing.get(id);
    if (existing) {
      existing.source.stop();
      this.playing.delete(id);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    if (opts?.detune) source.detune.value = opts.detune;

    const gain = this.ctx.createGain();
    gain.gain.value = (opts?.volume ?? 1) * this.masterVolume;

    source.connect(gain);
    gain.connect(this.masterGain);
    source.loop = opts?.loop ?? false;
    source.start();

    this.playing.set(id, { source, gain, loop: source.loop });
  }

  stop(id: string) {
    const entry = this.playing.get(id);
    if (!entry) return;
    entry.source.stop();
    this.playing.delete(id);
  }

  setMaster(volume: number) {
    this.masterVolume = volume;
    for (const entry of this.playing.values()) {
      entry.gain.gain.value = volume;
    }
  }
}

export function sfx(audio: AudioManager, id: string, options?: { vol?: number; detune?: number }) {
  audio.play(id, { volume: options?.vol, detune: options?.detune });
}

export function music(audio: AudioManager, id: string, transition: 'immediate' | 'crossfade' = 'immediate') {
  if (transition === 'immediate') {
    audio.stop('music');
    audio.play(id, { loop: true, volume: 0.8 });
  } else {
    audio.play(id, { loop: true, volume: 0.8 });
  }
}
