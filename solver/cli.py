"""CLI entry point.

    python -m solver.cli                 # run on the real bundle, print table
    python -m solver.cli --json out.json # also emit machine-readable results
    python -m solver.cli --fuel 3.25     # override fuel price ($/gal)
    python -m solver.cli --corridor 4    # tighten the reroute corridor cap
"""
from __future__ import annotations

import argparse
import json
import sys

from .config import default_config
from .report import render_table, solve, to_json


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Deterministic reroute price optimizer")
    p.add_argument("--fuel", type=float, help="fuel price $/gal (overrides default 2.50)")
    p.add_argument("--corridor", type=int, help="reroute corridor capacity")
    p.add_argument("--alternate", type=int, help="divert capacity per alternate airport")
    p.add_argument("--casualties", help="path to casualties.json")
    p.add_argument("--track", help="path to hero track json")
    p.add_argument("--json", dest="json_out", help="write full results JSON to this path")
    args = p.parse_args(argv)

    cfg = default_config()
    if args.fuel is not None:
        cfg.cost.fuel_price = args.fuel
    if args.corridor is not None:
        cfg.coupling.corridor_capacity = args.corridor
    if args.alternate is not None:
        cfg.coupling.alternate_capacity = args.alternate

    results = solve(cfg, casualties_path=args.casualties, track_path=args.track)
    print(render_table(results))

    if args.json_out:
        with open(args.json_out, "w") as fh:
            json.dump(to_json(results), fh, indent=2)
        print("\nJSON written to %s" % args.json_out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
