// Root = sim/live timeline. Sim: hero U-turn + stationed flights that ground when the TFR
// activates + accruing cost. Live: real OpenSky traffic (dead-reckoned) with synthetic
// fallback + NOTAM/intelligence feed (no pricing). Pitch dock explains everything.
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import SimulationControls, { type TimelineMarker } from "@/components/SimulationControls";
import FeedTabs from "@/components/FeedTabs";
import PricingPanel from "@/components/demo/PricingPanel";
import PitchDock from "@/components/PitchDock";
import { accruedAt, projectForward } from "@/components/demo/accrual";
import { getActiveTFRs, generateRandomTFR } from "@/lib/simulation";
import { fetchLiveFlights } from "@/lib/opensky";
import { HERO_FLIGHT } from "@/lib/data/heroFlight";
import { KINGSTON_TFRS } from "@/lib/data/kingstonTFR";
import { NEWS_FEED } from "@/lib/data/newsFeed";
import { AIRPORTS } from "@/lib/data/airports";
import { GROUNDED_FLIGHTS } from "@/lib/data/groundedFlights";
import type { TFRZone, SimEvent, LiveFlight } from "@/lib/types";
import type { StateModel } from "@/lib/airspace/types";

const SIM_FLIGHTS = [HERO_FLIGHT];
const AirspaceMap = dynamic(() => import("@/components/AirspaceMap"), { ssr: false });

const TICK_MS = 100;
const SIM_DURATION = 12000;
const LIVE_POLL_MS = 10_000;
const LIVE_ANIM_MS = 600;
const TFR_ACTIVE_AT = 1800; // sim seconds = 21:30Z

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// Synthetic live traffic — fallback so Live mode never looks dead if OpenSky rate-limits.
const SYNTHETIC_LIVE: LiveFlight[] = Array.from({ length: 60 }, (_, i) => ({
  icao24: `synth${i}`,
  callsign: ["AAL", "DAL", "JBU", "NKS", "SWA", "UAL"][i % 6] + (100 + i * 7),
  lat: 17 + ((i * 37) % 100) / 10,
  lng: -83 + ((i * 53) % 110) / 10,
  heading: (i * 47) % 360,
  altitude: 9000 + (i % 5) * 600,
  velocity: 200 + (i % 7) * 12,
  onGround: false,
  country: "United States",
}));

