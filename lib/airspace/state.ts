// lib/airspace/state.ts
// build_state() orchestrator → StateModel. Deterministic (R9).
import type { StateModel, EventCard } from "./types";
import {
  loadFlights,
  loadTfr,
  loadSectors,
  loadWeather,
  loadNews,
} from "./loader";
import { detectAffected } from "./detection";
import { eventCost, flightCost, trackLengthNm, COST_RATES } from "./cost";
import { buildOptions } from "./options";
import { buildNetworkView } from "./network";

export function buildState(): StateModel {
  const flights = loadFlights();
  const tfr = loadTfr();
  detectAffected(flights, tfr.polygon, tfr.startSec, tfr.endSec);

  // attach per-flight cost for timeline accrual
  for (const f of flights) f.costUsd = f.affected ? flightCost(f).totalUsd : 0;

  const affected = flights.filter((f) => f.affected);
  const cost = eventCost(flights);
  const windowHours = (tfr.endSec - tfr.startSec) / 3600;

  // hero's real wasted track distance (out + back ≈ 373 nm) feeds the divert option
  const hero = flights.find((f) => f.isHero);
  const wastedNm = hero && hero.track.length > 0 ? trackLengthNm(hero) : 0;

  const event: EventCard = {
    id: tfr.id,
    name: tfr.name,
    summary: tfr.summary ?? "",
    polygon: tfr.polygon,
    affectedFlightIds: affected.map((f) => f.id),
    cost,
    options: buildOptions(windowHours, wastedNm, affected.length),
    bookmarked: true,
  };

  return {
    events: [event],
    flights,
    sectors: loadSectors(),
    weather: loadWeather(),
    news: loadNews(),
    network: buildNetworkView(cost.totalUsd),
    costModel: COST_RATES,
    window: { startSec: tfr.startSec, endSec: tfr.endSec },
  };
}
