// lib/airspace/network.ts
// Network view + coordination gap (R7). Reference computation, not a solver. Ported from backend/network.py.
import type { NetworkView } from "./types";

export const COORDINATION_FACTOR = 0.75; // coordinated = 75% of everyone acting alone

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildNetworkView(selfishTotalUsd: number): NetworkView {
  const coordinated = round2(selfishTotalUsd * COORDINATION_FACTOR);
  return {
    selfishUsd: round2(selfishTotalUsd),
    coordinatedUsd: coordinated,
    gapUsd: round2(selfishTotalUsd - coordinated),
  };
}
