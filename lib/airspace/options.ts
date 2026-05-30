// lib/airspace/options.ts
// Priced action options (R6). Heuristics, NOT an optimizer. Ported from backend/options.py.
import type { ActionOption } from "./types";
import {
  HOLDING_USD_PER_HR,
  CREW_OVERNIGHT_USD,
  BURN_GAL_PER_NM,
  JET_A_USD_PER_GAL,
  DELAY_USD_PER_MIN,
} from "./cost";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildOptions(
  windowHours: number,
  extraNm: number,
  nAffected: number,
): ActionOption[] {
  const fleet = Math.max(1, nAffected);
  const hold = HOLDING_USD_PER_HR * windowHours * fleet;
  const divert =
    (extraNm * BURN_GAL_PER_NM * JET_A_USD_PER_GAL + CREW_OVERNIGHT_USD) * fleet;
  const preempt = windowHours * 60 * DELAY_USD_PER_MIN * fleet * 0.5;

  const raw: Array<[ActionOption["kind"], number, string]> = [
    ["hold", round2(hold), "Hold affected flights airborne until the TFR lifts."],
    [
      "divert",
      round2(divert),
      "Divert affected flights to an alternate around the zone.",
    ],
    [
      "preempt",
      round2(preempt),
      "Delay departures on the ground to skip the closure window.",
    ],
  ];
  const cheapest = Math.min(...raw.map(([, c]) => c));
  return raw.map(([kind, costUsd, rationale]) => ({
    kind,
    costUsd,
    cheapest: costUsd === cheapest,
    rationale,
  }));
}
