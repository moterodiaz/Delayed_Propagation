// lib/airspace/cost.ts
// Deterministic cost engine (R5). Pure functions, no I/O.
// Every rate is sourced from published aviation figures (see Context(Docs)/Cost_Model.md).
// Model maximizes the DEFENSIBLE total disruption cost — the bigger the loss, the larger
// the value of the cost optimizer.
import type { FlightState, CostBreakdown, CostLineItem, CostRateDoc } from "./types";

// --- Published rates (sources cited per constant) ---
// A4A 2024: avg all-in cost of aircraft block time = $100.76/min (labor $35.23 + fuel $33.06 + maint/ownership/other).
export const BLOCK_COST_PER_MIN = 100.76;
const SRC_BLOCK = "A4A U.S. Passenger Carrier Delay Costs 2024 ($100.76/block-min)";

// FAA/DOT value of passenger time: $47/hr ≈ $0.78/min per passenger.
export const PAX_VALUE_PER_MIN = 0.78;
const SRC_PAX_TIME = "FAA/DOT value of passenger time ($47/hr ≈ $0.78/min/pax)";

// JetBlue mainline (A320/A321) typical seats.
export const PAX_PER_FLIGHT = 150;

// Passenger reaccommodation (meal vouchers + rebooking). Hawaiian A330 turnback: ~$47k vouchers / 300 pax ≈ $157/pax.
export const REACCOMMODATION_PER_PAX = 150;
const SRC_REACCOM = "The Points Guy / Hawaiian A330 turnback (~$150/pax care+rebooking)";

// Fraction of a merely-delayed flight's pax who misconnect and must be reaccommodated.
export const MISSED_CONNECTION_RATE = 0.15;

// Diversion / turnback penalty for a flight that does not reach its destination.
// Documented diversion range $25k (regional) to $200k+ (widebody); A320 turnback ~$92.5k midpoint.
export const DIVERSION_PENALTY_USD = 92500;
const SRC_DIVERSION =
  "EUROCONTROL Standard Inputs / The Points Guy diversion cost ($25k–$200k+; A320 turnback ~$92.5k)";

// Crew overnight (hotel + per-diem) when a delay times the crew out (> 3 h).
export const CREW_OVERNIGHT_USD = 1800;
const SRC_CREW = "Crew duty-limit overnight (hotel + per-diem)";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Exposed for the methodology / "show the data" surface.
export const COST_RATES: CostRateDoc[] = [
  { key: "BLOCK_COST_PER_MIN", rate: BLOCK_COST_PER_MIN, unit: "$/block-min", source: SRC_BLOCK },
  { key: "PAX_VALUE_PER_MIN", rate: PAX_VALUE_PER_MIN, unit: "$/min/pax", source: SRC_PAX_TIME },
  { key: "PAX_PER_FLIGHT", rate: PAX_PER_FLIGHT, unit: "seats", source: "JetBlue A320/A321 typical" },
  { key: "REACCOMMODATION_PER_PAX", rate: REACCOMMODATION_PER_PAX, unit: "$/pax", source: SRC_REACCOM },
  { key: "MISSED_CONNECTION_RATE", rate: MISSED_CONNECTION_RATE, unit: "fraction", source: "industry misconnect rate" },
  { key: "DIVERSION_PENALTY_USD", rate: DIVERSION_PENALTY_USD, unit: "$/diverted flight", source: SRC_DIVERSION },
  { key: "CREW_OVERNIGHT_USD", rate: CREW_OVERNIGHT_USD, unit: "$/crew", source: SRC_CREW },
];

export function greatCircleNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLmb = toRad(lng2 - lng1);
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLmb / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.sqrt(a));
}

export function trackLengthNm(flight: FlightState): number {
  let total = 0;
  const w = flight.track;
  for (let i = 0; i < w.length - 1; i++) {
    total += greatCircleNm(w[i].lat, w[i].lng, w[i + 1].lat, w[i + 1].lng);
  }
  return total;
}

