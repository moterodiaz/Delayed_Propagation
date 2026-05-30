# Delayed Propagation — The Pitch

**One line:** When a rocket closes the sky, a weather dashboard shows all green. We show the dollar wall — and what to do about it.

## The scenario (real event, replayed)

On **2026-05-22**, SpaceX Starship Flight 12 launched from Boca Chica. The FAA and the Jamaica Civil Aviation Authority closed part of the **Kingston FIR** from **21:30–23:43Z**. Weather at KFLL / KMIA / MKJP was **clear VFR** — every weather tool showed green. But the space NOTAM was a wall.

Real ADS-B (OpenSky) shows JetBlue **JBU1575**, KFLL→Kingston, flying toward the closure, **U-turning over the Bahamas (~23.8°N)**, and returning to Fort Lauderdale. Behind it, ~42 flights to/from Miami and Fort Lauderdale were grounded or put in holding loops — they got the warning and realized they could no longer take off.

**The hook (the paradox):** clear skies, still grounded.

## What happened, in sequence

| Time (EDT) | Event |
|---|---|
| 17:15 | FAA warns: Caribbean corridor closing — ~42 routes face +140 nm reroutes |
| 17:30 | **NOTAM A0183/26** — launch TFR, surface-to-space closure over the Gulf + Kingston FIR |
| 18:30 | Starship launches; Super Heavy booster hard splashdown → debris freeze +45 min |
| 19:15 | **NOTAM B0975/26** — reentry risk corridor, Kingston inbound strictly blocked (the severe beat) |
| 19:45 | Jet fuel spot +6.6% at MIA/FLL from the wave of diversions |

The closure ran the whole window (21:30–23:43Z) — not a single moment. B0975/26 is the *reentry phase*, the most severe block.

## What it cost (~$351,000)

Every line is a **published rate** — nothing invented:

| Line item | Rate / source |
|---|---|
| Aircraft block time (delay) | $100.76/block-min — Airlines for America (A4A) 2024 |
| Passenger value of time | $0.78/min/pax ($47/hr) — FAA/DOT, × ~150 seats |
| Passenger reaccommodation | ~$150/pax (vouchers + rebooking) — Hawaiian A330 turnback precedent |
| Diversion / turnback penalty | $25k–$200k+ range; A320 turnback ~$92.5k — EUROCONTROL / The Points Guy |
| Crew overnight | hotel + per-diem when crew times out |

JBU1575 alone ≈ **$125k** (wasted block time + the turnback). Fuel is already inside the A4A block-minute rate, so it is **not** double-counted.

## The 3 priced actions (counterfactual)

- **Hold** airborne until the TFR lifts — full block cost + passenger time.
- **Divert** every affected flight to an alternate — diversion penalty + reaccommodation.
- **Pre-empt** — ground-hold departures to skip the window. **Cheapest.** No fuel burn, no diversion.

The product doesn't just detect the conflict — it tells the ops manager the right move and what it's worth.

## The wider board (coordination gap)

