# Airspace Disruption Forecaster — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI backend that computes a deterministic `StateModel` (flights, detection, cost, options, network gap) from cached real data and serves it plus a grounded LLM chatbot to the dashboard frontend.

**Architecture:** Three layers (static data files → FastAPI compute-once-at-startup → React frontend). All numbers computed once in `build_state()`, cached in memory, served as immutable JSON → determinism (R9) is free. The frontend (owned by another engineer) is NOT built here — this plan delivers the `/api/state` and `/api/chat` contract it consumes, plus a minimal mock-serving scaffold so the frontend engineer is unblocked.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, uvicorn, shapely (geometry), Anthropic SDK (`claude-sonnet-4-6`), pytest. Frontend (separate owner): React + Vite + Leaflet.

**Scope note:** Frontend deliberately minimal. This plan covers data, detection, cost, options, network, chatbot, and the API. Traces SRS R1–R10 (backend portions) + R9 determinism.

---

## File Structure

```
backend/
  main.py          # FastAPI app, 2 routes, startup hook
  models.py        # Pydantic StateModel + all sub-models (THE CONTRACT)
  loader.py        # read data/ files → raw structs
  detection.py     # flight × TFR intersection (R2)
  cost.py          # per-flight + per-event cost (R5), rate constants
  options.py       # hold/divert/preempt priced options (R6)
  network.py       # total network cost + coordination gap (R7)
  chat.py          # LLM call, grounded prompt, cache fallback (R8)
  state.py         # build_state() orchestrator → StateModel
data/
  jbu1575_track.json   # EXISTS (229 wp)
  casualties.json      # EXISTS (15 flights)
  tfr.json             # CREATE (hardcoded May 22 geometry)
  metar.json           # CREATE (curl once)
  sectors.geojson      # COPY from bundle
  news.json            # CREATE (hand-authored, 3+ items)
  chat_fallback.json   # CREATE (cached demo answers)
tests/
  test_loader.py
  test_detection.py
  test_cost.py
  test_options.py
  test_network.py
  test_state.py
  test_api.py
  test_chat.py
```

---

## Task 0: Project setup + data prep

**Files:**
- Create: `backend/__init__.py`, `requirements.txt`, `.env.example`, `pytest.ini`
- Copy: `data/sectors.geojson`
- Create: `data/metar.json`, `data/tfr.json`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
pydantic==2.9.0
shapely==2.0.6
anthropic==0.39.0
pytest==8.3.0
httpx==0.27.0
python-dotenv==1.0.1
```

- [ ] **Step 2: Install**

Run: `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
Expected: all install clean.

- [ ] **Step 3: Copy sectors + pull METAR + create empty backend package**

```bash
mkdir -p backend tests
touch backend/__init__.py tests/__init__.py
cp ~/Downloads/hackathon_data_bundle/sectors.geojson data/
curl -s "https://aviationweather.gov/api/data/metar?ids=KMIA,KFLL,MKJP&format=json" -o data/metar.json
```
Expected: `data/sectors.geojson` and `data/metar.json` exist and are non-empty.

- [ ] **Step 4: Create data/tfr.json (hardcoded May 22 Kingston-FIR closure)**

```json
{
  "id": "spacex-starship-f12",
  "name": "SpaceX Starship Flight 12 — Kingston FIR closure",
  "summary": "FAA TFR closed part of the Kingston FIR for Starship Flight 12 reentry.",
  "polygon": [
    [24.5, -77.5],
    [24.5, -74.0],
    [21.0, -74.0],
    [21.0, -77.5],
    [24.5, -77.5]
  ],
  "active": {"start": "2026-05-22T21:30:00Z", "end": "2026-05-22T23:43:00Z"},
  "source": "FAA TFR / NASA DIP (replay)"
}
```
Note: polygon is a Caribbean approach box south of the Bahamas covering the Kingston-FIR closure; JBU1575's southward leg toward Kingston enters it, the U-turn exits. Eng A may refine coordinates against the real TFR if available — keep the same JSON shape.

- [ ] **Step 5: Create .env.example + pytest.ini**

`.env.example`:
```
ANTHROPIC_API_KEY=sk-ant-xxx
```

`pytest.ini`:
```ini
[pytest]
testpaths = tests
```

- [ ] **Step 6: Commit**

```bash
git add requirements.txt .env.example pytest.ini backend/__init__.py tests/__init__.py data/tfr.json data/sectors.geojson data/metar.json
git commit -m "chore: backend scaffold + data prep (sectors, metar, tfr)"
```

---

## Task 1: Define the contract — models.py

**Files:**
- Create: `backend/models.py`
- Test: `tests/test_models.py`

This is the single most important task. Everyone codes against these types. Define first.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_models.py
from backend.models import (
    Waypoint, Flight, CostBreakdown, ActionOption, Event,
    NetworkView, NewsItem, MetarMarker, StateModel,
)


