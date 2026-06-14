import type { Note } from "@/types/music";

const A4_FREQ = 440;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function frequencyToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / A4_FREQ) + 69);
}

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function midiToFrequency(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - 69) / 12);
}

interface PitchFrame {
  time: number;
  frequency: number;
  confidence: number;
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);

  if (rms < 0.01) return -1;

  const correlations = new Float32Array(size);
  for (let lag = 0; lag < size; lag++) {
    let sum = 0;
    for (let i = 0; i < size - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = sum;
  }

  let d = 0;
  while (d < size && correlations[d] > correlations[d + 1]) {
    d++;
  }

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < size; i++) {
    if (correlations[i] > maxVal) {
      maxVal = correlations[i];
      maxPos = i;
    }
  }

  if (maxPos === -1 || maxVal < 0.1 * correlations[0]) return -1;

  const prev = correlations[maxPos - 1] ?? 0;
  const next = correlations[maxPos + 1] ?? 0;
  const shift = (prev - next) / (2 * (prev - 2 * maxVal + next));
  const refinedPos = maxPos + (isFinite(shift) ? shift : 0);

  return sampleRate / refinedPos;
}

function extractPitchFrames(
  audioData: Float32Array,
  sampleRate: number,
  frameSize: number = 2048,
  hopSize: number = 512
): PitchFrame[] {
  const frames: PitchFrame[] = [];

  for (let offset = 0; offset + frameSize <= audioData.length; offset += hopSize) {
    const frame = audioData.slice(offset, offset + frameSize);
    const frequency = autoCorrelate(frame, sampleRate);
    const time = offset / sampleRate;

    if (frequency > 60 && frequency < 2000) {
      let rms = 0;
      for (let i = 0; i < frame.length; i++) {
        rms += frame[i] * frame[i];
      }
      rms = Math.sqrt(rms / frame.length);

      frames.push({ time, frequency, confidence: Math.min(rms * 10, 1) });
    }
  }

  return frames;
}

function framesToNotes(frames: PitchFrame[], minDuration: number = 0.08): Note[] {
  if (frames.length === 0) return [];

  const notes: Note[] = [];
  let currentMidi = frequencyToMidi(frames[0].frequency);
  let startTime = frames[0].time;
  let count = 1;

  for (let i = 1; i < frames.length; i++) {
    const midi = frequencyToMidi(frames[i].frequency);
    const timeDiff = frames[i].time - frames[i - 1].time;

    if (midi === currentMidi && timeDiff < 0.2) {
      count++;
    } else {
      const duration = frames[i - 1].time - startTime + (frames[1]?.time - frames[0]?.time || 0.01);
      if (duration >= minDuration && count >= 2) {
        notes.push({
          pitch: currentMidi,
          startTime,
          duration,
          velocity: 80,
        });
      }
      currentMidi = midi;
      startTime = frames[i].time;
      count = 1;
    }
  }

  const lastFrame = frames[frames.length - 1];
  const duration = lastFrame.time - startTime + (frames[1]?.time - frames[0]?.time || 0.01);
  if (duration >= minDuration && count >= 2) {
    notes.push({
      pitch: currentMidi,
      startTime,
      duration,
      velocity: 80,
    });
  }

  return notes;
}

export function detectPitch(audioData: Float32Array, sampleRate: number): Note[] {
  const frames = extractPitchFrames(audioData, sampleRate);
  return framesToNotes(frames);
}
