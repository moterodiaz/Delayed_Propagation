"""Unit tests for the reroute price-optimization core.

Run:  python -m pytest tests/ -q      (or)  python tests/test_solver.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from solver import geometry as geo
from solver.config import Closure, Config, default_config
from solver.data_loader import Flight, load_flights
from solver.pricing import (price_connection, price_divert, price_ground_stop,
                            price_hold, price_reroute)
from solver.report import solve

# A disk we can reason about: center near (20, -76), 250 nm.
CLOSURE = default_config().closure


def _mk_flight(**kw) -> Flight:
    base = dict(
        id="TST1", icao24="aaaaaa", ac_type="A320",
        origin_icao="KFLL", origin=(26.07, -80.15),
        dest_icao="MKJP", dest=(17.94, -76.79), current=(24.0, -78.5),
        departed=True, sched_dep_epoch=0.0,
        cruise_alt_ft=37000.0, cruise_speed_kt=450.0,
        burn_gal_min=11.5, pax=150,
        fuel_remaining_gal=5000.0, reserve_gal=517.5,
        straight_nm=523.0, remaining_nm=400.0, flags=[],
    )
    base.update(kw)
    f = Flight(**base)
    f.dest_in_zone = geo.point_in_disk(f.dest[0], f.dest[1],
                                       CLOSURE.center_lat, CLOSURE.center_lon,
                                       CLOSURE.radius_nm)
    f.route_crosses = geo.segment_crosses_disk(
        f.origin[0], f.origin[1], f.dest[0], f.dest[1],
        CLOSURE.center_lat, CLOSURE.center_lon, CLOSURE.radius_nm)
    f.affected = f.dest_in_zone or f.route_crosses
    return f


# --- 1. detour > straight ONLY when the route is blocked -------------------- #
def test_detour_only_when_blocked():
    c = CLOSURE
    # route that misses the disk entirely (two points well north)
    straight_clear = geo.haversine_nm(30.0, -80.0, 31.0, -75.0)
    around_clear = geo.around_distance_disk(30.0, -80.0, 31.0, -75.0,
                                            c.center_lat, c.center_lon, c.radius_nm)
    assert abs(around_clear - straight_clear) < 1e-9, "no detour when clear"

    # route that crosses the disk (south through Kingston FIR)
    straight_blocked = geo.haversine_nm(26.07, -80.15, 17.94, -76.79)
    # use a destination OUTSIDE the disk on the far side so tangents are defined
    # (origin north, dest south but outside): pick a far southern point
    far_south = (12.0, -76.25)
    straight_b = geo.haversine_nm(26.07, -80.15, far_south[0], far_south[1])
    around_b = geo.around_distance_disk(26.07, -80.15, far_south[0], far_south[1],
                                        c.center_lat, c.center_lon, c.radius_nm)
    assert around_b > straight_b, "detour must exceed straight when blocked"


# --- 2. hold blocked when fuel is short ------------------------------------- #
def test_hold_blocked_when_fuel_short():
    cfg = default_config()
    rich = _mk_flight(fuel_remaining_gal=50000.0, reserve_gal=517.5)
    poor = _mk_flight(fuel_remaining_gal=600.0, reserve_gal=517.5)
    assert price_hold(rich, cfg).feasible, "ample fuel -> hold feasible"
    assert not price_hold(poor, cfg).feasible, "short fuel -> hold infeasible"


# --- 3. ground_stop only for not-departed ----------------------------------- #
def test_ground_stop_requires_not_departed():
    cfg = default_config()
    airborne = _mk_flight(departed=True)
    on_ground = _mk_flight(departed=False)
    assert not price_ground_stop(airborne, cfg).feasible
    assert price_ground_stop(on_ground, cfg).feasible


# --- 4. cost_saved >= 0 on the real bundle ---------------------------------- #
def test_cost_saved_nonnegative_real_data():
    cfg = default_config()  # generous caps -> coupling does not bump
    results = solve(cfg)
    assert results["summary"]["cost_saved"] >= -1e-6


# --- 5. reroute infeasible to a destination inside the zone ----------------- #
def test_no_reroute_into_closed_destination():
    cfg = default_config()
    hero = _mk_flight(dest=(17.94, -76.79))  # MKJP, inside disk
    assert hero.dest_in_zone
    assert not price_reroute(hero, cfg).feasible


# --- 6. determinism: identical inputs -> identical totals ------------------- #
def test_connection_cheaper_than_divert():
    # passengers-rebooked connection should beat a dead-end divert for the same
    # flight, because it carries a smaller disruption penalty.
    cfg = default_config()
    hero = _mk_flight(dest=(17.94, -76.79), current=(23.83, -78.30))  # MKJP blocked
    conn = price_connection(hero, cfg)
    div = price_divert(hero, cfg)
    assert conn.feasible and div.feasible
    assert conn.cost < div.cost, "connection must undercut divert"


def test_determinism():
    cfg = default_config()
    a = solve(cfg)["summary"]["optimized_total"]
    b = solve(cfg)["summary"]["optimized_total"]
    assert a == b


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print("PASS %s" % fn.__name__)
        except AssertionError as e:
            failed += 1
            print("FAIL %s -- %s" % (fn.__name__, e))
    print("\n%d/%d passed" % (len(fns) - failed, len(fns)))
    sys.exit(1 if failed else 0)
