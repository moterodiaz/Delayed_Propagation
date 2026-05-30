# Cost Model — Methodology & Sources

> The dollar figure is the pitch (SRS R5). This documents every rate behind it, with published sources, so the number survives scrutiny on stage. Implemented in `lib/airspace/cost.ts`; the live rates + sources are also served at `GET /api/state → costModel[]`.

## Framing

We are pitching a **cost optimizer**. The larger the *defensible* disruption cost, the larger the value of optimizing it. So we model the **full** cost of the SpaceX Flight 12 / Kingston-FIR closure — airline operating cost **plus** passenger value of time **plus** reaccommodation **plus** diversion — using published per-unit rates. Nothing is invented; every line cites a source.

## Per-flight cost = sum of line items

| Line item | Formula | Rate | Source |
|---|---|---|---|
| Aircraft block time (delay) | `disruptionMin × $100.76` | $100.76 / block-min (all-in: labor $35.23 + fuel $33.06 + maint/ownership/other) | [A4A — U.S. Passenger Carrier Delay Costs, 2024](https://www.airlines.org/dataset/u-s-passenger-carrier-delay-costs/) |
| Passenger value of time | `disruptionMin × $0.78 × 150 pax` | $47/hr ≈ $0.78/min/pax; 150 seats (A320/A321) | [FAA/DOT value of passenger time](https://www.faa.gov/regulations_policies/policy_guidance/benefit_cost) |
| Passenger reaccommodation | diverted: `150 × $150`; delayed: `150 × 15% × $150` | ~$150/pax (vouchers + rebooking) | [The Points Guy — cost of a diversion](https://thepointsguy.com/airline/how-much-cost-plane-diverts/) (Hawaiian A330 turnback: ~$47k vouchers / 300 pax ≈ $157/pax) |
| Diversion / turnback penalty | `$92,500` if the flight never reaches its destination | $25k (regional) – $200k+ (widebody); A320 turnback ≈ $92.5k midpoint | [EUROCONTROL Standard Inputs — Cost of Diversion](https://ansperformance.eu/economics/cba/standard-inputs/latest/chapters/cost_of_diversion.html); [The Points Guy](https://thepointsguy.com/airline/how-much-cost-plane-diverts/) |
| Crew overnight | `$1,800` if disrupted > 3 h or diverted | hotel + per-diem when crew times out | industry crew duty-limit cost |

**Disruption minutes:**
- Hero (JBU1575, full ADS-B track): whole wasted block time = `(lastWaypoint.t − firstWaypoint.t)/60`. It returned to origin, so the entire flight was wasted → counts as a turnback/diversion.
- Casualties (15 flights, no track coords): time exposed inside the closure window = `(lastSeen − firstSeen)/60`. Real OpenSky `firstSeen/lastSeen`.

## Why no separate fuel line

A teammate's `Chatbot.md` itemized fuel as `373 nm × 1.8 gal/nm × $3.50 = $2,350`. The **373 nm wasted is real** (PROJECT_CONTEXT.md §4: 168.5 nm out + 204.9 nm back, real ADS-B) and we keep it as narrative in the cost `detail` string. But **fuel is already inside the A4A $100.76/block-min rate** ($33.06/min of it is fuel). Itemizing fuel separately would **double-count**. So `cost.ts` does NOT add a fuel line; the wasted distance is shown as context, not summed.

> Note: the earlier reference backend used `BURN_GAL_PER_NM = 12.0`, flagged as a unit error (a narrowbody is ~0.8–1.5 gal/nm cruise). The current model does not use a per-nm burn rate at all, so that error is retired.

## Network coordination gap (R7)

`coordinated = selfish × 0.75` → `gap = selfish × 0.25`. The 0.75 factor is a **declared reference assumption** (shared-slot efficiency), not a published rate or a real multi-carrier solver. Labeled as such per SDD §6. A genuine traffic-flow solver is a v2 item.

## Current computed figures (deterministic)

| Quantity | Value |
|---|---|
| Affected flights | 16 (JBU1575 + 15 casualties) |
| **Total event cost** | **~$351,302** |
| — Aircraft block time | ~$85,082 |
| — Passenger value of time | ~$98,795 |
| — Passenger reaccommodation | ~$73,125 |
| — Diversion / turnback (hero) | $92,500 |
| — Crew overnight | $1,800 |
| Action options | preempt ~$313k (cheapest) · hold ~$463k · divert ~$1.84M |
| Network: alone vs coordinated | ~$351k vs ~$263k → **gap ~$88k** |

Reproduces byte-identically across runs (R9). Re-run `GET /api/state` to verify.
