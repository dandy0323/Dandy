import type { Note } from "@/types/music";
import { midiToNoteName } from "./pitch-detector";

interface MusicXMLOptions {
  title?: string;
  parts: { name: string; notes: Note[] }[];
  tempo?: number;
}

function noteToDuration(durationSec: number, tempo: number): { type: string; dots: number } {
  const beatDuration = 60 / tempo;
  const beats = durationSec / beatDuration;

  if (beats >= 3) return { type: "whole", dots: 0 };
  if (beats >= 1.5) return { type: "half", dots: 1 };
  if (beats >= 1) return { type: "half", dots: 0 };
  if (beats >= 0.75) return { type: "quarter", dots: 1 };
  if (beats >= 0.5) return { type: "quarter", dots: 0 };
  if (beats >= 0.375) return { type: "eighth", dots: 1 };
  if (beats >= 0.25) return { type: "eighth", dots: 0 };
  return { type: "16th", dots: 0 };
}

function durationTypeToDivisions(type: string, dots: number): number {
  const base: Record<string, number> = {
    whole: 16,
    half: 8,
    quarter: 4,
    eighth: 2,
    "16th": 1,
  };
  let dur = base[type] ?? 4;
  if (dots > 0) dur = dur + dur / 2;
  return dur;
}

function parseNoteName(midi: number): { step: string; octave: number; alter: number } {
  const name = midiToNoteName(midi);
  const match = name.match(/^([A-G])(#?)(\d+)$/);
  if (!match) return { step: "C", octave: 4, alter: 0 };
  return {
    step: match[1],
    octave: parseInt(match[3]),
    alter: match[2] === "#" ? 1 : 0,
  };
}

export function generateMusicXML(options: MusicXMLOptions): string {
  const tempo = options.tempo ?? 120;
  const title = options.title ?? "Humming Score";

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${title}</work-title>
  </work>
  <part-list>`;

  options.parts.forEach((part, i) => {
    xml += `
    <score-part id="P${i + 1}">
      <part-name>${part.name}</part-name>
    </score-part>`;
  });

  xml += `
  </part-list>`;

  options.parts.forEach((part, partIndex) => {
    xml += `
  <part id="P${partIndex + 1}">`;

    const beatDuration = 60 / tempo;
    const beatsPerMeasure = 4;
    const measureDuration = beatsPerMeasure * beatDuration;

    const totalDuration =
      part.notes.length > 0
        ? Math.max(...part.notes.map((n) => n.startTime + n.duration))
        : measureDuration;
    const numMeasures = Math.max(1, Math.ceil(totalDuration / measureDuration));

    for (let m = 0; m < numMeasures; m++) {
      const measureStart = m * measureDuration;
      const measureEnd = (m + 1) * measureDuration;

      xml += `
    <measure number="${m + 1}">`;

      if (m === 0) {
        xml += `
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction placement="above">
        <direction-type>
          <metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome>
        </direction-type>
      </direction>`;
      }

      const measureNotes = part.notes.filter(
        (n) => n.startTime >= measureStart && n.startTime < measureEnd
      );

      if (measureNotes.length === 0) {
        xml += `
      <note>
        <rest/>
        <duration>16</duration>
        <type>whole</type>
      </note>`;
      } else {
        for (const note of measureNotes) {
          const { step, octave, alter } = parseNoteName(note.pitch);
          const durInfo = noteToDuration(note.duration, tempo);
          const divisions = durationTypeToDivisions(durInfo.type, durInfo.dots);

          xml += `
      <note>
        <pitch>
          <step>${step}</step>${alter ? `\n          <alter>${alter}</alter>` : ""}
          <octave>${octave}</octave>
        </pitch>
        <duration>${divisions}</duration>
        <type>${durInfo.type}</type>${durInfo.dots ? "\n        <dot/>" : ""}
      </note>`;
        }
      }

      xml += `
    </measure>`;
    }

    xml += `
  </part>`;
  });

  xml += `
</score-partwise>`;

  return xml;
}
