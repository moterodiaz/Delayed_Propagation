"""Coupling pass: flights share scarce resources (a reroute corridor, and a
finite number of divert slots per alternate). After the per-flight cheapest
pick, repair any capacity violation by bumping the LOWEST-REGRET flights (the
ones cheapest to switch to their next-best move) until within capacity.

Greedy and intentionally swappable.

TODO: replace this greedy repair with an exact ILP (OR-Tools CP-SAT) and/or a
Lagrangian congestion-pricing relaxation that prices each corridor / alternate
slot and lets flights re-optimize against the shadow prices. The interface
(repair(assignments, moves, cfg) -> assignments) stays the same.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from .config import Config
from .data_loader import Flight
from .pricing import Move, cheapest


@dataclass
class Assignment:
    flight_id: str
    move: Move


def _regret(moves: Dict[str, Move], current_name: str, forbid: set) -> float:
    """Cost increase to switch this flight off `current_name` to its next-best
    feasible move (infinity if there is no alternative)."""
    alt = cheapest(moves, forbid=forbid | {current_name})
    if alt is None:
        return float("inf")
    return alt.cost - moves[current_name].cost


def repair(assignments: Dict[str, Move],
           moves_by_flight: Dict[str, Dict[str, Move]],
           cfg: Config) -> Dict[str, Move]:
    """Mutates a copy of `assignments` to respect corridor + alternate caps."""
    assign = dict(assignments)
    corridor_cap = cfg.coupling.corridor_capacity
    alt_cap = cfg.coupling.alternate_capacity

    changed = True
    while changed:
        changed = False

        # --- reroute corridor capacity -----------------------------------
        rerouters = [fid for fid, m in assign.items() if m.name == "reroute"]
        if len(rerouters) > corridor_cap:
            # bump those cheapest to move away from reroute
            rerouters.sort(key=lambda fid: _regret(moves_by_flight[fid],
                                                   "reroute", set()))
            for fid in rerouters[:len(rerouters) - corridor_cap]:
                nxt = cheapest(moves_by_flight[fid], forbid={"reroute"})
                if nxt is not None:
                    assign[fid] = nxt
                    changed = True

        # --- per-alternate divert capacity --------------------------------
        by_alt: Dict[str, List[str]] = {}
        for fid, m in assign.items():
            if m.name == "divert" and m.alternate is not None:
                by_alt.setdefault(m.alternate, []).append(fid)
        for airport, fids in by_alt.items():
            if len(fids) > alt_cap:
                fids.sort(key=lambda fid: _regret(moves_by_flight[fid],
                                                  "divert", set()))
                for fid in fids[:len(fids) - alt_cap]:
                    nxt = cheapest(moves_by_flight[fid], forbid={"divert"})
                    if nxt is not None:
                        assign[fid] = nxt
                        changed = True

    return assign


def usage(assignments: Dict[str, Move]) -> Dict[str, object]:
    """Capacity-usage report fragment."""
    reroutes = sum(1 for m in assignments.values() if m.name == "reroute")
    diverts_by_alt: Dict[str, int] = {}
    for m in assignments.values():
        if m.name == "divert" and m.alternate is not None:
            diverts_by_alt[m.alternate] = diverts_by_alt.get(m.alternate, 0) + 1
    return {"reroutes": reroutes, "diverts_by_alt": diverts_by_alt}
