# Software Requirements Specification — Airspace Disruption Forecaster

> **Status:** Pitch SRS (Shaping → Betting per Shape Up phase model)
> **Event:** ASI Hackathon — "Hacking the Fourth Dimension," Fenway Park, Boston, 2026-05-30
> **Date:** 2026-05-30
> **Owner:** Xavier
> **Team:** 5 people (3 eng, 1 designer, 1 presenter)
> **Build budget:** 1 hr design + ~3 hr build
> **Related:** [[SDD]]

## 1. Project summary

A **live airspace operations dashboard** for an airline ops center. It watches real-world events that can close airspace (rocket launches, military activity, FIR closures, geopolitical incidents), shows their impact on the airline's flights on a map, computes what each disruption costs, and gives a chatbot that explains the impact, recommends priced actions, and drafts the comms.

The hero scenario is a **replay of a real event**: SpaceX Starship Flight 12 launched 2026-05-22, triggering a TFR that closed part of the Kingston FIR (21:30–23:43Z). Real ADS-B shows JetBlue **JBU1575** (KFLL→Kingston) flying toward the closure, U-turning over the Bahamas, and returning to Fort Lauderdale. The differentiator hook: weather at KFLL/KMIA/MKJP was **clear VFR** — a weather dashboard shows all green, but our system flags the space NOTAM wall.

The product also shows the **wider network picture**: total cost across all carriers and the gap between acting alone (selfish-optimal) and coordinated action — situational awareness the airline can see even though it only controls its own flights.

## 2. User

**Primary user:** An airline operations center (AOC) — JetBlue ops in the demo. Dispatchers and the network ops manager who decide holds, diversions, and cancellations and absorb the delay cost.

**Optimization scope:** The user acts only on **their own** flights (selfish-optimal). The platform additionally **shows** total network impact across all carriers and the selfish-vs-coordinated savings gap — for awareness, not command.

**User context:** The operator tracks a watchlist of events affecting them (left panel), sees impact on a map (center), discovers incoming news that might matter (top-right), and asks a chatbot how it all affects them, what to do, and to draft the message (bottom-right). No training needed to read the screen — the map, the dollar figures, and the chatbot answers carry the story.

**Not the user:** FAA traffic-flow management (it appears only as the "coordinated" reference case), pilots, passengers, general aviation.

## 3. "Done" — two tiers

This is a ~3-hour build. "Done" has two levels.

### Tier 1 — MVP (target)
The dashboard renders as one screen with four working panels against real cached data:
1. **Center map** — the SpaceX TFR polygon at the correct location, the real JBU1575 track (U-turn), affected flights, and clear-weather markers (the paradox).
2. **Left — bookmarked events** — the operator's tracked events (SpaceX TFR, Kingston FIR closure), each showing its dollar impact.
3. **Top-right — potential news** — a feed of incoming events that might be relevant (pre-loaded, "live" badge), bookmark-able.
4. **Bottom-right — chatbot** — a real LLM that summarizes overall impact, breaks it down per event, recommends priced action options (hold / divert / pre-empt), and drafts comms to the ops team and crews.

Static computation against a single cached data snapshot. Cost and the network gap compute deterministically.

### Tier 2 — Stretch (if Tier 1 ships early)
Live bookmark on stage (pull a real GDELT/NewsAPI item and watch it flow left), a time-stepped animation of the disruption window, a second event (a weather cell or a different NOTAM) to prove generality, and passenger-facing comms drafts.

## 4. Requirements

Format for each: **ID — Statement — Acceptance criteria — Rationale — Tier.**

### R1 — Disruption + map display  *(Tier 1)*
The system shall render a national/Caribbean map showing the disruption zone (the SpaceX TFR: center 26.97°N 97.16°W with the Kingston-FIR closure polygon), the real JBU1575 track, affected flights, ATC sectors from `sectors.geojson`, and clear-weather markers for KFLL/KMIA/MKJP.
- **Acceptance:** The TFR polygon and JBU1575 U-turn render at correct geographic locations; the clear-weather markers are visibly green; a reader can point to the conflict unprompted on a projector.
- **Rationale:** This is the hook — the "clear skies, still grounded" paradox. Without a visible conflict there's no story.

### R2 — Affected-flight detection  *(Tier 1)*
The system shall flag every flight whose route intersects the disruption zone during the event window, using the real cached OpenSky tracks.
- **Acceptance:** JBU1575 is flagged as conflicting; the affected set matches a hand-verified geometric check for ≥ 95% of flights near the zone; flagged flights are visually distinct.
- **Rationale:** The affected set feeds cost, events, and the chatbot. Everything downstream depends on it.

