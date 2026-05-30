// lib/opensky.ts
import type { LiveFlight } from "./types";

const OPENSKY_URL = "/api/flights";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeStateVector(sv: any[]): LiveFlight | null {
  const lng = sv[5] as number | null;
  const lat = sv[6] as number | null;
  if (lat == null || lng == null) return null;

  return {
    icao24: sv[0] as string,
    callsign: ((sv[1] as string | null) ?? "").trim() || (sv[0] as string),
    lat,
    lng,
    heading: (sv[10] as number | null) ?? 0,
    altitude: (sv[7] as number | null) ?? 0,
    velocity: (sv[9] as number | null) ?? 0,
    onGround: sv[8] as boolean,
    country: sv[2] as string,
  };
}

/**
 * Fetches live aircraft in Florida-Caribbean bounding box from OpenSky Network.
 * Returns [] on network error so the map retains its last known state.
 * Anonymous rate limit: 10 requests / 10 seconds -- poll at 10s intervals.
 */
export async function fetchLiveFlights(): Promise<LiveFlight[]> {
  try {
    const res = await fetch(OPENSKY_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { states: unknown[][] | null };
    if (!data.states) return [];
    return data.states
      .map((sv) => normalizeStateVector(sv as unknown[] as any[]))
      .filter((f): f is LiveFlight => f !== null);
  } catch {
    return [];
  }
}
