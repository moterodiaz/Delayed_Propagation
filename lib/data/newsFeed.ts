import type { NewsFeedItem } from "@/lib/types";

// GDELT / FAA SWIM intelligence feed -- SpaceX Starship Flt-12 Caribbean TFR
// window 2026-05-22T17:15 to 20:00 EDT. Drives the live intelligence panel.
export const NEWS_FEED: NewsFeedItem[] = [
  {
    id: "evt_gdl_001",
    timestamp: "2026-05-22T17:15:00-04:00",
    type: "NEWS_ALERT",
    source: "GDELT / Aviation Logistics Wire",
    url: "https://www.faa.gov/newsroom",
    headline:
      "FAA Confirms Impending Closure of Crucial Caribbean Corridor for Commercial Space Operations",
    synthesis:
      "OPERATOR IMPACT: 42 commercial routes connecting Southeast hubs (MIA, FLL) to Caribbean destinations face immediate route extensions of up to 140 nautical miles. Running an unoptimized flight path through eastern airspace will trigger an estimated fleet-wide fuel surge of +$98,000 across active carriers.",
    metrics: {
      estimated_planes_affected: 42,
      base_fuel_multiplier: 1.25,
      projected_delay_mins: 35,
    },
  },
  {
    id: "ntm_faa_001",
    timestamp: "2026-05-22T17:30:00-04:00",
    type: "NOTAM",
    source: "FAA SWIM / KZJX (Jacksonville Center)",
    url: "https://tfr.faa.gov/tfr2/list.html",
    headline:
      "NOTAM A0183/26: TEMPORARY FLIGHT RESTRICTIONS (TFR) ACTIVATED FOR SPACEX STARSHIP FLT-12 LAUNCH",
    synthesis:
      "OPERATOR IMPACT: Surface to space (FL000-FL999) closure over the Gulf of Mexico and Kingston FIR boundaries. Immediate action required for 18 airborne assets: dispatcher intervention must choose between filing an emergency easterly reroute or entering an airborne holding pattern outside the polygon.",
    metrics: {
      estimated_planes_affected: 18,
      base_fuel_multiplier: 1.45,
      projected_delay_mins: 55,
    },
  },
  {
    id: "evt_gdl_002",
    timestamp: "2026-05-22T18:30:00-04:00",
    type: "NEWS_ALERT",
    source: "GDELT / Aerospace News Flash",
    url: "https://www.spacex.com/launches/",
    headline:
      "SpaceX Starship V3 Launches Safely From Pad 2; Super Heavy Booster Suffers Hard Landing in Gulf Zone",
    synthesis:
      "OPERATOR IMPACT: While Starship successfully achieved its suborbital path, the first-stage Super Heavy booster experienced a partial boostback burn and an uncontrolled hard ocean splashdown. Post-mission debris hazard verification will extend air corridor freeze times by an extra 45 minutes. High congestion building over northern Florida waypoints.",
    metrics: {
      estimated_planes_affected: 55,
      base_fuel_multiplier: 1.6,
      projected_delay_mins: 75,
    },
  },
  {
    id: "ntm_faa_002",
    timestamp: "2026-05-22T19:15:00-04:00",
    type: "NOTAM",
    source: "FAA / JCAA (Jamaica Civil Aviation Authority)",
    url: "https://jcaa.gov.jm/aeronautical-information",
    headline:
      "NOTAM B0975/26: REENTRY RISK CORRIDOR DECLARED ACTIVE IN LOWER CORRIDORS",
    synthesis:
      "OPERATOR IMPACT: Inbound flight tracks to Kingston (MKJK FIR) are strictly blocked. Commercial assets from JetBlue and American Airlines are logging multi-loop airborne holding patterns outside Miami. Direct variable burn compounding at an extreme rate of ~$24.50/minute per narrowbody asset.",
    metrics: {
      estimated_planes_affected: 29,
      base_fuel_multiplier: 1.8,
      projected_delay_mins: 90,
    },
  },
  {
    id: "evt_gdl_003",
    timestamp: "2026-05-22T19:45:00-04:00",
    type: "NEWS_ALERT",
    source: "GDELT / Energy & Commodities Index",
    url: "https://www.eia.gov/petroleum/gasdiesel/",
    headline:
      "Jet Fuel Spot Prices Jump 6.6% at Southeastern Terminals Amid Widespread Flight Diversions",
    synthesis:
      "OPERATOR IMPACT: Localized jet fuel spot prices at MIA and FLL surge from $2.42 to $2.58 per gallon due to sudden high-volume gate-refueling requests from unscheduled flight diversions. Ground-holding remaining regional assets at origin gates yields optimal protection of corporate margin.",
    metrics: {
      estimated_planes_affected: 112,
      base_fuel_multiplier: 1.066,
      projected_delay_mins: 15,
    },
  },
];
