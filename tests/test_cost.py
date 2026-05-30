from backend.cost import great_circle_nm, track_length_nm, flight_cost, event_cost
from backend.models import Flight, Waypoint

def _wp(lat, lon, t=0): return Waypoint(lat=lat, lon=lon, t=t)

def test_great_circle_known_distance():
    d = great_circle_nm(26.07, -80.15, 17.94, -76.79)
    assert 480 < d < 600

def test_tracked_flight_cost_deterministic_positive():
    f = Flight(id="X", icao24="x", affected=True, track=[_wp(26,-80), _wp(23,-76), _wp(26,-80)])
    c1 = flight_cost(f, 18.0, -76.8); c2 = flight_cost(f, 18.0, -76.8)
    assert c1.total_usd == c2.total_usd and c1.total_usd > 0
    assert abs(c1.total_usd - (c1.delay_usd + c1.fuel_usd + c1.crew_usd)) < 1e-6

def test_trackless_casualty_cost_from_exposure():
    f = Flight(id="C", icao24="c", affected=True, track=[], first_seen=1779489225, last_seen=1779491007)
    c = flight_cost(f, 18.0, -76.8)
    assert c.total_usd > 0 and c.fuel_usd == 0.0

def test_event_cost_sums_affected_only():
    a = Flight(id="A", icao24="a", affected=True, track=[_wp(26,-80), _wp(23,-76)])
    b = Flight(id="B", icao24="b", affected=False, track=[_wp(40,-100)])
    cb = event_cost([a,b], 18.0, -76.8); only_a = flight_cost(a, 18.0, -76.8)
    assert abs(cb.total_usd - only_a.total_usd) < 1e-6
