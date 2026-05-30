// components/FlightMarker.tsx
"use client";

import { useMemo } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { getFlightPosition } from "@/lib/simulation";
import type { Flight } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  enroute: "#22d3ee",
  diverted: "#f97316",
  grounded: "#6b7280",
  scheduled: "#a78bfa",
  landed: "#4ade80",
};

function makeIcon(heading: number, color: string): L.DivIcon {
  // SVG points north (up) at 0°; rotate(heading) aligns tip with route bearing
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"
    style="transform:rotate(${heading}deg);filter:drop-shadow(0 0 4px ${color}99);">
    <polygon points="14,2 18,20 14,17 10,20" fill="${color}"/>
  </svg>`;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function FlightMarker({
  flight,
  simTime,
}: {
  flight: Flight;
  simTime: number;
}) {
  const pos = getFlightPosition(flight, simTime);
  const color = STATUS_COLORS[flight.status] ?? "#ffffff";
  const heading = pos?.heading ?? 0;
  const icon = useMemo(() => makeIcon(heading, color), [heading, color]);

  if (!pos) return null;

  return (
    <Marker position={[pos.lat, pos.lng]} icon={icon}>
      <Tooltip direction="top" offset={[0, -14]}>
        <div className="text-xs font-mono leading-tight">
          <div className="font-bold">{flight.callsign}</div>
          <div>
            {flight.origin} to {flight.destination}
          </div>
          <div style={{ color }}>Status: {flight.status.toUpperCase()}</div>
          <div className="text-gray-400">
            {pos.lat.toFixed(2)}N {Math.abs(pos.lng).toFixed(2)}W
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
}
