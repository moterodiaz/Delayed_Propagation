// components/NewsFeed.tsx
"use client";

import { Fuel, Newspaper, Plane, Siren, Timer } from "lucide-react";
import type { NewsFeedItem } from "@/lib/types";

interface NewsFeedProps {
  items: NewsFeedItem[];
  // sim seconds from 17:00 EDT epoch. If set, only items whose
  // timestamp has elapsed are shown. Omit to show the full feed.
  simTime?: number;
}

// "2026-05-22T17:15:00-04:00" -> sim seconds from 17:00 EDT epoch.
function itemSimOffset(iso: string): number {
  const time = iso.slice(11, 19); // "17:15:00"
  const [h, m, s] = time.split(":").map(Number);
  return (h - 17) * 3600 + m * 60 + s;
}

function clockLabel(iso: string): string {
  return `${iso.slice(11, 16)} EDT`;
}

export default function NewsFeed({ items, simTime }: NewsFeedProps) {
  const visible =
    simTime === undefined
      ? items
      : items.filter((it) => itemSimOffset(it.timestamp) <= simTime);

  return (
    <div className="flex flex-col h-full bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Newspaper size={14} className="text-cyan-400" />
          Intelligence Feed
        </div>
        <span className="text-[10px] text-gray-500 font-mono">
          GDELT / FAA SWIM
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {visible.length === 0 && (
          <p className="text-gray-500 text-xs text-center mt-6">
            No intelligence yet -- advance simulation
          </p>
        )}
        {[...visible].reverse().map((it) => {
          const isNotam = it.type === "NOTAM";
          return (
            <div
              key={it.id}
              className={`rounded-lg border px-3 py-2.5 ${
                isNotam
                  ? "border-red-800/60 bg-red-950/30"
                  : "border-gray-700 bg-gray-800/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    isNotam
                      ? "bg-red-700/80 text-red-100"
                      : "bg-cyan-700/70 text-cyan-100"
                  }`}
                >
                  {isNotam ? <Siren size={9} /> : <Newspaper size={9} />}
                  {it.type.replace("_", " ")}
                </span>
                <span className="font-mono text-[10px] text-gray-500">
                  {clockLabel(it.timestamp)}
                </span>
              </div>

              <div className="mt-1.5 text-xs font-semibold leading-snug text-gray-100">
                {it.headline}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                {it.source}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-gray-300">
                {it.synthesis}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                <span className="inline-flex items-center gap-1 rounded bg-gray-700/60 px-1.5 py-0.5 text-gray-200">
                  <Plane size={9} className="text-cyan-400" />
                  {it.metrics.estimated_planes_affected} aircraft
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-gray-700/60 px-1.5 py-0.5 text-gray-200">
                  <Fuel size={9} className="text-orange-400" />
                  {it.metrics.base_fuel_multiplier.toFixed(2)}x fuel
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-gray-700/60 px-1.5 py-0.5 text-gray-200">
                  <Timer size={9} className="text-yellow-400" />+
                  {it.metrics.projected_delay_mins}m delay
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
