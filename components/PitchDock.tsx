"use client";
import { useState } from "react";
import type { StateModel } from "@/lib/airspace/types";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export default function PitchDock({ state }: { state: StateModel | null }) {
  const [open, setOpen] = useState(false);
  const e = state?.events[0];
  const n = state?.network;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500"
      >
        ℹ Pitch / Explain
      </button>

      {open && (
        <div className="fixed inset-0 z-[2000] flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-[460px] max-w-[92vw] h-full overflow-y-auto bg-gray-950 border-l border-gray-700 p-6 text-gray-200"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">The Pitch</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
            </div>

            <Section title="What happened">
              On <b>May 22, 2026</b>, SpaceX Starship Flight 12 launched from Boca Chica. The FAA + Jamaica CAA
              closed part of the <b>Kingston FIR</b> from <b>21:30–23:43Z</b>. Weather across KFLL/KMIA/MKJP was
              <b> clear VFR</b> — a normal weather dashboard showed all green, but the space NOTAM was a wall.
              JetBlue <b>JBU1575</b> (KFLL→Kingston) flew toward the closure, <b>U-turned over the Bahamas</b>, and
              returned to Fort Lauderdale. Behind it, ~42 flights were grounded or held.
            </Section>

            <Section title="The event sequence">
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li><b>17:30 EDT</b> — NOTAM A0183/26: launch TFR, surface-to-space closure.</li>
                <li><b>18:30</b> — launch + Super Heavy booster hard splashdown → debris freeze +45 min.</li>
                <li><b>19:15</b> — <b>NOTAM B0975/26</b>: reentry risk corridor, Kingston inbound blocked.</li>
                <li><b>19:45</b> — jet fuel spot +6.6% at MIA/FLL from diversions.</li>
              </ul>
            </Section>

            <Section title="What it cost">
              <div className="text-2xl font-mono font-bold text-red-400 mb-1">{usd(e?.cost.totalUsd ?? 0)}</div>
              <div className="text-xs text-gray-400 mb-2">{e?.affectedFlightIds.length ?? 0} affected flights. Every line is a published rate:</div>
              <table className="w-full text-xs">
                <tbody>
                  {(e?.cost.lineItems ?? []).map((li) => (
                    <tr key={li.label} className="border-b border-gray-800">
                      <td className="py-1 text-gray-300">{li.label}</td>
                      <td className="py-1 text-right font-mono text-gray-100">{usd(li.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="The 3 action options">
              {(e?.options ?? []).map((o) => (
                <div key={o.kind} className="flex justify-between text-sm py-1">
                  <span className="capitalize">{o.kind}{o.cheapest && <span className="ml-2 text-green-400 text-xs">CHEAPEST</span>}</span>
                  <span className="font-mono">{usd(o.costUsd)}</span>
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-2">Pre-empt (ground-hold to skip the window) beats holding airborne or diverting.</p>
            </Section>

            <Section title="The wider board">
              <p className="text-sm">
                Acting alone costs <b>{usd(n?.selfishUsd ?? 0)}</b>. If carriers coordinated slot usage, total drops to{" "}
                <b>{usd(n?.coordinatedUsd ?? 0)}</b> — a <b className="text-green-400">{usd(n?.gapUsd ?? 0)}</b> gap left
                on the table. You only move your own flights, but the board shows the whole picture.
              </p>
            </Section>

            <p className="text-[11px] text-gray-500 mt-4">Sources: A4A 2024 · FAA/DOT · EUROCONTROL · OpenSky. Full write-up in PITCH.md.</p>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-bold text-cyan-400 tracking-widest uppercase mb-2">{title}</h3>
      <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}
