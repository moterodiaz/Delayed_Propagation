// components/TFRZone.tsx
"use client";

import { Polygon, Tooltip } from "react-leaflet";
import type { TFRZone as TFRZoneType } from "@/lib/types";

export default function TFRZone({ zone }: { zone: TFRZoneType }) {
  const isDanger = zone.severity === "danger";
  const fillColor = isDanger ? "#ef4444" : "#f59e0b";
  const borderColor = isDanger ? "#fca5a5" : "#fcd34d";
  const positions = zone.polygon.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: borderColor,
        fillColor,
        fillOpacity: 0.25,
        weight: 2,
        dashArray: isDanger ? undefined : "6 4",
        className: "tfr-pulse",
      }}
    >
      <Tooltip sticky>
        <div className="text-xs font-mono leading-tight max-w-xs">
          <div className="font-bold" style={{ color: fillColor }}>
            {zone.label}
          </div>
          <div className="text-gray-300 mt-1">{zone.reason}</div>
        </div>
      </Tooltip>
    </Polygon>
  );
}
