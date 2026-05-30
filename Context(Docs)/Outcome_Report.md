# Outcome Report — SpaceX Starship Flight 12 / Kingston FIR Closure

**Event:** FAA TFR closed part of the Kingston FIR (MKJK) for Starship Flight 12 reentry.
**Window (UTC):** 2026-05-22 21:30 → 23:43 (2h 13m, 2.22 hr).
**Weather:** clear VFR at KFLL / KMIA / MKJP — pure airspace closure, no accident.
**Source:** FAA TFR / NASA DIP replay; flight tracks from OpenSky ADS-B.

> "Casualties" in `data/casualties.json` = flights caught in the closure, **not** deaths. Nobody was hurt.

---

## What happened to the people

The hero flight **JBU1575** (JetBlue, A320, ~150 pax) was inbound toward Kingston. When the TFR
went active it **U-turned over the Bahamas and returned to Fort Lauderdale (KFLL)**. Passengers
never reached their destination — they landed back at origin and had to be reaccommodated
(rebooked + meal/care vouchers). 14 other flights in the window absorbed delay and missed-connection
cost without diverting.

---

## Time lost

| Scope | Disruption time |
|---|---|
| JBU1575 (hero, turnback) | **38.5 min** wasted block time, 205 nm flown for zero net progress |
| All 15 affected flights | **806 min total ≈ 13.4 flight-hours** lost |

Casualty-flight delay range: 11 min (JBU238) → 96 min (JBU575 / DAL1295).

---

## Cost of the disruption (modeled, defensible rates)

Rates sourced from A4A 2024 ($100.76/block-min), FAA/DOT pax time ($0.78/min/pax), EUROCONTROL /
TPG diversion ($92.5k A320 turnback), $150/pax reaccommodation. See `Context(Docs)/Cost_Model.md`.

### JBU1575 (hero) — $125,191

| Line item | USD |
|---|---|
| Aircraft block time (38.5 min delay) | 3,882.62 |
| Passenger value of time (150 pax) | 4,508.40 |
| Passenger reaccommodation (full, turnback) | 22,500.00 |
| Diversion / turnback penalty | 92,500.00 |
| Crew overnight | 1,800.00 |
| **Total** | **125,191.02** |

### Whole event — $339,532

- 15 affected flights, 806 disruption-minutes.
- **Total modeled disruption cost: $339,531.90**
- If carriers coordinated slot usage → ~75% = **$254,648.92**
- **Network coordination gap (value left on the table): $84,882.97**

---

## What should have been done about JBU1575

Priced action options for the hero flight (per-flight, window = 2.22 hr):

| Option | Cost (1 flight) | Cost (whole 15-flight fleet) |
|---|---|---|
| **Pre-empt** (ground-hold departure, skip window) ✅ cheapest | **$19,581** | $293,720 |
| Hold (airborne until TFR lifts) | $28,962 | $434,431 |
| Divert (turnback / alternate) | $115,000 | $1,725,000 |

**Recommendation:** pre-empt. Holding on the ground beats burning fuel airborne, and both crush the
$115k turnback that actually happened. The turnback was the worst-case outcome the optimizer exists
to avoid.

---

*Generated from `data/casualties.json`, `data/jbu1575_track.json`, `data/tfr.json` via the deterministic
cost engine (`lib/airspace/cost.ts`, `lib/airspace/options.ts`). Numbers reproduce exactly.*
