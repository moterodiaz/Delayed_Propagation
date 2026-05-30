"""Price the four legal moves for one flight and pick the cheapest FEASIBLE one.

Per-flight derived rates (spec):
    gs         = cruise_speed_kt / 60          (nm per minute)
    gal_per_nm = burn / gs
A move carries: cost, feasibility, a human detail, and the cost split into
fuel / time / disruption.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from . import geometry as geo
from .config import CONNECTION_HUBS, Config
from .data_loader import Flight


@dataclass
class Move:
    name: str                    # ground_stop | reroute | hold | divert
    feasible: bool
    cost: float
    fuel: float
    time: float
    disruption: float
    detail: str
    reason: str = ""             # why infeasible / extra context
    alternate: Optional[str] = None   # for divert

    @property
    def sortable_cost(self) -> float:
        return self.cost if self.feasible else float("inf")


def _closure_minutes(cfg: Config) -> float:
    """Minutes from closure activation to clear (the wait/hold horizon)."""
    return (cfg.closure.clear_epoch - cfg.closure.activate_epoch) / 60.0


def price_ground_stop(f: Flight, cfg: Config) -> Move:
    wait_min = _closure_minutes(cfg)
    cost = wait_min * cfg.cost.ground_rate
    feasible = not f.departed
    return Move("ground_stop", feasible, cost,
                fuel=0.0, time=cost, disruption=0.0,
                detail="wait %.0f min" % wait_min,
                reason="" if feasible else "already departed")


def price_reroute(f: Flight, cfg: Config) -> Move:
    c = cfg.closure
    # cannot reroute to a destination that is itself inside the zone
    if f.dest_in_zone:
        return Move("reroute", False, float("inf"), 0.0, 0.0, 0.0,
                    detail="-", reason="destination inside zone")
    try:
        around = geo.around_distance_disk(
            f.origin[0], f.origin[1], f.dest[0], f.dest[1],
            c.center_lat, c.center_lon, c.radius_nm)
    except ValueError as exc:
        return Move("reroute", False, float("inf"), 0.0, 0.0, 0.0,
                    detail="-", reason=str(exc))
    extra_nm = max(0.0, around - f.straight_nm)
    fuel = extra_nm * f.gal_per_nm * cfg.cost.fuel_price
    time = (extra_nm / f.gs_nm_min) * cfg.cost.time_rate
    return Move("reroute", True, fuel + time, fuel, time, 0.0,
                detail="+%.0f nm around zone" % extra_nm)


def price_hold(f: Flight, cfg: Config) -> Move:
    hold_min = _closure_minutes(cfg)
    fuel_needed = hold_min * f.burn_gal_min
    usable = f.fuel_remaining_gal - f.reserve_gal
    feasible = fuel_needed <= usable
    fuel = hold_min * f.burn_gal_min * cfg.cost.fuel_price
    time = hold_min * cfg.cost.time_rate
    reason = ("" if feasible
              else "needs %.0f gal, only %.0f usable above reserve"
                   % (fuel_needed, usable))
    return Move("hold", feasible, fuel + time, fuel, time, 0.0,
                detail="hold %.0f min (%.0f gal)" % (hold_min, fuel_needed),
                reason=reason)


def _nearest_alternate(f: Flight, cfg: Config) -> Optional[Tuple[str, float]]:
    """Nearest airport to the current position that is OUTSIDE the zone."""
    c = cfg.closure
    best: Optional[Tuple[str, float]] = None
    for icao, (lat, lon) in sorted(cfg.airports.items()):
        if geo.point_in_disk(lat, lon, c.center_lat, c.center_lon, c.radius_nm):
            continue
        d = geo.haversine_nm(f.current[0], f.current[1], lat, lon)
        if best is None or d < best[1]:
            best = (icao, d)
    return best


def price_divert(f: Flight, cfg: Config) -> Move:
    alt = _nearest_alternate(f, cfg)
    if alt is None:
        return Move("divert", False, float("inf"), 0.0, 0.0, 0.0,
                    detail="-", reason="no alternate outside zone")
    icao, leg_nm = alt
    extra_nm = max(0.0, leg_nm - f.remaining_nm)
    fuel = extra_nm * f.gal_per_nm * cfg.cost.fuel_price
    time = (leg_nm / f.gs_nm_min) * cfg.cost.time_rate
    disruption = cfg.cost.disrupt_fixed + cfg.cost.disrupt_pax * f.pax
    return Move("divert", True, fuel + time + disruption, fuel, time, disruption,
                detail="divert %s (%.0f nm leg)" % (icao, leg_nm),
                alternate=icao)


def _nearest_hub(f: Flight, cfg: Config) -> Optional[Tuple[str, float]]:
    """Nearest connecting hub to the current position that is OUTSIDE the zone
    and is not the flight's own (closed) destination."""
    c = cfg.closure
    best: Optional[Tuple[str, float]] = None
    for icao in CONNECTION_HUBS:
        if icao not in cfg.airports or icao == f.dest_icao:
            continue
        lat, lon = cfg.airports[icao]
        if geo.point_in_disk(lat, lon, c.center_lat, c.center_lon, c.radius_nm):
            continue
        d = geo.haversine_nm(f.current[0], f.current[1], lat, lon)
        if best is None or d < best[1]:
            best = (icao, d)
    return best


def price_connection(f: Flight, cfg: Config) -> Move:
    """Soft divert: fly to a hub, rebook passengers onward to the real dest.
    Cheaper than a divert (pax still arrive) -- smaller rebooking penalty."""
    hub = _nearest_hub(f, cfg)
    if hub is None:
        return Move("connection", False, float("inf"), 0.0, 0.0, 0.0,
                    detail="-", reason="no connecting hub outside zone")
    icao, leg_nm = hub
    extra_nm = max(0.0, leg_nm - f.remaining_nm)
    fuel = extra_nm * f.gal_per_nm * cfg.cost.fuel_price
    time = (leg_nm / f.gs_nm_min) * cfg.cost.time_rate
    disruption = cfg.cost.rebooking_fixed + cfg.cost.rebooking_pax * f.pax
    return Move("connection", True, fuel + time + disruption, fuel, time, disruption,
                detail="connect via %s (%.0f nm leg)" % (icao, leg_nm),
                alternate=icao)


def price_flight(f: Flight, cfg: Config) -> Dict[str, Move]:
    """All five priced moves, keyed by name."""
    return {
        "ground_stop": price_ground_stop(f, cfg),
        "reroute": price_reroute(f, cfg),
        "hold": price_hold(f, cfg),
        "divert": price_divert(f, cfg),
        "connection": price_connection(f, cfg),
    }


def cheapest(moves: Dict[str, Move], forbid: Optional[set] = None) -> Optional[Move]:
    forbid = forbid or set()
    feasible = [m for m in moves.values() if m.feasible and m.name not in forbid]
    if not feasible:
        return None
    return min(feasible, key=lambda m: m.cost)


def baseline_move(moves: Dict[str, Move]) -> Optional[Move]:
    """Uncoordinated naive choice: reroute if possible, else divert. No ground
    stops, no holds (the comparison point for cost_saved)."""
    rr = moves["reroute"]
    if rr.feasible:
        return rr
    dv = moves["divert"]
    return dv if dv.feasible else None