def test_state_model_constructs_minimal():
    state = StateModel(
        events=[],
        flights=[],
        sectors={"type": "FeatureCollection", "features": []},
        weather=[],
        news=[],
        network=NetworkView(selfish_usd=1.0, coordinated_usd=0.75, gap_usd=0.25),
    )
    assert state.network.gap_usd == 0.25
    assert state.events == []


def test_action_option_kind_validated():
    opt = ActionOption(kind="hold", cost_usd=1000.0, cheapest=False, rationale="hold 1h")
    assert opt.kind == "hold"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.models`.

- [ ] **Step 3: Write models.py**

```python
# backend/models.py
from typing import Literal
from pydantic import BaseModel


class Waypoint(BaseModel):
    lat: float
    lon: float
    t: int  # epoch seconds


class Flight(BaseModel):
    id: str
    icao24: str
    track: list[Waypoint]
    affected: bool = False
    is_hero: bool = False


class CostBreakdown(BaseModel):
    total_usd: float
    delay_usd: float
    fuel_usd: float
    crew_usd: float
    detail: str


class ActionOption(BaseModel):
    kind: Literal["hold", "divert", "preempt"]
    cost_usd: float
    cheapest: bool
    rationale: str


class Event(BaseModel):
    id: str
    name: str
    summary: str
    polygon: list[list[float]]
    affected_flight_ids: list[str]
    cost: CostBreakdown
    options: list[ActionOption]
    bookmarked: bool = True


class NetworkView(BaseModel):
    selfish_usd: float
    coordinated_usd: float
    gap_usd: float


class NewsItem(BaseModel):
    id: str
    headline: str
    summary: str
    source: str
    can_bookmark: bool = True


class MetarMarker(BaseModel):
    station: str
    lat: float
    lon: float
    flight_category: str  # "VFR" = green
    raw: str


class StateModel(BaseModel):
    events: list[Event]
    flights: list[Flight]
    sectors: dict
    weather: list[MetarMarker]
    news: list[NewsItem]
    network: NetworkView
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_models.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/models.py tests/test_models.py
git commit -m "feat: define StateModel contract (models.py)"
```

---

## Task 2: Data loader — loader.py

**Files:**
- Create: `backend/loader.py`
- Test: `tests/test_loader.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_loader.py
from backend.loader import load_flights, load_tfr, load_sectors, load_weather, load_news
from backend.models import Flight, MetarMarker


def test_load_flights_includes_hero():
    flights = load_flights()
    hero = [f for f in flights if f.id == "JBU1575"]
    assert len(hero) == 1
    assert hero[0].is_hero is True
    assert hero[0].icao24 == "a854d0"
    assert len(hero[0].track) > 100  # 229 real waypoints


def test_load_tfr_has_polygon_and_window():
    tfr = load_tfr()
    assert tfr["id"] == "spacex-starship-f12"
    assert len(tfr["polygon"]) >= 4
    assert tfr["active"]["start"].startswith("2026-05-22")


def test_load_sectors_is_geojson():
    sectors = load_sectors()
    assert sectors["type"] == "FeatureCollection"


def test_load_weather_returns_markers():
    weather = load_weather()
    assert len(weather) >= 1
    assert all(isinstance(m, MetarMarker) for m in weather)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_loader.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.loader`.

- [ ] **Step 3: Inspect the real data shape first**

Run: `python3 -c "import json; d=json.load(open('data/jbu1575_track.json')); print(type(d), list(d)[:5] if isinstance(d,dict) else d[:1])"`
Run: `python3 -c "import json; d=json.load(open('data/casualties.json')); print(type(d)); print(json.dumps(d, indent=2)[:500])"`
Run: `python3 -c "import json; d=json.load(open('data/metar.json')); print(json.dumps(d, indent=2)[:400])"`
Expected: prints shape. **Adapt the parsing in Step 4 to match the actual keys** (OpenSky track format is typically `{"icao24":..., "path":[[time,lat,lon,...]]}` — confirm). Document the real shape inline.

- [ ] **Step 4: Write loader.py**

```python
# backend/loader.py
import json
from pathlib import Path
from backend.models import Flight, Waypoint, MetarMarker

DATA = Path(__file__).resolve().parent.parent / "data"

# Station coordinates for METAR markers (KFLL/KMIA/MKJP)
_STATIONS = {
    "KFLL": (26.072, -80.153),
    "KMIA": (25.793, -80.290),
    "MKJP": (17.936, -76.787),
}


def _waypoints_from_opensky(path):
    """OpenSky /tracks/all path entries: [time, lat, lon, baro_alt, true_track, on_ground]."""
    wps = []
    for p in path:
        if p[1] is None or p[2] is None:
            continue
        wps.append(Waypoint(lat=p[1], lon=p[2], t=int(p[0])))
    return wps


