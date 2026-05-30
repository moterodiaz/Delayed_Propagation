import type { TFRZone } from "@/lib/types";

export const MOCK_TFRS: TFRZone[] = [
  {
    id: "TFR-SPACEX-001",
    label: "SpaceX TFR -- NOTAM 6/3421",
    polygon: [
      { lat: 23.5, lng: -80.5 },
      { lat: 23.5, lng: -72.0 },
      { lat: 17.0, lng: -72.0 },
      { lat: 17.0, lng: -80.5 },
      { lat: 23.5, lng: -80.5 },
    ],
    activeFrom: 1800,
    activeTo: 10380,
    severity: "danger",
    reason: "SpaceX Starship Flight 12 debris corridor -- FL000-FL999",
  },
  {
    id: "TFR-WEATHER-001",
    label: "Convective Activity Warning",
    polygon: [
      { lat: 25.5, lng: -82.5 },
      { lat: 25.5, lng: -80.0 },
      { lat: 23.5, lng: -80.0 },
      { lat: 23.5, lng: -82.5 },
      { lat: 25.5, lng: -82.5 },
    ],
    activeFrom: 5400,
    activeTo: 8000,
    severity: "warning",
    reason: "Severe thunderstorm cell FL180 reported -- PIREP",
  },
];
