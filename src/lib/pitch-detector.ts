import type { Note } from "@/types/music";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export async function detectPitch(
  audioData: Float32Array,
  sampleRate: number,
  onProgress?: (percent: number) => void,
): Promise<Note[]> {
  const { BasicPitch, noteFramesToTime, outputToNotesPoly, addPitchBendsToNoteEvents } =
    await import("@spotify/basic-pitch");

  const modelUrl = "/model/model.json";
  const basicPitch = new BasicPitch(modelUrl);

  let frames: number[][] = [];
  let onsets: number[][] = [];
  let contours: number[][] = [];

  const audioBuffer = floatToAudioBuffer(audioData, sampleRate);

  await basicPitch.evaluateModel(
    audioBuffer,
    (f, o, c) => {
      frames = f;
      onsets = o;
      contours = c;
    },
    (percent) => {
      onProgress?.(percent);
    },
  );

  const noteEvents = outputToNotesPoly(
    frames,
    onsets,
    0.25, // onsetThresh
    0.15, // frameThresh
    5,    // minNoteLen
    true, // inferOnsets
    null, // maxFreq
    null, // minFreq
    true, // melodiaTrick
    11,   // energyTolerance
  );

  const withBends = addPitchBendsToNoteEvents(contours, noteEvents);
  const timedNotes = noteFramesToTime(withBends);

  return timedNotes.map((n) => ({
    pitch: n.pitchMidi,
    startTime: n.startTimeSeconds,
    duration: n.durationSeconds,
    velocity: Math.round(Math.min(n.amplitude * 127, 127)),
  }));
}

function floatToAudioBuffer(data: Float32Array, sampleRate: number): AudioBuffer {
  const audioCtx = new OfflineAudioContext(1, data.length, sampleRate);
  const buffer = audioCtx.createBuffer(1, data.length, sampleRate);
  buffer.getChannelData(0).set(data);
  return buffer;
}
