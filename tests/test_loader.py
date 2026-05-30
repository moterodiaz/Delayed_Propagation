from backend.loader import load_flights, load_tfr, load_sectors, load_weather, load_news
from backend.models import Flight, MetarMarker


def test_load_flights_includes_hero_with_full_track():
    flights = load_flights()
    hero = [f for f in flights if f.is_hero]
    assert len(hero) == 1
    assert hero[0].id == "JBU1575"
    assert hero[0].icao24 == "a854d0"
    assert len(hero[0].track) > 100  # 229 real waypoints


def test_load_flights_includes_15_casualties_as_affected():
    flights = load_flights()
    casualties = [f for f in flights if not f.is_hero]
    assert len(casualties) == 15
    assert all(f.affected for f in casualties)  # pre-filtered affected set
    assert all(f.first_seen is not None for f in casualties)


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