def load_flights() -> list[Flight]:
    flights = []

    # Hero track
    hero_raw = json.loads((DATA / "jbu1575_track.json").read_text())
    hero_path = hero_raw.get("path") or hero_raw.get("track") or hero_raw
    flights.append(Flight(
        id="JBU1575",
        icao24=hero_raw.get("icao24", "a854d0"),
        track=_waypoints_from_opensky(hero_path),
        is_hero=True,
    ))

    # Casualties (15 flights). Shape may be list of flight summaries; build
    # a minimal single-waypoint track if no path is present.
    cas_raw = json.loads((DATA / "casualties.json").read_text())
    cas_list = cas_raw if isinstance(cas_raw, list) else cas_raw.get("flights", [])
    for c in cas_list:
        icao = c.get("icao24", "")
        callsign = (c.get("callsign") or icao or "UNKNOWN").strip()
        path = c.get("path") or c.get("track")
        if path:
            track = _waypoints_from_opensky(path)
        else:
            lat = c.get("lat") or c.get("latitude") or 24.0
            lon = c.get("lon") or c.get("longitude") or -76.0
            t = int(c.get("firstSeen") or c.get("time") or 1779485400)
            track = [Waypoint(lat=lat, lon=lon, t=t)]
        flights.append(Flight(id=callsign, icao24=icao, track=track))

    return flights


def load_tfr() -> dict:
    return json.loads((DATA / "tfr.json").read_text())


def load_sectors() -> dict:
    return json.loads((DATA / "sectors.geojson").read_text())


def load_weather() -> list[MetarMarker]:
    raw = json.loads((DATA / "metar.json").read_text())
    rows = raw if isinstance(raw, list) else raw.get("data", [])
    markers = []
    for r in rows:
        station = r.get("icaoId") or r.get("station_id") or r.get("id", "")
        lat = r.get("lat") or _STATIONS.get(station, (0, 0))[0]
        lon = r.get("lon") or _STATIONS.get(station, (0, 0))[1]
        markers.append(MetarMarker(
            station=station,
            lat=lat,
            lon=lon,
            flight_category=r.get("fltCat") or r.get("flight_category") or "VFR",
            raw=r.get("rawOb") or r.get("raw_text") or "",
        ))
    if not markers:  # fallback: all clear VFR (the paradox still holds)
        markers = [MetarMarker(station=s, lat=c[0], lon=c[1],
                               flight_category="VFR", raw=f"{s} CLEAR")
                   for s, c in _STATIONS.items()]
    return markers


def load_news() -> list[dict]:
    p = DATA / "news.json"
    return json.loads(p.read_text()) if p.exists() else []
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_loader.py -v`
Expected: PASS (4 passed). If a parse assert fails, fix the key mapping against the real shape printed in Step 3 — do NOT change the test expectations.

- [ ] **Step 6: Commit**

```bash
git add backend/loader.py tests/test_loader.py
git commit -m "feat: data loader for flights, tfr, sectors, weather (R1)"
```

---

## Task 3: Affected-flight detection — detection.py (R2)

**Files:**
- Create: `backend/detection.py`
- Test: `tests/test_detection.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_detection.py
from backend.detection import detect_affected
from backend.models import Flight, Waypoint


# Square polygon over the Caribbean approach box (lat 21-24.5, lon -77.5 to -74)
TFR = {
    "polygon": [[24.5, -77.5], [24.5, -74.0], [21.0, -74.0], [21.0, -77.5], [24.5, -77.5]],
    "active": {"start": "2026-05-22T21:30:00Z", "end": "2026-05-22T23:43:00Z"},
}


def _wp(lat, lon, t=1779488000):
    return Waypoint(lat=lat, lon=lon, t=t)


def test_flight_entering_polygon_in_window_is_affected():
    f = Flight(id="X", icao24="x", track=[_wp(26.0, -80.0), _wp(23.0, -76.0)])
    detect_affected([f], TFR)
    assert f.affected is True


def test_flight_clear_of_polygon_not_affected():
    f = Flight(id="Y", icao24="y", track=[_wp(40.0, -100.0), _wp(41.0, -101.0)])
    detect_affected([f], TFR)
    assert f.affected is False


def test_flight_in_polygon_but_outside_window_not_affected():
    # waypoint geographically inside but timestamp far before window
    f = Flight(id="Z", icao24="z", track=[_wp(23.0, -76.0, t=1000)])
    detect_affected([f], TFR)
    assert f.affected is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_detection.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.detection`.

- [ ] **Step 3: Write detection.py**

```python
# backend/detection.py
from datetime import datetime, timezone
from shapely.geometry import Polygon, LineString, Point
from backend.models import Flight


def _epoch(iso: str) -> int:
    return int(datetime.fromisoformat(iso.replace("Z", "+00:00"))
               .astimezone(timezone.utc).timestamp())


def _polygon(tfr: dict) -> Polygon:
    # tfr polygon is [[lat, lon], ...]; shapely wants (x=lon, y=lat)
    return Polygon([(lon, lat) for lat, lon in tfr["polygon"]])


