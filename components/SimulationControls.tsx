// components/SimulationControls.tsx
"use client";

import { Play, Pause, Zap } from "lucide-react";
import { simTimeToDisplay } from "@/lib/simulation";

const SPEEDS = [1, 10, 60, 120];
const SIM_DURATION = 12000;

interface SimulationControlsProps {
  simTime: number;
  isPlaying: boolean;
  speed: number;
  onTogglePlay: () => void;
  onSetSpeed: (speed: number) => void;
}

export default function SimulationControls({
  simTime,
  isPlaying,
  speed,
  onTogglePlay,
  onSetSpeed,
}: SimulationControlsProps) {
  const progress = Math.min((simTime / SIM_DURATION) * 100, 100);

  return (
    <div className="flex flex-col gap-2 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-5 py-3 shadow-xl">
      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onTogglePlay}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? "Pause" : "Play"}
        </button>
        <div className="flex items-center gap-1">
          <Zap size={13} className="text-yellow-400" />
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                speed === s
                  ? "bg-yellow-500 text-black font-bold"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="ml-auto font-mono text-cyan-400 text-sm tracking-wider">
          {simTimeToDisplay(simTime)}
        </div>
      </div>
    </div>
  );
}
