import type { Note } from "@/types/music";

let toneModule: typeof import("tone") | null = null;

async function getTone() {
  if (!toneModule) {
    toneModule = await import("tone");
  }
  return toneModule;
}

export type TrackType = "original" | "upperHarmony" | "lowerHarmony";

export interface PlaybackOptions {
  tracks: Partial<Record<TrackType, Note[]>>;
  mutedTracks?: Set<TrackType>;
  bpm?: number;
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

const TRACK_SYNTH_CONFIG: Record<TrackType, { type: OscillatorType; volume: number }> = {
  original: { type: "triangle", volume: -6 },
  upperHarmony: { type: "sine", volume: -10 },
  lowerHarmony: { type: "sine", volume: -10 },
};

export class Player {
  private synths: Map<TrackType, InstanceType<typeof import("tone").PolySynth>> = new Map();
  private isPlaying = false;
  private scheduledEvents: number[] = [];

  async play(options: PlaybackOptions): Promise<void> {
    const Tone = await getTone();
    await Tone.start();

    this.stop();
    this.isPlaying = true;

    const transport = Tone.getTransport();
    transport.cancel();
    transport.bpm.value = options.bpm ?? 120;
    transport.position = 0;

    for (const [trackType, notes] of Object.entries(options.tracks) as [TrackType, Note[]][]) {
      if (options.mutedTracks?.has(trackType)) continue;
      if (!notes || notes.length === 0) continue;

      const config = TRACK_SYNTH_CONFIG[trackType];
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: config.type },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.3 },
        volume: config.volume,
      }).toDestination();

      this.synths.set(trackType, synth);

      for (const note of notes) {
        const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
        const id = transport.schedule((time) => {
          synth.triggerAttackRelease(freq, note.duration, time, note.velocity / 127);
        }, note.startTime);
        this.scheduledEvents.push(id);
      }
    }

    const allNotes = Object.values(options.tracks).flat().filter(Boolean) as Note[];
    if (allNotes.length > 0) {
      const maxEnd = Math.max(...allNotes.map((n) => n.startTime + n.duration));

      const endId = transport.schedule(() => {
        this.stop();
        options.onEnd?.();
      }, maxEnd + 0.5);
      this.scheduledEvents.push(endId);
    }

    if (options.onProgress) {
      const progressInterval = setInterval(() => {
        if (!this.isPlaying) {
          clearInterval(progressInterval);
          return;
        }
        const seconds = transport.seconds;
        options.onProgress!(seconds);
      }, 50);
    }

    transport.start();
  }

  async stop(): Promise<void> {
    const Tone = await getTone();
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();

    for (const synth of this.synths.values()) {
      synth.dispose();
    }
    this.synths.clear();
    this.scheduledEvents = [];
    this.isPlaying = false;
  }

  get playing(): boolean {
    return this.isPlaying;
  }
}