export default function Page() {
  const [mode, setMode] = useState<"sim" | "live">("sim");
  const [simTime, setSimTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [liveAnimated, setLiveAnimated] = useState<LiveFlight[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [liveSynthetic, setLiveSynthetic] = useState(false);
  const liveBase = useRef<{ flights: LiveFlight[]; t: number }>({ flights: [], t: 0 });
  const [extraTFRs, setExtraTFRs] = useState<TFRZone[]>([]);
  const [state, setState] = useState<StateModel | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([
    { id: "init-0", simTime: 0, message: "Simulation initialized. May 22, 2026 -- 17:00 EDT.", type: "info" },
    { id: "init-1", simTime: 0, message: "Monitoring JetBlue 1575 (KFLL->MKJP) -- Kingston FIR.", type: "info" },
  ]);
  const firedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/state").then((r) => r.json()).then(setState).catch(() => setState(null));
  }, []);

  const realT = state
    ? mode === "live"
      ? state.window.endSec
      : state.window.startSec + (simTime / SIM_DURATION) * (state.window.endSec - state.window.startSec)
    : 0;
  const acc = state ? accruedAt(state, realT) : { cost: 0, affected: 0, frac: 0 };

  const addEvent = useCallback((ev: Omit<SimEvent, "id">) => {
    setEvents((prev) => [...prev, { ...ev, id: `ev-${Date.now()}-${Math.random()}` }]);
  }, []);

  // sim tick
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

  // scripted sim events
  useEffect(() => {
    if (mode !== "sim") return;
    getActiveTFRs([...KINGSTON_TFRS, ...extraTFRs], simTime).forEach((tfr) => {
      if (!firedEvents.current.has(tfr.id)) {
        firedEvents.current.add(tfr.id);
        addEvent({ simTime, message: `TFR ACTIVATED: ${tfr.label} -- ${tfr.reason}`, type: tfr.severity === "danger" ? "danger" : "warning" });
      }
    });
    if (simTime >= TFR_ACTIVE_AT && !firedEvents.current.has("grounded-fleet")) {
      firedEvents.current.add("grounded-fleet");
      addEvent({ simTime, message: "Kingston FIR closed -- ~42 stationed flights at KMIA/KFLL can no longer depart.", type: "danger" });
    }
    if (simTime >= 2239 && !firedEvents.current.has("b61575-diverted")) {
      firedEvents.current.add("b61575-diverted");
      addEvent({ simTime, message: "JetBlue 1575: no clearance through Kingston FIR closure -- U-turn over the Bahamas, returning to KFLL.", type: "danger" });
    }
  }, [simTime, mode, extraTFRs, addEvent]);

  // live polling
  useEffect(() => {
    if (mode !== "live") return;
    async function poll() {
      setLiveLoading(true);
      const flights = await fetchLiveFlights();
      const synthetic = flights.length < 10;
      const use = synthetic ? SYNTHETIC_LIVE : flights;
      liveBase.current = { flights: use, t: Date.now() };
      setLiveCount(use.length);
      setLiveSynthetic(synthetic);
      setLiveAnimated(use);
      setLiveLoading(false);
      addEvent({ simTime: 0, message: `Live feed updated -- ${use.length} aircraft${synthetic ? " (synthetic fallback)" : ""} in region.`, type: "info" });
    }
    poll();
    const interval = setInterval(poll, LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [mode, addEvent]);

  // live dead-reckoning: glide planes between polls
  useEffect(() => {
    if (mode !== "live") return;
    const id = setInterval(() => {
      const { flights, t } = liveBase.current;
      if (!flights.length) return;
      const dt = (Date.now() - t) / 1000;
      setLiveAnimated(
        flights.map((f) => {
          if (f.onGround || !f.velocity) return f;
          const [lat, lng] = projectForward(f.lat, f.lng, f.heading, f.velocity, dt);
          return { ...f, lat, lng };
        }),
      );
    }, LIVE_ANIM_MS);
    return () => clearInterval(id);
  }, [mode]);

  function switchMode(next: "sim" | "live") {
    setIsPlaying(false);
    setMode(next);
    addEvent({ simTime: 0, message: next === "sim" ? "Switched to simulation mode." : "Switched to live mode -- polling OpenSky Network.", type: "info" });
  }

  const handleInjectRandom = useCallback(() => {
    const newTFR = generateRandomTFR(simTime);
    setExtraTFRs((prev) => [...prev, newTFR]);
    addEvent({ simTime, message: `Random TFR injected: ${newTFR.label} -- ${newTFR.reason}`, type: newTFR.severity === "danger" ? "danger" : "warning" });
  }, [simTime, addEvent]);

  const activeTFRs = mode === "sim" ? getActiveTFRs(KINGSTON_TFRS, simTime) : [];

  const handleSeek = useCallback((t: number) => {
    setIsPlaying(false);
    setSimTime(Math.max(0, Math.min(t, SIM_DURATION)));
  }, []);

  const timelineMarkers: TimelineMarker[] = [
    ...NEWS_FEED.map((it) => {
      const time = it.timestamp.slice(11, 19).split(":").map(Number);
      return { t: (time[0] - 17) * 3600 + time[1] * 60 + time[2], label: it.headline, danger: it.type === "NOTAM" };
    }),
    { t: 2239, label: "JetBlue 1575 U-turn back to KFLL", danger: true },
  ];

  const groundedActive = mode === "sim" && simTime >= TFR_ACTIVE_AT;

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Airspace Intelligence — Cost Optimizer</h1>
          <p className="text-xs text-gray-500">
            {mode === "sim" ? "SpaceX Starship 12 — May 22, 2026 Caribbean TFR Case Study" : `Live ADS-B — Florida-Caribbean · ${liveCount} aircraft${liveSynthetic ? " (synthetic)" : ""}`}
          </p>
        </div>

        {mode === "sim" && (
          <div className="text-right">
            <div className="text-[10px] text-gray-500 tracking-widest">DISRUPTION COST</div>
            <div className="text-xl font-mono font-bold text-red-400" style={{ textShadow: "0 0 10px rgba(248,113,113,0.4)" }}>{usd(acc.cost)}</div>
            <div className="text-[10px] text-gray-500">{acc.affected} affected · {Math.round(acc.frac * 100)}% of {usd(state?.events[0]?.cost.totalUsd ?? 0)}</div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <PitchDock state={state} />
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button onClick={() => switchMode("sim")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === "sim" ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>Simulation</button>
            <button onClick={() => switchMode("live")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === "live" ? "bg-green-600 text-white" : "text-gray-400 hover:text-gray-200"}`}>
              {mode === "live" && liveLoading && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />}
              Live
            </button>
          </div>
        </div>
      </div>

      {/* Map + Pricing(sim) + Feeds */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <AirspaceMap
            flights={SIM_FLIGHTS}
            simTime={simTime}
            liveFlights={liveAnimated}
            activeTFRs={activeTFRs}
            extraTFRs={extraTFRs}
            airports={AIRPORTS}
            mode={mode}
            grounded={GROUNDED_FLIGHTS}
            groundedActive={groundedActive}
          />
        </div>

        {/* Pricing — sim only */}
        {mode === "sim" && (
          <div className="w-80 shrink-0 flex border-l border-gray-800 min-h-0">
            <PricingPanel state={state} t={realT} />
          </div>
        )}

        {/* Intelligence / Events tabs */}
        <div className="w-80 shrink-0 border-l border-gray-800 min-h-0">
          <FeedTabs events={events} onInjectRandomEvent={handleInjectRandom} news={NEWS_FEED} simTime={mode === "sim" ? simTime : undefined} />
        </div>
      </div>

      {/* Timeline scrubber — sim mode */}
      {mode === "sim" && (
        <div className="px-4 pb-4 pt-2 shrink-0">
          <SimulationControls simTime={simTime} isPlaying={isPlaying} speed={speed} onTogglePlay={() => setIsPlaying((p) => !p)} onSetSpeed={setSpeed} onSeek={handleSeek} markers={timelineMarkers} />
        </div>
      )}
    </div>
  );
}
