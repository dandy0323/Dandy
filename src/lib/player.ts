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
  original: { type: "triangle", gain: 0.3 },
  upperHarmony: { type: "sine", gain: 0.2 },
  lowerHarmony: { type: "sine", gain: 0.2 },
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class Player {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;

  private ensureContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async play(options: PlaybackOptions): Promise<void> {
    this.stop();

    const ctx = this.ensureContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    this.isPlaying = true;
    const now = ctx.currentTime + 0.05;
    this.startTime = now;

    let maxEnd = 0;

    for (const [trackType, notes] of Object.entries(options.tracks) as [TrackType, Note[]][]) {
      if (options.mutedTracks?.has(trackType)) continue;
      if (!notes || notes.length === 0) continue;

      const config = TRACK_CONFIG[trackType];

      for (const note of notes) {
        const freq = midiToFreq(note.pitch);
        const noteStart = now + note.startTime;
        const noteEnd = noteStart + note.duration;

        const osc = ctx.createOscillator();
        osc.type = config.type;
        osc.frequency.value = freq;

        const gainNode = ctx.createGain();
        const vel = (note.velocity / 127) * config.gain;

        gainNode.gain.setValueAtTime(0, noteStart);
        gainNode.gain.linearRampToValueAtTime(vel, noteStart + 0.03);
        gainNode.gain.setValueAtTime(vel, noteEnd - 0.03);
        gainNode.gain.linearRampToValueAtTime(0, noteEnd);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteEnd + 0.01);

        if (noteEnd > maxEnd) maxEnd = noteEnd;
      }
    }

    if (options.onProgress) {
      this.progressTimer = setInterval(() => {
        if (!this.isPlaying || !this.audioContext) {
          if (this.progressTimer) clearInterval(this.progressTimer);
          return;
        }
        const elapsed = this.audioContext.currentTime - this.startTime;
        options.onProgress!(elapsed);
      }, 50);
    }

    const totalDuration = (maxEnd - now) * 1000 + 500;
    setTimeout(() => {
      if (this.isPlaying) {
        this.stop();
        options.onEnd?.();
      }
    }, totalDuration);
  }

  stop(): void {
    this.isPlaying = false;

    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  get playing(): boolean {
    return this.isPlaying;
  }
}
