# Frontend Contract

Backend runs: `uvicorn backend.main:app --port 8000`

## GET /api/state -> StateModel
```json
{
  "events": [{ "id": "", "name": "", "summary": "", "polygon": [[lat,lon]], "affected_flight_ids": [], "cost": {"total_usd": 0, "delay_usd": 0, "fuel_usd": 0, "crew_usd": 0, "detail": ""}, "options": [{"kind": "", "cost_usd": 0, "cheapest": false, "rationale": ""}], "bookmarked": false }],
  "flights": [{ "id": "", "icao24": "", "track": [{"lat": 0, "lon": 0, "t": 0}], "affected": false, "is_hero": false, "arr": "", "first_seen": 0, "last_seen": 0 }],
  "sectors": {},
  "weather": [{ "station": "", "lat": 0, "lon": 0, "flight_category": "", "raw": "" }],
  "news": [{ "id": "", "headline": "", "summary": "", "source": "", "can_bookmark": false }],
  "network": { "selfish_usd": 0, "coordinated_usd": 0, "gap_usd": 0 }
}
```
Note: only the hero (is_hero=true, JBU1575) has a full track[]. The 15 casualties have empty track[] but affected=true (real pre-filtered set).

## POST /api/chat
Request: `{ "message": "", "event_id": null }`
Response: `{ "reply": "", "source": "" }`

## Panel mapping (SRS R10)
- LEFT = events[] cards (cost.total_usd; click -> focus map polygon)
- CENTER = Leaflet: event polygon (red), hero track (bold U-turn), weather (green circles, flight_category VFR), sectors
- TOP-RIGHT = news[] (bookmark moves to left, client-side)
- BOTTOM-RIGHT = chat (POST /api/chat, render reply)
