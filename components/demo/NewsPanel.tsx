"use client";
import type { StateModel } from "@/lib/airspace/types";

const TAG: Record<string, { bg: string; glow: string }> = {
  "FAA NOTAM": { bg: "#f4511e", glow: "rgba(244,81,30,0.4)" },
  "NWS AWC": { bg: "#1e88e5", glow: "rgba(30,136,229,0.4)" },
  GDELT: { bg: "#8e44ad", glow: "rgba(142,68,173,0.4)" },
};

export default function NewsPanel({ state }: { state: StateModel | null }) {
  const news = state?.news ?? [];
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(2,8,22,0.97)", borderBottom: "1px solid rgba(0,160,255,0.09)" }}>
      <div style={{ padding: "11px 14px", flexShrink: 0, borderBottom: "1px solid rgba(0,160,255,0.07)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13 }}>📡</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#4a6a8a", letterSpacing: 3 }}>POTENTIAL EVENTS</span>
        {news.length > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 8, color: "#00c8ff", letterSpacing: 1, border: "1px solid rgba(0,200,255,0.25)", padding: "1px 6px", borderRadius: 8 }}>LIVE</span>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        {news.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", fontSize: 10, color: "#1e3050", letterSpacing: 2 }}>MONITORING FEEDS…</div>
        ) : news.map((item) => {
          const t = TAG[item.source] ?? { bg: "#1e88e5", glow: "rgba(30,136,229,0.4)" };
          return (
            <div key={item.id} style={{ background: "rgba(6,16,38,0.9)", border: `1px solid ${t.bg}28`, borderLeft: `3px solid ${t.bg}`, borderRadius: 5, padding: "9px 11px", marginBottom: 8, boxShadow: `0 0 12px ${t.glow}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1.2, color: "#fff", background: t.bg, padding: "2px 7px", borderRadius: 3 }}>{item.source}</span>
              </div>
              <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 600, color: "#c8e0f8", lineHeight: 1.4 }}>{item.headline}</p>
              <p style={{ margin: 0, fontSize: 10.5, color: "#6a8aaa", lineHeight: 1.4 }}>{item.summary}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
