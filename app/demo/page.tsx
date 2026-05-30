"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { StateModel } from "@/lib/airspace/types";
import PricingPanel from "@/components/demo/PricingPanel";
import ChatPanel from "@/components/demo/ChatPanel";
import NewsPanel from "@/components/demo/NewsPanel";
import TimelinePanel from "@/components/demo/TimelinePanel";
import { accruedAt } from "@/components/demo/accrual";

const DemoMap = dynamic(() => import("@/components/demo/DemoMap"), { ssr: false });

export default function DemoPage() {
  const [state, setState] = useState<StateModel | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((s: StateModel) => {
        setState(s);
        setT(s.window.startSec); // start at TFR activation
      })
      .catch(() => setState(null));
  }, []);

  const acc = state ? accruedAt(state, t) : { cost: 0, affected: 0, frac: 0 };
  const total = "$" + Math.round(acc.cost).toLocaleString("en-US");

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#040c1e", display: "grid", gridTemplateRows: "54px 1fr auto 40px", overflow: "hidden", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", color: "#c8e0f8" }}>
      <header style={{ display: "flex", alignItems: "center", padding: "0 18px", background: "rgba(2,6,18,0.98)", borderBottom: "1px solid rgba(0,160,255,0.12)" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#00c8ff", letterSpacing: 3 }}>✈ DELAYED PROPAGATION</div>
        <div style={{ marginLeft: 14, fontSize: 9, color: "#00c8ff", letterSpacing: 3, padding: "2px 8px", border: "1px solid rgba(0,200,255,0.25)", borderRadius: 3 }}>OPS · COST OPTIMIZER</div>
        <div style={{ marginLeft: 18, fontSize: 11, color: "#3a5a7a", letterSpacing: 1.5 }}>INCIDENT · SpaceX Starship Flight 12 · Kingston FIR Closure · May 22 2026</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: playing ? "#00ff88" : "#3a5a7a", boxShadow: playing ? "0 0 10px #00ff88" : "none" }} />
          <span style={{ fontSize: 10, color: "#4a6a8a", letterSpacing: 1 }}>{playing ? "PLAYING" : "PAUSED"}</span>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 360px", overflow: "hidden", minHeight: 0 }}>
        <div style={{ borderRight: "1px solid rgba(0,160,255,0.09)", display: "flex", minHeight: 0 }}>
          <PricingPanel state={state} t={t} />
        </div>
        <div style={{ minHeight: 0 }}>
          <DemoMap state={state} t={t} />
        </div>
        <div style={{ borderLeft: "1px solid rgba(0,160,255,0.09)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <NewsPanel state={state} />
          <ChatPanel />
        </div>
      </div>

      {/* timeline — always visible, drives everything */}
      <TimelinePanel state={state} t={t} setT={setT} playing={playing} setPlaying={setPlaying} />

      <footer style={{ display: "flex", alignItems: "center", padding: "0 18px", gap: 28, background: "rgba(1,4,12,0.98)", borderTop: "1px solid rgba(0,160,255,0.09)" }}>
        <Stat label="FLIGHTS AFFECTED" val={String(acc.affected)} c="#ff6b35" />
        <Stat label="DISRUPTION COST" val={total} c="#ff3355" />
        <Stat label="WEATHER" val="CLEAR VFR" c="#00ff88" />
        <Stat label="TFR" val="ACTIVE" c="#ff3355" />
        <div style={{ marginLeft: "auto", fontSize: 9, color: "#1a2840", letterSpacing: 2 }}>OPENSKY · A4A · FAA/DOT · EUROCONTROL</div>
      </footer>
    </div>
  );
}

function Stat({ label, val, c }: { label: string; val: string; c: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontSize: 9, color: "#2a4060", letterSpacing: 2 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: c, textShadow: `0 0 8px ${c}60` }}>{val}</span>
    </div>
  );
}
