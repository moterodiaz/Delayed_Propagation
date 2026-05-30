// lib/airspace/types.ts
// Output contract for /api/state and /api/chat. Aligned to lib/types.ts ({lat,lng}).
import type { LatLng } from "@/lib/types";

export interface TrackPoint extends LatLng {
  t: number; // epoch seconds
}

export interface FlightState {
  id: string;
  icao24: string;
  track: TrackPoint[]; // only the hero (isHero) has a full track; casualties are []
  affected: boolean;
  isHero: boolean;
  arr?: string | null;
  firstSeen?: number | null;
  lastSeen?: number | null;
  costUsd?: number; // this flight's disruption cost (for timeline accrual)
}

export interface CostLineItem {
  label: string;
  usd: number;
  source: string; // published citation for the rate behind this line
}

export interface CostBreakdown {
  totalUsd: number;
  lineItems: CostLineItem[]; // itemized, citable — the "show the data" surface
  detail: string;
  // legacy roll-ups (kept for any consumer): airline operating delay, passenger, other
  delayUsd: number;
  fuelUsd: number;
  crewUsd: number;
}

export type ActionKind = "hold" | "divert" | "preempt";

export interface ActionOption {
  kind: ActionKind;
  costUsd: number;
  cheapest: boolean;
  rationale: string;
}

export interface EventCard {
  id: string;
  name: string;
  summary: string;
  polygon: LatLng[];
  affectedFlightIds: string[];
  cost: CostBreakdown;
  options: ActionOption[];
  bookmarked: boolean;
}

export interface NetworkView {
  selfishUsd: number;
  coordinatedUsd: number;
  gapUsd: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  canBookmark: boolean;
}

export interface MetarMarker {
  station: string;
  lat: number;
  lng: number;
  flightCategory: string; // "VFR" = green (the clear-weather paradox)
  raw: string;
}

export interface CostRateDoc {
  key: string;
  rate: number;
  unit: string;
  source: string;
}

export interface StateModel {
  events: EventCard[];
  flights: FlightState[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sectors: any; // GeoJSON FeatureCollection passthrough
  weather: MetarMarker[];
  news: NewsItem[];
  network: NetworkView;
  costModel: CostRateDoc[]; // published rates + sources — the "show the data" surface
  window: { startSec: number; endSec: number }; // event closure window (epoch sec) for the timeline
}
