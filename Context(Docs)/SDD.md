# System Design Document — Airspace Disruption Forecaster

> **Status:** Design (post-SRS, pre-implementation)
> **Event:** ASI Hackathon — "Hacking the Fourth Dimension," Fenway Park, Boston, 2026-05-30
> **Date:** 2026-05-30
> **Owner:** Xavier
> **Team:** 5 (3 eng, 1 designer, 1 presenter) — ~3 hr build
> **Traces:** [[SRS]] (R1–R13)

## 1. Purpose & scope

Realize the SRS as buildable components in a 3-hour window. Defines architecture, panel components, data flow, contracts between engineers, tech stack, and the build timeline mapped to the engineer split. Tier 1 (R1–R10) is the commit; Tier 2 (R11–R13) slots into reserved seams.

**Design north star:** every number is deterministic and computed once at startup. The frontend renders precomputed JSON. The LLM is fed those numbers, never asked to invent them. Nothing on stage makes a live external call.

## 2. Architecture overview

Three layers. One process per layer, both runnable on one laptop.

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite + Leaflet)                            │
│  4-panel single-screen dashboard. Renders /api/state JSON.    │
│  Chatbot posts to /api/chat.                                  │
└───────────────▲───────────────────────────┬──────────────────┘
                │ GET /api/state              │ POST /api/chat
                │ (one fetch on load)         │
┌───────────────┴───────────────────────────▼──────────────────┐
│  BACKEND (FastAPI / Python)                                   │
│  ┌──────────────┐ ┌────────────┐ ┌─────────┐ ┌─────────────┐ │
│  │ data loader  │→│ detection  │→│ cost +  │→│ chatbot     │ │
│  │ (R1)         │ │ (R2)       │ │ network │ │ (R8, LLM)   │ │
│  │              │ │            │ │ (R5-R7) │ │             │ │
│  └──────────────┘ └────────────┘ └─────────┘ └─────────────┘ │
│  Computes StateModel ONCE at startup → caches in memory.      │
└───────────────▲───────────────────────────────────────────────┘
                │ reads at startup only
┌───────────────┴───────────────────────────────────────────────┐
│  DATA (static, cached, all real)                              │
│  data/jbu1575_track.json · data/casualties.json ·             │
│  data/tfr.json (hardcoded May22 geom) · data/metar.json ·     │
│  data/news.json (pre-loaded) · sectors.geojson (bundle)       │
└────────────────────────────────────────────────────────────────┘
```

**Why this shape:** determinism (R9) falls out for free — state computed once from static files, served as immutable JSON. No DB, no live calls, no race conditions. The frontend is a pure view of one JSON object. A demo re-run reads the same cache → same numbers.

## 3. Data layer

All inputs are static files in `data/`. The loader normalizes them into in-memory structures at startup.

| File | Source | Owner | Status |
|---|---|---|---|
| `jbu1575_track.json` | OpenSky (cached) | Eng A | ✅ exists (229 wp) |
| `casualties.json` | OpenSky (cached) | Eng A | ✅ exists (15 flights) |
| `tfr.json` | hardcoded May 22 Kingston-FIR polygon | Eng A | TODO |
| `metar.json` | aviationweather.gov, pulled once | Eng A | TODO (1 curl) |
| `news.json` | hand-authored from real GDELT items | Eng C | TODO |
| `sectors.geojson` | bundle (copy into `data/`) | Eng A | exists in bundle |

**Action — copy sectors:** `cp ~/Downloads/hackathon_data_bundle/sectors.geojson data/`

**`tfr.json` shape** (hardcoded, Eng A authors):
```json
{
  "id": "spacex-starship-f12",
  "name": "SpaceX Starship Flight 12 — Kingston FIR closure",
  "polygon": [[lat,lon], ...],
  "active": {"start": "2026-05-22T21:30:00Z", "end": "2026-05-22T23:43:00Z"},
  "source": "FAA TFR / NASA DIP (replay)"
}
```

## 4. Backend (FastAPI)

Single app. Two endpoints. All compute happens at startup in `build_state()`; endpoints just serve cache.

### 4.1 Modules (map to engineer split)

```
backend/
  main.py          # FastAPI app, 2 routes, calls build_state() on startup
  loader.py        # Eng A — read all data/ files → raw structs
  detection.py     # Eng A — flight × TFR intersection (R2)
  cost.py          # Eng B — per-flight + per-event cost (R5)
  options.py       # Eng B — hold/divert/preempt priced options (R6)
  network.py       # Eng B — total network cost + coordination gap (R7)
  chat.py          # Eng C — LLM call, grounded prompt, cache fallback (R8)
  state.py         # build_state() orchestrator → StateModel
  models.py        # Pydantic schemas (the contract between everyone)
