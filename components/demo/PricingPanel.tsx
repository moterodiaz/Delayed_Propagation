"use client";
import type { StateModel } from "@/lib/airspace/types";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export default function PricingPanel({ state }: { state: StateModel | null }) {
  if (!state) return <Panel title="PRICING & OPTIONS">Loading…</Panel>;
  const e = state.events[0];
  const n = state.network;

  return (
    <Panel title="💰 PRICING & ACTION OPTIONS">
      {/* headline cost */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,160,255,0.08)" }}>
        <div style={{ fontSize: 9, color: "#4a6a8a", letterSpacing: 2 }}>TOTAL DISRUPTION COST</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#ff3355", fontFamily: "monospace", textShadow: "0 0 14px rgba(255,51,85,0.4)" }}>
          {usd(e.cost.totalUsd)}
        </div>
        <div style={{ fontSize: 10, color: "#4a6a8a" }}>{e.cost.detail}</div>
        {/* line items */}
        <div style={{ marginTop: 8 }}>
          {e.cost.lineItems.map((li) => (
            <div key={li.label} title={li.source} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", color: "#9abcda", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span>{li.label}</span>
              <span style={{ fontFamily: "monospace", color: "#c8e0f8" }}>{usd(li.usd)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* priced options */}
      <div style={{ padding: "10px 14px" }}>
        <div style={{ fontSize: 9, color: "#4a6a8a", letterSpacing: 2, marginBottom: 8 }}>RESPONSE OPTIONS (cheapest flagged)</div>
        {e.options.map((o) => (
          <div key={o.kind} style={{
            position: "relative",
            background: o.cheapest ? "rgba(67,160,71,0.08)" : "rgba(6,16,38,0.85)",
            border: o.cheapest ? "1px solid rgba(67,160,71,0.45)" : "1px solid rgba(0,160,255,0.1)",
            borderRadius: 5, padding: "9px 11px", marginBottom: 8,
          }}>
            {o.cheapest && (
              <div style={{ position: "absolute", top: 0, right: 8, fontSize: 8, fontWeight: 800, letterSpacing: 1, color: "#050d1a", background: "#43a047", padding: "2px 7px", borderRadius: "0 0 4px 4px" }}>CHEAPEST</div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#c8e0f8", textTransform: "capitalize" }}>{o.kind}</span>
              <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: o.cheapest ? "#00ff88" : "#ffae42" }}>{usd(o.costUsd)}</span>
            </div>
            <p style={{ margin: 0, fontSize: 10.5, color: "#4a6a8a", lineHeight: 1.4 }}>{o.rationale}</p>
          </div>
        ))}
      </div>

      {/* network gap */}
      <div style={{ marginTop: "auto", padding: "11px 14px", borderTop: "1px solid rgba(0,160,255,0.08)", background: "rgba(0,200,255,0.04)" }}>
        <div style={{ fontSize: 9, color: "#4a6a8a", letterSpacing: 2, marginBottom: 4 }}>NETWORK COORDINATION GAP</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9abcda" }}>
          <span>Acting alone</span><span style={{ fontFamily: "monospace" }}>{usd(n.selfishUsd)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9abcda" }}>
          <span>If coordinated</span><span style={{ fontFamily: "monospace" }}>{usd(n.coordinatedUsd)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#00ff88", marginTop: 3 }}>
          <span>SAVINGS GAP</span><span style={{ fontFamily: "monospace", textShadow: "0 0 10px rgba(0,255,136,0.4)" }}>{usd(n.gapUsd)}</span>
        </div>
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto", background: "rgba(2,6,18,0.98)" }}>
      <div style={{ padding: "11px 14px", flexShrink: 0, borderBottom: "1px solid rgba(0,160,255,0.07)", fontSize: 9, fontWeight: 700, color: "#4a6a8a", letterSpacing: 3 }}>{title}</div>
      {children}
    </div>
  );
}
