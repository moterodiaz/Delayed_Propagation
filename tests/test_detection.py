from backend.detection import detect_affected
from backend.models import Flight, Waypoint

TFR = {
    "polygon": [[24.5, -77.5], [24.5, -74.0], [21.0, -74.0], [21.0, -77.5], [24.5, -77.5]],
    "active": {"start": "2026-05-22T21:30:00Z", "end": "2026-05-22T23:43:00Z"},
}


def _wp(lat, lon, t=1779488000):
    return Waypoint(lat=lat, lon=lon, t=t)


def test_tracked_flight_crossing_polygon_in_window_is_affected():
    f = Flight(id="X", icao24="x", track=[_wp(26.0, -80.0), _wp(23.0, -76.0)])
    detect_affected([f], TFR)
    assert f.affected is True


def test_tracked_flight_clear_of_polygon_not_affected():
    f = Flight(id="Y", icao24="y", track=[_wp(40.0, -100.0), _wp(41.0, -101.0)])
    detect_affected([f], TFR)
    assert f.affected is False


def test_tracked_flight_in_polygon_but_outside_window_not_affected():
    f = Flight(id="Z", icao24="z", track=[_wp(23.0, -76.0, t=1000)])
    detect_affected([f], TFR)
    assert f.affected is False


def test_trackless_casualty_keeps_loaded_affected_flag():
    f = Flight(id="C", icao24="c", track=[], affected=True)
    detect_affected([f], TFR)
    assert f.affected is True  # not un-flagged


from backend.loader import load_flights, load_tfr


def test_hero_jbu1575_flagged_against_real_data():
    flights = load_flights()
    detect_affected(flights, load_tfr())
    hero = next(f for f in flights if f.is_hero)
    assert hero.affected is True, "JBU1575 must be flagged; widen data/tfr.json polygon to cover its track"
