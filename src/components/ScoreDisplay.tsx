"use client";

import { useEffect, useRef } from "react";
import type { Note } from "@/types/music";
import { midiToNoteName } from "@/lib/pitch-detector";

interface ScoreDisplayProps {
  original: Note[];
  upperHarmony: Note[];
  lowerHarmony: Note[];
  showUpper: boolean;
  showLower: boolean;
  currentTime?: number;
}

const TRACK_COLORS = {
  original: "#3b82f6",
  upper: "#ef4444",
  lower: "#22c55e",
};

export default function ScoreDisplay({
  original,
  upperHarmony,
  lowerHarmony,
  showUpper,
  showLower,
  currentTime,
}: ScoreDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, width, height);

    const allNotes = [
      ...original,
      ...(showUpper ? upperHarmony : []),
      ...(showLower ? lowerHarmony : []),
    ];

    if (allNotes.length === 0) {
      ctx.fillStyle = "#999";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No notes detected", width / 2, height / 2);
      return;
    }

    const minPitch = Math.min(...allNotes.map((n) => n.pitch)) - 2;
    const maxPitch = Math.max(...allNotes.map((n) => n.pitch)) + 2;
    const maxTime = Math.max(...allNotes.map((n) => n.startTime + n.duration));

    const padding = { top: 30, bottom: 30, left: 50, right: 20 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const timeScale = plotWidth / maxTime;
    const pitchRange = maxPitch - minPitch || 1;
    const pitchScale = plotHeight / pitchRange;

    ctx.strokeStyle = "#e5e5e5";
    ctx.lineWidth = 0.5;
    for (let p = minPitch; p <= maxPitch; p++) {
      if (p % 12 === 0) {
        const y = padding.top + (maxPitch - p) * pitchScale;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = "#aaa";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(midiToNoteName(p), padding.left - 5, y + 3);
      }
    }

    function drawNotes(notes: Note[], color: string) {
      if (!ctx) return;
      for (const note of notes) {
        const x = padding.left + note.startTime * timeScale;
        const y = padding.top + (maxPitch - note.pitch) * pitchScale;
        const w = Math.max(note.duration * timeScale, 4);
        const h = Math.max(pitchScale * 0.8, 6);

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.roundRect(x, y - h / 2, w, h, 3);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (w > 30) {
          ctx.fillStyle = "#fff";
          ctx.font = "9px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(midiToNoteName(note.pitch), x + 3, y + 3);
        }
      }
    }

    if (showLower) drawNotes(lowerHarmony, TRACK_COLORS.lower);
    if (showUpper) drawNotes(upperHarmony, TRACK_COLORS.upper);
    drawNotes(original, TRACK_COLORS.original);

    if (currentTime !== undefined && currentTime > 0) {
      const x = padding.left + currentTime * timeScale;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }
  }, [original, upperHarmony, lowerHarmony, showUpper, showLower, currentTime]);

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full h-64 rounded-lg border border-zinc-200 dark:border-zinc-700"
        style={{ imageRendering: "auto" }}
      />
      <div className="flex gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ background: TRACK_COLORS.original }} />
          Original
        </span>
        {showUpper && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: TRACK_COLORS.upper }} />
            Upper Harmony
          </span>
        )}
        {showLower && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: TRACK_COLORS.lower }} />
            Lower Harmony
          </span>
        )}
      </div>
    </div>
  );
}
