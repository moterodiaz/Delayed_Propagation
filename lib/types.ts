export interface LatLng {
  lat: number;
  lng: number;
}

export interface Waypoint extends LatLng {
  t: number; // sim seconds from epoch (17:00 EDT = 0)
}

export type FlightStatus =
  | "scheduled"
  | "enroute"
  | "diverted"
  | "grounded"
  | "landed";

export interface Flight {
  id: string;
  callsign: string;
  airline: string;
  origin: string;
  destination: string;
  waypoints: Waypoint[];
  status: FlightStatus;
}

export interface LiveFlight {
  icao24: string;
  callsign: string;
  lat: number;
  lng: number;
  heading: number; // degrees clockwise from north
  altitude: number; // meters
  velocity: number; // m/s
  onGround: boolean;
  country: string;
}

export interface TFRZone {
  id: string;
  label: string;
  polygon: LatLng[];
  activeFrom: number; // sim seconds (ignored in live mode)
  activeTo: number;
  severity: "warning" | "danger";
  reason: string;
}

export interface Airport {
  icao: string;
  name: string;
  position: LatLng;
}

export interface SimEvent {
  id: string;
  simTime: number;
  message: string;
  type: "info" | "warning" | "danger";
}
