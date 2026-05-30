"use client";
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { StateModel } from "@/lib/airspace/types";

export default function DemoMap({ state }: { state: StateModel | null }) {
  if (!state) return <div style={{ background: "#04101f" }} />;
  const event = state.events[0];
  const hero = state.flights.find((f) => f.isHero);
  const tfr = event.polygon.map((p) => [p.lat, p.lng] as [number, number]);
  const heroTrack = (hero?.track ?? []).map((w) => [w.lat, w.lng] as [number, number]);

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapContainer center={[23.5, -78.0]} zoom={6} style={{ height: "100%", width: "100%", background: "#04101f" }} zoomControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />

        {/* ATC sectors (thin gray) */}
        {state.sectors?.features?.slice(0, 200).map((f: { geometry?: { type?: string; coordinates?: number[][][] } }, i: number) => {
          if (f.geometry?.type !== "Polygon" || !f.geometry.coordinates) return null;
          const ring = f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
          return <Polygon key={`s${i}`} positions={ring} pathOptions={{ color: "#1e3a55", weight: 0.5, fill: false }} />;
        })}

        {/* SpaceX TFR closure (red wall) */}
        <Polygon positions={tfr} pathOptions={{ color: "#ff3355", weight: 2, fillColor: "#ff3355", fillOpacity: 0.18 }}>
          <Tooltip>{event.name}</Tooltip>
        </Polygon>

        {/* Hero JBU1575 U-turn track */}
        {heroTrack.length > 1 && (
          <Polyline positions={heroTrack} pathOptions={{ color: "#ff6b35", weight: 3 }}>
            <Tooltip sticky>JBU1575 — U-turn, returned to KFLL</Tooltip>
          </Polyline>
        )}

        {/* Clear-weather VFR markers (the paradox) */}
        {state.weather.map((w) => (
          <CircleMarker key={w.station} center={[w.lat, w.lng]} radius={8}
            pathOptions={{ color: "#00ff88", fillColor: "#00ff88", fillOpacity: 0.8 }}>
            <Tooltip>{w.station}: {w.flightCategory} (clear)</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* corner brackets */}
      {[{ top: 12, left: 12 }, { top: 12, right: 12 }, { bottom: 12, left: 12 }, { bottom: 12, right: 12 }].map((s, i) => (
        <div key={i} style={{ position: "absolute", ...s, zIndex: 900, pointerEvents: "none", width: 20, height: 20, borderTop: i < 2 ? "2px solid rgba(0,200,255,0.3)" : "none", borderBottom: i >= 2 ? "2px solid rgba(0,200,255,0.3)" : "none", borderLeft: i % 2 === 0 ? "2px solid rgba(0,200,255,0.3)" : "none", borderRight: i % 2 === 1 ? "2px solid rgba(0,200,255,0.3)" : "none" }} />
      ))}
    </div>
  );
}
