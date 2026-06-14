export interface Note {
  pitch: number; // MIDI note number (0-127)
  startTime: number; // seconds
  duration: number; // seconds
  velocity: number; // 0-127
}

export interface NoteEvent {
  note: Note;
  frequency: number; // Hz
  noteName: string; // e.g. "C4", "D#5"
}

export type HarmonyType = "upper" | "lower";

export interface HarmonyResult {
  original: Note[];
  upperHarmony: Note[];
  lowerHarmony: Note[];
  key: string;
  scale: "major" | "minor";
}

export interface RecordingState {
  isRecording: boolean;
  audioData: Float32Array | null;
  duration: number;
}

export type AppPhase = "record" | "detect" | "result";
