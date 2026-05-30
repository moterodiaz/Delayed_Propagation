"""Standalone data analysis — see exactly what we're working with.

Run:  python3 analyze_data.py

Three parts:
  1. RAW casualties.json     — what each flight actually has vs. what's missing
  2. RAW jbu1575_track.json  — the one flight with real positions (the hero)
  3. AFTER data_loader       — what the loader DERIVES/DEFAULTS to fill the gaps
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def utc(ep: float) -> str:
    return datetime.fromtimestamp(ep, tz=timezone.utc).strftime("%H:%M:%S")


def rule(c="-", n=78):
    print(c * n)


# --------------------------------------------------------------------------- #
# 1. RAW casualties.json                                                       #
# --------------------------------------------------------------------------- #
def analyze_casualties():
    with open(os.path.join(DATA, "casualties.json")) as fh:
        d = json.load(fh)

    rule("=")
    print("1. RAW  data/casualties.json")
    rule("=")
    print("event                 :", d["event"])
    print("window_utc            :", d["window_utc"])
    print("total_flights_in_window:", d["total_flights_in_window"])
    print("casualties listed     :", len(d["casualties"]))
    print("fields per flight     :", list(d["casualties"][0].keys()))
    print()

    cas = sorted(d["casualties"], key=lambda r: r["flight"])
    print("%-9s %-7s %-6s %-8s %-10s %-10s %-7s" %
          ("FLIGHT", "DEP", "ARR", "ICAO24", "FIRST(UTC)", "LAST(UTC)", "MINUTES"))
    rule()
    for r in cas:
        dur = (r["lastSeen"] - r["firstSeen"]) / 60.0
        print("%-9s %-7s %-6s %-8s %-10s %-10s %6.1f" % (
            r["flight"], r["dep"] or "—NULL—", r["arr"], r["icao24"],
            utc(r["firstSeen"]), utc(r["lastSeen"]), dur))

    # completeness / what's MISSING
    n = len(cas)
    have_dep = sum(1 for r in cas if r["dep"])
    print()
    print("FIELD COMPLETENESS (what we have vs. what the cost model needs):")
    rule()
    print("  flight id        : %2d/%d   ✓ exists" % (n, n))
    print("  destination (arr): %2d/%d   ✓ exists" % (n, n))
    print("  origin (dep)     : %2d/%d   ✗ %d are NULL  -> loader INFERS"
          % (have_dep, n, n - have_dep))
    for field in ("aircraft type", "position", "altitude", "speed",
                  "fuel", "passengers", "scheduled dep time"):
        print("  %-16s :  0/%d   ✗ absent      -> loader DEFAULTS/DERIVES"
              % (field, n))

    # carriers / airports
    carriers = {}
    for r in cas:
        carriers[r["flight"][:3]] = carriers.get(r["flight"][:3], 0) + 1
    print()
    print("carriers   :", dict(sorted(carriers.items())))
    print("origins seen:", sorted({r["dep"] for r in cas if r["dep"]}))
    print("dests seen  :", sorted({r["arr"] for r in cas}))
    print()


# --------------------------------------------------------------------------- #
# 2. RAW jbu1575_track.json                                                    #
# --------------------------------------------------------------------------- #
def analyze_track():
    with open(os.path.join(DATA, "jbu1575_track.json")) as fh:
        d = json.load(fh)
    wps = d["waypoints"]

    rule("=")
    print("2. RAW  data/jbu1575_track.json   (the ONLY flight with real positions)")
    rule("=")
    for k in ("flight", "also_known_as", "icao24", "scheduled", "actual",
              "source"):
        print("%-14s: %s" % (k, d[k]))
    print("%-14s: %d" % ("waypoints", len(wps)))
    print("%-14s: %s" % ("fields/wp", list(wps[0].keys())))
    print("%-14s: %s -> %s UTC" % ("time span", utc(d["start_time"]), utc(d["end_time"])))

    alts = [w["alt_m"] for w in wps]
    lats = [w["lat"] for w in wps]
    lons = [w["lon"] for w in wps]
    print("%-14s: %.0f .. %.0f m   (max ≈ FL%03d)"
          % ("altitude", min(alts), max(alts), max(alts) / 0.3048 / 100))
    print("%-14s: lat %.2f..%.2f   lon %.2f..%.2f"
          % ("bbox", min(lats), max(lats), min(lons), max(lons)))
    print()
    print("sample waypoints (first / middle / last):")
    rule()
    for label, w in (("first", wps[0]), ("mid", wps[len(wps)//2]), ("last", wps[-1])):
        print("  %-6s t=%s  (%.4f, %.4f)  alt %5dm  hdg %3d  ground=%s" % (
            label, utc(w["t"]), w["lat"], w["lon"], w["alt_m"],
            w["heading"], w["on_ground"]))
    print()


# --------------------------------------------------------------------------- #
# 3. AFTER data_loader — the gap-filled Flight objects                         #
# --------------------------------------------------------------------------- #
def analyze_loaded():
    from solver.config import default_config
    from solver.data_loader import load_flights

    cfg = default_config()
    flights = load_flights(cfg)

    rule("=")
    print("3. AFTER  solver/data_loader.py   (gaps filled, every guess flagged)")
    rule("=")
    print("%-9s %-5s %-5s %-6s %5s %5s %7s %5s  %-9s"
          % ("FLIGHT", "TYPE", "ORIG", "DEST", "STRn", "REMn", "FUELg", "PAX", "AFFECTED"))
    rule()
    for f in sorted(flights, key=lambda x: x.id):
        print("%-9s %-5s %-5s %-6s %5.0f %5.0f %7.0f %5d  %s"
              % (f.id, f.ac_type, f.origin_icao or "INF", f.dest_icao,
                 f.straight_nm, f.remaining_nm, f.fuel_remaining_gal, f.pax,
                 "YES" if f.affected else "no (ignored)"))
    print()
    print("legend: ORIG=INF -> origin was NULL, inferred as a Kingston-FIR transit")
    print("        STRn/REMn = straight & remaining great-circle nm; FUELg = est. gallons")
    print()
    print("per-flight provenance flags (what was derived vs. real):")
    rule()
    for f in sorted(flights, key=lambda x: x.id):
        print("  %-9s %s" % (f.id, " | ".join(f.flags)))
    print()
    aff = [f for f in flights if f.affected]
    print("=> %d affected (priced by solver), %d ignored (route not blocked)"
          % (len(aff), len(flights) - len(aff)))


if __name__ == "__main__":
    analyze_casualties()
    analyze_track()
    analyze_loaded()
