import type { Flight } from "@/lib/types";

export const MOCK_FLIGHTS: Flight[] = [
  {
    id: "B61575",
    callsign: "JetBlue 1575",
    airline: "JetBlue",
    origin: "KFLL",
    destination: "MKJP",
    status: "enroute",
    waypoints: [
      { lat: 26.072, lng: -80.152, t: 0 },
      { lat: 26.072, lng: -80.152, t: 1200 }, // departs 17:20
      { lat: 24.5, lng: -77.8, t: 3600 },
      { lat: 23.0, lng: -76.2, t: 4500 },
      { lat: 21.8, lng: -75.5, t: 4800 }, // hits TFR 18:20, U-turn
      { lat: 22.8, lng: -76.8, t: 5400 },
      { lat: 24.8, lng: -78.9, t: 6600 },
      { lat: 25.795, lng: -80.287, t: 7200 }, // diverts KMIA 19:00
      { lat: 25.795, lng: -80.287, t: 12000 },
    ],
  },
  {
    id: "DL402",
    callsign: "Delta 402",
    airline: "Delta",
    origin: "KATL",
    destination: "MKJP",
    status: "enroute",
    waypoints: [
      { lat: 33.641, lng: -84.427, t: 0 },
      { lat: 30.5, lng: -82.0, t: 2000 },
      { lat: 27.5, lng: -80.0, t: 3600 },
      { lat: 26.072, lng: -80.152, t: 4200 }, // ground-stopped KFLL
      { lat: 26.072, lng: -80.152, t: 12000 },
    ],
  },
  {
    id: "BA2157",
    callsign: "British Airways 2157",
    airline: "British Airways",
    origin: "MKJP",
    destination: "EGLL",
    status: "enroute",
    waypoints: [
      { lat: 17.935, lng: -76.787, t: 0 },
      { lat: 17.935, lng: -76.787, t: 1000 },
      { lat: 19.5, lng: -76.0, t: 2200 },
      { lat: 20.4, lng: -75.3, t: 2800 }, // forced back by TFR
      { lat: 19.2, lng: -76.5, t: 3600 },
      { lat: 17.935, lng: -76.787, t: 4400 },
      { lat: 17.935, lng: -76.787, t: 12000 },
    ],
  },
  {
    id: "KW201",
    callsign: "Cayman Airways 201",
    airline: "Cayman Airways",
    origin: "MWCR",
    destination: "KFLL",
    status: "enroute",
    waypoints: [
      { lat: 19.292, lng: -81.357, t: 0 },
      { lat: 20.5, lng: -80.5, t: 900 },
      { lat: 22.0, lng: -79.5, t: 1800 },
      { lat: 23.0, lng: -77.5, t: 3000 }, // reroutes east around TFR
      { lat: 24.5, lng: -77.0, t: 3900 },
      { lat: 25.5, lng: -78.8, t: 4800 },
      { lat: 26.072, lng: -80.152, t: 5800 },
      { lat: 26.072, lng: -80.152, t: 12000 },
    ],
  },
];
