// lib/simulation.ts
import type { Flight, TFRZone, LatLng } from "./types";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function getFlightPosition(
  flight: Flight,
  simTime: number,
): (LatLng & { heading: number }) | null {
  const { waypoints } = flight;
  if (waypoints.length === 0 || simTime < waypoints[0].t) return null;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    if (simTime >= from.t && simTime <= to.t) {
      const duration = to.t - from.t;
      const progress = duration === 0 ? 1 : (simTime - from.t) / duration;
      return {
        lat: lerp(from.lat, to.lat, progress),
        lng: lerp(from.lng, to.lng, progress),
        heading: bearingBetween(from, to),
      };
    }
  }

  const last = waypoints[waypoints.length - 1];
  return { lat: last.lat, lng: last.lng, heading: 0 };
}

export function bearingBetween(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLng) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

export function getActiveTFRs(tfrs: TFRZone[], simTime: number): TFRZone[] {
  return tfrs.filter((z) => simTime >= z.activeFrom && simTime <= z.activeTo);
}

export function simTimeToDisplay(simSeconds: number): string {
  const totalMinutes = Math.floor(simSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const hours24 = 17 + totalHours;
  const mins = totalMinutes % 60;
  const displayHour = hours24 > 12 ? hours24 - 12 : hours24;
  const ampm = hours24 >= 12 ? "PM" : "AM";
  return `${displayHour}:${String(mins).padStart(2, "0")} ${ampm} EDT`;
}

export function generateRandomTFR(simTime: number): TFRZone {
  const centerLat = 20 + Math.random() * 6;
  const centerLng = -82 + Math.random() * 10;
  const size = 0.8 + Math.random() * 1.2;
  return {
    id: `TFR-RANDOM-${Date.now()}`,
    label: "Unplanned Airspace Restriction",
    polygon: [
      { lat: centerLat + size, lng: centerLng - size },
      { lat: centerLat + size, lng: centerLng + size },
      { lat: centerLat - size, lng: centerLng + size },
      { lat: centerLat - size, lng: centerLng - size },
      { lat: centerLat + size, lng: centerLng - size },
    ],
    activeFrom: simTime,
    activeTo: simTime + 1800 + Math.floor(Math.random() * 3600),
    severity: Math.random() > 0.5 ? "danger" : "warning",
    reason: "Military exercise -- notified via NOTAM",
  };
}
