from backend.options import build_options

def test_three_options_one_cheapest():
    opts = build_options(2.13, 240.0, 16)
    assert len(opts) == 3
    assert {o.kind for o in opts} == {"hold","divert","preempt"}
    assert len([o for o in opts if o.cheapest]) == 1
    assert all(o.cost_usd > 0 for o in opts)

def test_options_deterministic():
    assert [o.cost_usd for o in build_options(2.13,240.0,16)] == [o.cost_usd for o in build_options(2.13,240.0,16)]
