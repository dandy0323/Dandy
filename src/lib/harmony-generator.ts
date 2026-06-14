import type { Note, HarmonyResult } from "@/types/music";

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

interface KeyDetectionResult {
  key: number; // 0-11 (C=0, C#=1, ...)
  scale: "major" | "minor";
  confidence: number;
}

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function detectKey(notes: Note[]): KeyDetectionResult {
  const pitchClasses = new Array(12).fill(0);
  for (const note of notes) {
    pitchClasses[note.pitch % 12] += note.duration;
  }

  let bestKey = 0;
  let bestScale: "major" | "minor" = "major";
  let bestScore = -1;

  for (let root = 0; root < 12; root++) {
    for (const [scaleName, intervals] of [
      ["major", MAJOR_SCALE],
      ["minor", MINOR_SCALE],
    ] as const) {
      let score = 0;
      for (const interval of intervals) {
        score += pitchClasses[(root + interval) % 12];
      }
      if (score > bestScore) {
        bestScore = score;
        bestKey = root;
        bestScale = scaleName;
      }
    }
  }

  const totalDuration = pitchClasses.reduce((a: number, b: number) => a + b, 0);
  return { key: bestKey, scale: bestScale, confidence: bestScore / totalDuration };
}

function getScaleDegree(pitch: number, key: number, scale: number[]): number {
  const pitchClass = ((pitch % 12) - key + 12) % 12;
  let closest = 0;
  let minDist = 12;
  for (let i = 0; i < scale.length; i++) {
    const dist = Math.abs(pitchClass - scale[i]);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  return closest;
}

function harmonizeNote(
  note: Note,
  key: number,
  scale: number[],
  direction: "upper" | "lower",
  interval: number = 2 // diatonic 3rd (0-indexed: 2 steps up/down in scale)
): Note {
  const degree = getScaleDegree(note.pitch, key, scale);
  const octave = Math.floor((note.pitch - key) / 12);

  let targetDegree: number;
  let targetOctave: number;

  if (direction === "upper") {
    targetDegree = degree + interval;
    targetOctave = octave;
    if (targetDegree >= scale.length) {
      targetDegree -= scale.length;
      targetOctave++;
    }
  } else {
    targetDegree = degree - interval;
    targetOctave = octave;
    if (targetDegree < 0) {
      targetDegree += scale.length;
      targetOctave--;
    }
  }

  const targetPitch = key + targetOctave * 12 + scale[targetDegree];

  return {
    pitch: targetPitch,
    startTime: note.startTime,
    duration: note.duration,
    velocity: Math.round(note.velocity * 0.85),
  };
}

export function generateHarmony(notes: Note[]): HarmonyResult {
  if (notes.length === 0) {
    return {
      original: [],
      upperHarmony: [],
      lowerHarmony: [],
      key: "C",
      scale: "major",
    };
  }

  const keyInfo = detectKey(notes);
  const scale = keyInfo.scale === "major" ? MAJOR_SCALE : MINOR_SCALE;

  const upperHarmony = notes.map((note) => harmonizeNote(note, keyInfo.key, scale, "upper"));
  const lowerHarmony = notes.map((note) => harmonizeNote(note, keyInfo.key, scale, "lower"));

  return {
    original: notes,
    upperHarmony,
    lowerHarmony,
    key: KEY_NAMES[keyInfo.key],
    scale: keyInfo.scale,
  };
}
