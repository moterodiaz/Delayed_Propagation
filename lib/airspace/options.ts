// lib/airspace/options.ts
// Priced action options (R6) with cited, itemized breakdowns. Heuristics, NOT an optimizer.
import type { ActionOption, CostLineItem } from "./types";
import {
  BLOCK_COST_PER_MIN,
  PAX_VALUE_PER_MIN,
  PAX_PER_FLIGHT,
  DIVERSION_PENALTY_USD,
  REACCOMMODATION_PER_PAX,
} from "./cost";

const round2 = (n: number) => Math.round(n * 100) / 100;

const SRC_BLOCK = "A4A U.S. Passenger Carrier Delay Costs 2024 ($100.76/block-min)";
const SRC_PAX = "FAA/DOT value of passenger time ($0.78/min/pax × 150 seats)";
const SRC_DIV = "EUROCONTROL Standard Inputs / The Points Guy diversion cost (A320 ≈ $92.5k)";
const SRC_RE = "The Points Guy / Hawaiian A330 turnback (~$150/pax reaccommodation)";

// Ground-hold burns ~30% of airborne block cost (no fuel burn; crew/ownership still accrue).
const GROUND_HOLD_FACTOR = 0.3;

export function buildOptions(
  windowHours: number,
  _wastedNm: number,
  nAffected: number,
): ActionOption[] {
  const fleet = Math.max(1, nAffected);
  const holdMin = windowHours * 60;
  const paxPerMin = PAX_VALUE_PER_MIN * PAX_PER_FLIGHT;

  const holdBlock = BLOCK_COST_PER_MIN * holdMin * fleet;
  const holdPax = paxPerMin * holdMin * fleet;
  const divPenalty = DIVERSION_PENALTY_USD * fleet;
  const divReaccom = REACCOMMODATION_PER_PAX * PAX_PER_FLIGHT * fleet;
  const preBlock = BLOCK_COST_PER_MIN * GROUND_HOLD_FACTOR * holdMin * fleet;
  const prePax = paxPerMin * holdMin * fleet;

  const m = holdMin.toFixed(0);
  const li = (label: string, usd: number, source: string): CostLineItem => ({ label, usd: round2(usd), source });

  const raw: Array<{ kind: ActionOption["kind"]; cost: number; rationale: string; breakdown: CostLineItem[] }> = [
    {
      kind: "hold",
      cost: holdBlock + holdPax,
      rationale: "Hold affected flights airborne until the TFR lifts.",
      breakdown: [
        li(`Airborne block hold (${m} min × ${fleet} flights × $100.76/min)`, holdBlock, SRC_BLOCK),
        li(`Passenger value of time (${m} min × 150 pax × $0.78/min × ${fleet})`, holdPax, SRC_PAX),
      ],
    },
    {
      kind: "divert",
      cost: divPenalty + divReaccom,
      rationale: "Divert every affected flight to an alternate around the zone.",
      breakdown: [
        li(`Diversion penalty (${fleet} flights × $92,500)`, divPenalty, SRC_DIV),
        li(`Passenger reaccommodation (${fleet} × 150 pax × $150)`, divReaccom, SRC_RE),
      ],
    },
    {
      kind: "preempt",
      cost: preBlock + prePax,
      rationale: "Delay departures on the ground to skip the closure window (no fuel burn, no diversion).",
      breakdown: [
        li(`Ground hold (30% block, ${m} min × ${fleet} × $100.76/min)`, preBlock, SRC_BLOCK + " — ground rate, no fuel burn"),
        li(`Passenger value of time (${m} min × 150 pax × $0.78/min × ${fleet})`, prePax, SRC_PAX),
      ],
    },
  ];

  const cheapest = Math.min(...raw.map((r) => round2(r.cost)));
  return raw.map((r) => ({
    kind: r.kind,
    costUsd: round2(r.cost),
    cheapest: round2(r.cost) === cheapest,
    rationale: r.rationale,
    breakdown: r.breakdown,
  }));
}
