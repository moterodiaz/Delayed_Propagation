// Timeline accrual: how much of the disruption has materialized by sim time `t` (epoch sec).
import type { StateModel, FlightState } from "@/lib/airspace/types";

export function flightWindow(f: FlightState): [number, number] | null {
  if (f.track.length > 0) return [f.track[0].t, f.track[f.track.length - 1].t];
  if (f.firstSeen != null && f.lastSeen != null) return [f.firstSeen, f.lastSeen];
  return null;
}

export interface Accrued {
  cost: number;
  affected: number;
  frac: number; // 0..1 of full event cost
}

export function accruedAt(state: StateModel, t: number): Accrued {
  let cost = 0;
  let affected = 0;
  for (const f of state.flights) {
    if (!f.affected || !f.costUsd) continue;
    const w = flightWindow(f);
    if (!w) {
      cost += f.costUsd;
      affected++;
      continue;
    }
    const [s, e] = w;
    if (t < s) continue;
    affected++;
    const frac = e <= s ? 1 : Math.min(1, (t - s) / (e - s));
    cost += f.costUsd * frac;
  }
  const full = state.events[0]?.cost.totalUsd ?? 0;
  return { cost, affected, frac: full ? cost / full : 0 };
}

/** Interpolate the hero's position at sim time `t`. Returns [lat,lng] or null. */
export function heroPositionAt(
  track: { lat: number; lng: number; t: number }[],
  t: number,
): [number, number] | null {
  if (track.length === 0) return null;
  if (t <= track[0].t) return [track[0].lat, track[0].lng];
  const last = track[track.length - 1];
  if (t >= last.t) return [last.lat, last.lng];
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return [a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f];
    }
  }
  return [last.lat, last.lng];
}

/** Dead-reckon a position forward along a heading at velocity (m/s) for dt seconds. */
export function projectForward(
  lat: number,
  lng: number,
  headingDeg: number,
  velocityMs: number,
  dtSec: number,
): [number, number] {
  const R = 6371000;
  const d = velocityMs * dtSec;
  if (d <= 0) return [lat, lng];
  const br = (headingDeg * Math.PI) / 180;
  const la1 = (lat * Math.PI) / 180;
  const lo1 = (lng * Math.PI) / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d / R) + Math.cos(la1) * Math.sin(d / R) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d / R) * Math.cos(la1), Math.cos(d / R) - Math.sin(la1) * Math.sin(la2));
  return [(la2 * 180) / Math.PI, (lo2 * 180) / Math.PI];
}

export function fmtUtc(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}Z`;
}
