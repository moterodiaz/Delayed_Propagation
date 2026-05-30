// components/AirspaceMap.tsx
"use client";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  Polyline,
} from "react-leaflet";
import FlightMarker from "@/components/FlightMarker";
import LiveFlightMarker from "@/components/LiveFlightMarker";
import TFRZone from "@/components/TFRZone";
import type {
  Flight,
  LiveFlight,
  TFRZone as TFRZoneType,
  Airport,
} from "@/lib/types";

export interface AirspaceMapProps {
  flights: Flight[];
  simTime: number;
  liveFlights: LiveFlight[];
  activeTFRs: TFRZoneType[];
  extraTFRs: TFRZoneType[];
  airports: Airport[];
  mode: "sim" | "live";
}

export default function AirspaceMap({
  flights,
  simTime,
  liveFlights,
  activeTFRs,
  extraTFRs,
  airports,
  mode,
}: AirspaceMapProps) {
  return (
    <MapContainer center={[24.0, -78.0]} zoom={5} className="w-full h-full">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
      />

      {/* Planned route trails -- sim mode only */}
      {mode === "sim" &&
        flights.map((f) => (
          <Polyline
            key={`route-${f.id}`}
            positions={f.waypoints.map(
              (w) => [w.lat, w.lng] as [number, number],
            )}
            pathOptions={{
              color: "#374151",
              weight: 1,
              dashArray: "4 4",
              opacity: 0.6,
            }}
          />
        ))}

      {/* TFR zones (both modes) */}
      {[...activeTFRs, ...extraTFRs].map((zone) => (
        <TFRZone key={zone.id} zone={zone} />
      ))}

      {/* Airport reference markers */}
      {airports.map((ap) => (
        <CircleMarker
          key={ap.icao}
          center={[ap.position.lat, ap.position.lng]}
          radius={5}
          pathOptions={{
            color: "#6366f1",
            fillColor: "#818cf8",
            fillOpacity: 1,
            weight: 1,
          }}
        >
          <Tooltip permanent direction="right" offset={[8, 0]}>
            <span className="text-[10px] font-mono text-indigo-300">
              {ap.icao}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Flight markers -- mode-switched */}
      {mode === "sim"
        ? flights.map((f) => (
            <FlightMarker key={f.id} flight={f} simTime={simTime} />
          ))
        : liveFlights.map((f) => (
            <LiveFlightMarker key={f.icao24} flight={f} />
          ))}
    </MapContainer>
  );
}
