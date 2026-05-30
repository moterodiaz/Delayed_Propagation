// components/AirspaceMap.tsx
"use client";

import { Fragment } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Tooltip,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import FlightMarker from "@/components/FlightMarker";
import LiveFlightMarker from "@/components/LiveFlightMarker";
import TFRZone from "@/components/TFRZone";
import type {
  Flight,
  LiveFlight,
  TFRZone as TFRZoneType,
  Airport,
} from "@/lib/types";
import type { GroundedFlight } from "@/lib/data/groundedFlights";

// Parked-plane glyph for stationed flights; red when grounded by the TFR, amber otherwise.
function groundedIcon(grounded: boolean) {
  const c = grounded ? "#ef4444" : "#fbbf24";
  return L.divIcon({
    html: `<div style="filter:drop-shadow(0 0 4px ${c}aa)"><svg width="15" height="15" viewBox="0 0 24 24" fill="${c}"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg></div>`,
    className: "",
    iconSize: [15, 15],
    iconAnchor: [7, 7],
  });
}

export interface AirspaceMapProps {
  flights: Flight[];
  simTime: number;
  liveFlights: LiveFlight[];
  activeTFRs: TFRZoneType[];
  extraTFRs: TFRZoneType[];
  airports: Airport[];
  mode: "sim" | "live";
  grounded?: GroundedFlight[];
  groundedActive?: boolean; // TFR active -> stationed flights can't depart
}

export default function AirspaceMap({
  flights,
  simTime,
  liveFlights,
  activeTFRs,
  extraTFRs,
  airports,
  mode,
  grounded = [],
  groundedActive = false,
}: AirspaceMapProps) {
  return (
    <MapContainer center={[24.0, -78.0]} zoom={5} className="w-full h-full">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
      />

      {/* Route trails -- sim mode only.
          Synthetic (drawn outbound) leg renders dashed/dim; real ADS-B leg
          renders solid/bright. The seam is the U-turn point. */}
      {mode === "sim" &&
        flights.map((f) => {
          const synth = f.waypoints.filter((w) => w.synthetic);
          const real = f.waypoints.filter((w) => !w.synthetic);
          // Connect the synthetic leg to the first real point so there's no gap.
          const synthPositions = [
            ...synth.map((w) => [w.lat, w.lng] as [number, number]),
            ...(real[0] ? [[real[0].lat, real[0].lng] as [number, number]] : []),
          ];
          const realPositions = real.map(
            (w) => [w.lat, w.lng] as [number, number],
          );
          return (
            <Fragment key={`route-${f.id}`}>
              {synthPositions.length > 1 && (
                <Polyline
                  positions={synthPositions}
                  pathOptions={{
                    color: "#6b7280",
                    weight: 1,
                    dashArray: "4 4",
                    opacity: 0.5,
                  }}
                />
              )}
              {realPositions.length > 1 && (
                <Polyline
                  positions={realPositions}
                  pathOptions={{ color: "#22d3ee", weight: 2, opacity: 0.9 }}
                />
              )}
            </Fragment>
          );
        })}

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

      {/* Stationed flights waiting to depart -- sim mode. Turn red + "GROUNDED" when TFR active. */}
      {mode === "sim" &&
        grounded.map((g) => (
          <Marker key={`gnd-${g.id}`} position={[g.lat, g.lng]} icon={groundedIcon(groundedActive)}>
            <Tooltip>
              <span className="text-[10px] font-mono">
                {g.id} @ {g.airport}{" "}
                {groundedActive ? "— GROUNDED, cannot depart" : "— scheduled to depart"}
              </span>
            </Tooltip>
          </Marker>
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
