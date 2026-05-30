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
