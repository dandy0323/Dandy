import type { Note } from "@/types/music";

export type TrackType = "original" | "upperHarmony" | "lowerHarmony";

export interface PlaybackOptions {
  tracks: Partial<Record<TrackType, Note[]>>;
  mutedTracks?: Set<TrackType>;
  onProgress?: (time: number) => void;
  onEnd?: () => void;
}

const TRACK_COLORS: Record<TrackType, string> = {
  original: "#3b82f6",
  upperHarmony: "#ef4444",
  lowerHarmony: "#22c55e",
};

export function getTrackColor(track: TrackType): string {
  return TRACK_COLORS[track];
}

const TRACK_CONFIG: Record<TrackType, { type: OscillatorType; gain: number }> = {
  original: { type: "triangle", gain: 0.25 },
  upperHarmony: { type: "sine", gain: 0.18 },
  lowerHarmony: { type: "sine", gain: 0.18 },
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

export class Player {
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private isPlaying = false;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;

  async play(options: PlaybackOptions): Promise<void> {
    this.stop();

    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    this.isPlaying = true;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);
    this.gainNodes.push(masterGain);

    const now = ctx.currentTime + 0.1;
    this.startTime = now;

    let maxEnd = 0;

    for (const [trackType, notes] of Object.entries(options.tracks) as [TrackType, Note[]][]) {
      if (options.mutedTracks?.has(trackType)) continue;
      if (!notes || notes.length === 0) continue;

      const config = TRACK_CONFIG[trackType];

      for (const note of notes) {
        const freq = midiToFreq(note.pitch);
        const noteStart = now + note.startTime;
        const dur = Math.max(note.duration, 0.05);
        const noteEnd = noteStart + dur;

        const osc = ctx.createOscillator();
        osc.type = config.type;
        osc.frequency.setValueAtTime(freq, noteStart);

        const env = ctx.createGain();
        const vol = (note.velocity / 127) * config.gain;

        const attack = Math.min(0.02, dur * 0.1);
        const release = Math.min(0.02, dur * 0.1);

        env.gain.setValueAtTime(0.001, noteStart);
        env.gain.exponentialRampToValueAtTime(vol, noteStart + attack);
        env.gain.setValueAtTime(vol, noteEnd - release);
        env.gain.exponentialRampToValueAtTime(0.001, noteEnd);

        osc.connect(env);
        env.connect(masterGain);

        osc.start(noteStart);
        osc.stop(noteEnd + 0.05);

        this.oscillators.push(osc);
        this.gainNodes.push(env);

        if (noteEnd > maxEnd) maxEnd = noteEnd;
      }
    }

    if (maxEnd === 0) {
      this.isPlaying = false;
      options.onEnd?.();
      return;
    }

    if (options.onProgress) {
      this.progressTimer = setInterval(() => {
        if (!this.isPlaying) {
          if (this.progressTimer) clearInterval(this.progressTimer);
          return;
        }
        const ctx2 = getAudioContext();
        const elapsed = ctx2.currentTime - this.startTime;
        options.onProgress!(Math.max(0, elapsed));
      }, 50);
    }

    const totalMs = (maxEnd - now) * 1000 + 300;
    this.endTimer = setTimeout(() => {
      this.stop();
      options.onEnd?.();
    }, totalMs);
  }

  stop(): void {
    this.isPlaying = false;

    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }

    for (const osc of this.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // already stopped
      }
    }
    this.oscillators = [];

    for (const gain of this.gainNodes) {
      try {
        gain.disconnect();
      } catch {
        // already disconnected
      }
    }
    this.gainNodes = [];
  }

  get playing(): boolean {
    return this.isPlaying;
  }
}
