"use client";

import { useState, useRef, useCallback } from "react";
import type { Note } from "@/types/music";
import { Player, type TrackType } from "@/lib/player";

interface PlaybackControlsProps {
  original: Note[];
  upperHarmony: Note[];
  lowerHarmony: Note[];
  onTimeUpdate?: (time: number) => void;
  onTrackToggle?: (tracks: { original: boolean; upper: boolean; lower: boolean }) => void;
}

export default function PlaybackControls({
  original,
  upperHarmony,
  lowerHarmony,
  onTimeUpdate,
  onTrackToggle,
}: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState({
    original: true,
    upper: true,
    lower: true,
  });
  const playerRef = useRef<Player | null>(null);

  const toggleTrack = useCallback(
    (track: "original" | "upper" | "lower") => {
      setTracks((prev) => {
        const next = { ...prev, [track]: !prev[track] };
        onTrackToggle?.(next);
        return next;
      });
    },
    [onTrackToggle]
  );

  const play = useCallback(async () => {
    if (!playerRef.current) {
      playerRef.current = new Player();
    }

    const mutedTracks = new Set<TrackType>();
    if (!tracks.original) mutedTracks.add("original");
    if (!tracks.upper) mutedTracks.add("upperHarmony");
    if (!tracks.lower) mutedTracks.add("lowerHarmony");

    setIsPlaying(true);

    await playerRef.current.play({
      tracks: {
        original,
        upperHarmony,
        lowerHarmony,
      },
      mutedTracks,
      onProgress: (time) => onTimeUpdate?.(time),
      onEnd: () => {
        setIsPlaying(false);
        onTimeUpdate?.(0);
      },
    });
  }, [original, upperHarmony, lowerHarmony, tracks, onTimeUpdate]);

  const stop = useCallback(async () => {
    await playerRef.current?.stop();
    setIsPlaying(false);
    onTimeUpdate?.(0);
  }, [onTimeUpdate]);

  const trackButtons = [
    { key: "original" as const, label: "Original", color: "bg-blue-500", active: tracks.original },
    { key: "upper" as const, label: "Upper", color: "bg-red-500", active: tracks.upper },
    { key: "lower" as const, label: "Lower", color: "bg-green-500", active: tracks.lower },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 justify-center">
        <button
          onClick={isPlaying ? stop : play}
          className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="4" height="12" />
              <rect x="9" y="2" width="4" height="12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <polygon points="3,1 14,8 3,15" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex gap-2 justify-center">
        {trackButtons.map(({ key, label, color, active }) => (
          <button
            key={key}
            onClick={() => toggleTrack(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              active
                ? `${color} text-white`
                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
