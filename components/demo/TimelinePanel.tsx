"use client";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { StateModel } from "@/lib/airspace/types";
import { fmtUtc, flightWindow } from "./accrual";

interface Props {
  state: StateModel | null;
  t: number;
  setT: Dispatch<SetStateAction<number>>;
  playing: boolean;
  setPlaying: Dispatch<SetStateAction<boolean>>;
}

// 1 real second of playback = STEP event-seconds
const STEP = 90;

export default function TimelinePanel({ state, t, setT, playing, setPlaying }: Props) {
  const start = state?.window.startSec ?? 0;
  const end = state?.window.endSec ?? 1;
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || !state) return;
    const id = setInterval(() => {
      setT((prev: number) => {
        const next = prev + STEP;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
    }, 60);
    raf.current = id as unknown as number;
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, state, end]);

  if (!state) return <div style={{ height: 64, background: "rgba(1,4,12,0.98)" }} />;

  // markers: TFR active (start), JBU1575 U-turn (southernmost hero waypoint), TFR lifts (end)
  const hero = state.flights.find((f) => f.isHero);
  let turnT = (start + end) / 2;
  if (hero && hero.track.length) {
    let minLat = Infinity;
    for (const w of hero.track) if (w.lat < minLat) { minLat = w.lat; turnT = w.t; }
  }
  const markers = [
    { t: start, label: "TFR ACTIVE", c: "#ff3355" },
    { t: turnT, label: "JBU1575 U-TURN", c: "#ff6b35" },
    { t: end, label: "TFR LIFTS", c: "#43a047" },
  ];
  const pct = (x: number) => ((x - start) / (end - start)) * 100;

  return (
    <div style={{ background: "rgba(1,4,12,0.98)", borderTop: "1px solid rgba(0,160,255,0.12)", padding: "8px 18px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => { if (t >= end) setT(start); setPlaying(!playing); }}
          style={{ background: playing ? "#ff3355" : "#00c8ff", color: "#021018", border: "none", borderRadius: 5, width: 34, height: 26, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button onClick={() => { setPlaying(false); setT(start); }}
          style={{ background: "rgba(0,200,255,0.08)", color: "#7aa8d0", border: "1px solid rgba(0,160,255,0.2)", borderRadius: 5, padding: "3px 9px", fontSize: 10, cursor: "pointer" }}>
          ⟲ RESET
        </button>
        <span style={{ fontSize: 9, color: "#2a4060", letterSpacing: 2 }}>EVENT TIME (UTC)</span>
        <span style={{ fontSize: 14, color: "#00c8ff", fontFamily: "monospace", fontWeight: 700 }}>{fmtUtc(t)}</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: "#2a4060", letterSpacing: 2 }}>
          SpaceX Starship F12 · Kingston FIR closure · {fmtUtc(start)}–{fmtUtc(end)}
        </span>
      </div>

      {/* scrubber */}
      <div style={{ position: "relative", height: 30 }}>
        {/* casualty entry ticks */}
        {state.flights.filter((f) => f.affected && !f.isHero).map((f, i) => {
          const w = flightWindow(f);
          if (!w) return null;
          return <div key={i} style={{ position: "absolute", left: `${pct(w[0])}%`, top: 14, width: 2, height: 8, background: "rgba(255,107,53,0.5)" }} />;
        })}
        {/* event markers */}
        {markers.map((m) => (
          <div key={m.label} style={{ position: "absolute", left: `${pct(m.t)}%`, top: 0, transform: "translateX(-50%)", textAlign: "center" }}>
            <div style={{ width: 2, height: 10, background: m.c, margin: "0 auto" }} />
            <div style={{ fontSize: 7, color: m.c, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{m.label}</div>
          </div>
        ))}
        <input
          type="range" min={start} max={end} value={t} step={30}
          onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }}
          style={{ position: "absolute", bottom: 0, left: 0, width: "100%", accentColor: "#00c8ff", cursor: "pointer" }}
        />
      </div>
    </div>
  );
}
