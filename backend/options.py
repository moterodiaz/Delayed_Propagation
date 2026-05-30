from backend.models import ActionOption
from backend.cost import HOLDING_USD_PER_HR, CREW_OVERNIGHT_USD, BURN_GAL_PER_NM, JET_A_USD_PER_GAL, DELAY_USD_PER_MIN

def build_options(window_hours, extra_nm, n_affected):
    fleet = max(1, n_affected)
    hold = HOLDING_USD_PER_HR * window_hours * fleet
    divert = (extra_nm * BURN_GAL_PER_NM * JET_A_USD_PER_GAL + CREW_OVERNIGHT_USD) * fleet
    preempt = (window_hours * 60.0) * DELAY_USD_PER_MIN * fleet * 0.5
    raw = [("hold", round(hold,2), "Hold affected flights airborne until the TFR lifts."),
           ("divert", round(divert,2), "Divert affected flights to an alternate around the zone."),
           ("preempt", round(preempt,2), "Delay departures on the ground to skip the closure window.")]
    cheapest = min(c for _,c,_ in raw)
    return [ActionOption(kind=k, cost_usd=c, cheapest=(c==cheapest), rationale=r) for k,c,r in raw]
