// lib/data/kingstonTFR.ts
//
// Closure geometry for the SpaceX Starship Flight 12 event, 2026-05-22.
//
//   - REAL:  the published Kingston FIR (MKJK) boundary — ICAO/AIP-derived
//            (VATSIM VATSpy dataset). This is the genuine airspace region the
//            NOTAM closed. Medium confidence: the closure was "part of" the FIR;
//            the exact TFR sub-polygon is not publicly available.
//   - DRAWN: a synthetic projected hazard/debris corridor extending north from
//            the FIR toward the JBU1575 turnpoint (~23.83N). The real FIR tops
//            out at 20.0N — ~230nm south of where the plane turned — so this
//            corridor bridges the gap to explain the turn-back. NOT real coords;
//            labeled as an estimate and rendered dashed/amber.

import type { TFRZone } from "@/lib/types";

// Real MKJK FIR boundary (closed ring), {lat, lng}. Source: ICAO/AIP via VATSpy.
const KINGSTON_FIR = [
  { lat: 20.0, lng: -82.0 },
  { lat: 20.0, lng: -78.333333 },
  { lat: 19.5, lng: -77.5 },
  { lat: 18.5, lng: -75.0 },
  { lat: 17.0, lng: -73.0 },
  { lat: 16.0, lng: -74.0 },
  { lat: 15.0, lng: -74.0 },
  { lat: 15.0, lng: -82.25 },
  { lat: 19.0, lng: -82.083333 },
  { lat: 20.0, lng: -82.0 },
];

// Synthetic hazard corridor — bridges the real FIR (20N) up to the turnpoint
// (~23.83N) along the launch trajectory. Estimated, not published.
const DEBRIS_CORRIDOR = [
  { lat: 20.0, lng: -79.0 },
  { lat: 24.2, lng: -78.6 },
  { lat: 24.2, lng: -77.4 },
  { lat: 20.0, lng: -76.5 },
  { lat: 20.0, lng: -79.0 },
];

const ACTIVE_FROM = 1800; // 21:30Z
const ACTIVE_TO = 9780; // 23:43Z

export const KINGSTON_TFRS: TFRZone[] = [
  {
    id: "TFR-KINGSTON-FIR",
    label: "Kingston FIR Closure -- Starship Flight 12",
    polygon: KINGSTON_FIR,
    activeFrom: ACTIVE_FROM,
    activeTo: ACTIVE_TO,
    severity: "danger",
    reason:
      "Real MKJK FIR boundary (ICAO/AIP). Closed 21:30-23:43Z, 2026-05-22. Exact TFR sub-polygon not public.",
  },
  {
    id: "TFR-DEBRIS-CORRIDOR",
    label: "Projected Hazard Corridor (est.)",
    polygon: DEBRIS_CORRIDOR,
    activeFrom: ACTIVE_FROM,
    activeTo: ACTIVE_TO,
    severity: "warning",
    reason:
      "SYNTHETIC estimate -- launch hazard/debris corridor extending north toward the Bahamas turnpoint. Not published coordinates.",
  },
];
