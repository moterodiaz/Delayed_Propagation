// lib/airspace/state.ts
// build_state() orchestrator → StateModel. Deterministic (R9). Ported from backend/state.py.
import type { StateModel, EventCard } from "./types";
import {
  loadFlights,
  loadTfr,
  loadSectors,
  loadWeather,
  loadNews,
} from "./loader";
import { detectAffected } from "./detection";
import { eventCost, trackLengthNm, greatCircleNm } from "./cost";
import { buildOptions } from "./options";
import { buildNetworkView } from "./network";

// Kingston (MKJP) — the intended arrival before the U-turn
const DEST_LAT = 17.936;
const DEST_LNG = -76.787;

export function buildState(): StateModel {
  const flights = loadFlights();
  const tfr = loadTfr();
  detectAffected(flights, tfr.polygon, tfr.startSec, tfr.endSec);

  const affected = flights.filter((f) => f.affected);
  const cost = eventCost(flights, DEST_LAT, DEST_LNG);
  const windowHours = (tfr.endSec - tfr.startSec) / 3600;

  const hero = flights.find((f) => f.isHero);
  let extraNm = 0;
  if (hero && hero.track.length > 0) {
    const flown = trackLengthNm(hero);
    const direct = greatCircleNm(
      hero.track[0].lat,
      hero.track[0].lng,
      DEST_LAT,
      DEST_LNG,
    );
    extraNm = Math.max(0, flown - direct);
  }

  const event: EventCard = {
    id: tfr.id,
    name: tfr.name,
    summary: tfr.summary ?? "",
    polygon: tfr.polygon,
    affectedFlightIds: affected.map((f) => f.id),
    cost,
    options: buildOptions(windowHours, extraNm, affected.length),
    bookmarked: true,
  };

  return {
    events: [event],
    flights,
    sectors: loadSectors(),
    weather: loadWeather(),
    news: loadNews(),
    network: buildNetworkView(cost.totalUsd),
  };
}
