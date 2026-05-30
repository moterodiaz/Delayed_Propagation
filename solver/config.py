"""All tunables live here. Nothing downstream hardcodes a constant inline.

Three groups:
  - CostConfig / FleetConfig / CouplingConfig : the priced-move economics
  - AIRPORTS                                  : ICAO -> (lat, lon) reference table
  - Closure                                   : the swappable disruption scenario
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


# --------------------------------------------------------------------------- #
# Cost constants (spec defaults; fuel_price overridable via CLI --fuel)        #
# --------------------------------------------------------------------------- #
@dataclass
class CostConfig:
    fuel_price: float = 7.43      # $/gal
    ground_rate: float = 50.0     # $/min  (ground stop, no fuel burned)
    time_rate: float = 68.0       # $/min  (airborne time cost)
    disrupt_fixed: float = 12000.0   # $ fixed penalty per DIVERT (pax stranded)
    disrupt_pax: float = 120.0       # $ per passenger on a divert
    # connection = soft divert: land at a hub, rebook pax onward to the real
    # destination. Cheaper than a divert because passengers still arrive.
    rebooking_fixed: float = 4000.0  # $ fixed to rebook a planeload onward
    rebooking_pax: float = 45.0      # $ per pax for the onward leg (incl. delay)


# --------------------------------------------------------------------------- #
# Fleet model                                                                  #
# --------------------------------------------------------------------------- #
# burn = gallons per MINUTE at cruise, by ICAO type designator.
BURN_BY_TYPE: Dict[str, float] = {
    "B738": 11.5, "A320": 11.5, "A21N": 12.0,
    "B739": 13.0, "B752": 13.0, "B789": 17.0,
}
# Default passenger counts by type (used when no pax data exists).
PAX_BY_TYPE: Dict[str, int] = {
    "B738": 150, "A320": 150, "A21N": 180,
    "B739": 170, "B752": 180, "B789": 280,
}
WIDEBODY_TYPES = {"B789"}

# Type defaulting by great-circle route length (no type field in the data).
NARROWBODY_DEFAULT = "A320"
WIDEBODY_DEFAULT = "B789"
WIDEBODY_ROUTE_NM = 3000.0   # routes longer than this default to a widebody


@dataclass
class FleetConfig:
    cruise_speed_kt: float = 450.0   # default TAS (narrowbody)
    cruise_alt_ft: float = 37000.0   # default FL370
    reserve_hold_min: float = 45.0   # 45 min of holding fuel held in reserve
    fuel_buffer_frac: float = 0.05   # +5% planning buffer on remaining-trip fuel


# --------------------------------------------------------------------------- #
# Coupling (shared-resource) caps                                             #
# --------------------------------------------------------------------------- #
# Defaults are deliberately GENEROUS so they do not bind on the 15-flight
# bundle (keeps cost_saved >= 0 and the default run clean). Tighten via CLI to
# watch the greedy repair bump low-regret flights.
@dataclass
class CouplingConfig:
    corridor_capacity: int = 20                # max total reroutes
    alternate_capacity: int = 10               # max diverts PER alternate airport


# --------------------------------------------------------------------------- #
# Airport reference table (decimal degrees). The bundle ships no airports      #
# file, so these are filled from the context docs + standard references.       #
# --------------------------------------------------------------------------- #
AIRPORTS: Dict[str, Tuple[float, float]] = {
    "KFLL": (26.0742, -80.1506),   # Fort Lauderdale-Hollywood Intl
    "KMIA": (25.7959, -80.2870),   # Miami Intl
    "MKJP": (17.9357, -76.7875),   # Kingston Norman Manley Intl (scheduled hero dest)
    "KATL": (33.6367, -84.4281),   # Atlanta Hartsfield
    "KRDU": (35.8776, -78.7875),   # Raleigh-Durham
    "KTPA": (27.9755, -82.5332),   # Tampa Intl
    "MMUN": (21.0365, -86.8771),   # Cancun Intl
    "TJSJ": (18.4394, -66.0018),   # San Juan Luis Munoz Marin
    "MWCR": (19.2928, -81.3577),   # Owen Roberts Intl (Cayman)
}

# Connecting hubs: airports assumed to have onward service to any destination,
# used by the `connection` (passenger-rebooking) move. ASSUMPTION -- the bundle
# ships no schedule/network data, so this is a configured list, not derived.
CONNECTION_HUBS: List[str] = ["KMIA", "KATL", "KFLL"]


# --------------------------------------------------------------------------- #
# Closure scenario (provided separately from the data bundle, as a config      #
# object so scenarios can be swapped). Default = a DISK fit to the May-22       #
# Kingston-FIR TFR box from AIRSPACE_MAP_PLAN.md (lat 17.0-23.5N, lon           #
# -80.5..-72.0W). Center = box center; radius ~250 nm covers Kingston (MKJP)    #
# and is crossed by the KFLL->MKJP hero route. The original polygon is kept     #
# for reference / future polygon-detour swap.                                   #
# --------------------------------------------------------------------------- #
@dataclass
class Closure:
    name: str
    center_lat: float
    center_lon: float
    radius_nm: float
    activate_epoch: float        # closure activates (UTC epoch seconds)
    clear_epoch: float           # closure clears  (fixed given)
    polygon: Optional[List[Tuple[float, float]]] = None  # [(lat, lon), ...]


# May 22 2026, Kingston FIR closure for SpaceX Starship Flight 12.
# 21:30Z = 1779485400 ; clears 23:43Z = +2h13m = +7980s = 1779493380.
KINGSTON_FIR_CLOSURE = Closure(
    name="SpaceX Starship 12 TFR - Kingston FIR",
    center_lat=20.25,
    center_lon=-76.25,
    radius_nm=250.0,
    activate_epoch=1779485400.0,
    clear_epoch=1779493380.0,
    polygon=[(23.5, -80.5), (23.5, -72.0), (17.0, -72.0), (17.0, -80.5)],
)


# --------------------------------------------------------------------------- #
# Inference knobs for the position-less / origin-less casualties.             #
# --------------------------------------------------------------------------- #
@dataclass
class InferenceConfig:
    # null-dep casualties are modeled as Kingston-FIR transits: origin inferred
    # on the far side of the disk from the destination, this many nm outside
    # the disk edge (so the straight route crosses the zone).
    null_origin_margin_nm: float = 50.0
    # cap on how far along its route a synthesized flight is placed.
    max_progress_frac: float = 0.95


@dataclass
class Config:
    cost: CostConfig = field(default_factory=CostConfig)
    fleet: FleetConfig = field(default_factory=FleetConfig)
    coupling: CouplingConfig = field(default_factory=CouplingConfig)
    inference: InferenceConfig = field(default_factory=InferenceConfig)
    closure: Closure = field(default_factory=lambda: KINGSTON_FIR_CLOSURE)
    airports: Dict[str, Tuple[float, float]] = field(default_factory=lambda: dict(AIRPORTS))


def default_config() -> Config:
    return Config()