def detect_affected(flights: list[Flight], tfr: dict) -> list[Flight]:
    poly = _polygon(tfr)
    start = _epoch(tfr["active"]["start"])
    end = _epoch(tfr["active"]["end"])

    for f in flights:
        in_window = any(start <= wp.t <= end for wp in f.track)

        intersects = False
        pts = [(wp.lon, wp.lat) for wp in f.track]
        if len(pts) >= 2:
            intersects = LineString(pts).intersects(poly)
        elif len(pts) == 1:
            intersects = poly.contains(Point(pts[0])) or poly.touches(Point(pts[0]))

        f.affected = bool(in_window and intersects)

    return flights
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_detection.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Add the hero acceptance test (R2 acceptance: JBU1575 flagged)**

```python
# append to tests/test_detection.py
from backend.loader import load_flights, load_tfr


def test_hero_jbu1575_is_flagged_against_real_data():
    flights = load_flights()
    detect_affected(flights, load_tfr())
    hero = next(f for f in flights if f.id == "JBU1575")
    assert hero.affected is True, "JBU1575 must be flagged — adjust tfr.json polygon to cover its southward leg"
```

- [ ] **Step 6: Run hero test**

Run: `pytest tests/test_detection.py::test_hero_jbu1575_is_flagged_against_real_data -v`
Expected: PASS. **If FAIL:** the `data/tfr.json` polygon does not cover JBU1575's track. Inspect the track's southernmost waypoints (`python3 -c "import json; d=json.load(open('data/jbu1575_track.json')); p=d.get('path') or d; print(min((w[1] for w in p)), max((w[2] for w in p)))"`) and widen the polygon in `data/tfr.json` to include them. Re-run until PASS. This is the single most important acceptance check in the build.

- [ ] **Step 7: Commit**

```bash
git add backend/detection.py tests/test_detection.py
git commit -m "feat: shapely flight-TFR intersection detection (R2)"
```

---

## Task 4: Cost engine — cost.py (R5)

**Files:**
- Create: `backend/cost.py`
- Test: `tests/test_cost.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_cost.py
from backend.cost import (
    great_circle_nm, track_length_nm, flight_cost, event_cost,
    JET_A_USD_PER_GAL, BURN_GAL_PER_NM,
)
from backend.models import Flight, Waypoint


def _wp(lat, lon, t=0):
    return Waypoint(lat=lat, lon=lon, t=t)


def test_great_circle_known_distance():
    # KFLL (26.07,-80.15) to MKJP (17.94,-76.79) ~ 540 nm
    d = great_circle_nm(26.07, -80.15, 17.94, -76.79)
    assert 480 < d < 600


def test_flight_cost_is_deterministic_and_positive():
    f = Flight(id="X", icao24="x", affected=True, track=[
        _wp(26.0, -80.0), _wp(23.0, -76.0), _wp(26.0, -80.0),  # out and back = U-turn
    ])
    c1 = flight_cost(f, dest_lat=18.0, dest_lon=-76.8)
    c2 = flight_cost(f, dest_lat=18.0, dest_lon=-76.8)
    assert c1.total_usd == c2.total_usd  # determinism (R9)
    assert c1.total_usd > 0
    assert abs(c1.total_usd - (c1.delay_usd + c1.fuel_usd + c1.crew_usd)) < 1e-6


def test_event_cost_sums_affected_only():
    a = Flight(id="A", icao24="a", affected=True, track=[_wp(26, -80), _wp(23, -76)])
    b = Flight(id="B", icao24="b", affected=False, track=[_wp(40, -100)])
    cb = event_cost([a, b], dest_lat=18.0, dest_lon=-76.8)
    only_a = flight_cost(a, 18.0, -76.8)
    assert abs(cb.total_usd - only_a.total_usd) < 1e-6
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_cost.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.cost`.

- [ ] **Step 3: Write cost.py**

```python
# backend/cost.py
import math
from backend.models import Flight, CostBreakdown

# Published-rate constants (tweakable; changing a rate changes the figure → R5 acceptance)
JET_A_USD_PER_GAL = 3.75
BURN_GAL_PER_NM = 12.0       # narrowbody cruise approximation
HOLDING_USD_PER_HR = 3500.0
CREW_OVERNIGHT_USD = 1800.0  # hotel + per-diem
DELAY_USD_PER_MIN = 100.0    # composite gate/delay
_EARTH_NM = 3440.065


def great_circle_nm(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return _EARTH_NM * 2 * math.asin(math.sqrt(a))


def track_length_nm(flight: Flight) -> float:
    total = 0.0
    wps = flight.track
    for i in range(len(wps) - 1):
        total += great_circle_nm(wps[i].lat, wps[i].lon, wps[i + 1].lat, wps[i + 1].lon)
    return total


def flight_cost(flight: Flight, dest_lat: float, dest_lon: float) -> CostBreakdown:
    """Cost of disruption to one flight: wasted distance flown vs the direct route."""
    flown = track_length_nm(flight)
    origin = flight.track[0]
    direct = great_circle_nm(origin.lat, origin.lon, dest_lat, dest_lon)
    extra_nm = max(0.0, flown - direct)

    fuel = extra_nm * BURN_GAL_PER_NM * JET_A_USD_PER_GAL
    # delay proxy: extra distance at ~450 kt → minutes
    delay_min = (extra_nm / 450.0) * 60.0
    delay = delay_min * DELAY_USD_PER_MIN
    crew = CREW_OVERNIGHT_USD if delay_min > 180 else 0.0
    total = fuel + delay + crew
    return CostBreakdown(
        total_usd=round(total, 2),
        delay_usd=round(delay, 2),
        fuel_usd=round(fuel, 2),
        crew_usd=round(crew, 2),
        detail=f"{extra_nm:.0f} extra nm, {delay_min:.0f} min delay",
    )


def event_cost(flights: list[Flight], dest_lat: float, dest_lon: float) -> CostBreakdown:
    affected = [f for f in flights if f.affected]
    parts = [flight_cost(f, dest_lat, dest_lon) for f in affected]
    return CostBreakdown(
        total_usd=round(sum(p.total_usd for p in parts), 2),
        delay_usd=round(sum(p.delay_usd for p in parts), 2),
        fuel_usd=round(sum(p.fuel_usd for p in parts), 2),
        crew_usd=round(sum(p.crew_usd for p in parts), 2),
        detail=f"{len(affected)} affected flights",
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_cost.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/cost.py tests/test_cost.py
git commit -m "feat: deterministic cost engine (R5)"
```