```

### 4.2 The contract — `StateModel` (models.py)

This is the single most important artifact. Eng A/B fill it; Eng C renders it. Define it FIRST, stub everything, integrate against the stub.

```python
class Flight(BaseModel):
    id: str               # "JBU1575"
    icao24: str           # "a854d0"
    track: list[Waypoint] # [{lat, lon, t}]
    affected: bool        # R2 verdict
    is_hero: bool         # JBU1575 = true → highlight

class Event(BaseModel):           # left panel cards (R3)
    id: str
    name: str
    summary: str                  # one line
    polygon: list[list[float]]    # render on map
    affected_flight_ids: list[str]
    cost: CostBreakdown           # R5
    options: list[ActionOption]   # R6
    bookmarked: bool

class CostBreakdown(BaseModel):   # R5
    total_usd: float
    delay_usd: float
    fuel_usd: float
    crew_usd: float
    detail: str                   # one-line explanation

class ActionOption(BaseModel):    # R6
    kind: Literal["hold","divert","preempt"]
    cost_usd: float
    cheapest: bool
    rationale: str                # one sentence

class NetworkView(BaseModel):     # R7
    selfish_usd: float            # airline acting alone
    coordinated_usd: float        # system-optimal reference
    gap_usd: float                # save $X alone vs $Y coordinated

class NewsItem(BaseModel):        # R4 top-right feed
    id: str; headline: str; summary: str; source: str
    can_bookmark: bool

class StateModel(BaseModel):
    events: list[Event]           # left panel
    flights: list[Flight]         # map
    sectors: dict                 # geojson passthrough
    weather: list[MetarMarker]    # clear-VFR green markers (R1)
    news: list[NewsItem]          # top-right
    network: NetworkView          # R7
```

### 4.3 Endpoints

| Route | Method | Returns | Req |
|---|---|---|---|
| `/api/state` | GET | full `StateModel` JSON | R1–R7,R10 |
| `/api/chat` | POST `{message, event_id?}` | `{reply, cited_numbers}` | R8 |

`/api/state` returns the cached object built at startup — same bytes every call → R9.

## 5. Detection logic (R2) — Eng A

Point-in-polygon over the TFR, filtered to the event window.

```
for flight in flights:
    in_window = any(wp.t in [tfr.start, tfr.end] for wp in flight.track)
    intersects = any(point_in_polygon(wp, tfr.polygon) OR
                     segment_crosses(wp_i, wp_i+1, tfr.polygon)
                     for wp in flight.track)
    flight.affected = in_window and intersects
