from backend.loader import load_flights, load_tfr, load_sectors, load_weather, load_news
from backend.detection import detect_affected, _epoch
from backend.cost import event_cost, track_length_nm, great_circle_nm
from backend.options import build_options
from backend.network import build_network_view
from backend.models import StateModel, Event, NewsItem

DEST_LAT, DEST_LON = 17.936, -76.787

def build_state():
    flights = load_flights()
    tfr = load_tfr()
    detect_affected(flights, tfr)
    affected = [f for f in flights if f.affected]
    cost = event_cost(flights, DEST_LAT, DEST_LON)
    window_hours = (_epoch(tfr["active"]["end"]) - _epoch(tfr["active"]["start"])) / 3600.0
    hero = next((f for f in flights if f.is_hero), None)
    extra_nm = 0.0
    if hero and hero.track:
        flown = track_length_nm(hero)
        direct = great_circle_nm(hero.track[0].lat, hero.track[0].lon, DEST_LAT, DEST_LON)
        extra_nm = max(0.0, flown - direct)
    options = build_options(window_hours, extra_nm, len(affected))
    event = Event(id=tfr["id"], name=tfr["name"], summary=tfr.get("summary",""),
                  polygon=tfr["polygon"], affected_flight_ids=[f.id for f in affected],
                  cost=cost, options=options, bookmarked=True)
    network = build_network_view(cost.total_usd)
    news = [NewsItem(**n) for n in load_news()]
    return StateModel(events=[event], flights=flights, sectors=load_sectors(),
                      weather=load_weather(), news=news, network=network)
