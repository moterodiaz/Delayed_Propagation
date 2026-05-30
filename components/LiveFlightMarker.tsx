// components/LiveFlightMarker.tsx
"use client";

import { useMemo } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { LiveFlight } from "@/lib/types";

function makeIcon(heading: number, onGround: boolean): L.DivIcon {
  const color = onGround ? "#6b7280" : "#22d3ee";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 28 28"
    style="transform:rotate(${heading}deg);filter:drop-shadow(0 0 4px ${color}99);">
    <polygon points="14,2 18,20 14,17 10,20" fill="${color}"/>
  </svg>`;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function LiveFlightMarker({ flight }: { flight: LiveFlight }) {
  const icon = useMemo(
    () => makeIcon(flight.heading, flight.onGround),
    [flight.heading, flight.onGround],
  );

  return (
    <Marker position={[flight.lat, flight.lng]} icon={icon}>
      <Tooltip direction="top" offset={[0, -12]}>
        <div className="text-xs font-mono leading-tight">
          <div className="font-bold">{flight.callsign}</div>
          <div className="text-gray-400">{flight.country}</div>
          <div className="text-cyan-400">
            {flight.lat.toFixed(2)}N {Math.abs(flight.lng).toFixed(2)}W
          </div>
          <div className="text-gray-400">
            Alt: {Math.round(flight.altitude)}m ·{" "}
            {Math.round(flight.velocity * 1.944)} kts
          </div>
          {flight.onGround && <div className="text-yellow-400">ON GROUND</div>}
        </div>
      </Tooltip>
    </Marker>
  );
}
