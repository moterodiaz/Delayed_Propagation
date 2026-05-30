import math
from backend.models import Flight, CostBreakdown

JET_A_USD_PER_GAL = 3.75
BURN_GAL_PER_NM = 12.0
HOLDING_USD_PER_HR = 3500.0
CREW_OVERNIGHT_USD = 1800.0
DELAY_USD_PER_MIN = 100.0
_EARTH_NM = 3440.065

def great_circle_nm(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1); dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dlmb/2)**2
    return _EARTH_NM * 2 * math.asin(math.sqrt(a))

def track_length_nm(flight):
    total = 0.0; wps = flight.track
    for i in range(len(wps)-1):
        total += great_circle_nm(wps[i].lat, wps[i].lon, wps[i+1].lat, wps[i+1].lon)
    return total

def flight_cost(flight, dest_lat, dest_lon):
    if flight.track:
        flown = track_length_nm(flight)
        o = flight.track[0]
        direct = great_circle_nm(o.lat, o.lon, dest_lat, dest_lon)
        extra_nm = max(0.0, flown - direct)
        fuel = extra_nm * BURN_GAL_PER_NM * JET_A_USD_PER_GAL
        delay_min = (extra_nm / 450.0) * 60.0
        detail = f"{extra_nm:.0f} extra nm, {delay_min:.0f} min delay"
    else:
        exposure_s = (flight.last_seen - flight.first_seen) if (flight.last_seen and flight.first_seen) else 0
        delay_min = max(0.0, exposure_s / 60.0); extra_nm = 0.0; fuel = 0.0
        detail = f"{delay_min:.0f} min in closed airspace"
    delay = delay_min * DELAY_USD_PER_MIN
    crew = CREW_OVERNIGHT_USD if delay_min > 180 else 0.0
    total = fuel + delay + crew
    return CostBreakdown(total_usd=round(total,2), delay_usd=round(delay,2),
                         fuel_usd=round(fuel,2), crew_usd=round(crew,2), detail=detail)

def event_cost(flights, dest_lat, dest_lon):
    aff = [f for f in flights if f.affected]
    parts = [flight_cost(f, dest_lat, dest_lon) for f in aff]
    return CostBreakdown(
        total_usd=round(sum(p.total_usd for p in parts),2),
        delay_usd=round(sum(p.delay_usd for p in parts),2),
        fuel_usd=round(sum(p.fuel_usd for p in parts),2),
        crew_usd=round(sum(p.crew_usd for p in parts),2),
        detail=f"{len(aff)} affected flights")
