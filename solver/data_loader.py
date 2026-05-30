"""Load the real OpenSky bundle into Flight objects, applying the derive /
default rules agreed in STEP 1.

Rules (every one is flagged on the Flight so the report stays honest):
  - id, icao24             : EXIST  (casualties.json)
  - aircraft type          : DEFAULT by route length (no type in data)
  - dest                   : DERIVED from arr ICAO; for the hero JBU1575 the
                             dest is OVERRIDDEN to MKJP (its scheduled, blocked
                             destination -- arr=KFLL only records the return).
  - origin                 : DERIVED from dep ICAO when present; for null-dep
                             casualties the origin is INFERRED south of the disk
                             (modeled as a Kingston-FIR transit).
  - current position       : REAL for JBU1575 (track turn point); SYNTHESIZED
                             for the rest (great-circle progress at closure time).
  - departed               : DERIVED true for all (they all have live ADS-B).
  - sched departure        : PROXY = firstSeen.
  - cruise alt / speed      : DEFAULT (FL370 / 450 kt); hero alt from track.
  - fuel remaining         : ESTIMATED = remaining-trip fuel + reserve + buffer.
  - passengers             : DEFAULT by type.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from . import geometry as geo
from .config import (BURN_BY_TYPE, NARROWBODY_DEFAULT, PAX_BY_TYPE,
                     WIDEBODY_DEFAULT, WIDEBODY_ROUTE_NM, WIDEBODY_TYPES, Config)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


@dataclass
class Flight:
    id: str
    icao24: str
    ac_type: str
    origin_icao: Optional[str]
    origin: Tuple[float, float]          # (lat, lon)
    dest_icao: str
    dest: Tuple[float, float]
    current: Tuple[float, float]
    departed: bool
    sched_dep_epoch: float
    cruise_alt_ft: float
    cruise_speed_kt: float
    burn_gal_min: float
    pax: int
    fuel_remaining_gal: float
    reserve_gal: float
    # geometry (filled after closure is known)
    straight_nm: float = 0.0
    remaining_nm: float = 0.0
    affected: bool = False
    dest_in_zone: bool = False
    route_crosses: bool = False
    # provenance flags
    flags: List[str] = field(default_factory=list)

    @property
    def gs_nm_min(self) -> float:
        return self.cruise_speed_kt / 60.0

    @property
    def gal_per_nm(self) -> float:
        return self.burn_gal_min / self.gs_nm_min


def _default_type(route_nm: float) -> str:
    return WIDEBODY_DEFAULT if route_nm > WIDEBODY_ROUTE_NM else NARROWBODY_DEFAULT


def _infer_null_origin(dest: Tuple[float, float], cfg: Config) -> Tuple[float, float]:
    """Place an inferred origin on the FAR side of the disk from the dest, just
    outside the disk edge, so the straight route crosses the closure."""
    c = cfg.closure
    bearing_center_to_dest = geo.initial_bearing(c.center_lat, c.center_lon,
                                                 dest[0], dest[1])
    away = (bearing_center_to_dest + 180.0) % 360.0
    dist = c.radius_nm + cfg.inference.null_origin_margin_nm
    return geo.destination_point(c.center_lat, c.center_lon, away, dist)


def _synthesize_current(origin: Tuple[float, float], dest: Tuple[float, float],
                        first_seen: float, speed_kt: float, cfg: Config
                        ) -> Tuple[float, float]:
    """Place the flight along its origin->dest great circle at the fraction of
    the trip it would have completed by closure-activation time."""
    straight = geo.haversine_nm(origin[0], origin[1], dest[0], dest[1])
    if straight <= 0:
        return origin
    enroute_s = straight / speed_kt * 3600.0
    elapsed = cfg.closure.activate_epoch - first_seen
    frac = max(0.0, min(cfg.inference.max_progress_frac, elapsed / enroute_s))
    brg = geo.initial_bearing(origin[0], origin[1], dest[0], dest[1])
    return geo.destination_point(origin[0], origin[1], brg, frac * straight)


def _hero_current(track: dict) -> Tuple[float, float]:
    """JBU1575 decision point = first cached waypoint (where it faced the zone)."""
    wp = track["waypoints"][0]
    return (wp["lat"], wp["lon"])


def _hero_cruise_alt_ft(track: dict) -> float:
    max_alt_m = max(w["alt_m"] for w in track["waypoints"])
    return round(max_alt_m / 0.3048, 0)  # meters -> feet


def load_flights(cfg: Config,
                 casualties_path: Optional[str] = None,
                 track_path: Optional[str] = None) -> List[Flight]:
    casualties_path = casualties_path or os.path.join(DATA_DIR, "casualties.json")
    track_path = track_path or os.path.join(DATA_DIR, "jbu1575_track.json")

    with open(casualties_path) as fh:
        cas = json.load(fh)
    with open(track_path) as fh:
        track = json.load(fh)
    hero_id = track["flight"]

    flights: List[Flight] = []
    for rec in sorted(cas["casualties"], key=lambda r: r["flight"]):  # deterministic
        fid = rec["flight"]
        is_hero = (fid == hero_id)
        flags: List[str] = []

        # --- destination -----------------------------------------------------
        if is_hero:
            dest_icao = "MKJP"
            flags.append("dest_overridden=MKJP(scheduled)")
        else:
            dest_icao = rec["arr"]
        dest = cfg.airports[dest_icao]

        # --- origin ----------------------------------------------------------
        dep = rec.get("dep")
        if dep and dep in cfg.airports:
            origin_icao = dep
            origin = cfg.airports[dep]
        else:
            origin_icao = None
            origin = _infer_null_origin(dest, cfg)
            flags.append("origin_inferred(Kingston-FIR transit)")

        # --- aircraft type / fleet defaults ----------------------------------
        route_nm = geo.haversine_nm(origin[0], origin[1], dest[0], dest[1])
        ac_type = _default_type(route_nm)
        flags.append("type_default=%s" % ac_type)
        burn = BURN_BY_TYPE[ac_type]
        pax = PAX_BY_TYPE[ac_type]
        speed = cfg.fleet.cruise_speed_kt

        # --- current position ------------------------------------------------
        if is_hero:
            current = _hero_current(track)
            cruise_alt = _hero_cruise_alt_ft(track)
            flags.append("position_real(ADS-B)")
        else:
            current = _synthesize_current(origin, dest, rec["firstSeen"], speed, cfg)
            cruise_alt = cfg.fleet.cruise_alt_ft
            flags.append("position_synthesized")

        # --- fuel estimate ---------------------------------------------------
        remaining_nm = geo.haversine_nm(current[0], current[1], dest[0], dest[1])
        gs = speed / 60.0
        gal_per_nm = burn / gs
        trip_fuel = remaining_nm * gal_per_nm
        reserve = cfg.fleet.reserve_hold_min * burn
        buffer = cfg.fleet.fuel_buffer_frac * trip_fuel
        fuel_remaining = trip_fuel + reserve + buffer

        flights.append(Flight(
            id=fid, icao24=rec["icao24"], ac_type=ac_type,
            origin_icao=origin_icao, origin=origin,
            dest_icao=dest_icao, dest=dest, current=current,
            departed=True, sched_dep_epoch=float(rec["firstSeen"]),
            cruise_alt_ft=cruise_alt, cruise_speed_kt=speed,
            burn_gal_min=burn, pax=pax,
            fuel_remaining_gal=fuel_remaining, reserve_gal=reserve,
            straight_nm=geo.haversine_nm(origin[0], origin[1], dest[0], dest[1]),
            remaining_nm=remaining_nm,
            flags=flags,
        ))

    _mark_affected(flights, cfg)
    return flights


def _mark_affected(flights: List[Flight], cfg: Config) -> None:
    c = cfg.closure
    for f in flights:
        f.dest_in_zone = geo.point_in_disk(f.dest[0], f.dest[1],
                                           c.center_lat, c.center_lon, c.radius_nm)
        f.route_crosses = geo.segment_crosses_disk(
            f.origin[0], f.origin[1], f.dest[0], f.dest[1],
            c.center_lat, c.center_lon, c.radius_nm)
        f.affected = f.dest_in_zone or f.route_crosses
