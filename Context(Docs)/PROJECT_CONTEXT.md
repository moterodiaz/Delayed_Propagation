# Delayed Propagation — Full Project Context

> Drop-in context doc. Self-contained. Merge into https://github.com/moterodiaz/Delayed_Propagation.
> Everything a teammate needs: what we're building, the locked decisions, the airline, the route, the cost math, the data, the requirements, the architecture, the build split.
> **Event:** ASI Hackathon "Hacking the Fourth Dimension," Fenway Park, Boston, 2026-05-30. 5 people (3 eng, 1 designer, 1 presenter). ~1 hr design + ~3 hr build.

---

## 1. What we're building

A **live airspace operations dashboard** for an airline ops center. It watches real-world events that close airspace (rocket launches, military activity, FIR closures, geopolitics), shows the impact on the airline's flights on a map, computes the dollar cost, and a chatbot explains the impact, recommends priced actions, and drafts the comms.

**The wider picture:** it also shows total network cost across all carriers and the gap between acting alone (selfish-optimal) and coordinated action — situational awareness even though the airline only controls its own flights.

---

## 2. ✈️ AIRLINE = JetBlue (locked, whole project)

One airline is the ops center for the entire project. **It is JetBlue.**

| Reason | Detail |
|---|---|
| Hero is JetBlue | JBU1575's real U-turn over the Bahamas (cached ADS-B, 229 waypoints) is the wow moment. No other carrier has a dramatic diversion track cached. |
| Most relevant fleet impact | JetBlue owns **4 of 15** affected flights (JBU1575, JBU238→San Juan, JBU2694, JBU575) — enough for a real watchlist + network view. |
| Story-to-data ratio | American has 8 affected flights (more volume) but no hero track → flat narrative. Delta has 3. |

Carrier split in `data/casualties.json`: **American 8 · JetBlue 4 · Delta 3.**

---

## 3. Hero scenario (REAL event, replayed)

- **SpaceX Starship Flight 12**, launched **2026-05-22**. FAA TFR closed part of the **Kingston FIR**, **21:30–23:43Z** (2h13m).
- **JetBlue JBU1575** (= B61575), KFLL→Kingston, flew toward the closure, **U-turned over the Bahamas (~23.83°N), returned to Fort Lauderdale (KFLL)**. Real ADS-B says returned to FLL, not Miami.
- **The hook (paradox):** weather at KFLL / KMIA / MKJP was **clear VFR** — a weather dashboard is all green, but the space NOTAM is a wall. That contrast is the wow.

---

## 4. The route

### Airports

| ICAO | Name | Lat / Lon | Role |
|---|---|---|---|
| KFLL | Fort Lauderdale–Hollywood Intl | 26.073, -80.153 | Origin + actual return |
| MKJP | Kingston Norman Manley Intl | 17.936, -76.788 | Scheduled destination (never reached) |
| KMIA | Miami Intl | 25.796, -80.287 | Most casualty arrivals divert / queue here |

### Path

- **Scheduled:** KFLL → MKJP (Kingston).
- **Actual:** KFLL → SE toward Kingston → **U-turn over Bahamas (~23.83°N, -78.30°)** → returned **KFLL**.

| Metric | Value |
|---|---|
| Scheduled leg KFLL→MKJP (great circle) | **523.1 nm** (never completed) |
| Turnpoint from FLL (Bahamas) | **168.5 nm** SE |
| Cached return leg flown | **204.9 nm** |
| Total wasted (out + back, zero net progress) | **~373 nm** |
| Cruise altitude at turn | 11,277 m ≈ **FL370** |
| Descent to | 0 (landed KFLL) |

### Speed / time (cached return leg, real ADS-B)

| Metric | Value |
|---|---|
| Waypoints | 229 |
| Window | **38.5 min** (epoch 1779487039 → 1779489351) |
| Avg groundspeed | **~319 kt** (incl. descent/approach) |
| Max groundspeed | **~568 kt** (cruise + tailwind) |
| icao24 | `a854d0` |

