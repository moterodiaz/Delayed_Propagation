"""Spherical geometry for closure detection and tangent-arc detours.

Distances in nautical miles, angles in degrees. Great-circle (haversine) is
used for distances; the disk-crossing test and the tangent-arc detour use a
local equirectangular projection around the disk center -- accurate for the
sub-600 nm ranges here, but a flat approximation (flagged as such).
"""
from __future__ import annotations

import math
from typing import Tuple

R_NM = 3440.065  # Earth radius in nautical miles


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in nm."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R_NM * math.asin(min(1.0, math.sqrt(a)))


def initial_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing degrees (0..360) from point 1 to point 2."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def destination_point(lat: float, lon: float, bearing_deg: float, dist_nm: float
                      ) -> Tuple[float, float]:
    """Forward geodesic: point reached going dist_nm along bearing from (lat, lon)."""
    d = dist_nm / R_NM
    th = math.radians(bearing_deg)
    p1 = math.radians(lat)
    l1 = math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(th))
    l2 = l1 + math.atan2(math.sin(th) * math.sin(d) * math.cos(p1),
                         math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), (math.degrees(l2) + 540.0) % 360.0 - 180.0


# --- local projection around the disk center (nm plane) --------------------- #
def _project(lat: float, lon: float, lat0: float, lon0: float) -> Tuple[float, float]:
    x = (lon - lon0) * math.cos(math.radians(lat0)) * 60.0
    y = (lat - lat0) * 60.0
    return x, y


def _point_seg_dist(px: float, py: float, ax: float, ay: float,
                    bx: float, by: float) -> float:
    """Min distance from point P to segment AB in the nm plane."""
    abx, aby = bx - ax, by - ay
    denom = abx * abx + aby * aby
    if denom == 0.0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * abx + (py - ay) * aby) / denom
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * abx, ay + t * aby
    return math.hypot(px - cx, py - cy)


def point_in_disk(lat: float, lon: float, center_lat: float, center_lon: float,
                  radius_nm: float) -> bool:
    return haversine_nm(lat, lon, center_lat, center_lon) <= radius_nm


def segment_crosses_disk(lat1: float, lon1: float, lat2: float, lon2: float,
                         center_lat: float, center_lon: float, radius_nm: float
                         ) -> bool:
    """True if the straight route between the two points enters the disk
    (includes the case where either endpoint is inside)."""
    ax, ay = _project(lat1, lon1, center_lat, center_lon)
    bx, by = _project(lat2, lon2, center_lat, center_lon)
    return _point_seg_dist(0.0, 0.0, ax, ay, bx, by) <= radius_nm


def around_distance_disk(lat1: float, lon1: float, lat2: float, lon2: float,
                         center_lat: float, center_lon: float, radius_nm: float
                         ) -> float:
    """Shortest path from point 1 to point 2 that avoids a disk obstacle:
    tangent -> arc -> tangent. Returns the straight great-circle distance when
    the route does not cross the disk.

    Raises ValueError if an endpoint lies INSIDE the disk (you cannot route
    around to a point that is itself blocked -- caller must handle, e.g. divert).
    """
    straight = haversine_nm(lat1, lon1, lat2, lon2)
    if not segment_crosses_disk(lat1, lon1, lat2, lon2,
                                center_lat, center_lon, radius_nm):
        return straight

    dA = haversine_nm(lat1, lon1, center_lat, center_lon)
    dB = haversine_nm(lat2, lon2, center_lat, center_lon)
    if dA <= radius_nm or dB <= radius_nm:
        raise ValueError("endpoint inside disk -- cannot reroute around it")

    # tangent lengths (right triangle: hypotenuse d, one leg r)
    tan_a = math.sqrt(dA * dA - radius_nm * radius_nm)
    tan_b = math.sqrt(dB * dB - radius_nm * radius_nm)

    # angle subtended at center between CA and CB
    bA = initial_bearing(center_lat, center_lon, lat1, lon1)
    bB = initial_bearing(center_lat, center_lon, lat2, lon2)
    theta = math.radians(abs((bA - bB + 180.0) % 360.0 - 180.0))

    # arc swept between the two tangent contact points
    alpha_a = math.acos(max(-1.0, min(1.0, radius_nm / dA)))
    alpha_b = math.acos(max(-1.0, min(1.0, radius_nm / dB)))
    arc_angle = max(0.0, theta - alpha_a - alpha_b)
    arc_len = radius_nm * arc_angle

    return tan_a + tan_b + arc_len
