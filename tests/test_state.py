from backend.state import build_state
from backend.models import StateModel

def test_build_state_full_model():
    s = build_state()
    assert isinstance(s, StateModel)
    sp = next(e for e in s.events if e.id == "spacex-starship-f12")
    assert sp.cost.total_usd > 0 and len(sp.options) == 3
    assert "JBU1575" in sp.affected_flight_ids
    assert s.network.gap_usd > 0 and len(s.weather) >= 1

def test_build_state_deterministic():
    assert build_state().model_dump_json() == build_state().model_dump_json()
