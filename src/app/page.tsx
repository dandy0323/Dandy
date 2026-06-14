"use client";

import { useState, useCallback } from "react";
import type { Note, AppPhase } from "@/types/music";
import { generateHarmony } from "@/lib/harmony-generator";
import RecordButton from "@/components/RecordButton";
import ScoreDisplay from "@/components/ScoreDisplay";
import PlaybackControls from "@/components/PlaybackControls";

export default function Home() {
  const [phase, setPhase] = useState<AppPhase>("record");
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
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
    async (audioData: Float32Array, sampleRate: number) => {
      setPhase("detect");
      setAnalyzeProgress(0);

      try {
        const { detectPitch } = await import("@/lib/pitch-detector");
        const notes = await detectPitch(audioData, sampleRate, (percent) => {
          setAnalyzeProgress(Math.round(percent * 100));
        });

        if (notes.length === 0) {
          setPhase("record");
          alert("メロディーを検出できませんでした。もう少し大きな声でハミングしてみてください。");
          return;
        }

        const harmony = generateHarmony(notes);

        setOriginal(harmony.original);
        setUpperHarmony(harmony.upperHarmony);
        setLowerHarmony(harmony.lowerHarmony);
        setKeyInfo(`${harmony.key} ${harmony.scale}`);
        setPhase("result");
      } catch (err) {
        console.error("Pitch detection failed:", err);
        setPhase("record");
        alert(`解析中にエラーが発生しました: ${err}`);
      }
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
          <p className="text-xs text-zinc-400">鼻歌からハーモニーを生成</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-3xl space-y-8">
          {phase === "record" && (
            <div className="flex flex-col items-center gap-6 py-12">
              <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-200">
                メロディーをハミング
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md">
                ボタンを押してメロディーをハミングしてください。音を検出してハーモニーを生成します。
              </p>
              <RecordButton onRecordingComplete={handleRecordingComplete} />
            </div>
          )}

          {phase === "detect" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-500 dark:text-zinc-400">メロディーを解析中...</p>
              {analyzeProgress > 0 && (
                <div className="w-48">
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${analyzeProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-400 text-center mt-1">{analyzeProgress}%</p>
                </div>
              )}
            </div>
          )}

          {phase === "result" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                    スコア
                  </h2>
                  {keyInfo && (
                    <p className="text-sm text-zinc-500">
                      検出キー: <span className="font-medium text-zinc-700 dark:text-zinc-300">{keyInfo}</span>
                      {" / "}
                      {original.length} 音
                    </p>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  もう一度録音
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
          すべての処理はブラウザ内で完結します。データはサーバーに送信されません。
        </p>
      </footer>
    </div>
  );
}