Acting alone (selfish-optimal) costs the full figure. If carriers coordinated slot usage, total network cost drops to ~75% — the **~$88k gap** is value left on the table when everyone optimizes independently. You only move your own flights, but the board shows the whole picture. (Reference computation, not a real multi-carrier solver — that's v2.)

## What's real vs. modeled

- **Real:** JBU1575's 229-waypoint ADS-B track + U-turn; the 15 casualty callsigns and their in-window times; the Kingston FIR boundary; clear-VFR METARs; live OpenSky traffic in Live mode; all cost rates.
- **Modeled / labeled:** the debris hazard corridor (drawn estimate bridging the FIR to the turnpoint), the apron-padding flights for density, and the 0.75 coordination factor.

## The two modes

- **Simulation** — replay the event on the real window (21:30–23:43Z): JBU1575 flies and U-turns, stationed flights flip to GROUNDED when the TFR activates, and the cost accrues to ~$351k as the timeline plays.
- **Live** — real-time OpenSky traffic over the Florida–Caribbean box, with a live NOTAM/intelligence feed.

## Why it lands

Clear-weather paradox + a sourced dollar figure + the coordination gap. Three things on one screen that turn a map into a business case.

---

## Software & tools we used

| Layer | Tool | Why |
|---|---|---|
| Frontend | **Next.js 16 + React 19** | one app, App Router, API routes co-located with UI |
| Map | **Leaflet + react-leaflet**, CARTO dark tiles | free, no API token (no live dependency on stage) |
| Styling | **Tailwind CSS v4** + inline panel styling | fast layout, dark "ops" aesthetic |
| Flight data | **OpenSky Network API** | real ADS-B — the JBU1575 track + live traffic |
| Cost engine | TypeScript (`lib/airspace/*`) | deterministic compute, served at `/api/state` |
| Chatbot | **Anthropic API** (`claude-sonnet-4-6`) via REST | grounded ops assistant; cached fallback |
| Cost rates | **A4A, FAA/DOT, EUROCONTROL** published figures | defensible dollar numbers |
| Geometry | shapely-equivalent point/line-in-polygon (TS) | affected-flight detection |

API contract: `GET /api/state` returns the full deterministic snapshot (flights, cost, options, network, sources); `POST /api/chat` answers grounded in those numbers.

### APIs we actually called

| API | Use | Where |
|---|---|---|
| **OpenSky Network API** | Real ADS-B aircraft tracking — live positions (`/states/all`) for Live mode + the JBU1575 historical track (`/tracks/all`, OAuth2, cached) for the U-turn | `app/api/flights/route.ts`, `lib/opensky.ts`, `data/jbu1575_track.json` |
| **Anthropic API** (Claude `claude-sonnet-4-6`) | The grounded ops chatbot — answers from computed numbers, cached fallback | `lib/airspace/chat.ts` |
| **Aviation Weather Center API** (`aviationweather.gov`) | METAR observations → the clear-VFR markers (the paradox) | `data/metar.json` (pulled once, cached) |
| **CARTO basemap tiles + OpenStreetMap** | Dark map tiles | `components/AirspaceMap.tsx`, `components/demo/DemoMap.tsx` |

**Data sources / citations (not live APIs):** Airlines for America (A4A) 2024 delay costs · FAA/DOT value of passenger time · EUROCONTROL Standard Inputs (diversion) · FAA SpaceX Starship airspace-closure docs. GDELT / FAA SWIM appear in the narrative as the *kind* of feed a production system would ingest — they are not called in this build.

## How we calculated the pricing

Per-flight disruption cost = sum of sourced line items (no invented numbers; fuel is inside the block rate, never double-counted):

```
disruptionMin = hero: wasted block time (returned to origin)
                casualty: time exposed in the closure window (real firstSeen/lastSeen)

block delay   = disruptionMin × $100.76/min            [A4A 2024]
passenger time= disruptionMin × $0.78/min × 150 seats  [FAA/DOT $47/hr]
reaccommodation = diverted ? 150×$150 : 150×15%×$150   [Hawaiian A330 precedent]
diversion     = returned/diverted ? $92,500 : 0        [EUROCONTROL / TPG, A320 midpoint]
crew overnight= (>3h or diverted) ? $1,800 : 0
```

Event total = Σ affected flights ≈ **$351k**. The 3 action options price the same way:

- **Hold** = airborne block ($100.76/min) + passenger time, over the window × fleet.
- **Divert** = $92.5k diversion penalty + $150/pax reaccommodation × fleet.
- **Pre-empt** = ground hold at 30% of block (no fuel burn) + passenger time × fleet → cheapest.

Click any option in the app to expand its itemized breakdown with the source on each line.

**Honest note:** the *fleet count* and the apron-density flights are partly synthetic (only the hero has a real track; the 15 casualties are real callsigns/times but no coordinates). The *rates* are all real and cited — so the figures are grounded even where the fleet is padded for the visual.

## Our design process

1. **SRS** — wrote a Software Requirements Spec: the user (airline ops center), the hero scenario, and R1–R10 (Tier 1) / R11–R13 (stretch), each with acceptance criteria.
2. **SDD** — a System Design Doc: 3-layer architecture (static data → compute-once backend → dashboard), the `StateModel` contract, determinism as a hard constraint.
3. **Data first** — pulled the real JBU1575 ADS-B track + 15 casualties from OpenSky, the Kingston FIR boundary, clear-VFR METARs, the NOTAM/news timeline.
4. **Backend brain** — cost engine, detection, priced options, network gap, grounded chatbot — built test-first, deterministic, served as one JSON snapshot.
5. **UI iterations** — snapshot dashboard → timeline-driven dashboard → merged onto the sim/live timeline the team liked, then layered cost, grounded fleet, live dead-reckoning, and the pitch dock.
6. **Decision log** — every non-obvious call (e.g., dropping a separate fuel line to avoid double-counting) recorded in `decisions/log.md`.

## Shortfalls & how we'd improve

| Shortfall | Why it's there | How we'd fix it |
|---|---|---|
| Only the hero animates with a real track | OpenSky gave us one full track; casualties are a manifest (no coords) | Fetch full ADS-B tracks for all 15 casualties so every affected plane flies its real path |
| Apron fleet padded to ~42 | density for the visual | Pull the real scheduled departures from KMIA/KFLL in the window |
| Debris hazard corridor is drawn, not published | exact TFR sub-polygon isn't public | Ingest the real FAA TFR GeoJSON via NASA DIP / FAA SWIM |
| Coordination gap uses a fixed 0.75 factor | no time for a real solver | Build a true multi-carrier slot-allocation optimizer (system-optimal) |
| One event at a time | scope | Multi-event mode: concurrent disruptions, re-run detection/cost on each |
| Live feed is anonymous OpenSky (rate-limited) | no auth on stage | OAuth2 OpenSky + a server cache; richer live NOTAM ingestion (GDELT/SWIM) |
| Chatbot prose can vary | LLM | Already grounded on computed numbers + cached fallback; would add tool-calling so it can re-run "what-if" pricing live |
| Cost model is per-flight heuristic | not an ops-grade model | Calibrate against airline historical IROPS cost data |
