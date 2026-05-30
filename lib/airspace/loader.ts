// lib/airspace/loader.ts
// Reads cached real data files from data/. Node runtime only. Ported from backend/loader.py.
// Converts the data files' `lon` key to the app's `lng` convention.
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { LatLng } from "@/lib/types";
import type { FlightState, MetarMarker, NewsItem } from "./types";

const DATA = join(process.cwd(), "data");

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA, name), "utf-8")) as T;
}

interface RawWaypoint {
  t: number;
  lat: number;
  lon: number;
}
interface RawHero {
  flight?: string;
  icao24?: string;
  waypoints: RawWaypoint[];
}
interface RawCasualty {
  flight?: string;
  icao24?: string;
  arr?: string | null;
  firstSeen?: number;
  lastSeen?: number;
}

export function loadFlights(): FlightState[] {
  const flights: FlightState[] = [];

  const hero = readJson<RawHero>("jbu1575_track.json");
  flights.push({
    id: hero.flight ?? "JBU1575",
    icao24: hero.icao24 ?? "a854d0",
    track: hero.waypoints
      .filter((w) => w.lat != null && w.lon != null)
      .map((w) => ({ lat: w.lat, lng: w.lon, t: Math.trunc(w.t) })),
    affected: false,
    isHero: true,
  });

  const cas = readJson<{ casualties: RawCasualty[] }>("casualties.json");
  for (const c of cas.casualties) {
    flights.push({
      id: (c.flight ?? c.icao24 ?? "UNKNOWN").trim(),
      icao24: c.icao24 ?? "",
      track: [],
      affected: true, // real pre-filtered affected set
      isHero: false,
      arr: c.arr ?? null,
      firstSeen: c.firstSeen ?? null,
      lastSeen: c.lastSeen ?? null,
    });
  }

  return flights;
}

export interface TfrData {
  id: string;
  name: string;
  summary?: string;
  polygon: LatLng[]; // converted from [[lat,lon]]
  startSec: number;
  endSec: number;
}

export function loadTfr(): TfrData {
  const raw = readJson<{
    id: string;
    name: string;
    summary?: string;
    polygon: [number, number][];
    active: { start: string; end: string };
  }>("tfr.json");
  return {
    id: raw.id,
    name: raw.name,
    summary: raw.summary ?? "",
    polygon: raw.polygon.map(([lat, lon]) => ({ lat, lng: lon })),
    startSec: Math.trunc(Date.parse(raw.active.start) / 1000),
    endSec: Math.trunc(Date.parse(raw.active.end) / 1000),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadSectors(): any {
  return readJson("sectors.geojson");
}

export function loadWeather(): MetarMarker[] {
  interface RawMetar {
    icaoId?: string;
    station_id?: string;
    lat?: number;
    lon?: number;
    fltCat?: string;
    rawOb?: string;
  }
  let rows: RawMetar[] = [];
  try {
    const raw = readJson<RawMetar[] | { data: RawMetar[] }>("metar.json");
    rows = Array.isArray(raw) ? raw : (raw.data ?? []);
  } catch {
    rows = [];
  }
  const markers: MetarMarker[] = rows.map((r) => ({
    station: r.icaoId ?? r.station_id ?? "",
    lat: r.lat ?? 0,
    lng: r.lon ?? 0,
    flightCategory: r.fltCat ?? "VFR", // raw METAR lacks category; clear-VFR paradox
    raw: r.rawOb ?? "",
  }));
  if (markers.length === 0) {
    return [
      { station: "KFLL", lat: 26.072, lng: -80.153, flightCategory: "VFR", raw: "KFLL CLEAR" },
      { station: "KMIA", lat: 25.793, lng: -80.29, flightCategory: "VFR", raw: "KMIA CLEAR" },
      { station: "MKJP", lat: 17.936, lng: -76.787, flightCategory: "VFR", raw: "MKJP CLEAR" },
    ];
  }
  return markers;
}

export function loadNews(): NewsItem[] {
  const path = join(DATA, "news.json");
  if (!existsSync(path)) return [];
  interface RawNews {
    id: string;
    headline: string;
    summary: string;
    source: string;
    can_bookmark?: boolean;
  }
  const raw = readJson<RawNews[]>("news.json");
  return raw.map((n) => ({
    id: n.id,
    headline: n.headline,
    summary: n.summary,
    source: n.source,
    canBookmark: n.can_bookmark ?? true,
  }));
}

export function loadChatFallback(): Record<string, string> {
  const path = join(DATA, "chat_fallback.json");
  if (!existsSync(path)) return {};
  return readJson<Record<string, string>>("chat_fallback.json");
}
