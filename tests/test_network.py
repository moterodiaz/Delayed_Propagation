from backend.network import build_network_view
from backend.models import NetworkView

def test_gap_is_selfish_minus_coordinated():
    nv = build_network_view(1_000_000.0)
    assert isinstance(nv, NetworkView)
    assert nv.coordinated_usd < nv.selfish_usd
    assert abs(nv.gap_usd - (nv.selfish_usd - nv.coordinated_usd)) < 1e-6

def test_network_deterministic():
    assert build_network_view(1e6).gap_usd == build_network_view(1e6).gap_usd
