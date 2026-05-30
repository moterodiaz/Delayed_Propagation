import json
from pathlib import Path
from backend.models import Flight, Waypoint, MetarMarker

DATA = Path(__file__).resolve().parent.parent / "data"


def load_flights() -> list[Flight]:
    flights = []

    # Hero: full real track from "waypoints"
    hero = json.loads((DATA / "jbu1575_track.json").read_text())
    track = [Waypoint(lat=w["lat"], lon=w["lon"], t=int(w["t"]))
             for w in hero["waypoints"]
             if w.get("lat") is not None and w.get("lon") is not None]
    flights.append(Flight(
        id=hero.get("flight", "JBU1575"),
        icao24=hero.get("icao24", "a854d0"),
        track=track,
        is_hero=True,
    ))

    # Casualties: real pre-filtered affected set, no track coords
    cas = json.loads((DATA / "casualties.json").read_text())
    for c in cas["casualties"]:
        flights.append(Flight(
            id=(c.get("flight") or c.get("icao24") or "UNKNOWN").strip(),
            icao24=c.get("icao24", ""),
            track=[],
            affected=True,
            arr=c.get("arr"),
            first_seen=c.get("firstSeen"),
            last_seen=c.get("lastSeen"),
        ))

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
        markers.append(MetarMarker(
            station=r.get("icaoId") or r.get("station_id") or "",
            lat=r.get("lat", 0.0),
            lon=r.get("lon", 0.0),
            flight_category=r.get("fltCat") or "VFR",  # raw METAR lacks category; clear-VFR paradox
            raw=r.get("rawOb") or "",
        ))
    if not markers:
        markers = [
            MetarMarker(station="KFLL", lat=26.072, lon=-80.153, flight_category="VFR", raw="KFLL CLEAR"),
            MetarMarker(station="KMIA", lat=25.793, lon=-80.290, flight_category="VFR", raw="KMIA CLEAR"),
            MetarMarker(station="MKJP", lat=17.936, lon=-76.787, flight_category="VFR", raw="MKJP CLEAR"),
        ]
    return markers


def load_news() -> list[dict]:
    p = DATA / "news.json"
    return json.loads(p.read_text()) if p.exists() else []
