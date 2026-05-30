// components/EventFeed.tsx
"use client";

import { AlertTriangle, Info, Radio, Zap } from "lucide-react";
import { simTimeToDisplay } from "@/lib/simulation";
import type { SimEvent } from "@/lib/types";

const ICONS = {
  info: <Info size={13} className="text-cyan-400 shrink-0 mt-0.5" />,
  warning: (
    <AlertTriangle size={13} className="text-yellow-400 shrink-0 mt-0.5" />
  ),
  danger: (
    <Radio size={13} className="text-red-400 shrink-0 mt-0.5 animate-pulse" />
  ),
};

interface EventFeedProps {
  events: SimEvent[];
  onInjectRandomEvent: () => void;
}

export default function EventFeed({
  events,
  onInjectRandomEvent,
}: EventFeedProps) {
  return (
    <div className="flex flex-col h-full bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Radio size={14} className="text-red-400 animate-pulse" />
          Live Event Feed
        </div>
        <button
          onClick={onInjectRandomEvent}
          className="flex items-center gap-1.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded-lg px-2.5 py-1.5 transition-colors font-medium"
        >
          <Zap size={11} />
          Inject Event
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 && (
          <p className="text-gray-500 text-xs text-center mt-6">
            No events -- start simulation
          </p>
        )}
        {[...events].reverse().map((ev) => (
          <div
            key={ev.id}
            className="flex gap-2 text-xs leading-snug bg-gray-800/60 rounded-lg px-3 py-2"
          >
            {ICONS[ev.type]}
            <div>
              <div className="font-mono text-gray-400 text-[10px]">
                {simTimeToDisplay(ev.simTime)}
              </div>
              <div className="text-gray-200 mt-0.5">{ev.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
