# Delayed Propagation — The Pitch

**One line:** When a rocket closes the sky, a weather dashboard shows all green. We show the dollar wall — and what to do about it.

## The scenario (real event, replayed)

On **2026-05-22**, SpaceX Starship Flight 12 launched from Boca Chica. The FAA and the Jamaica Civil Aviation Authority closed part of the **Kingston FIR** from **21:30–23:43Z**. Weather at KFLL / KMIA / MKJP was **clear VFR** — every weather tool showed green. But the space NOTAM was a wall.

Real ADS-B (OpenSky) shows JetBlue **JBU1575**, KFLL→Kingston, flying toward the closure, **U-turning over the Bahamas (~23.8°N)**, and returning to Fort Lauderdale. Behind it, ~42 flights to/from Miami and Fort Lauderdale were grounded or put in holding loops — they got the warning and realized they could no longer take off.

**The hook (the paradox):** clear skies, still grounded.

## What happened, in sequence

| Time (EDT) | Event |
|---|---|
| 17:15 | FAA warns: Caribbean corridor closing — ~42 routes face +140 nm reroutes |
| 17:30 | **NOTAM A0183/26** — launch TFR, surface-to-space closure over the Gulf + Kingston FIR |
| 18:30 | Starship launches; Super Heavy booster hard splashdown → debris freeze +45 min |
| 19:15 | **NOTAM B0975/26** — reentry risk corridor, Kingston inbound strictly blocked (the severe beat) |
| 19:45 | Jet fuel spot +6.6% at MIA/FLL from the wave of diversions |

The closure ran the whole window (21:30–23:43Z) — not a single moment. B0975/26 is the *reentry phase*, the most severe block.

## What it cost (~$351,000)

Every line is a **published rate** — nothing invented:

| Line item | Rate / source |
|---|---|
| Aircraft block time (delay) | $100.76/block-min — Airlines for America (A4A) 2024 |
| Passenger value of time | $0.78/min/pax ($47/hr) — FAA/DOT, × ~150 seats |
| Passenger reaccommodation | ~$150/pax (vouchers + rebooking) — Hawaiian A330 turnback precedent |
| Diversion / turnback penalty | $25k–$200k+ range; A320 turnback ~$92.5k — EUROCONTROL / The Points Guy |
| Crew overnight | hotel + per-diem when crew times out |

JBU1575 alone ≈ **$125k** (wasted block time + the turnback). Fuel is already inside the A4A block-minute rate, so it is **not** double-counted.

## The 3 priced actions (counterfactual)

- **Hold** airborne until the TFR lifts — full block cost + passenger time.
- **Divert** every affected flight to an alternate — diversion penalty + reaccommodation.
- **Pre-empt** — ground-hold departures to skip the window. **Cheapest.** No fuel burn, no diversion.

The product doesn't just detect the conflict — it tells the ops manager the right move and what it's worth.

## The wider board (coordination gap)

Acting alone (selfish-optimal) costs the full figure. If carriers coordinated slot usage, total network cost drops to ~75% — the **~$88k gap** is value left on the table when everyone optimizes independently. You only move your own flights, but the board shows the whole picture. (Reference computation, not a real multi-carrier solver — that's v2.)

## What's real vs. modeled

- **Real:** JBU1575's 229-waypoint ADS-B track + U-turn; the 15 casualty callsigns and their in-window times; the Kingston FIR boundary; clear-VFR METARs; live OpenSky traffic in Live mode; all cost rates.
- **Modeled / labeled:** the debris hazard corridor (drawn estimate bridging the FIR to the turnpoint), the apron-padding flights for density, and the 0.75 coordination factor.

## The two modes

- **Simulation** — replay the event on the real window (21:30–23:43Z): JBU1575 flies and U-turns, stationed flights flip to GROUNDED when the TFR activates, and the cost accrues to ~$351k as the timeline plays.
- **Live** — real-time OpenSky traffic over the Florida–Caribbean box, with a live NOTAM/intelligence feed.

## Why it lands

Clear-weather paradox + a sourced dollar figure + the coordination gap. Three things on one screen that turn a map into a business case.
