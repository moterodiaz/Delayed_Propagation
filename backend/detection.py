from datetime import datetime, timezone
from shapely.geometry import Polygon, LineString, Point
from backend.models import Flight


def _epoch(iso: str) -> int:
    return int(datetime.fromisoformat(iso.replace("Z", "+00:00"))
               .astimezone(timezone.utc).timestamp())


def _polygon(tfr: dict) -> Polygon:
    # tfr polygon is [[lat, lon], ...]; shapely uses (x=lon, y=lat)
    return Polygon([(lon, lat) for lat, lon in tfr["polygon"]])


def detect_affected(flights: list[Flight], tfr: dict) -> list[Flight]:
    poly = _polygon(tfr)
    start = _epoch(tfr["active"]["start"])
    end = _epoch(tfr["active"]["end"])

    for f in flights:
        if not f.track:
            continue  # trackless casualty: keep loaded affected flag
        in_window = any(start <= wp.t <= end for wp in f.track)
        pts = [(wp.lon, wp.lat) for wp in f.track]
        if len(pts) >= 2:
            intersects = LineString(pts).intersects(poly)
        else:
            intersects = poly.contains(Point(pts[0])) or poly.touches(Point(pts[0]))
        f.affected = bool(in_window and intersects)

    return flights