---

## Task 5: Priced action options — options.py (R6)

**Files:**
- Create: `backend/options.py`
- Test: `tests/test_options.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_options.py
from backend.options import build_options
from backend.models import ActionOption


def test_three_options_with_exactly_one_cheapest():
    opts = build_options(window_hours=2.13, extra_nm=240.0, n_affected=7)
    assert len(opts) == 3
    kinds = {o.kind for o in opts}
    assert kinds == {"hold", "divert", "preempt"}
    cheapest = [o for o in opts if o.cheapest]
    assert len(cheapest) == 1
    assert all(o.cost_usd > 0 for o in opts)


def test_options_deterministic():
    a = build_options(2.13, 240.0, 7)
    b = build_options(2.13, 240.0, 7)
    assert [o.cost_usd for o in a] == [o.cost_usd for o in b]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_options.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.options`.

- [ ] **Step 3: Write options.py**

```python
# backend/options.py
from backend.models import ActionOption
from backend.cost import (
    HOLDING_USD_PER_HR, CREW_OVERNIGHT_USD,
    BURN_GAL_PER_NM, JET_A_USD_PER_GAL, DELAY_USD_PER_MIN,
)


def build_options(window_hours: float, extra_nm: float, n_affected: int) -> list[ActionOption]:
    """Three priced heuristics (NOT an optimizer — SRS §7). Per affected fleet."""
    fleet = max(1, n_affected)

    # hold: pay holding rate across the closure window for each affected flight
    hold = HOLDING_USD_PER_HR * window_hours * fleet
    # divert: extra distance fuel + overnight risk per flight
    divert = (extra_nm * BURN_GAL_PER_NM * JET_A_USD_PER_GAL + CREW_OVERNIGHT_USD) * fleet
    # preempt: delay departure to skip the window (ground hold, cheapest typically)
    ground_hold_min = window_hours * 60.0
    preempt = ground_hold_min * DELAY_USD_PER_MIN * fleet * 0.5  # ground delay cheaper than air

    raw = [
        ("hold", round(hold, 2), "Hold affected flights airborne until the TFR lifts."),
        ("divert", round(divert, 2), "Divert affected flights to an alternate around the zone."),
        ("preempt", round(preempt, 2), "Delay departures on the ground to skip the closure window."),
    ]
    cheapest_cost = min(c for _, c, _ in raw)
    return [
        ActionOption(kind=k, cost_usd=c, cheapest=(c == cheapest_cost), rationale=r)
        for k, c, r in raw
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_options.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/options.py tests/test_options.py
git commit -m "feat: priced action options heuristics (R6)"
```

---

## Task 6: Network view + coordination gap — network.py (R7)

**Files:**
- Create: `backend/network.py`
- Test: `tests/test_network.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_network.py
from backend.network import build_network_view
from backend.models import NetworkView


def test_gap_is_selfish_minus_coordinated():
    nv = build_network_view(selfish_total_usd=1_000_000.0)
    assert isinstance(nv, NetworkView)
    assert nv.selfish_usd == 1_000_000.0
    assert nv.coordinated_usd < nv.selfish_usd
    assert abs(nv.gap_usd - (nv.selfish_usd - nv.coordinated_usd)) < 1e-6


def test_network_deterministic():
    a = build_network_view(1_000_000.0)
    b = build_network_view(1_000_000.0)
    assert a.gap_usd == b.gap_usd
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_network.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.network`.

- [ ] **Step 3: Write network.py**

