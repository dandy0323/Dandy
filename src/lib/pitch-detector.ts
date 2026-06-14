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

  const allFrames: number[][] = [];
  const allOnsets: number[][] = [];
  const allContours: number[][] = [];

  const resampled = resampleTo22050(audioData, sampleRate);

  await basicPitch.evaluateModel(
    resampled,
    (f, o, c) => {
      allFrames.push(...f);
      allOnsets.push(...o);
      allContours.push(...c);
    },
    (percent) => {
      onProgress?.(percent);
    },
  );

  const noteEvents = outputToNotesPoly(
    allFrames,
    allOnsets,
    0.25, // onsetThresh
    0.15, // frameThresh
    5,    // minNoteLen
    true, // inferOnsets
    null, // maxFreq
    null, // minFreq
    true, // melodiaTrick
    11,   // energyTolerance
  );

  const withBends = addPitchBendsToNoteEvents(allContours, noteEvents);
  const timedNotes = noteFramesToTime(withBends);

  return timedNotes.map((n) => ({
    pitch: n.pitchMidi,
    startTime: n.startTimeSeconds,
    duration: n.durationSeconds,
    velocity: Math.round(Math.min(n.amplitude * 127, 127)),
  }));
}

function resampleTo22050(data: Float32Array, fromRate: number): Float32Array {
  const targetRate = 22050;
  if (Math.abs(fromRate - targetRate) < 1) return data;

  const ratio = fromRate / targetRate;
  const newLength = Math.round(data.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, data.length - 1);
    const frac = srcIndex - low;
    result[i] = data[low] * (1 - frac) + data[high] * frac;
  }

  return result;
}
