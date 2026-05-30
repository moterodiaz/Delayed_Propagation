"""Orchestration + presentation: solve(), a readable table, and a JSON dump.

solve() runs the whole deterministic pipeline:
    load -> mark affected -> price 4 moves -> cheapest pick -> baseline ->
    coupling repair -> summary.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from .config import Config
from .coupling import repair, usage
from .data_loader import Flight, load_flights
from .pricing import Move, baseline_move, cheapest, price_flight


def solve(cfg: Config,
          casualties_path: Optional[str] = None,
          track_path: Optional[str] = None) -> Dict:
    flights = load_flights(cfg, casualties_path, track_path)
    affected = [f for f in flights if f.affected]
    ignored = [f for f in flights if not f.affected]

    moves_by_flight: Dict[str, Dict[str, Move]] = {}
    pre_pick: Dict[str, Move] = {}
    baseline: Dict[str, Move] = {}

    for f in affected:
        moves = price_flight(f, cfg)
        moves_by_flight[f.id] = moves
        pick = cheapest(moves)
        if pick is None:  # nothing feasible at all
            pick = Move("none", True, 0.0, 0.0, 0.0, 0.0, detail="no feasible move",
                        reason="all moves infeasible")
        pre_pick[f.id] = pick
        bm = baseline_move(moves)
        baseline[f.id] = bm if bm is not None else pick

    # coupling repair (capacity) -> optimized assignment
    optimized = repair(pre_pick, moves_by_flight, cfg)

    optimized_total = sum(m.cost for m in optimized.values())
    baseline_total = sum(m.cost for m in baseline.values())
    cost_saved = baseline_total - optimized_total

    # flags. A flight is fuel-critical when it cannot outlast the closure on a
    # hold AND therefore had to abandon its destination (divert or connection) --
    # a cheaper hold existed in principle but was unreachable on remaining fuel.
    abandoned = ("divert", "connection")
    fuel_critical = [f.id for f in affected
                     if optimized[f.id].name in abandoned
                     and not moves_by_flight[f.id]["hold"].feasible]
    forced_divert = [f.id for f in affected
                     if optimized[f.id].name == "divert"
                     and not moves_by_flight[f.id]["reroute"].feasible
                     and not moves_by_flight[f.id]["hold"].feasible
                     and not moves_by_flight[f.id]["connection"].feasible]

    return {
        "closure": cfg.closure,
        "flights": flights,
        "affected": affected,
        "ignored": ignored,
        "moves_by_flight": moves_by_flight,
        "optimized": optimized,
        "baseline": baseline,
        "summary": {
            "optimized_total": optimized_total,
            "baseline_total": baseline_total,
            "cost_saved": cost_saved,
            "n_affected": len(affected),
            "n_ignored": len(ignored),
            "usage": usage(optimized),
            "caps": {"corridor": cfg.coupling.corridor_capacity,
                     "alternate_per_airport": cfg.coupling.alternate_capacity},
            "fuel_critical": fuel_critical,
            "forced_divert": forced_divert,
        },
    }


# --------------------------------------------------------------------------- #
# Pretty table                                                                 #
# --------------------------------------------------------------------------- #
def _fmt_usd(x: float) -> str:
    return "$%s" % format(int(round(x)), ",")


def render_table(results: Dict) -> str:
    c = results["closure"]
    s = results["summary"]
    lines: List[str] = []
    lines.append("=" * 92)
    lines.append("AIR-TRAFFIC REROUTE PRICE OPTIMIZER")
    lines.append("Closure: %s" % c.name)
    lines.append("  disk center (%.3f, %.3f)  radius %.0f nm   window %d-%d (epoch)"
                 % (c.center_lat, c.center_lon, c.radius_nm,
                    int(c.activate_epoch), int(c.clear_epoch)))
    lines.append("=" * 92)
    lines.append("Affected: %d   Ignored (in window, route not blocked): %d"
                 % (s["n_affected"], s["n_ignored"]))
    lines.append("")

    hdr = "%-9s %-5s %-9s %-11s %12s  %-26s" % (
        "FLIGHT", "TYPE", "ROUTE", "MOVE", "COST", "DETAIL")
    lines.append(hdr)
    lines.append("-" * 92)
    for f in sorted(results["affected"], key=lambda x: x.id):
        m = results["optimized"][f.id]
        route = "%s>%s" % (f.origin_icao or "??", f.dest_icao)
        lines.append("%-9s %-5s %-9s %-11s %12s  %-26s" % (
            f.id, f.ac_type, route, m.name, _fmt_usd(m.cost), m.detail))
        lines.append("            split: fuel %s | time %s | disruption %s"
                     % (_fmt_usd(m.fuel), _fmt_usd(m.time), _fmt_usd(m.disruption)))

    lines.append("-" * 92)
    lines.append("SYSTEM SUMMARY")
    lines.append("  Optimized total      : %s" % _fmt_usd(s["optimized_total"]))
    lines.append("  Uncoordinated baseline: %s  (everyone reroutes/diverts, no ground stops)"
                 % _fmt_usd(s["baseline_total"]))
    lines.append("  Cost saved           : %s" % _fmt_usd(s["cost_saved"]))
    u = s["usage"]
    lines.append("  Corridor reroutes    : %d / %d cap"
                 % (u["reroutes"], s["caps"]["corridor"]))
    lines.append("  Diverts per alternate: %s  (cap %d each)"
                 % (u["diverts_by_alt"] or "{}", s["caps"]["alternate_per_airport"]))
    if s["fuel_critical"]:
        lines.append("  FUEL-CRITICAL (hold infeasible): %s" % ", ".join(s["fuel_critical"]))
    if s["forced_divert"]:
        lines.append("  FORCED DIVERT (no reroute/hold): %s" % ", ".join(s["forced_divert"]))
    lines.append("=" * 92)
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# JSON                                                                         #
# --------------------------------------------------------------------------- #
def _move_json(m: Move) -> Dict:
    return {"move": m.name, "cost": round(m.cost, 2), "feasible": m.feasible,
            "fuel": round(m.fuel, 2), "time": round(m.time, 2),
            "disruption": round(m.disruption, 2), "detail": m.detail,
            "alternate": m.alternate, "reason": m.reason}


def to_json(results: Dict) -> Dict:
    c = results["closure"]
    out_flights = []
    for f in sorted(results["affected"], key=lambda x: x.id):
        moves = results["moves_by_flight"][f.id]
        out_flights.append({
            "id": f.id, "icao24": f.icao24, "type": f.ac_type,
            "origin": f.origin_icao, "dest": f.dest_icao,
            "pax": f.pax, "departed": f.departed,
            "straight_nm": round(f.straight_nm, 1),
            "remaining_nm": round(f.remaining_nm, 1),
            "fuel_remaining_gal": round(f.fuel_remaining_gal, 1),
            "reserve_gal": round(f.reserve_gal, 1),
            "dest_in_zone": f.dest_in_zone, "route_crosses": f.route_crosses,
            "flags": f.flags,
            "chosen": _move_json(results["optimized"][f.id]),
            "baseline": _move_json(results["baseline"][f.id]),
            "options": {name: _move_json(m) for name, m in moves.items()},
        })
    return {
        "closure": {"name": c.name, "center": [c.center_lat, c.center_lon],
                    "radius_nm": c.radius_nm,
                    "activate_epoch": c.activate_epoch, "clear_epoch": c.clear_epoch},
        "summary": {k: v for k, v in results["summary"].items()},
        "flights": out_flights,
        "ignored": [{"id": f.id, "origin": f.origin_icao, "dest": f.dest_icao,
                     "reason": "route not blocked by zone"}
                    for f in sorted(results["ignored"], key=lambda x: x.id)],
    }
