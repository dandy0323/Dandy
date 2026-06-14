"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface RecordButtonProps {
  onRecordingComplete: (audioData: Float32Array, sampleRate: number) => void;
}

export default function RecordButton({ onRecordingComplete }: RecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<{
    audioContext: AudioContext;
    mediaStream: MediaStream;
    processor: ScriptProcessorNode;
    chunks: Float32Array[];
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current) {
        recorderRef.current.mediaStream.getTracks().forEach((t) => t.stop());
        recorderRef.current.audioContext.close();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(mediaStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];

    processor.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(audioContext.destination);

    recorderRef.current = { audioContext, mediaStream, processor, chunks };
    setIsRecording(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 0.1), 100);
  }, []);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const { audioContext, mediaStream, processor, chunks } = recorderRef.current;
    const sampleRate = audioContext.sampleRate;

    processor.disconnect();
    mediaStream.getTracks().forEach((t) => t.stop());

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const audioData = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioData.set(chunk, offset);
      offset += chunk.length;
    }

    audioContext.close();
    recorderRef.current = null;

    setIsRecording(false);
    setDuration(0);
    onRecordingComplete(audioData, sampleRate);
  }, [onRecordingComplete]);

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`relative w-24 h-24 rounded-full border-4 transition-all duration-200 flex items-center justify-center ${
          isRecording
            ? "border-red-500 bg-red-50 dark:bg-red-950 animate-pulse"
            : "border-blue-500 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900"
        }`}
      >
        {isRecording ? (
          <div className="w-8 h-8 rounded-sm bg-red-500" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-500" />
        )}
      </button>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {isRecording ? `${duration.toFixed(1)}s` : "Tap to record"}
      </p>
    </div>
  );
}
