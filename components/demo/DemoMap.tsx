"use client";
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { StateModel } from "@/lib/airspace/types";
import { heroPositionAt } from "./accrual";

function planeIcon(active: boolean) {
  const c = active ? "#ff6b35" : "#00e5ff";
  return L.divIcon({
    html: `<div style="filter:drop-shadow(0 0 6px ${c})"><svg width="22" height="22" viewBox="0 0 24 24" fill="${c}"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg></div>`,
    className: "", iconSize: [22, 22], iconAnchor: [11, 11],
  });
}

export default function DemoMap({ state, t }: { state: StateModel | null; t: number }) {
  if (!state) return <div style={{ background: "#04101f", height: "100%" }} />;
  const event = state.events[0];
  const hero = state.flights.find((f) => f.isHero);
  const tfr = event.polygon.map((p) => [p.lat, p.lng] as [number, number]);
  const fullTrack = (hero?.track ?? []).map((w) => [w.lat, w.lng] as [number, number]);
  const heroPos = hero ? heroPositionAt(hero.track, t) : null;
  // flown-so-far track up to t
  const flown = (hero?.track ?? []).filter((w) => w.t <= t).map((w) => [w.lat, w.lng] as [number, number]);
  const tfrActive = t >= state.window.startSec && t <= state.window.endSec;

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapContainer center={[23.5, -78.0]} zoom={6} style={{ height: "100%", width: "100%", background: "#04101f" }} zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap &copy; CARTO" />

        {state.sectors?.features?.slice(0, 200).map((f: { geometry?: { type?: string; coordinates?: number[][][] } }, i: number) => {
          if (f.geometry?.type !== "Polygon" || !f.geometry.coordinates) return null;
          const ring = f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
          return <Polygon key={`s${i}`} positions={ring} pathOptions={{ color: "#1e3a55", weight: 0.5, fill: false }} />;
        })}

        {/* TFR — bright when active */}
        <Polygon positions={tfr} pathOptions={{ color: tfrActive ? "#ff3355" : "#5a2030", weight: 2, fillColor: "#ff3355", fillOpacity: tfrActive ? 0.2 : 0.05 }}>
          <Tooltip>{event.name}</Tooltip>
        </Polygon>

        {/* full route faint + flown-so-far bright */}
        {fullTrack.length > 1 && <Polyline positions={fullTrack} pathOptions={{ color: "#ff6b35", weight: 1, opacity: 0.25 }} />}
        {flown.length > 1 && <Polyline positions={flown} pathOptions={{ color: "#ff6b35", weight: 3 }} />}

        {/* animated hero */}
        {heroPos && (
          <Marker position={heroPos} icon={planeIcon(tfrActive)}>
            <Tooltip>JBU1575 — {tfrActive ? "in disruption window" : "tracking"}</Tooltip>
          </Marker>
        )}

        {/* clear-weather VFR markers (the paradox) */}
        {state.weather.map((w) => (
          <CircleMarker key={w.station} center={[w.lat, w.lng]} radius={8} pathOptions={{ color: "#00ff88", fillColor: "#00ff88", fillOpacity: 0.85 }}>
            <Tooltip>{w.station}: {w.flightCategory} (clear)</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {[{ top: 12, left: 12 }, { top: 12, right: 12 }, { bottom: 12, left: 12 }, { bottom: 12, right: 12 }].map((s, i) => (
        <div key={i} style={{ position: "absolute", ...s, zIndex: 900, pointerEvents: "none", width: 20, height: 20, borderTop: i < 2 ? "2px solid rgba(0,200,255,0.3)" : "none", borderBottom: i >= 2 ? "2px solid rgba(0,200,255,0.3)" : "none", borderLeft: i % 2 === 0 ? "2px solid rgba(0,200,255,0.3)" : "none", borderRight: i % 2 === 1 ? "2px solid rgba(0,200,255,0.3)" : "none" }} />
      ))}
    </div>
  );
}
