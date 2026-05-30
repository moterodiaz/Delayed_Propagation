// lib/airspace/cost.ts
// Deterministic cost engine (R5). Pure functions, no I/O. Ported from backend/cost.py.
import type { FlightState, CostBreakdown } from "./types";

export const JET_A_USD_PER_GAL = 3.75;
export const BURN_GAL_PER_NM = 12.0; // narrowbody cruise approximation
export const HOLDING_USD_PER_HR = 3500.0;
export const CREW_OVERNIGHT_USD = 1800.0; // hotel + per-diem
export const DELAY_USD_PER_MIN = 100.0; // composite gate/delay
const EARTH_NM = 3440.065;

export function greatCircleNm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLmb = toRad(lng2 - lng1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLmb / 2) ** 2;
  return EARTH_NM * 2 * Math.asin(Math.sqrt(a));
}

export function trackLengthNm(flight: FlightState): number {
  let total = 0;
  const w = flight.track;
  for (let i = 0; i < w.length - 1; i++) {
    total += greatCircleNm(w[i].lat, w[i].lng, w[i + 1].lat, w[i + 1].lng);
  }
  return total;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function flightCost(
  flight: FlightState,
  destLat: number,
  destLng: number,
): CostBreakdown {
  let extraNm = 0;
  let fuel = 0;
  let delayMin = 0;
  let detail = "";

  if (flight.track.length > 0) {
    const flown = trackLengthNm(flight);
    const o = flight.track[0];
    const direct = greatCircleNm(o.lat, o.lng, destLat, destLng);
    extraNm = Math.max(0, flown - direct);
    fuel = extraNm * BURN_GAL_PER_NM * JET_A_USD_PER_GAL;
    delayMin = (extraNm / 450) * 60;
    detail = `${extraNm.toFixed(0)} extra nm, ${delayMin.toFixed(0)} min delay`;
  } else {
    // trackless casualty: window-exposure time as a delay proxy
    const exposureS =
      flight.lastSeen != null && flight.firstSeen != null
        ? flight.lastSeen - flight.firstSeen
        : 0;
    delayMin = Math.max(0, exposureS / 60);
    detail = `${delayMin.toFixed(0)} min in closed airspace`;
  }

  const delay = delayMin * DELAY_USD_PER_MIN;
  const crew = delayMin > 180 ? CREW_OVERNIGHT_USD : 0;
  const total = fuel + delay + crew;
  return {
    totalUsd: round2(total),
    delayUsd: round2(delay),
    fuelUsd: round2(fuel),
    crewUsd: round2(crew),
    detail,
  };
}

export function eventCost(
  flights: FlightState[],
  destLat: number,
  destLng: number,
): CostBreakdown {
  const aff = flights.filter((f) => f.affected);
  const parts = aff.map((f) => flightCost(f, destLat, destLng));
  return {
    totalUsd: round2(parts.reduce((s, p) => s + p.totalUsd, 0)),
    delayUsd: round2(parts.reduce((s, p) => s + p.delayUsd, 0)),
    fuelUsd: round2(parts.reduce((s, p) => s + p.fuelUsd, 0)),
    crewUsd: round2(parts.reduce((s, p) => s + p.crewUsd, 0)),
    detail: `${aff.length} affected flights`,
  };
}
