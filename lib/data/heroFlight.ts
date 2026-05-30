// lib/data/heroFlight.ts
//
// The hero flight JBU1575 (JetBlue 1575), built from REAL cached ADS-B.
//
// IMPORTANT — what is real vs drawn:
//   - REAL:  the return leg (229 waypoints) from the Bahamas turnpoint (~23.83N,
//            -78.30) home to KFLL. Positions + timing are real OpenSky ADS-B.
//   - DRAWN: a synthetic outbound leg KFLL -> turnpoint, prepended so the full
//            depart -> fly-toward-closure -> U-turn arc animates. Every synthetic
//            waypoint is flagged { synthetic: true } and the map renders it dashed.
//
// The seam is the turnpoint: the synthetic leg ends exactly where the real leg
// begins (same lat/lng/t), so the path is continuous.
//
// Deterministic: computed at import from fixed inputs. No Date/random (R9).

import type { Flight, Waypoint } from "@/lib/types";
import rawTrack from "@/data/jbu1575_track.json";

// Sim t0 = 17:00 EDT = 21:00:00Z, 2026-05-22. Real epochs map to sim seconds by
// subtracting this. (The real return leg lands at sim t ~2239-4551s; the TFR
// activates at 1800s = 21:30Z, so the wall appears before the plane turns home.)
const SIM_ZERO_EPOCH = 1779484800;

interface RawWaypoint {
  t: number; // epoch seconds
  lat: number;
  lon: number;
  alt_m: number;
  heading: number;
  on_ground: boolean;
}

const realWaypoints = (rawTrack as { waypoints: RawWaypoint[] }).waypoints;

// Real return leg: lon -> lng, epoch -> sim seconds.
const realLeg: Waypoint[] = realWaypoints.map((w) => ({
  lat: w.lat,
  lng: w.lon,
  t: w.t - SIM_ZERO_EPOCH,
  synthetic: false,
}));

const TURNPOINT = realLeg[0]; // real first point: the Bahamas U-turn (~t 2239)
const KFLL = { lat: 26.072, lng: -80.152 };
const DEPART_T = 600; // 17:10 EDT — synthetic departure off the gate

// Synthetic outbound: KFLL -> turnpoint. Linear interpolation along the leg,
// ending one step short of the turnpoint (the real leg supplies that vertex).
const OUTBOUND_STEPS = 8;
const synthOutbound: Waypoint[] = Array.from({ length: OUTBOUND_STEPS }, (_, i) => {
  const f = i / OUTBOUND_STEPS;
  return {
    lat: KFLL.lat + (TURNPOINT.lat - KFLL.lat) * f,
    lng: KFLL.lng + (TURNPOINT.lng - KFLL.lng) * f,
    t: Math.round(DEPART_T + (TURNPOINT.t - DEPART_T) * f),
    synthetic: true,
  };
});

export const HERO_FLIGHT: Flight = {
  id: "B61575",
  callsign: "JetBlue 1575",
  airline: "JetBlue",
  origin: "KFLL",
  destination: "MKJP",
  status: "diverted",
  waypoints: [...synthOutbound, ...realLeg],
};