### R3 — Bookmarked events panel  *(Tier 1)*
The left panel shall list the operator's tracked events, each with a one-line summary and its computed dollar impact.
- **Acceptance:** SpaceX TFR and Kingston FIR closure appear as cards, each showing flights affected and a dollar figure; clicking a card focuses the map on that event.
- **Rationale:** This is the operator's working watchlist — the "what affects me right now" view.

### R4 — Potential news feed  *(Tier 1)*
The top-right panel shall show a feed of incoming events that might be relevant (pre-loaded, labeled live), each bookmark-able into the left panel.
- **Acceptance:** The feed shows ≥ 3 plausible events (e.g., GoM military exercise NOTAM, FL storm, port strike); a bookmark action moves an item to the left panel. Pre-loaded content renders deterministically.
- **Rationale:** Closes the discovery→curation loop and shows the system is general, not SpaceX-only.

### R5 — Cost quantification  *(Tier 1)*
The system shall compute the operational cost of each disruption from per-flight delay minutes, extra distance flown, and crew/overnight cost, using published per-minute, per-nautical-mile, and per-overnight rates.
- **Acceptance:** Each event card and the chatbot report a dollar figure with a breakdown (delay, extra-fuel/distance, crew); changing an input rate changes the figure deterministically.
- **Rationale:** The dollar number is what makes an ops manager care. It turns a map into a business case.

### R6 — Priced action options (counterfactual)  *(Tier 1)*
The system shall present at least three actions the airline can take on its own flights — **hold**, **divert**, **pre-emptively avoid** — each with its computed cost, marking the cheapest.
- **Acceptance:** Three options render with distinct costs and the cheapest is flagged; the logic behind each is explainable in one sentence on stage.
- **Rationale:** Detection is table stakes. Telling the operator the right action and what it's worth is the product.

### R7 — Network view + coordination gap  *(Tier 1)*
The system shall compute total cost across all carriers in the window and the gap between the airline acting alone (selfish-optimal) and coordinated action (system-optimal reference).
- **Acceptance:** The system reports a total network dollar figure and a "save $X alone vs $Y if coordinated" delta; both reproduce across runs.
- **Rationale:** The wider perspective the user asked for. ASI-grade situational awareness — see the whole board even when you only move your own pieces.

### R8 — Chatbot (real LLM)  *(Tier 1)*
The bottom-right panel shall be a real LLM chatbot that, on request, summarizes overall impact, breaks it down per event, recommends a priced action, and drafts comms to the ops team and crews. Demo prompts are pre-tested.
- **Acceptance:** Each pre-tested prompt returns a coherent answer grounded in the computed numbers (cost figures match R5/R6); a comms draft to crew/ops renders. A failed API call degrades to a cached answer, not a crash.
- **Rationale:** The interactive brain of the product. Lets a judge ask "what should I do?" and get a grounded, priced answer.

### R9 — Determinism  *(Tier 1)*
Given identical inputs (cached tracks + TFR geometry + cost rates), the system shall produce identical flagged flights, identical cost figures, and identical network gap.
- **Acceptance:** Run 5 times; numeric outputs match within 1e-6 and flagged sets match exactly. (Chatbot prose may vary; the numbers it cites must not.)
- **Rationale:** Stage trust. A mid-demo re-run must not change a number in front of judges.

### R10 — Single-screen dashboard layout  *(Tier 1)*
The UI shall present all four panels on one screen (left events, center map, top-right news, bottom-right chatbot) readable on a projector, with the eye flowing left→center→right.
- **Acceptance:** All four panels render together without scrolling on a demo display; each is legible from across a room.
- **Rationale:** This is the pitch surface. The build only matters if it reads as one coherent ops dashboard.

### R11 — Live bookmark on stage  *(Tier 2 / stretch)*
The system shall pull a real GDELT/NewsAPI item live and let the presenter bookmark it into the left panel during the demo.
- **Acceptance:** A live-fetched item appears in the news feed and can be bookmarked on stage; falls back to pre-loaded on failure.
- **Rationale:** Proves the loop is real, not canned. Defers cleanly — pure polish.

### R12 — Disruption-window animation  *(Tier 2 / stretch)*
The system shall step through the event window and animate the JBU1575 track and affected set over time.
- **Acceptance:** Pressing play advances the track through the U-turn; reproducible across runs.
- **Rationale:** Turns the static map into a living forecast. Cut first if time is short.

### R13 — Second-event generality  *(Tier 2 / stretch)*
The system shall accept a second disruption (a weather cell or different NOTAM) and re-run R2–R7.
- **Acceptance:** Toggling produces a different but plausible affected set, cost, and network gap.
- **Rationale:** Answers "does this only work for rockets?"