/** Minutes the flight was disrupted: hero = whole wasted block time (it returned to origin);
 *  trackless casualty = time exposed inside the closure window. */
function disruptionMinutes(flight: FlightState): number {
  if (flight.track.length > 0) {
    const t0 = flight.track[0].t;
    const t1 = flight.track[flight.track.length - 1].t;
    return Math.max(0, (t1 - t0) / 60);
  }
  if (flight.lastSeen != null && flight.firstSeen != null) {
    return Math.max(0, (flight.lastSeen - flight.firstSeen) / 60);
  }
  return 0;
}

export function flightCost(flight: FlightState): CostBreakdown {
  const delayMin = disruptionMinutes(flight);
  const diverted = flight.isHero; // hero returned to origin = a turnback/diversion
  // Real wasted track distance (hero flew out + back for zero net progress ≈ 373 nm of real ADS-B).
  // Informational only — fuel is already inside the A4A block-minute rate, so we do NOT add it
  // to the total (would double-count). See Context(Docs)/Cost_Model.md.
  const wastedNm = flight.track.length > 0 ? trackLengthNm(flight) : 0;

  const airlineDelay = delayMin * BLOCK_COST_PER_MIN;
  const paxTime = delayMin * PAX_VALUE_PER_MIN * PAX_PER_FLIGHT;
  const reaccomPax = diverted
    ? PAX_PER_FLIGHT
    : PAX_PER_FLIGHT * MISSED_CONNECTION_RATE;
  const reaccom = reaccomPax * REACCOMMODATION_PER_PAX;
  const diversion = diverted ? DIVERSION_PENALTY_USD : 0;
  const crew = delayMin > 180 || diverted ? CREW_OVERNIGHT_USD : 0;

  const lineItems: CostLineItem[] = [
    { label: "Aircraft block time (delay)", usd: round2(airlineDelay), source: SRC_BLOCK },
    { label: "Passenger value of time", usd: round2(paxTime), source: SRC_PAX_TIME },
    { label: "Passenger reaccommodation", usd: round2(reaccom), source: SRC_REACCOM },
  ];
  if (diversion) lineItems.push({ label: "Diversion / turnback penalty", usd: round2(diversion), source: SRC_DIVERSION });
  if (crew) lineItems.push({ label: "Crew overnight", usd: round2(crew), source: SRC_CREW });

  const total = lineItems.reduce((s, li) => s + li.usd, 0);
  return {
    totalUsd: round2(total),
    lineItems,
    detail:
      `${delayMin.toFixed(0)} min disrupted` +
      (wastedNm > 0 ? `, ${wastedNm.toFixed(0)} nm flown for zero net progress` : "") +
      (diverted ? ", returned to origin" : ""),
    delayUsd: round2(airlineDelay),
    fuelUsd: 0,
    crewUsd: round2(crew),
  };
}

export function eventCost(flights: FlightState[]): CostBreakdown {
  const aff = flights.filter((f) => f.affected);
  const parts = aff.map((f) => flightCost(f));

  // aggregate line items by label
  const byLabel = new Map<string, { usd: number; source: string }>();
  for (const p of parts) {
    for (const li of p.lineItems) {
      const cur = byLabel.get(li.label) ?? { usd: 0, source: li.source };
      cur.usd += li.usd;
      byLabel.set(li.label, cur);
    }
  }
  const lineItems: CostLineItem[] = [...byLabel.entries()].map(([label, v]) => ({
    label,
    usd: round2(v.usd),
    source: v.source,
  }));
  const total = round2(parts.reduce((s, p) => s + p.totalUsd, 0));
  return {
    totalUsd: total,
    lineItems,
    detail: `${aff.length} affected flights`,
    delayUsd: round2(parts.reduce((s, p) => s + p.delayUsd, 0)),
    fuelUsd: 0,
    crewUsd: round2(parts.reduce((s, p) => s + p.crewUsd, 0)),
  };
}
