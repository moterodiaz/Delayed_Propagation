// components/SimulationControls.tsx
"use client";

import { Play, Pause, Zap } from "lucide-react";
import { simTimeToDisplay } from "@/lib/simulation";

const SPEEDS = [1, 10, 60, 120];
const SIM_DURATION = 12000;

export interface TimelineMarker {
  t: number; // sim seconds
  label: string;
  danger: boolean;
}

interface SimulationControlsProps {
  simTime: number;
  isPlaying: boolean;
  speed: number;
  onTogglePlay: () => void;
  onSetSpeed: (speed: number) => void;
  onSeek: (simTime: number) => void;
  markers?: TimelineMarker[];
}

export default function SimulationControls({
  simTime,
  isPlaying,
  speed,
  onTogglePlay,
  onSetSpeed,
  onSeek,
  markers = [],
}: SimulationControlsProps) {
  const progress = Math.min((simTime / SIM_DURATION) * 100, 100);

  return (
    <div className="flex flex-col gap-2 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-5 py-3 shadow-xl">
      {/* Scrubbable timeline */}
      <div className="relative h-5">
        {/* event markers -- click to jump */}
        {markers.map((m) => (
          <button
            key={`${m.t}-${m.label}`}
            onClick={() => onSeek(m.t)}
            title={`${simTimeToDisplay(m.t)} -- ${m.label}`}
            className={`absolute top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-900 transition-transform hover:scale-150 ${
              m.danger ? "bg-red-500" : "bg-cyan-300"
            }`}
            style={{ left: `${(m.t / SIM_DURATION) * 100}%` }}
          />
        ))}
        {/* track fill (visual) */}
        <div className="absolute top-1/2 left-0 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full bg-cyan-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* range input on top -- drag/click to scrub */}
        <input
          type="range"
          min={0}
          max={SIM_DURATION}
          step={10}
          value={Math.min(simTime, SIM_DURATION)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Scrub simulation timeline"
          className="timeline-scrub absolute top-1/2 left-0 z-20 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent"
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