---

## 5. NOTAM / TFR

- **Trigger:** SpaceX Starship Flight 12 launch, 2026-05-22.
- **Closure:** FAA TFR closed part of the **Kingston FIR**, **21:30–23:43Z**.
- **TFR center (R1):** 26.97°N 97.16°W with the Kingston-FIR closure polygon.
- **Demo source:** geometry hardcoded for the May 22 event (deterministic, demo-safe).
- **Live arch source:** NASA DIP (FAA SWIM relay, GeoJSON) — the source the real architecture would ingest.

---

## 6. Cost model (R5 — defensible estimate, not final)

Assumptions: A320-class burn ~1.8 gal/nm cruise, Jet-A ~$3.50/gal.

| Component | Estimate |
|---|---|
| Wasted fuel (~373 nm flown for zero progress) | ~672 gal → **~$2,350** |
| Re-fly / rebook to MKJP (523 nm leg still owed) | next-day or rebook cost |
| Plus | gate delay fees, crew duty / overnight, pax rebooking |

**Net:** JBU1575 burned ~$2.3k of fuel + a full crew duty cycle to arrive back where it started, with the 523 nm Kingston leg still owed.

Cost engine inputs (per the spec): per-flight delay minutes, extra distance flown, crew/overnight, using published per-minute / per-nm / per-overnight rates. Holding ≈ $2,000–$5,000/hr by aircraft size.

---

## 7. Network view + coordination gap (R7 — the killer beat)

- **5,093 flights** in window 21:30–23:30Z; **15** filtered as affected (`data/casualties.json`).
- JBU1575 is the hero. Most others = KMIA arrivals (AAL367, DAL1790, AAL2231, AAL1128, AAL920, DAL1328…) + JBU238→TJSJ (San Juan).
- The platform shows **total network cost** + **"save $X alone vs $Y if coordinated"** delta. JetBlue acts only on its own flights (selfish-optimal); the gap is awareness, not command. FAA = the "coordinated" reference case only.

---

## 8. Layout (LOCKED) — single screen, 4 panels

| Panel | Content |
|---|---|
| **Left** | Bookmarked events (operator watchlist), each with $ impact. SpaceX TFR + Kingston FIR closure as cards; click focuses map. |
| **Center** | Map: TFR polygon + JBU1575 U-turn track + affected flights + ATC sectors + clear-weather (green) markers. |
| **Top-right** | Potential news feed (discovery, bookmark-able; pre-loaded + "live" badge). ≥3 plausible events. |
| **Bottom-right** | Chatbot (real LLM, pre-tested prompts): overall + per-event impact, priced action options (hold/divert/pre-empt), drafts comms to ops team + crews. Cached fallback so a failed API call never crashes the demo. |

Eye flows left → center → right. Readable on a projector, no scrolling.

---

## 9. Requirements (13, two tiers)

**Tier 1 — MVP (must ship in the 3-hr window):**

| ID | Requirement |
|---|---|
| R1 | Disruption + map display (TFR polygon, JBU1575 track, sectors, clear-weather markers) — the paradox hook |
| R2 | Affected-flight detection (route ∩ disruption zone, real cached tracks; JBU1575 flagged) |
| R3 | Bookmarked-events panel (cards + $ impact + click-to-focus) |
| R4 | Potential news feed (≥3 events, bookmark-able, pre-loaded deterministic) |
| R5 | Cost quantification ($ figure + breakdown: delay, extra-fuel/distance, crew) |
| R6 | 3 priced action options (hold / divert / pre-empt), cheapest flagged |
| R7 | Network view + coordination gap (total cost + "alone vs coordinated" delta) |
| R8 | Real-LLM chatbot grounded in computed numbers, drafts comms, cached fallback |
| R9 | Determinism — identical inputs → identical flagged flights / costs / gap (5-run repeat, 1e-6) |
| R10 | Single-screen 4-panel layout, projector-legible |

