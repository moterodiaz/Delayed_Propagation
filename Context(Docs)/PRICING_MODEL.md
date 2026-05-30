# Pricing Model — Reference Doc

The deterministic cost engine behind the reroute optimizer. Pure arithmetic, no
ML. Given an airspace closure and a set of flights, it prices five legal moves
per affected flight and picks the cheapest feasible one.

Code: `solver/pricing.py` (moves), `solver/coupling.py` (capacity), `solver/report.py` (totals).

---

## 1. Inputs the model consumes

**Per-flight (from `data_loader`):**

| Symbol | Field | Meaning | Source |
|---|---|---|---|
| `v` | `cruise_speed_kt` | cruise speed (kt) | default 450 |
| `burn` | `burn_gal_min` | fuel burn (gal/min) | by aircraft type |
| `pax` | `pax` | passengers | by type (150) |
| `F_rem` | `fuel_remaining_gal` | estimated fuel on board | derived |
| `F_res` | `reserve_gal` | untouchable reserve = 45 min × burn | derived |
| `straight_nm` | — | great-circle origin → dest | computed |
| `remaining_nm` | — | great-circle current → dest | computed |

**Closure scenario `Z` (config, swappable):** disk center, radius `R`, window `[t_act, t_clear]`.

**Cost constants `Θ` (config):** see §6.

---

## 2. Derived rates (per flight)

```
gs         = v / 60                 ground speed in nm per minute
gal_per_nm = burn / gs             fuel burned per nautical mile
```

These two convert any distance into time-cost and fuel-cost.

---

## 3. The five moves

Each move returns: **feasible?**, **cost**, and the split **fuel / time / disruption**.
Let `T = (t_clear − t_act) / 60` = minutes the closure is active.

### ground_stop — wait on the ground
```
cost = T × ground_rate
feasible  ⟺  NOT departed
split: fuel 0 | time = cost | disruption 0
```
*(All bundle flights are airborne → never feasible here.)*

### reroute — fly around the zone
```
extra_nm = max(0, around_distance − straight_nm)
cost     = extra_nm × gal_per_nm × fuel_price        ← fuel
         + (extra_nm / gs)        × time_rate         ← time
feasible  ⟺  destination is OUTSIDE the zone
split: fuel | time | disruption 0
```
`around_distance` = tangent–arc–tangent path around the disk (`geometry.py`).
If the destination is **inside** the zone, you cannot route around to it → infeasible.

### hold — circle until the zone clears
```
fuel_needed = T × burn
cost        = T × burn × fuel_price     ← fuel
            + T × time_rate              ← time
feasible  ⟺  fuel_needed ≤ F_rem − F_res     (can't dip into reserve)
split: fuel | time | disruption 0
```

### divert — land at nearest open airport (passengers stranded)
```
leg_nm     = distance(current → nearest alternate outside zone)
extra_nm   = max(0, leg_nm − remaining_nm)
cost       = extra_nm × gal_per_nm × fuel_price          ← fuel
           + (leg_nm / gs)         × time_rate            ← time
           + disrupt_fixed + disrupt_pax × pax            ← disruption
feasible  ⟺  an alternate exists outside the zone
```

### connection — land at a hub, rebook passengers onward (soft divert)
```
leg_nm     = distance(current → nearest hub outside zone, ≠ destination)
extra_nm   = max(0, leg_nm − remaining_nm)
cost       = extra_nm × gal_per_nm × fuel_price          ← fuel
           + (leg_nm / gs)         × time_rate            ← time
           + rebooking_fixed + rebooking_pax × pax        ← disruption
feasible  ⟺  a connecting hub exists outside the zone
```
Same flying cost as divert, but a **smaller penalty** — passengers still reach
their destination, so no full stranded-pax charge.

---

## 4. Selection, baseline, and the gap

**Chosen move** = `argmin cost` over **feasible** moves only.

**Baseline (uncoordinated reference):** reroute if feasible, else divert. No
holds, ground stops, or connections — the naive policy.

**Coordination gap (a.k.a. "cost saved"):**
```
cost_saved = Σ baseline_cost − Σ optimized_cost
```
This is a comparison of **two policies priced by the same engine** — not savings
vs. real-world ground truth.

---

## 5. Coupling — shared-resource repair (`coupling.py`)

After the per-flight picks, flights compete for scarce capacity:
- **corridor_capacity** — total reroutes through the zone-avoidance airspace
- **alternate_capacity** — diverts allowed per airport (flat number; same for all)

If a resource is over capacity, bump the **lowest-regret** flights (smallest
`next_best_cost − current_cost`) to their next-best move; loop to a fixpoint.

> Greedy and swappable. TODO: replace with an exact ILP (OR-Tools) or a
> Lagrangian congestion-pricing relaxation.

**Not modeled:** real airport busyness, delay propagation, time-phased slots,
reroute-corridor congestion. Caps are flat configured defaults.

---

## 6. Constants (config defaults, CLI-overridable)

| Constant | Value | Used in |
|---|---|---|
| `fuel_price` | **$7.43 / gal** | reroute, hold, divert, connection (`--fuel`) |
| `ground_rate` | $50 / min | ground_stop |
| `time_rate` | $68 / min | all airborne time |
| `disrupt_fixed` | $12,000 | divert |
| `disrupt_pax` | $120 / pax | divert |
| `rebooking_fixed` | $4,000 | connection |
| `rebooking_pax` | $45 / pax | connection |
| `reserve_hold_min` | 45 min | fuel reserve = 45 × burn |
| `fuel_buffer_frac` | 5% | fuel estimate |
| `cruise_speed_kt` | 450 | gs |
| burn by type | B738/A320 11.5 · A21N 12.0 · B739/B752 13.0 · B789 17.0 (gal/min) | gal_per_nm |

---

## 7. Worked example — JBU1575 (the hero)

A320, `burn = 11.5`, `gs = 450/60 = 7.5 nm/min`, `gal_per_nm = 11.5/7.5 = 1.53`,
`remaining_nm = 364`, closure `T = 133 min`. Destination MKJP is **inside** the zone.

| Move | Feasible? | Why / cost |
|---|---|---|
| ground_stop | ❌ | already airborne |
| reroute | ❌ | destination inside zone |
| hold | ❌ | needs 133×11.5 = **1,530 gal**, only **585** usable above reserve |
| divert | ✅ | KMIA, 160 nm leg → time $1,455 + disruption $30,000 = **$31,455** |
| **connection** | ✅ | KMIA hub → time $1,455 + rebooking $10,750 = **$12,205** ✅ chosen |

**Result:** forced to abandon Kingston (fuel-critical, can't hold), and
**connection beats divert by ~$19k** purely on the disruption penalty
($10,750 vs $30,000). Matches reality — the real ADS-B shows JBU1575 turned back.

---

## 8. Properties

- **Deterministic** — same inputs → same outputs (flights sorted by id; no RNG).
- **Auditable** — every move exposes its fuel/time/disruption split; every
  derived flight input carries a provenance flag.
- **Honest** — 14 of 15 flights use synthesized inputs; only JBU1575 is fully
  ground-truthed. Costs are estimates of a *decision*, not measurements of history.