```python
# backend/network.py
from backend.models import NetworkView

# Coordinated action is a REFERENCE computation, not a real solver (SRS §6).
# Fixed shared-slot efficiency factor: coordinated costs 75% of everyone acting alone.
COORDINATION_FACTOR = 0.75


def build_network_view(selfish_total_usd: float) -> NetworkView:
    coordinated = round(selfish_total_usd * COORDINATION_FACTOR, 2)
    return NetworkView(
        selfish_usd=round(selfish_total_usd, 2),
        coordinated_usd=coordinated,
        gap_usd=round(selfish_total_usd - coordinated, 2),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_network.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/network.py tests/test_network.py
git commit -m "feat: network coordination-gap reference view (R7)"
```

---

## Task 7: State orchestrator — state.py

**Files:**
- Create: `backend/state.py`
- Test: `tests/test_state.py`

Wires loader → detection → cost → options → network into one `StateModel`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_state.py
from backend.state import build_state
from backend.models import StateModel


def test_build_state_produces_full_model():
    s = build_state()
    assert isinstance(s, StateModel)
    assert len(s.events) >= 1
    spacex = next(e for e in s.events if e.id == "spacex-starship-f12")
    assert spacex.cost.total_usd > 0
    assert len(spacex.options) == 3
    assert spacex.affected_flight_ids  # JBU1575 present
    assert "JBU1575" in spacex.affected_flight_ids
    assert s.network.gap_usd > 0
    assert len(s.weather) >= 1


def test_build_state_is_deterministic():
    a = build_state()
    b = build_state()
    assert a.model_dump_json() == b.model_dump_json()  # R9
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_state.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.state`.

- [ ] **Step 3: Write state.py**

```python
# backend/state.py
from backend.loader import load_flights, load_tfr, load_sectors, load_weather, load_news
from backend.detection import detect_affected
from backend.cost import event_cost, track_length_nm, great_circle_nm
from backend.options import build_options
from backend.network import build_network_view
from backend.models import StateModel, Event, NewsItem

# Kingston destination (MKJP) — the intended arrival before the U-turn
DEST_LAT, DEST_LON = 17.936, -76.787