## 5. Constraints

- **Data sources (all real):**
  - **Flight tracks** — OpenSky Network, cached via Xavier's OAuth2 creds. `data/jbu1575_track.json` (229 real waypoints) + `data/casualties.json` (15 flights). No live OpenSky call on stage.
  - **TFR / NOTAM** — hardcoded May 22 geometry (Kingston FIR closure); NASA DIP cited as the live source the architecture would use.
  - **Weather** — aviationweather.gov `/api/data/metar?ids=KMIA,KFLL,MKJP&format=json` (clear-weather paradox); pulled once and cached.
  - **News** — GDELT / NewsAPI for the top-right feed; pre-loaded for Tier 1, live for Tier 2 (R11).
  - **ATC sectors** — bundle `sectors.geojson` (real polygons + capacities).
- **Credentials:** `credentials.json` is git-ignored; no secret committed (hackathon rule).
- **Build budget:** ~3 hours build after 1 hour design. Tier 1 must fit. Tier 2 only if Tier 1 ships early.
- **Team split (3 eng):** Eng A — data + detection (R1, R2). Eng B — cost + options + network gap (R5, R6, R7). Eng C — dashboard frontend + chatbot wiring (R3, R4, R8, R10). Designer — panel layout/visual. Presenter — narrative.
- **Determinism:** Hard constraint for all numbers (R9).
- **Single snapshot for Tier 1:** computes against one cached window. Animation is Tier 2 (R12).

## 6. Deferred to future versions (and why)

- **Live NOTAM/news feed** *(future / partial in Tier 2)* — the real product ingests NASA DIP + GDELT continuously. Tier 1 caches because live endpoints can hang on stage. Architecture keeps ingestion behind an interface so a live source slots in.
- **True system-optimal solver** *(v2)* — R7's "coordinated" figure is a reference computation, not a real multi-carrier optimizer. A genuine traffic-flow solver is later.
- **Passenger comms** *(v2)* — chatbot drafts to ops team + crews in Tier 1; passenger rebooking notices are stretch.
- **Real reroute optimization** *(v2)* — Tier 1 actions use deterministic heuristics (hold duration, simple avoidance), not an optimizer. Enough to show priced choices.
- **Multiple simultaneous disruptions** *(v2)* — one active event at a time; R13's second event is a toggle, not concurrent.

## 7. Open questions

- **Where would scope drift hurt most?** Building a "real" optimizer for R6/R7. It eats the whole build. Hold the line: priced heuristics, not a solver.
- **Riskiest unknown?** Chatbot grounding — making the LLM cite the *computed* cost numbers, not invent them. Mitigation: feed the computed figures into the prompt context; pre-test every demo prompt; cache fallback answers (R8).
- **What sells the pitch?** The clear-weather paradox (R1) + the dollar figure (R5) + the coordination gap (R7). If those three read on the projector, the demo lands.

## 8. Requirement properties self-check

| ID | Verifiable | Unambiguous | Traceable | Independent |
|----|-----------|-------------|-----------|-------------|
| R1 | ✓ (location/scale + green markers) | ✓ | ✓ (the hook) | ✓ |
| R2 | ✓ (JBU1575 + manual geometry) | ✓ | ✓ (feeds all) | depends on R1 |
| R3 | ✓ (cards + click-to-focus) | ✓ | ✓ (watchlist) | depends on R2, R5 |
| R4 | ✓ (≥3 items + bookmark) | ✓ | ✓ (discovery loop) | ✓ |
| R5 | ✓ (figure + breakdown) | ✓ | ✓ (business case) | depends on R2 |
| R6 | ✓ (3 priced options) | ✓ | ✓ (differentiator) | depends on R5 |
| R7 | ✓ (total + delta, reproducible) | ✓ | ✓ (wider perspective) | depends on R5 |
| R8 | ✓ (grounded answers + draft) | ✓ | ✓ (interactive brain) | depends on R5, R6 |
| R9 | ✓ (5-run repeat) | ✓ | ✓ (stage trust) | ✓ |
| R10 | ✓ (4 panels + projector) | ✓ | ✓ (pitch surface) | depends on R1–R8 |
| R11 | ✓ (live item + fallback) | ✓ | ✓ (loop is real) | depends on R4 |
| R12 | ✓ (play advances track) | ✓ | ✓ (living forecast) | depends on R2 |
| R13 | ✓ (toggle re-runs pipeline) | ✓ | ✓ (generality) | depends on R2–R7 |