**Tier 2 — stretch (only if Tier 1 ships early):**

| ID | Requirement |
|---|---|
| R11 | Live bookmark on stage (real GDELT/NewsAPI item → left panel, fallback to pre-loaded) |
| R12 | Disruption-window animation (play advances JBU1575 track through the U-turn) |
| R13 | Second-event generality (toggle a weather cell / different NOTAM, re-run R2–R7) |

---

## 10. Architecture (locked — 3-layer deterministic)

Suggested stack: **FastAPI / Python backend + React frontend + Leaflet/Mapbox map; LLM via Claude or OpenAI.**

- **Layer 1 — Data/ingestion:** load cached OpenSky tracks, `sectors.geojson`, hardcoded TFR geometry, cached METAR. Ingestion behind an interface so a live source (NASA DIP / GDELT) slots in later.
- **Layer 2 — Compute (deterministic):** affected-flight detection (geometry intersection), cost engine, priced options, network gap. All numbers reproducible (R9).
- **Layer 3 — Presentation:** 4-panel dashboard + chatbot. Chatbot is fed the computed figures in prompt context (grounding); demo prompts pre-tested; cached fallback answers.

**Hard constraints:** determinism for all numbers; no live API calls on stage (all data cached); no secrets committed.

---

## 11. Data (all real, cached)

| Layer | Source | State | Location / notes |
|---|---|---|---|
| Flight tracks | OpenSky Network | ✅ cached | `data/jbu1575_track.json` (229 wp), `data/casualties.json` (15 flights) |
| TFR / NOTAM | hardcode May 22 geometry | demo | live = NASA DIP (FAA SWIM relay, GeoJSON) |
| Weather | aviationweather.gov | pull once + cache | `/api/data/metar?ids=KMIA,KFLL,MKJP&format=json` — clear VFR (the paradox) |
| News | GDELT / NewsAPI | pre-load Tier 1 | live = R11 |
| ATC sectors | hackathon bundle | local | `sectors.geojson` (real polygons + capacities; US-domestic only — no Caribbean polygons) |

### OpenSky refresh (how to re-pull)

- Creds: `credentials.json` (clientId / clientSecret). **git-ignored — never commit.**
- OAuth2: `POST https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token`, `grant_type=client_credentials` + client_id + client_secret. Token lasts 1800s.
- Historical needs the Bearer token (anonymous = 403). `GET /api/flights/all?begin=<epoch>&end=<epoch>` (max 2h window). Track: `GET /api/tracks/all?icao24=a854d0&time=<epoch-in-window>`.
- JBU1575 icao24 = `a854d0`. Event window epochs: begin `1779485400`, end `1779492600` (2026-05-22 21:30–23:30Z).

---

## 12. Build split (3 eng)

| Who | Owns | Requirements |
|---|---|---|
| Eng A | data + detection (load cached OpenSky, sectors, TFR geometry, intersection) | R1, R2 |
| Eng B | cost + options + network gap | R5, R6, R7 |
| Eng C | dashboard frontend (4 panels, map) + chatbot wiring | R3, R4, R8, R10 |
| Designer | panel layout / visual | R10 |
| Presenter | narrative | — |

---

## 13. Risks / what sells it

- **Riskiest unknown:** chatbot grounding — make the LLM cite the *computed* cost numbers, not invent them. Mitigation: feed computed figures into prompt context; pre-test every demo prompt; cache fallback (R8).
- **Where scope drift hurts most:** building a "real" optimizer for R6/R7. Hold the line — priced heuristics, not a solver.
- **What lands the pitch:** clear-weather paradox (R1) + dollar figure (R5) + coordination gap (R7). If those three read on the projector, the demo wins.

---

## 14. Deferred (v2)

Live NOTAM/news ingestion (NASA DIP + GDELT continuous), true system-optimal multi-carrier solver, passenger comms, real reroute optimization, multiple simultaneous disruptions.