```

Use `shapely` (`Polygon.contains` / `LineString.intersects`) — kills hand-rolled geometry bugs. JBU1575 must come back `affected=true` (acceptance check). The U-turn track approaches the polygon edge — segment-crossing test, not just vertex containment.

## 6. Cost engine (R5–R7) — Eng B

Pure functions, no I/O. Deterministic by construction.

**Rates (constants, tweakable — `cost.py` top):**
```python
JET_A_USD_PER_GAL = 3.75
BURN_GAL_PER_NM   = 12.0      # narrowbody cruise approx
HOLDING_USD_PER_HR= 3500.0
CREW_OVERNIGHT_USD= 1800.0    # hotel + per-diem
DELAY_USD_PER_MIN = 100.0     # gate/delay composite
```

**R5 per-flight cost** = extra_nm × BURN × JET_A + delay_min × DELAY_PER_MIN + (overnight? CREW_OVERNIGHT : 0). Extra_nm for JBU1575 = U-turn path length − great-circle KFLL→Kingston (the wasted distance). Event cost = Σ affected flights.

**R6 options** (counterfactual, heuristic NOT optimizer — hold the line per SRS §7):
- **hold** = HOLDING_PER_HR × (window_hours) + downstream delay.
- **divert** = extra_nm to alternate × fuel + crew_overnight if timeout.
- **preempt** (delay departure to avoid window) = ground_hold_min × DELAY_PER_MIN. Usually cheapest → flag it.

**R7 network gap:** `selfish` = sum of each carrier independently picking its own cheapest option. `coordinated` = reference figure (apply a fixed coordination discount factor, e.g. 0.75×, justified as shared-slot efficiency — labeled a reference computation, not a solver, per SRS §6). `gap = selfish − coordinated`.

## 7. Chatbot (R8) — Eng C

Real LLM (Claude — `claude-sonnet-4-6`, fast + cheap, sufficient here). Grounding is the whole risk (SRS §7).

**Grounding strategy:** inject the computed `StateModel` numbers into the system prompt as facts. The LLM formats/explains; it never computes.

```
SYSTEM: You are an airline ops assistant. Use ONLY these computed figures.
Do not invent numbers. Facts:
  SpaceX TFR: 7 affected flights, total cost $X.
  JBU1575: U-turned, extra 240nm, cost $Y.
  Options: hold $A, divert $B, preempt $C (cheapest).
  Network: selfish $S alone vs coordinated $K (gap $G).