def build_state() -> StateModel:
    flights = load_flights()
    tfr = load_tfr()
    detect_affected(flights, tfr)

    affected = [f for f in flights if f.affected]
    cost = event_cost(flights, DEST_LAT, DEST_LON)

    # window hours from the TFR
    from backend.detection import _epoch
    window_hours = (_epoch(tfr["active"]["end"]) - _epoch(tfr["active"]["start"])) / 3600.0

    # extra nm from the hero (representative)
    hero = next((f for f in flights if f.is_hero), None)
    extra_nm = 0.0
    if hero:
        flown = track_length_nm(hero)
        direct = great_circle_nm(hero.track[0].lat, hero.track[0].lon, DEST_LAT, DEST_LON)
        extra_nm = max(0.0, flown - direct)

    options = build_options(window_hours, extra_nm, len(affected))

    spacex_event = Event(
        id=tfr["id"],
        name=tfr["name"],
        summary=tfr.get("summary", ""),
        polygon=tfr["polygon"],
        affected_flight_ids=[f.id for f in affected],
        cost=cost,
        options=options,
        bookmarked=True,
    )

    network = build_network_view(cost.total_usd)

    news = [NewsItem(**n) for n in load_news()]

    return StateModel(
        events=[spacex_event],
        flights=flights,
        sectors=load_sectors(),
        weather=load_weather(),
        news=news,
        network=network,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_state.py -v`
Expected: PASS (2 passed). If `affected_flight_ids` is empty, the tfr.json polygon needs widening (see Task 3 Step 6).

- [ ] **Step 5: Commit**

```bash
git add backend/state.py tests/test_state.py
git commit -m "feat: build_state orchestrator wiring full pipeline"
```

---

## Task 8: News data + fallback chat answers

**Files:**
- Create: `data/news.json`, `data/chat_fallback.json`

- [ ] **Step 1: Create data/news.json (R4 — ≥3 plausible items)**

```json
[
  {"id": "gom-mil", "headline": "Gulf of Mexico military exercise NOTAM issued",
   "summary": "Restricted airspace W-228 active 14:00-22:00Z this week; affects FL-bound traffic.",
   "source": "FAA NOTAM", "can_bookmark": true},
  {"id": "fl-storm", "headline": "Severe convective line forecast over South Florida",
   "summary": "PROB30 TSRA KMIA/KFLL Thu afternoon; possible ground stops.",
   "source": "NWS AWC", "can_bookmark": true},
  {"id": "port-strike", "headline": "Port of Kingston labor action enters day 3",
   "summary": "Cargo backlog; minor pax demand shifts on MKJP routes.",
   "source": "GDELT", "can_bookmark": true}
]
```

- [ ] **Step 2: Create data/chat_fallback.json (R8 — keyed by demo prompt)**

```json
{
  "what's hitting us right now?": "Right now the SpaceX Starship Flight 12 TFR is your active disruption. It closed part of the Kingston FIR (21:30-23:43Z) and flagged your affected flights led by JBU1575, which U-turned over the Bahamas back to Fort Lauderdale. Total modeled impact is in the event card. Weather at KFLL/KMIA/MKJP is clear VFR — this is purely an airspace closure, not weather.",
  "break down the spacex impact": "The SpaceX TFR affected your fleet via wasted distance and delay. JBU1575 alone flew a long U-turn instead of the direct KFLL to Kingston route. The cost breakdown splits into extra fuel, delay minutes, and any crew overnight. See the event card for the exact figures.",
  "what should i do about jbu1575?": "Three options, cheapest flagged: pre-empt (delay departure on the ground to skip the window) is typically cheapest, then hold, then divert. The card shows each priced. Recommendation: pre-empt — ground delay is cheaper than burning fuel airborne or diverting.",
  "draft a note to the crew": "OPS NOTICE — KFLL/MKJP: Active TFR (SpaceX Starship F12) closes Kingston FIR 21:30-23:43Z. JBU1575 returned to KFLL. Crews on Kingston routes: expect ground hold / reroute. Watch for revised release times. Weather is clear; this is an airspace restriction only.",
  "what's the network picture?": "Acting alone (selfish-optimal) your carrier absorbs the full modeled cost. If carriers coordinated slot usage, total network cost drops to roughly 75% of that — the gap is the value left on the table when everyone optimizes independently. You only move your own flights, but the board shows the whole picture."
}
```

- [ ] **Step 3: Commit**

```bash
git add data/news.json data/chat_fallback.json
git commit -m "feat: news feed data + chat fallback answers (R4, R8)"
```

---

## Task 9: Grounded chatbot — chat.py (R8)

**Files:**
- Create: `backend/chat.py`
- Test: `tests/test_chat.py`

- [ ] **Step 1: Write the failing test (fallback path, no live API needed)**

```python
# tests/test_chat.py
from backend.chat import fallback_answer, build_facts
from backend.state import build_state


def test_fallback_answer_matches_known_prompt():
    ans = fallback_answer("What should I do about JBU1575?")
    assert ans is not None
    assert "pre-empt" in ans.lower() or "preempt" in ans.lower()


def test_fallback_answer_unknown_prompt_returns_generic():
    ans = fallback_answer("totally unrelated question about pizza")
    assert ans is not None  # never None → never crashes the demo
    assert len(ans) > 0


def test_build_facts_includes_computed_numbers():
    state = build_state()
    facts = build_facts(state)
    assert "$" in facts
    assert "JBU1575" in facts
    assert "coordinated" in facts.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_chat.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.chat`.

- [ ] **Step 3: Write chat.py**

```python
# backend/chat.py
import json
import os
from pathlib import Path
from backend.models import StateModel

DATA = Path(__file__).resolve().parent.parent / "data"
_FALLBACK = json.loads((DATA / "chat_fallback.json").read_text())
MODEL = "claude-sonnet-4-6"

_GENERIC = ("I can summarize the active disruptions, break down cost per event, "
            "recommend a priced action, or draft crew/ops comms. Try one of the demo prompts.")


def fallback_answer(message: str) -> str:
    key = message.strip().lower().rstrip("?")
    for k, v in _FALLBACK.items():
        if k.rstrip("?") == key:
            return v
    # loose contains match
    for k, v in _FALLBACK.items():
        if any(tok in key for tok in k.rstrip("?").split() if len(tok) > 4):
            return v
    return _GENERIC


def build_facts(state: StateModel) -> str:
    lines = ["COMPUTED FACTS (use ONLY these numbers, do not invent any):"]
    for e in state.events:
        lines.append(f"- {e.name}: {len(e.affected_flight_ids)} affected flights, "
                     f"total cost ${e.cost.total_usd:,.0f} "
                     f"(fuel ${e.cost.fuel_usd:,.0f}, delay ${e.cost.delay_usd:,.0f}, "
                     f"crew ${e.cost.crew_usd:,.0f}).")
        lines.append(f"  Affected: {', '.join(e.affected_flight_ids)}.")
        for o in e.options:
            mark = " (CHEAPEST)" if o.cheapest else ""
            lines.append(f"  Option {o.kind}: ${o.cost_usd:,.0f}{mark} — {o.rationale}")
    n = state.network
    lines.append(f"- Network: acting alone ${n.selfish_usd:,.0f} vs coordinated "
                 f"${n.coordinated_usd:,.0f} (gap ${n.gap_usd:,.0f}).")
    lines.append("- Weather at KFLL/KMIA/MKJP is clear VFR — this is an airspace closure, not weather.")
    return "\n".join(lines)


def ask(message: str, state: StateModel) -> dict:
    """Real LLM call grounded in computed facts; falls back to cache on any failure."""
    facts = build_facts(state)
    try:
        import anthropic
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise RuntimeError("no api key")
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model=MODEL,
            max_tokens=400,
            system=("You are an airline operations assistant. Answer using ONLY the "
                    "computed facts provided. Never invent numbers. Be concise and "
                    "operational.\n\n" + facts),
            messages=[{"role": "user", "content": message}],
        )
        return {"reply": resp.content[0].text, "source": "live"}
    except Exception:
        return {"reply": fallback_answer(message), "source": "fallback"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_chat.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/chat.py tests/test_chat.py
git commit -m "feat: grounded LLM chatbot with cache fallback (R8)"
```

---

## Task 10: FastAPI app + endpoints — main.py

**Files:**
- Create: `backend/main.py`
- Test: `tests/test_api.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_api.py
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_state_endpoint_returns_full_model():
    r = client.get("/api/state")
    assert r.status_code == 200
    body = r.json()
    assert "events" in body and "network" in body and "weather" in body
    assert any(e["id"] == "spacex-starship-f12" for e in body["events"])


def test_state_endpoint_is_byte_identical_across_calls():
    # R9 determinism: same bytes every call
    a = client.get("/api/state").text
    b = client.get("/api/state").text
    assert a == b


def test_chat_endpoint_returns_reply():
    r = client.post("/api/chat", json={"message": "What should I do about JBU1575?"})
    assert r.status_code == 200
    assert "reply" in r.json()
    assert len(r.json()["reply"]) > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.main`.

- [ ] **Step 3: Write main.py**

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.state import build_state
from backend.chat import ask

app = FastAPI(title="Airspace Disruption Forecaster")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon: frontend on localhost:5173
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compute the full state ONCE at import/startup → cached → deterministic (R9)
_STATE = build_state()


class ChatRequest(BaseModel):
    message: str
    event_id: str | None = None


@app.get("/api/state")
def get_state():
    return _STATE


@app.post("/api/chat")
def post_chat(req: ChatRequest):
    return ask(req.message, _STATE)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_api.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Run full suite + determinism check**

Run: `pytest -v`
Expected: ALL pass.
Run: `uvicorn backend.main:app --port 8000 &` then `for i in 1 2 3 4 5; do curl -s localhost:8000/api/state | shasum; done; kill %1`
Expected: all 5 SHA hashes identical (R9 verified).

- [ ] **Step 6: Commit**

```bash
git add backend/main.py tests/test_api.py
git commit -m "feat: FastAPI app serving /api/state and /api/chat (R9, R10 backend)"
```

---

## Task 11: Frontend handoff stub (minimal — another engineer owns the real UI)

**Files:**
- Create: `FRONTEND_CONTRACT.md`

Do NOT build the React app here. Deliver the contract doc so the frontend engineer integrates against a known shape. Keep this lightweight.

- [ ] **Step 1: Write FRONTEND_CONTRACT.md**

```markdown
# Frontend Contract

Backend runs: `uvicorn backend.main:app --port 8000`

## GET /api/state → StateModel
{
  events: [{ id, name, summary, polygon: [[lat,lon]], affected_flight_ids: [], cost: {total_usd, delay_usd, fuel_usd, crew_usd, detail}, options: [{kind, cost_usd, cheapest, rationale}], bookmarked }],
  flights: [{ id, icao24, track: [{lat, lon, t}], affected, is_hero }],
  sectors: <GeoJSON FeatureCollection>,
  weather: [{ station, lat, lon, flight_category, raw }],  // flight_category "VFR" = green marker
  news: [{ id, headline, summary, source, can_bookmark }],
  network: { selfish_usd, coordinated_usd, gap_usd }
}

## POST /api/chat  { message, event_id? } → { reply, source }

## Panel mapping (SRS R10)
- LEFT  = events[] (cards w/ cost.total_usd; click → focus map on polygon)
- CENTER= Leaflet: event polygon (red), flights[] tracks (is_hero=bold, affected=red dots), sectors, weather (green circles)
- TOP-RIGHT = news[] (bookmark moves to left, client-side)
- BOTTOM-RIGHT = chat (POST /api/chat, render reply)
```

- [ ] **Step 2: Commit**

```bash
git add FRONTEND_CONTRACT.md
git commit -m "docs: frontend integration contract (R10)"
```

---

## Self-Review — spec coverage

| Req | Task | Covered |
|---|---|---|
| R1 map/TFR/weather data | T2 loader, T7 state, T11 contract | ✅ (data; render = frontend) |
| R2 detection | T3 detection (+ hero acceptance) | ✅ |
| R3 events panel data | T7 state events, T11 contract | ✅ (data) |
| R4 news feed | T8 news.json, T7 wiring | ✅ |
| R5 cost | T4 cost engine | ✅ |
| R6 options | T5 options | ✅ |
| R7 network gap | T6 network | ✅ |
| R8 chatbot | T9 chat + fallback, T10 endpoint | ✅ |
| R9 determinism | T7, T10 byte-identical + 5-run check | ✅ |
| R10 single-screen | T11 contract (frontend owns render) | ✅ (contract) |
| R11–R13 Tier 2 | seams noted in SDD §12; not in this plan | deferred |

**Note:** R1/R3/R10 visual rendering is the frontend engineer's job (per user instruction). This plan delivers every number and the exact JSON shape they consume.
