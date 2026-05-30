# Frontend Contract

Live API = **Next.js routes, same origin** (no separate server). Types in `lib/airspace/types.ts`.
(The Python `backend/` is reference only — do NOT call it.)

## GET /api/state -> StateModel
```jsonc
{
  "events": [{
    "id": "spacex-starship-f12",
    "name": "", "summary": "",
    "polygon": [{ "lat": 0, "lng": 0 }],
    "affectedFlightIds": ["JBU1575", "..."],
    "cost": {
      "totalUsd": 351301.56,
      "lineItems": [{ "label": "Aircraft block time (delay)", "usd": 0, "source": "A4A 2024 ..." }],
      "detail": "16 affected flights",
      "delayUsd": 0, "fuelUsd": 0, "crewUsd": 0   // legacy roll-ups; prefer lineItems
    },
    "options": [{ "kind": "hold|divert|preempt", "costUsd": 0, "cheapest": false, "rationale": "" }],
    "bookmarked": true
  }],
  "flights": [{ "id": "", "icao24": "", "track": [{ "lat": 0, "lng": 0, "t": 0 }],
               "affected": false, "isHero": false, "arr": null, "firstSeen": null, "lastSeen": null }],
  "sectors": { "type": "FeatureCollection", "features": [] },
  "weather": [{ "station": "KFLL", "lat": 0, "lng": 0, "flightCategory": "VFR", "raw": "" }],
  "news": [{ "id": "", "headline": "", "summary": "", "source": "", "canBookmark": true }],
  "network": { "selfishUsd": 0, "coordinatedUsd": 0, "gapUsd": 0 },
  "costModel": [{ "key": "", "rate": 0, "unit": "", "source": "" }]
}
```
Notes:
- Coordinates use `{lat, lng}` (matches `lib/types.ts`). Only the hero (`isHero=true`, JBU1575) has a full `track[]`; the 15 casualties have empty `track[]` but `affected=true` (real pre-filtered set).
- `cost.lineItems[]` is the itemized, **citable** breakdown — render it to "show the data". Each line has a `source`.
- `costModel[]` is the published rate sheet (rate + unit + source) — render as a methodology panel. See `Context(Docs)/Cost_Model.md`.
- Numbers are deterministic (byte-identical across calls). Total ≈ **$351,302**, network gap ≈ **$88k**.

## POST /api/chat
Request: `{ "message": "..." }`
Response: `{ "reply": "...", "source": "live" | "fallback" }`
- Grounded in the computed `/api/state` numbers (cost lineItems + sources injected into the system prompt). Falls back to cached answers on any API failure — never crashes.
- Needs `ANTHROPIC_API_KEY` in `.env.local` for live mode; without it, returns cached fallback.

## Panel mapping (SRS R10)
- LEFT = events[] cards (`cost.totalUsd`; click -> focus map on `polygon`)
- CENTER = Leaflet: event `polygon` (red), hero `track` (bold U-turn), `weather` (green circles, `flightCategory` VFR), `sectors`
- TOP-RIGHT = news[] (bookmark moves to left, client-side)
- BOTTOM-RIGHT = chat (POST /api/chat); optionally a cost-breakdown / methodology view from `cost.lineItems` + `costModel`
