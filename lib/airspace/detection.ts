// lib/airspace/detection.ts
// Affected-flight detection (R2). Ported from backend/detection.py (shapely).
import type { LatLng } from "@/lib/types";
import type { FlightState } from "./types";

function pointInPolygon(p: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng,
      yi = poly[i].lat;
    const xj = poly[j].lng,
      yj = poly[j].lat;
    const intersect =
      yi > p.lat !== yj > p.lat &&
      p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function ccw(a: LatLng, b: LatLng, c: LatLng): boolean {
  return (
    (c.lat - a.lat) * (b.lng - a.lng) > (b.lat - a.lat) * (c.lng - a.lng)
  );
}

function segmentsIntersect(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function trackCrossesPolygon(track: LatLng[], poly: LatLng[]): boolean {
  // any vertex inside, or any track segment crossing any polygon edge
  if (track.some((p) => pointInPolygon(p, poly))) return true;
  for (let i = 0; i < track.length - 1; i++) {
    for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
      if (segmentsIntersect(track[i], track[i + 1], poly[k], poly[j]))
        return true;
    }
  }
  return false;
}

/**
 * Geometric detection runs only on flights with a track (the hero). Flights with
 * an empty track keep their loaded `affected` flag (casualties = pre-filtered set).
 */
export function detectAffected(
  flights: FlightState[],
  polygon: LatLng[],
  windowStartSec: number,
  windowEndSec: number,
): FlightState[] {
  for (const f of flights) {
    if (f.track.length === 0) continue; // trackless casualty: keep loaded flag
    const inWindow = f.track.some(
      (w) => w.t >= windowStartSec && w.t <= windowEndSec,
    );
    const intersects = trackCrossesPolygon(f.track, polygon);
    f.affected = inWindow && intersects;
  }
  return flights;
}
