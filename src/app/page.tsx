"use client";

import { useState, useCallback } from "react";
import type { Note, AppPhase } from "@/types/music";
import { detectPitch } from "@/lib/pitch-detector";
import { generateHarmony } from "@/lib/harmony-generator";
import RecordButton from "@/components/RecordButton";
import ScoreDisplay from "@/components/ScoreDisplay";
import PlaybackControls from "@/components/PlaybackControls";

export default function Home() {
  const [phase, setPhase] = useState<AppPhase>("record");
  const [original, setOriginal] = useState<Note[]>([]);
  const [upperHarmony, setUpperHarmony] = useState<Note[]>([]);
  const [lowerHarmony, setLowerHarmony] = useState<Note[]>([]);
  const [keyInfo, setKeyInfo] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(0);
  const [trackVisibility, setTrackVisibility] = useState({
    original: true,
    upper: true,
    lower: true,
  });

  const handleRecordingComplete = useCallback(
    (audioData: Float32Array, sampleRate: number) => {
      setPhase("detect");

      requestAnimationFrame(() => {
        const notes = detectPitch(audioData, sampleRate);

        if (notes.length === 0) {
          setPhase("record");
          alert("Could not detect any melody. Please try again, humming louder and clearer.");
          return;
        }

        const harmony = generateHarmony(notes);

        setOriginal(harmony.original);
        setUpperHarmony(harmony.upperHarmony);
        setLowerHarmony(harmony.lowerHarmony);
        setKeyInfo(`${harmony.key} ${harmony.scale}`);
        setPhase("result");
      });
    },
    []
  );

  const handleReset = useCallback(() => {
    setPhase("record");
    setOriginal([]);
    setUpperHarmony([]);
    setLowerHarmony([]);
    setKeyInfo("");
    setCurrentTime(0);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Harmony Hum
          </h1>
          <p className="text-xs text-zinc-400">Hum a melody, get harmonies</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-3xl space-y-8">
          {phase === "record" && (
            <div className="flex flex-col items-center gap-6 py-12">
              <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-200">
                Hum your melody
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md">
                Press the button and hum a melody. We will detect the notes and create harmonies for you.
              </p>
              <RecordButton onRecordingComplete={handleRecordingComplete} />
            </div>
          )}

          {phase === "detect" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-500 dark:text-zinc-400">Analyzing your melody...</p>
            </div>
          )}

          {phase === "result" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                    Score
                  </h2>
                  {keyInfo && (
                    <p className="text-sm text-zinc-500">
                      Detected key: <span className="font-medium text-zinc-700 dark:text-zinc-300">{keyInfo}</span>
                      {" / "}
                      {original.length} notes
                    </p>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Record again
                </button>
              </div>

              <ScoreDisplay
                original={original}
                upperHarmony={upperHarmony}
                lowerHarmony={lowerHarmony}
                showUpper={trackVisibility.upper}
                showLower={trackVisibility.lower}
                currentTime={currentTime}
              />

              <PlaybackControls
                original={original}
                upperHarmony={upperHarmony}
                lowerHarmony={lowerHarmony}
                onTimeUpdate={setCurrentTime}
                onTrackToggle={setTrackVisibility}
              />
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-3">
        <p className="text-center text-xs text-zinc-400">
          All processing runs in your browser. No data is sent to any server.
        </p>
      </footer>
    </div>
  );
}