USER: {message}
```

**Cache fallback (R8 acceptance — no crash):** pre-test the ~5 demo prompts, store answers in `data/chat_fallback.json` keyed by prompt. On API exception or timeout (>5s), return the cached answer. Demo never depends on a live 200.

**Pre-tested demo prompts:**
1. "What's hitting us right now?" → overall summary
2. "Break down the SpaceX impact" → per-event
3. "What should I do about JBU1575?" → priced options, names cheapest
4. "Draft a note to the crew" → comms draft
5. "What's the network picture?" → R7 gap

## 8. Frontend (React + Vite + Leaflet) — Eng C + Designer

Single page, CSS grid, 4 panels, no routing, no scroll. Fetch `/api/state` once on mount → store in context → all panels read it.

```
┌──────────────┬─────────────────────────┬──────────────────┐
│ LEFT         │ CENTER                  │ TOP-RIGHT        │
│ Events (R3)  │ Leaflet map (R1)        │ News feed (R4)   │
│ - cards w/$  │ - TFR polygon (red)     │ - items+bookmark │
│ - click →    │ - JBU1575 track (U-turn)├──────────────────┤
│   focus map  │ - affected flights      │ BOTTOM-RIGHT     │
│              │ - sectors (geojson)     │ Chatbot (R8)     │
│              │ - weather green markers │ - prompt + reply │
│              │   (the paradox)         │ - action chips   │
└──────────────┴─────────────────────────┴──────────────────┘
```

Grid: `grid-template-columns: 320px 1fr 380px`, right column split into two rows. Big fonts, high contrast — projector-legible (R10).

**Map layers (Leaflet):** TFR polygon (red, semi-transparent), sectors (thin gray), JBU1575 track (bold polyline, animated dasharray optional = R12), affected flights (red dots), clear-weather markers (green circles at KFLL/KMIA/MKJP with METAR tooltip — the wow contrast).

**State management:** plain React Context + `useState`. No Redux. `bookmarked` flag toggled client-side (moves news item → left panel; Tier 2 R11 makes it a live fetch).

## 9. Tech stack (LOCKED)

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI + Pydantic + uvicorn | fast to write, schema = contract, auto-validates |
| Geometry | shapely | no hand-rolled point-in-polygon bugs |
| LLM | Anthropic SDK, `claude-sonnet-4-6` | fast, cheap, grounded prompt; key in `.env` (git-ignored) |
| Frontend | React + Vite | instant HMR, fastest scaffold |
| Map | Leaflet + react-leaflet | free, no token, GeoJSON native (Mapbox = token risk on stage) |
| Styling | plain CSS grid (or Tailwind if designer prefers) | one screen, no component lib needed |

**Mapbox dropped:** needs an API token = a live dependency on stage. Leaflet + OSM tiles cached or fine offline-ish. Avoids the exact failure mode we're engineering against.

## 10. Build timeline (3 hours, parallel)

**Hour 0 (first 20 min) — ALL TOGETHER:** lock `models.py` (`StateModel`). Eng A copies `sectors.geojson`, authors `tfr.json`, pulls METAR. Eng C scaffolds Vite + the 4-panel grid with HARDCODED mock state matching the schema. Now everyone unblocked — frontend builds against mock, backend fills the same shape.

| Time | Eng A (data/detect) | Eng B (cost/network) | Eng C (frontend/chat) |
|---|---|---|---|
| H0:20–H1:30 | loader + shapely detection (R2), JBU1575 flagged | cost.py rates + per-flight (R5) | map panel: TFR + track + weather (R1) |
| H1:30–H2:30 | wire detection into build_state | options (R6) + network gap (R7) | events panel (R3) + news (R4) from mock |
| H2:30–H3:00 | help integrate | help integrate | chat endpoint + grounded prompt + fallback (R8) |

**Integration gate (H2:30):** swap frontend from mock to real `/api/state`. Schema match = instant. This is why the contract is locked first.

**H3:00 — freeze.** Pre-test 5 chat prompts, cache fallbacks. Verify determinism (R9): hit `/api/state` 5×, diff. Rehearse narrative.

**Cut order if behind:** R7 network gap → R6 third option → R4 news to 3 static items → chatbot to fallback-only (still "works"). Never cut R1 (the hook) or R5 (the dollar).

## 11. Determinism plan (R9)

- All compute in `build_state()` at startup from static files. No `random`, no `datetime.now()` in compute paths — event times come from `tfr.json`.
- `/api/state` serves the cached object → identical bytes every call.
- Verify: `for i in {1..5}; do curl -s localhost:8000/api/state | sha256sum; done` → all hashes equal.
- Chatbot prose may vary; cited numbers come from injected facts → can't drift.

## 12. Tier 2 seams (R11–R13)

- **R11 live bookmark:** `news.py` ingestion already behind a function; swap static read for a GDELT fetch, keep the same `NewsItem` shape. Fallback to static on failure.
- **R12 animation:** track is already an ordered waypoint list with timestamps; add a play button that reveals waypoints by `t`. Frontend-only.
- **R13 second event:** `StateModel.events` is already a list; add a second `Event`, re-run detection/cost on it. Toggle in left panel.

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| LLM invents numbers (SRS §7) | inject computed facts; pre-test prompts; cache fallback |
| LLM API down on stage | fallback JSON keyed by prompt → never a live dependency |
| Geometry edge cases (U-turn near polygon) | shapely segment-crossing, not vertex-only; assert JBU1575 flagged |
| Scope drift into a real optimizer | heuristics only; coordination = fixed-factor reference, labeled as such |
| Integration thrash | lock `models.py` in first 20 min; frontend builds on mock |
| Map needs network token | Leaflet, no token |

## 14. Open items for build start

- METAR pull command (Eng A, H0): `curl "https://aviationweather.gov/api/data/metar?ids=KMIA,KFLL,MKJP&format=json" -o data/metar.json`
- `tfr.json` polygon coords — Eng A authors from Kingston-FIR closure geometry (center 26.97°N 97.16°W per SRS R1; closure polygon over Caribbean approach).
- Anthropic API key → `.env` (already git-ignored).
- `news.json` — Eng C hand-authors 3+ real GDELT-sourced items (GoM military NOTAM, FL storm, port strike per SRS R4).
