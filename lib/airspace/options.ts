// lib/airspace/options.ts
// Priced action options (R6). Heuristics, NOT an optimizer. Rates sourced (see cost.ts).
import type { ActionOption } from "./types";
import {
  BLOCK_COST_PER_MIN,
  PAX_VALUE_PER_MIN,
  PAX_PER_FLIGHT,
  DIVERSION_PENALTY_USD,
  REACCOMMODATION_PER_PAX,
} from "./cost";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Ground-hold burns ~30% of airborne block cost (no fuel burn, crew/ownership still accrue).
const GROUND_HOLD_FACTOR = 0.3;

export function buildOptions(
  windowHours: number,
  _wastedNm: number,
  nAffected: number,
): ActionOption[] {
  const fleet = Math.max(1, nAffected);
  const holdMin = windowHours * 60;
  const paxTimePerMin = PAX_VALUE_PER_MIN * PAX_PER_FLIGHT;

  // Hold airborne until the TFR lifts: full block cost + passenger time, per flight.
  const hold = (BLOCK_COST_PER_MIN * holdMin + paxTimePerMin * holdMin) * fleet;
  // Divert every affected flight to an alternate: diversion penalty + full reaccommodation.
  const divert =
    (DIVERSION_PENALTY_USD + REACCOMMODATION_PER_PAX * PAX_PER_FLIGHT) * fleet;
  // Pre-empt: hold departures on the ground to skip the window — no fuel burn, no diversion.
  const preempt =
    (BLOCK_COST_PER_MIN * GROUND_HOLD_FACTOR * holdMin + paxTimePerMin * holdMin) *
    fleet;

  const raw: Array<[ActionOption["kind"], number, string]> = [
    ["hold", round2(hold), "Hold affected flights airborne until the TFR lifts (full block + passenger time)."],
    ["divert", round2(divert), "Divert every affected flight to an alternate (diversion penalty + reaccommodation)."],
    ["preempt", round2(preempt), "Delay departures on the ground to skip the closure window (no fuel burn, no diversion)."],
  ];
  const cheapest = Math.min(...raw.map(([, c]) => c));
  return raw.map(([kind, costUsd, rationale]) => ({
    kind,
    costUsd,
    cheapest: costUsd === cheapest,
    rationale,
  }));
}
