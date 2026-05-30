import type { Airport } from "@/lib/types";

export const AIRPORTS: Airport[] = [
  {
    icao: "KFLL",
    name: "Fort Lauderdale",
    position: { lat: 26.072, lng: -80.152 },
  },
  {
    icao: "KMIA",
    name: "Miami Intl",
    position: { lat: 25.795, lng: -80.287 },
  },
  {
    icao: "MKJP",
    name: "Norman Manley (Kingston)",
    position: { lat: 17.935, lng: -76.787 },
  },
  {
    icao: "KATL",
    name: "Atlanta Hartsfield",
    position: { lat: 33.641, lng: -84.427 },
  },
  {
    icao: "MWCR",
    name: "Owen Roberts (Cayman)",
    position: { lat: 19.292, lng: -81.357 },
  },
];
