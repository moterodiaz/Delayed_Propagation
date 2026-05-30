"""Deterministic air-traffic reroute price-optimization core.

Pure arithmetic + optimization, NO machine learning. Given an airspace closure
(a launch-debris disk) and a set of flights, every affected flight picks the
cheapest legal move (ground_stop / reroute / hold / divert), then a coupling
pass repairs shared-resource (corridor / alternate) capacity violations.

Modules:
    config       constants, fleet model, airports, closure scenario (swappable)
    geometry     great-circle distance, disk crossing, tangent-arc detour
    data_loader  real OpenSky bundle -> Flight objects (with derive/default rules)
    pricing      the four priced moves + cheapest-feasible pick
    coupling     greedy capacity repair (TODO: ILP / Lagrangian)
    report       readable table + JSON emit
    cli          entry point
"""
