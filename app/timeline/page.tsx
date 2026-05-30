// app/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import SimulationControls, {
  type TimelineMarker,
} from "@/components/SimulationControls";
import EventFeed from "@/components/EventFeed";
import NewsFeed from "@/components/NewsFeed";
import { getActiveTFRs, generateRandomTFR } from "@/lib/simulation";
import { fetchLiveFlights } from "@/lib/opensky";
import { HERO_FLIGHT } from "@/lib/data/heroFlight";
import { KINGSTON_TFRS } from "@/lib/data/kingstonTFR";
import { NEWS_FEED } from "@/lib/data/newsFeed";
import { AIRPORTS } from "@/lib/data/airports";

// Real hero flight (JBU1575) is the only flight with a real ADS-B track in the
// dataset; the 14 other casualties have no positions to animate. So the sim map
// shows the real hero against the real Kingston FIR closure.
const SIM_FLIGHTS = [HERO_FLIGHT];
import type { TFRZone, SimEvent, LiveFlight } from "@/lib/types";

const AirspaceMap = dynamic(() => import("@/components/AirspaceMap"), {
  ssr: false,
});

const TICK_MS = 100;
const SIM_DURATION = 12000;
const LIVE_POLL_MS = 10_000;

export default function Page() {
  const [mode, setMode] = useState<"sim" | "live">("sim");

  // Sim state
  const [simTime, setSimTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);

  // Live state
  const [liveFlights, setLiveFlights] = useState<LiveFlight[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  // Shared
  const [extraTFRs, setExtraTFRs] = useState<TFRZone[]>([]);
  const [events, setEvents] = useState<SimEvent[]>([
    {
      id: "init-0",
      simTime: 0,
      message: "Simulation initialized. May 22, 2026 -- 17:00 EDT.",
      type: "info",
    },
    {
      id: "init-1",
      simTime: 0,
      message: "Monitoring JetBlue 1575 (KFLL->MKJP) -- Kingston FIR.",
      type: "info",
    },
  ]);
  const firedEvents = useRef<Set<string>>(new Set());

  const addEvent = useCallback((ev: Omit<SimEvent, "id">) => {
    setEvents((prev) => [
      ...prev,
      { ...ev, id: `ev-${Date.now()}-${Math.random()}` },
    ]);
  }, []);

  // -- Sim tick --------------------------------------------------------------
  useEffect(() => {
    if (mode !== "sim" || !isPlaying) return;
    const interval = setInterval(() => {
      setSimTime((prev) => {
        const next = prev + (TICK_MS / 1000) * speed;
        return next >= SIM_DURATION ? SIM_DURATION : next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [mode, isPlaying, speed]);

  useEffect(() => {
    if (simTime >= SIM_DURATION) setIsPlaying(false);
  }, [simTime]);

  // Scripted sim events
  useEffect(() => {
    if (mode !== "sim") return;
    getActiveTFRs([...KINGSTON_TFRS, ...extraTFRs], simTime).forEach((tfr) => {
      if (!firedEvents.current.has(tfr.id)) {
        firedEvents.current.add(tfr.id);
        addEvent({
          simTime,
          message: `TFR ACTIVATED: ${tfr.label} -- ${tfr.reason}`,
          type: tfr.severity === "danger" ? "danger" : "warning",
        });
      }
    });
    if (simTime >= 2239 && !firedEvents.current.has("b61575-diverted")) {
      firedEvents.current.add("b61575-diverted");
      addEvent({
        simTime,
        message:
          "JetBlue 1575: no clearance through Kingston FIR closure -- U-turn over the Bahamas, returning to KFLL.",
        type: "danger",
      });
    }
  }, [simTime, mode, extraTFRs, addEvent]);

  // -- Live polling ----------------------------------------------------------
  useEffect(() => {
    if (mode !== "live") return;
    async function poll() {
      setLiveLoading(true);
      const flights = await fetchLiveFlights();
      setLiveFlights(flights);
      setLiveLoading(false);
      addEvent({
        simTime: 0,
        message: `Live feed updated -- ${flights.length} aircraft in region.`,
        type: "info",
      });
    }
    poll();
    const interval = setInterval(poll, LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [mode, addEvent]);

  // -- Mode switch -----------------------------------------------------------
  function switchMode(next: "sim" | "live") {
    setIsPlaying(false);
    setMode(next);
    addEvent({
      simTime: 0,
      message:
        next === "sim"
          ? "Switched to simulation mode."
          : "Switched to live mode -- polling OpenSky Network.",
      type: "info",
    });
  }

  // -- Inject random TFR -----------------------------------------------------
  const handleInjectRandom = useCallback(() => {
    const newTFR = generateRandomTFR(simTime);
    setExtraTFRs((prev) => [...prev, newTFR]);
    addEvent({
      simTime,
      message: `Random TFR injected: ${newTFR.label} -- ${newTFR.reason}`,
      type: newTFR.severity === "danger" ? "danger" : "warning",
    });
  }, [simTime, addEvent]);

  const activeTFRs = mode === "sim" ? getActiveTFRs(KINGSTON_TFRS, simTime) : [];

  // Jump straight to a point on the timeline; pause so it doesn't tick away.
  const handleSeek = useCallback((t: number) => {
    setIsPlaying(false);
    setSimTime(Math.max(0, Math.min(t, SIM_DURATION)));
  }, []);

  // Clickable timeline markers: news alerts + the JetBlue diversion beat.
  const timelineMarkers: TimelineMarker[] = [
    ...NEWS_FEED.map((it) => {
      const time = it.timestamp.slice(11, 19).split(":").map(Number);
      return {
        t: (time[0] - 17) * 3600 + time[1] * 60 + time[2],
        label: it.headline,
        danger: it.type === "NOTAM",
      };
    }),
    { t: 2239, label: "JetBlue 1575 U-turn back to KFLL", danger: true },
  ];

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Airspace Intelligence
          </h1>
          <p className="text-xs text-gray-500">
            {mode === "sim"
              ? "SpaceX Starship 12 -- May 22, 2026 Caribbean TFR Case Study"
              : "Live ADS-B -- Florida-Caribbean via OpenSky Network"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => switchMode("sim")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === "sim"
                ? "bg-cyan-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Simulation
          </button>
          <button
            onClick={() => switchMode("live")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === "live"
                ? "bg-green-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {mode === "live" && liveLoading && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            )}
            Live
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />{" "}
            En Route
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />{" "}
            Diverted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{" "}
            TFR Danger
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{" "}
            TFR Warning
          </span>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <AirspaceMap
            flights={SIM_FLIGHTS}
            simTime={simTime}
            liveFlights={liveFlights}
            activeTFRs={activeTFRs}
            extraTFRs={extraTFRs}
            airports={AIRPORTS}
            mode={mode}
          />
        </div>
        <div className="w-72 shrink-0 p-3 overflow-hidden">
          <EventFeed events={events} onInjectRandomEvent={handleInjectRandom} />
        </div>
        <div className="w-80 shrink-0 py-3 pr-3 overflow-hidden">
          <NewsFeed
            items={NEWS_FEED}
            simTime={mode === "sim" ? simTime : undefined}
          />
        </div>
      </div>

      {/* Sim controls -- hidden in live mode */}
      {mode === "sim" && (
        <div className="px-4 pb-4 pt-2 shrink-0">
          <SimulationControls
            simTime={simTime}
            isPlaying={isPlaying}
            speed={speed}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onSetSpeed={setSpeed}
            onSeek={handleSeek}
            markers={timelineMarkers}
          />
        </div>
      )}
    </div>
  );
}
