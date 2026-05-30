# Airspace Live Map Visualizer — Implementation Plan

**Goal:** Build a Next.js airspace map with two modes:
- **Simulation** — tick-based animation of the SpaceX Starship 12 (May 22, 2026) case study. Controllable playback speed, scripted TFR activations, injectable random events.
- **Live** — polls OpenSky Network ADS-B API every 10s to render real aircraft positions over the Florida–Caribbean region.

**Architecture:** Single-page client app. Mode toggled via header button. Simulation uses hardcoded waypoint data + `setInterval` tick. Live mode polls `opensky-network.org/api/states/all` with a lat/lng bounding box, normalizes state-vector arrays to `LiveFlight[]`, renders markers directly (no interpolation). TFR zones are always mock — no free live TFR API exists. Both modes share the same Leaflet map, `TFRZone`, and `EventFeed` components.

**Tech Stack:** Next.js 15 App Router · TypeScript · Tailwind CSS · `react-leaflet` 4 · `leaflet` 1.9 · Lucide React · OpenSky REST API (anonymous, no key required)

---

## File Map

```
/Delayed_Propagation/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    ← all state: mode, simTime, liveFlights, TFRs, events
│   └── globals.css
├── components/
│   ├── AirspaceMap.tsx             ← Leaflet map shell; renders sim OR live markers based on mode prop
│   ├── FlightMarker.tsx            ← sim marker: waypoint-interpolated position + heading from bearing calc
│   ├── LiveFlightMarker.tsx        ← live marker: direct lat/lng/heading from OpenSky state vector
│   ├── TFRZone.tsx                 ← pulsing polygon overlay (shared by both modes)
│   ├── SimulationControls.tsx      ← play/pause, 1x/10x/60x/120x speed, sim clock, progress bar
│   └── EventFeed.tsx               ← scrolling event log + "Inject Random Event" button
└── lib/
    ├── types.ts                    ← Flight, LiveFlight, TFRZone, Airport, SimEvent interfaces
    ├── simulation.ts               ← getFlightPosition(), bearingBetween(), simTimeToDisplay(), generateRandomTFR()
    ├── opensky.ts                  ← fetchLiveFlights(): polls OpenSky, normalizes to LiveFlight[]
    └── data/
        ├── flights.ts              ← 4 mock flights with waypoints (JetBlue B61575, Delta, BA, Cayman)
        ├── tfr.ts                  ← SpaceX Kingston TFR + convective warning polygon
        └── airports.ts             ← KFLL, KMIA, MKJP, KATL, MWCR
```

---

## Data Flow

```
OpenSky API --poll every 10s--> fetchLiveFlights() --> liveFlights[] --> LiveFlightMarker
Mock waypoints --tick loop-->   getFlightPosition()  --> FlightMarker
Both modes ------------------>  TFRZone (mock, always injectable)
                                EventFeed (log of activations + inject button)
```

---

## OpenSky API Reference

**Endpoint:**
```
GET https://opensky-network.org/api/states/all?lamin=17&lomin=-83&lamax=27&lomax=-72
```

**Bounding box:** Florida to Caribbean (south ~Jamaica, north ~Miami, west ~Cuba, east ~Bahamas)

**Rate limit:** Anonymous = 10 requests / 10 seconds. Polling every 10s is within limits.

**State vector array indices used:**
```
[0]  icao24         string          ICAO 24-bit address
[1]  callsign       string | null   flight number (may have trailing spaces — trim it)
[2]  origin_country string
[5]  longitude      number | null   degrees
[6]  latitude       number | null   degrees
[7]  baro_altitude  number | null   meters
[8]  on_ground      boolean
[9]  velocity       number | null   m/s
[10] true_track     number | null   degrees clockwise from north (heading)
```

**Response shape:**
```json
{
  "time": 1716000000,
  "states": [
    ["ab1234", "AAL100  ", "United States", null, null, -80.5, 25.5, 10000, false, 250, 180, 0, null, 10000, null, false, 0]
  ]
}
```

---

## Task 1 — Scaffold Next.js Project

**Creates:** `package.json`, `next.config.ts`, `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`

```bash
cd /Users/mateootero-diaz/ASI_Hackathon/Delayed_Propagation
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes

npm install react-leaflet leaflet lucide-react
npm install --save-dev @types/leaflet
```

**next.config.ts:**
```ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { reactStrictMode: true }
export default nextConfig
```

**app/globals.css:**
```css
@import 'leaflet/dist/leaflet.css';
@tailwind base;
@tailwind components;
@tailwind utilities;

@keyframes tfr-pulse {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 0.25; }
}
.tfr-pulse { animation: tfr-pulse 2s ease-in-out infinite; }
```

**app/layout.tsx:**
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Airspace Intelligence',
  description: 'Real-time airspace conflict visualizer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  )
}
```

**Verify:** `npm run dev` — server starts at http://localhost:3000, no errors.

```bash
git add -A && git commit -m "feat: scaffold Next.js airspace map project"
```

---

## Task 2 — Types + Mock Data

**Creates:** `lib/types.ts`, `lib/data/flights.ts`, `lib/data/tfr.ts`, `lib/data/airports.ts`

**lib/types.ts:**
```ts
export interface LatLng {
  lat: number
  lng: number
}

export interface Waypoint extends LatLng {
  t: number   // sim seconds from epoch (17:00 EDT = 0)
}

export type FlightStatus = 'scheduled' | 'enroute' | 'diverted' | 'grounded' | 'landed'

export interface Flight {
  id: string
  callsign: string
  airline: string
  origin: string
  destination: string
  waypoints: Waypoint[]
  status: FlightStatus
}

export interface LiveFlight {
  icao24: string
  callsign: string
  lat: number
  lng: number
  heading: number     // degrees clockwise from north
  altitude: number    // meters
  velocity: number    // m/s
  onGround: boolean
  country: string
}

export interface TFRZone {
  id: string
  label: string
  polygon: LatLng[]
  activeFrom: number  // sim seconds (ignored in live mode)
  activeTo: number
  severity: 'warning' | 'danger'
  reason: string
}

export interface Airport {
  icao: string
  name: string
  position: LatLng
}

export interface SimEvent {
  id: string
  simTime: number
  message: string
  type: 'info' | 'warning' | 'danger'
}
```

**lib/data/flights.ts:**

> Epoch = sim second 0 = 17:00 EDT. SpaceX TFR window = 17:30 to 19:43 EDT = sim seconds 1800 to 10380.

```ts
import type { Flight } from '@/lib/types'

export const MOCK_FLIGHTS: Flight[] = [
  {
    id: 'B61575',
    callsign: 'JetBlue 1575',
    airline: 'JetBlue',
    origin: 'KFLL',
    destination: 'MKJP',
    status: 'enroute',
    waypoints: [
      { lat: 26.072, lng: -80.152, t: 0 },
      { lat: 26.072, lng: -80.152, t: 1200 },  // departs 17:20
      { lat: 24.5,   lng: -77.8,   t: 3600 },
      { lat: 23.0,   lng: -76.2,   t: 4500 },
      { lat: 21.8,   lng: -75.5,   t: 4800 },  // hits TFR 18:20, U-turn
      { lat: 22.8,   lng: -76.8,   t: 5400 },
      { lat: 24.8,   lng: -78.9,   t: 6600 },
      { lat: 25.795, lng: -80.287, t: 7200 },  // diverts KMIA 19:00
      { lat: 25.795, lng: -80.287, t: 12000 },
    ],
  },
  {
    id: 'DL402',
    callsign: 'Delta 402',
    airline: 'Delta',
    origin: 'KATL',
    destination: 'MKJP',
    status: 'enroute',
    waypoints: [
      { lat: 33.641, lng: -84.427, t: 0 },
      { lat: 30.5,   lng: -82.0,   t: 2000 },
      { lat: 27.5,   lng: -80.0,   t: 3600 },
      { lat: 26.072, lng: -80.152, t: 4200 },  // ground-stopped KFLL
      { lat: 26.072, lng: -80.152, t: 12000 },
    ],
  },
  {
    id: 'BA2157',
    callsign: 'British Airways 2157',
    airline: 'British Airways',
    origin: 'MKJP',
    destination: 'EGLL',
    status: 'enroute',
    waypoints: [
      { lat: 17.935, lng: -76.787, t: 0 },
      { lat: 17.935, lng: -76.787, t: 1000 },
      { lat: 19.5,   lng: -76.0,   t: 2200 },
      { lat: 20.4,   lng: -75.3,   t: 2800 },  // forced back by TFR
      { lat: 19.2,   lng: -76.5,   t: 3600 },
      { lat: 17.935, lng: -76.787, t: 4400 },
      { lat: 17.935, lng: -76.787, t: 12000 },
    ],
  },
  {
    id: 'KW201',
    callsign: 'Cayman Airways 201',
    airline: 'Cayman Airways',
    origin: 'MWCR',
    destination: 'KFLL',
    status: 'enroute',
    waypoints: [
      { lat: 19.292, lng: -81.357, t: 0 },
      { lat: 20.5,   lng: -80.5,   t: 900 },
      { lat: 22.0,   lng: -79.5,   t: 1800 },
      { lat: 23.0,   lng: -77.5,   t: 3000 },  // reroutes east around TFR
      { lat: 24.5,   lng: -77.0,   t: 3900 },
      { lat: 25.5,   lng: -78.8,   t: 4800 },
      { lat: 26.072, lng: -80.152, t: 5800 },
      { lat: 26.072, lng: -80.152, t: 12000 },
    ],
  },
]
```

**lib/data/tfr.ts:**
```ts
import type { TFRZone } from '@/lib/types'

export const MOCK_TFRS: TFRZone[] = [
  {
    id: 'TFR-SPACEX-001',
    label: 'SpaceX TFR -- NOTAM 6/3421',
    polygon: [
      { lat: 23.5, lng: -80.5 },
      { lat: 23.5, lng: -72.0 },
      { lat: 17.0, lng: -72.0 },
      { lat: 17.0, lng: -80.5 },
      { lat: 23.5, lng: -80.5 },
    ],
    activeFrom: 1800,
    activeTo: 10380,
    severity: 'danger',
    reason: 'SpaceX Starship Flight 12 debris corridor -- FL000-FL999',
  },
  {
    id: 'TFR-WEATHER-001',
    label: 'Convective Activity Warning',
    polygon: [
      { lat: 25.5, lng: -82.5 },
      { lat: 25.5, lng: -80.0 },
      { lat: 23.5, lng: -80.0 },
      { lat: 23.5, lng: -82.5 },
      { lat: 25.5, lng: -82.5 },
    ],
    activeFrom: 5400,
    activeTo: 8000,
    severity: 'warning',
    reason: 'Severe thunderstorm cell FL180 reported -- PIREP',
  },
]
```

**lib/data/airports.ts:**
```ts
import type { Airport } from '@/lib/types'

export const AIRPORTS: Airport[] = [
  { icao: 'KFLL', name: 'Fort Lauderdale',         position: { lat: 26.072, lng: -80.152 } },
  { icao: 'KMIA', name: 'Miami Intl',               position: { lat: 25.795, lng: -80.287 } },
  { icao: 'MKJP', name: 'Norman Manley (Kingston)', position: { lat: 17.935, lng: -76.787 } },
  { icao: 'KATL', name: 'Atlanta Hartsfield',       position: { lat: 33.641, lng: -84.427 } },
  { icao: 'MWCR', name: 'Owen Roberts (Cayman)',    position: { lat: 19.292, lng: -81.357 } },
]
```

```bash
git add lib/ && git commit -m "feat: add types and mock flight/TFR/airport data"
```

---

## Task 3 — Simulation Engine

**Creates:** `lib/simulation.ts`

```ts
// lib/simulation.ts
import type { Flight, TFRZone, LatLng } from './types'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function getFlightPosition(
  flight: Flight,
  simTime: number,
): (LatLng & { heading: number }) | null {
  const { waypoints } = flight
  if (waypoints.length === 0 || simTime < waypoints[0].t) return null

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i]
    const to   = waypoints[i + 1]
    if (simTime >= from.t && simTime <= to.t) {
      const duration = to.t - from.t
      const progress = duration === 0 ? 1 : (simTime - from.t) / duration
      return {
        lat:     lerp(from.lat, to.lat, progress),
        lng:     lerp(from.lng, to.lng, progress),
        heading: bearingBetween(from, to),
      }
    }
  }

  const last = waypoints[waypoints.length - 1]
  return { lat: last.lat, lng: last.lng, heading: 0 }
}

export function bearingBetween(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const dLng  = toRad(b.lng - a.lng)
  const lat1  = toRad(a.lat)
  const lat2  = toRad(b.lat)
  const x = Math.sin(dLng) * Math.cos(lat2)
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (toDeg(Math.atan2(x, y)) + 360) % 360
}

export function getActiveTFRs(tfrs: TFRZone[], simTime: number): TFRZone[] {
  return tfrs.filter(z => simTime >= z.activeFrom && simTime <= z.activeTo)
}

export function simTimeToDisplay(simSeconds: number): string {
  const totalMinutes = Math.floor(simSeconds / 60)
  const totalHours   = Math.floor(totalMinutes / 60)
  const hours24      = 17 + totalHours
  const mins         = totalMinutes % 60
  const displayHour  = hours24 > 12 ? hours24 - 12 : hours24
  const ampm         = hours24 >= 12 ? 'PM' : 'AM'
  return `${displayHour}:${String(mins).padStart(2, '0')} ${ampm} EDT`
}

export function generateRandomTFR(simTime: number): TFRZone {
  const centerLat = 20 + Math.random() * 6
  const centerLng = -82 + Math.random() * 10
  const size      = 0.8 + Math.random() * 1.2
  return {
    id:       `TFR-RANDOM-${Date.now()}`,
    label:    'Unplanned Airspace Restriction',
    polygon: [
      { lat: centerLat + size, lng: centerLng - size },
      { lat: centerLat + size, lng: centerLng + size },
      { lat: centerLat - size, lng: centerLng + size },
      { lat: centerLat - size, lng: centerLng - size },
      { lat: centerLat + size, lng: centerLng - size },
    ],
    activeFrom: simTime,
    activeTo:   simTime + 1800 + Math.floor(Math.random() * 3600),
    severity:   Math.random() > 0.5 ? 'danger' : 'warning',
    reason:     'Military exercise -- notified via NOTAM',
  }
}
```

```bash
git add lib/simulation.ts && git commit -m "feat: add simulation interpolation engine"
```

---

## Task 4 — OpenSky Live Data Fetcher

**Creates:** `lib/opensky.ts`

```ts
// lib/opensky.ts
import type { LiveFlight } from './types'

const OPENSKY_URL =
  'https://opensky-network.org/api/states/all' +
  '?lamin=17&lomin=-83&lamax=27&lomax=-72'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeStateVector(sv: any[]): LiveFlight | null {
  const lng = sv[5] as number | null
  const lat = sv[6] as number | null
  if (lat == null || lng == null) return null

  return {
    icao24:   sv[0] as string,
    callsign: ((sv[1] as string | null) ?? '').trim() || (sv[0] as string),
    lat,
    lng,
    heading:  (sv[10] as number | null) ?? 0,
    altitude: (sv[7]  as number | null) ?? 0,
    velocity: (sv[9]  as number | null) ?? 0,
    onGround: sv[8]  as boolean,
    country:  sv[2]  as string,
  }
}

/**
 * Fetches live aircraft in Florida-Caribbean bounding box from OpenSky Network.
 * Returns [] on network error so the map retains its last known state.
 * Anonymous rate limit: 10 requests / 10 seconds -- poll at 10s intervals.
 */
export async function fetchLiveFlights(): Promise<LiveFlight[]> {
  try {
    const res = await fetch(OPENSKY_URL, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json() as { states: unknown[][] | null }
    if (!data.states) return []
    return data.states
      .map(normalizeStateVector)
      .filter((f): f is LiveFlight => f !== null)
  } catch {
    return []
  }
}
```

```bash
git add lib/opensky.ts && git commit -m "feat: add OpenSky ADS-B fetcher with normalization"
```

---

## Task 5 — Base Map Component

**Creates:** `components/AirspaceMap.tsx` (shell), `app/page.tsx` (temp)

```tsx
// components/AirspaceMap.tsx
'use client'

import { MapContainer, TileLayer } from 'react-leaflet'
import type { Flight, LiveFlight, TFRZone as TFRZoneType, Airport } from '@/lib/types'

export interface AirspaceMapProps {
  flights:     Flight[]
  simTime:     number
  liveFlights: LiveFlight[]
  activeTFRs:  TFRZoneType[]
  extraTFRs:   TFRZoneType[]
  airports:    Airport[]
  mode:        'sim' | 'live'
}

export default function AirspaceMap(_props: AirspaceMapProps) {
  return (
    <MapContainer center={[24.0, -78.0]} zoom={5} className="w-full h-full">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
      />
    </MapContainer>
  )
}
```

Temp page.tsx to confirm map renders:

```tsx
// app/page.tsx
'use client'
import dynamic from 'next/dynamic'
const AirspaceMap = dynamic(() => import('@/components/AirspaceMap'), { ssr: false })

export default function Page() {
  return (
    <div className="w-screen h-screen">
      <AirspaceMap flights={[]} simTime={0} liveFlights={[]}
        activeTFRs={[]} extraTFRs={[]} airports={[]} mode="sim" />
    </div>
  )
}
```

**Verify:** `npm run dev` -- dark map fills screen at http://localhost:3000.

```bash
git add components/AirspaceMap.tsx app/page.tsx
git commit -m "feat: add base Leaflet map with dark CartoDB tiles"
```

---

## Task 6 — FlightMarker (Simulation Mode)

**Creates:** `components/FlightMarker.tsx`

```tsx
// components/FlightMarker.tsx
'use client'

import { useMemo } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { getFlightPosition } from '@/lib/simulation'
import type { Flight } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  enroute:   '#22d3ee',
  diverted:  '#f97316',
  grounded:  '#6b7280',
  scheduled: '#a78bfa',
  landed:    '#4ade80',
}

function makeIcon(heading: number, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="transform:rotate(${heading}deg);font-size:22px;color:${color};text-shadow:0 0 6px ${color}88;line-height:1;">&#x2708;</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

export default function FlightMarker({ flight, simTime }: { flight: Flight; simTime: number }) {
  const pos = getFlightPosition(flight, simTime)
  if (!pos) return null

  const color = STATUS_COLORS[flight.status] ?? '#ffffff'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const icon = useMemo(() => makeIcon(pos.heading, color), [pos.heading, color])

  return (
    <Marker position={[pos.lat, pos.lng]} icon={icon}>
      <Tooltip direction="top" offset={[0, -14]}>
        <div className="text-xs font-mono leading-tight">
          <div className="font-bold">{flight.callsign}</div>
          <div>{flight.origin} to {flight.destination}</div>
          <div style={{ color }}>Status: {flight.status.toUpperCase()}</div>
          <div className="text-gray-400">{pos.lat.toFixed(2)}N {Math.abs(pos.lng).toFixed(2)}W</div>
        </div>
      </Tooltip>
    </Marker>
  )
}
```

```bash
git add components/FlightMarker.tsx && git commit -m "feat: add sim-mode flight marker"
```

---

## Task 7 — LiveFlightMarker (Live Mode)

**Creates:** `components/LiveFlightMarker.tsx`

```tsx
// components/LiveFlightMarker.tsx
'use client'

import { useMemo } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { LiveFlight } from '@/lib/types'

function makeIcon(heading: number, onGround: boolean): L.DivIcon {
  const color = onGround ? '#6b7280' : '#22d3ee'
  return L.divIcon({
    className: '',
    html: `<div style="transform:rotate(${heading}deg);font-size:18px;color:${color};text-shadow:0 0 6px ${color}88;line-height:1;">&#x2708;</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

export default function LiveFlightMarker({ flight }: { flight: LiveFlight }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const icon = useMemo(() => makeIcon(flight.heading, flight.onGround), [flight.heading, flight.onGround])

  return (
    <Marker position={[flight.lat, flight.lng]} icon={icon}>
      <Tooltip direction="top" offset={[0, -12]}>
        <div className="text-xs font-mono leading-tight">
          <div className="font-bold">{flight.callsign}</div>
          <div className="text-gray-400">{flight.country}</div>
          <div className="text-cyan-400">{flight.lat.toFixed(2)}N {Math.abs(flight.lng).toFixed(2)}W</div>
          <div className="text-gray-400">
            Alt: {Math.round(flight.altitude)}m · {Math.round(flight.velocity * 1.944)} kts
          </div>
          {flight.onGround && <div className="text-yellow-400">ON GROUND</div>}
        </div>
      </Tooltip>
    </Marker>
  )
}
```

```bash
git add components/LiveFlightMarker.tsx && git commit -m "feat: add live-mode flight marker from OpenSky"
```

---

## Task 8 — TFR Zone Overlay

**Creates:** `components/TFRZone.tsx`

```tsx
// components/TFRZone.tsx
'use client'

import { Polygon, Tooltip } from 'react-leaflet'
import type { TFRZone as TFRZoneType } from '@/lib/types'

export default function TFRZone({ zone }: { zone: TFRZoneType }) {
  const isDanger    = zone.severity === 'danger'
  const fillColor   = isDanger ? '#ef4444' : '#f59e0b'
  const borderColor = isDanger ? '#fca5a5' : '#fcd34d'
  const positions   = zone.polygon.map(p => [p.lat, p.lng] as [number, number])

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color:       borderColor,
        fillColor,
        fillOpacity: 0.25,
        weight:      2,
        dashArray:   isDanger ? undefined : '6 4',
        className:   'tfr-pulse',
      }}
    >
      <Tooltip sticky>
        <div className="text-xs font-mono leading-tight max-w-xs">
          <div className="font-bold" style={{ color: fillColor }}>{zone.label}</div>
          <div className="text-gray-300 mt-1">{zone.reason}</div>
        </div>
      </Tooltip>
    </Polygon>
  )
}
```

```bash
git add components/TFRZone.tsx && git commit -m "feat: add pulsing TFR polygon overlay"
```

---

## Task 9 — Wire All Layers Into AirspaceMap

**Modifies:** `components/AirspaceMap.tsx`

```tsx
// components/AirspaceMap.tsx
'use client'

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline } from 'react-leaflet'
import FlightMarker     from '@/components/FlightMarker'
import LiveFlightMarker from '@/components/LiveFlightMarker'
import TFRZone          from '@/components/TFRZone'
import type { Flight, LiveFlight, TFRZone as TFRZoneType, Airport } from '@/lib/types'

export interface AirspaceMapProps {
  flights:     Flight[]
  simTime:     number
  liveFlights: LiveFlight[]
  activeTFRs:  TFRZoneType[]
  extraTFRs:   TFRZoneType[]
  airports:    Airport[]
  mode:        'sim' | 'live'
}

export default function AirspaceMap({
  flights, simTime, liveFlights, activeTFRs, extraTFRs, airports, mode,
}: AirspaceMapProps) {
  return (
    <MapContainer center={[24.0, -78.0]} zoom={5} className="w-full h-full">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
      />

      {/* Planned route trails -- sim mode only */}
      {mode === 'sim' && flights.map(f => (
        <Polyline
          key={`route-${f.id}`}
          positions={f.waypoints.map(w => [w.lat, w.lng] as [number, number])}
          pathOptions={{ color: '#374151', weight: 1, dashArray: '4 4', opacity: 0.6 }}
        />
      ))}

      {/* TFR zones (both modes) */}
      {[...activeTFRs, ...extraTFRs].map(zone => (
        <TFRZone key={zone.id} zone={zone} />
      ))}

      {/* Airport reference markers */}
      {airports.map(ap => (
        <CircleMarker
          key={ap.icao}
          center={[ap.position.lat, ap.position.lng]}
          radius={5}
          pathOptions={{ color: '#6366f1', fillColor: '#818cf8', fillOpacity: 1, weight: 1 }}
        >
          <Tooltip permanent direction="right" offset={[8, 0]}>
            <span className="text-[10px] font-mono text-indigo-300">{ap.icao}</span>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Flight markers -- mode-switched */}
      {mode === 'sim'
        ? flights.map(f     => <FlightMarker     key={f.id}     flight={f} simTime={simTime} />)
        : liveFlights.map(f => <LiveFlightMarker key={f.icao24} flight={f} />)
      }
    </MapContainer>
  )
}
```

```bash
git add components/AirspaceMap.tsx && git commit -m "feat: wire all map layers -- markers, TFRs, airports, trails"
```

---

## Task 10 — Simulation Controls

**Creates:** `components/SimulationControls.tsx`

```tsx
// components/SimulationControls.tsx
'use client'

import { Play, Pause, Zap } from 'lucide-react'
import { simTimeToDisplay } from '@/lib/simulation'

const SPEEDS       = [1, 10, 60, 120]
const SIM_DURATION = 12000

interface SimulationControlsProps {
  simTime:      number
  isPlaying:    boolean
  speed:        number
  onTogglePlay: () => void
  onSetSpeed:   (speed: number) => void
}

export default function SimulationControls({
  simTime, isPlaying, speed, onTogglePlay, onSetSpeed,
}: SimulationControlsProps) {
  const progress = Math.min((simTime / SIM_DURATION) * 100, 100)

  return (
    <div className="flex flex-col gap-2 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-5 py-3 shadow-xl">
      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-cyan-500 transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onTogglePlay}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="flex items-center gap-1">
          <Zap size={13} className="text-yellow-400" />
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                speed === s
                  ? 'bg-yellow-500 text-black font-bold'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="ml-auto font-mono text-cyan-400 text-sm tracking-wider">
          {simTimeToDisplay(simTime)}
        </div>
      </div>
    </div>
  )
}
```

```bash
git add components/SimulationControls.tsx && git commit -m "feat: add simulation playback controls"
```

---

## Task 11 — Event Feed Sidebar

**Creates:** `components/EventFeed.tsx`

```tsx
// components/EventFeed.tsx
'use client'

import { AlertTriangle, Info, Radio, Zap } from 'lucide-react'
import { simTimeToDisplay } from '@/lib/simulation'
import type { SimEvent } from '@/lib/types'

const ICONS = {
  info:    <Info          size={13} className="text-cyan-400   shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={13} className="text-yellow-400 shrink-0 mt-0.5" />,
  danger:  <Radio         size={13} className="text-red-400    shrink-0 mt-0.5 animate-pulse" />,
}

interface EventFeedProps {
  events:              SimEvent[]
  onInjectRandomEvent: () => void
}

export default function EventFeed({ events, onInjectRandomEvent }: EventFeedProps) {
  return (
    <div className="flex flex-col h-full bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Radio size={14} className="text-red-400 animate-pulse" />
          Live Event Feed
        </div>
        <button
          onClick={onInjectRandomEvent}
          className="flex items-center gap-1.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded-lg px-2.5 py-1.5 transition-colors font-medium"
        >
          <Zap size={11} />
          Inject Event
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 && (
          <p className="text-gray-500 text-xs text-center mt-6">No events -- start simulation</p>
        )}
        {[...events].reverse().map(ev => (
          <div key={ev.id} className="flex gap-2 text-xs leading-snug bg-gray-800/60 rounded-lg px-3 py-2">
            {ICONS[ev.type]}
            <div>
              <div className="font-mono text-gray-400 text-[10px]">{simTimeToDisplay(ev.simTime)}</div>
              <div className="text-gray-200 mt-0.5">{ev.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

```bash
git add components/EventFeed.tsx && git commit -m "feat: add event feed sidebar with inject button"
```

---

## Task 12 — Wire Everything in page.tsx

**Replaces:** `app/page.tsx`

All state lives here. Sim mode: tick loop at 100ms intervals. Live mode: OpenSky poll every 10s.

```tsx
// app/page.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import SimulationControls from '@/components/SimulationControls'
import EventFeed          from '@/components/EventFeed'
import { getActiveTFRs, generateRandomTFR } from '@/lib/simulation'
import { fetchLiveFlights }                  from '@/lib/opensky'
import { MOCK_FLIGHTS }                      from '@/lib/data/flights'
import { MOCK_TFRS }                         from '@/lib/data/tfr'
import { AIRPORTS }                          from '@/lib/data/airports'
import type { TFRZone, SimEvent, LiveFlight } from '@/lib/types'

const AirspaceMap = dynamic(() => import('@/components/AirspaceMap'), { ssr: false })

const TICK_MS      = 100
const SIM_DURATION = 12000
const LIVE_POLL_MS = 10_000

export default function Page() {
  const [mode, setMode]             = useState<'sim' | 'live'>('sim')

  // Sim state
  const [simTime, setSimTime]       = useState(0)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [speed, setSpeed]           = useState(60)

  // Live state
  const [liveFlights, setLiveFlights] = useState<LiveFlight[]>([])
  const [liveLoading, setLiveLoading] = useState(false)

  // Shared
  const [extraTFRs, setExtraTFRs] = useState<TFRZone[]>([])
  const [events, setEvents] = useState<SimEvent[]>([
    { id: 'init-0', simTime: 0, message: 'Simulation initialized. May 22, 2026 -- 17:00 EDT.', type: 'info' },
    { id: 'init-1', simTime: 0, message: 'Monitoring 4 flights in Florida-Caribbean FIR.',    type: 'info' },
  ])
  const firedEvents = useRef<Set<string>>(new Set())

  const addEvent = useCallback((ev: Omit<SimEvent, 'id'>) => {
    setEvents(prev => [...prev, { ...ev, id: `ev-${Date.now()}-${Math.random()}` }])
  }, [])

  // -- Sim tick --------------------------------------------------------------
  useEffect(() => {
    if (mode !== 'sim' || !isPlaying) return
    const interval = setInterval(() => {
      setSimTime(prev => {
        const next = prev + (TICK_MS / 1000) * speed
        return next >= SIM_DURATION ? SIM_DURATION : next
      })
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [mode, isPlaying, speed])

  useEffect(() => {
    if (simTime >= SIM_DURATION) setIsPlaying(false)
  }, [simTime])

  // Scripted sim events
  useEffect(() => {
    if (mode !== 'sim') return
    getActiveTFRs([...MOCK_TFRS, ...extraTFRs], simTime).forEach(tfr => {
      if (!firedEvents.current.has(tfr.id)) {
        firedEvents.current.add(tfr.id)
        addEvent({
          simTime,
          message: `TFR ACTIVATED: ${tfr.label} -- ${tfr.reason}`,
          type:    tfr.severity === 'danger' ? 'danger' : 'warning',
        })
      }
    })
    if (simTime >= 4800 && !firedEvents.current.has('b61575-diverted')) {
      firedEvents.current.add('b61575-diverted')
      addEvent({
        simTime,
        message: 'JetBlue 1575: entered TFR boundary -- executing emergency turn-back to KMIA.',
        type:    'danger',
      })
    }
  }, [simTime, mode, extraTFRs, addEvent])

  // -- Live polling ----------------------------------------------------------
  useEffect(() => {
    if (mode !== 'live') return
    async function poll() {
      setLiveLoading(true)
      const flights = await fetchLiveFlights()
      setLiveFlights(flights)
      setLiveLoading(false)
      addEvent({ simTime: 0, message: `Live feed updated -- ${flights.length} aircraft in region.`, type: 'info' })
    }
    poll()
    const interval = setInterval(poll, LIVE_POLL_MS)
    return () => clearInterval(interval)
  }, [mode, addEvent])

  // -- Mode switch -----------------------------------------------------------
  function switchMode(next: 'sim' | 'live') {
    setIsPlaying(false)
    setMode(next)
    addEvent({
      simTime: 0,
      message: next === 'sim'
        ? 'Switched to simulation mode.'
        : 'Switched to live mode -- polling OpenSky Network.',
      type: 'info',
    })
  }

  // -- Inject random TFR -----------------------------------------------------
  const handleInjectRandom = useCallback(() => {
    const newTFR = generateRandomTFR(simTime)
    setExtraTFRs(prev => [...prev, newTFR])
    addEvent({
      simTime,
      message: `Random TFR injected: ${newTFR.label} -- ${newTFR.reason}`,
      type:    newTFR.severity === 'danger' ? 'danger' : 'warning',
    })
  }, [simTime, addEvent])

  const activeTFRs = mode === 'sim' ? getActiveTFRs(MOCK_TFRS, simTime) : []

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Airspace Intelligence</h1>
          <p className="text-xs text-gray-500">
            {mode === 'sim'
              ? 'SpaceX Starship 12 -- May 22, 2026 Caribbean TFR Case Study'
              : 'Live ADS-B -- Florida-Caribbean via OpenSky Network'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => switchMode('sim')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'sim' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Simulation
          </button>
          <button
            onClick={() => switchMode('live')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'live' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {mode === 'live' && liveLoading && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            )}
            Live
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400  inline-block" /> En Route</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Diverted</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400    inline-block" /> TFR Danger</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> TFR Warning</span>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <AirspaceMap
            flights={MOCK_FLIGHTS}
            simTime={simTime}
            liveFlights={liveFlights}
            activeTFRs={activeTFRs}
            extraTFRs={extraTFRs}
            airports={AIRPORTS}
            mode={mode}
          />
        </div>
        <div className="w-72 shrink-0 p-3 overflow-hidden">
          <EventFeed events={events} onInjectRandomEvent={handleInjectRandom} />
        </div>
      </div>

      {/* Sim controls -- hidden in live mode */}
      {mode === 'sim' && (
        <div className="px-4 pb-4 pt-2 shrink-0">
          <SimulationControls
            simTime={simTime}
            isPlaying={isPlaying}
            speed={speed}
            onTogglePlay={() => setIsPlaying(p => !p)}
            onSetSpeed={setSpeed}
          />
        </div>
      )}
    </div>
  )
}
```

**Verify -- Simulation mode:**
- Dark map, airport labels visible
- Play at 60x: 4 aircraft appear and move along dashed trails
- At ~30 real seconds: red SpaceX TFR polygon pulses into view + event fires in sidebar
- At ~80 real seconds: JetBlue reverses toward Miami + danger event fires
- "Inject Event" spawns random polygon + sidebar entry
- Speed buttons change animation rate; progress bar and clock advance

**Verify -- Live mode:**
- Click "Live": sim controls disappear
- Green pulse dot during fetch
- Real aircraft over Florida/Caribbean
- Map auto-updates every 10 seconds; event feed logs count each cycle

```bash
git add app/page.tsx && git commit -m "feat: wire simulation + live OpenSky modes into page"
```

---

## Task Summary

| Task | File(s) | Purpose |
|------|---------|---------|
| 1  | scaffold | Next.js + deps + global CSS |
| 2  | `lib/types.ts`, `lib/data/*` | All interfaces + mock data |
| 3  | `lib/simulation.ts` | Position interpolation, TFR activation, random TFR generator |
| 4  | `lib/opensky.ts` | OpenSky fetch + state-vector normalization to LiveFlight |
| 5  | `components/AirspaceMap.tsx` | Leaflet shell, SSR-safe via dynamic() |
| 6  | `components/FlightMarker.tsx` | Sim-mode marker: interpolated pos + rotated aircraft icon |
| 7  | `components/LiveFlightMarker.tsx` | Live-mode marker: direct OpenSky lat/lng/heading |
| 8  | `components/TFRZone.tsx` | Pulsing danger/warning polygon, shared both modes |
| 9  | `components/AirspaceMap.tsx` | Wire all layers: trails, TFRs, airports, flight markers |
| 10 | `components/SimulationControls.tsx` | Play/pause, speed selector, sim clock, progress bar |
| 11 | `components/EventFeed.tsx` | Scrolling event log + inject random TFR button |
| 12 | `app/page.tsx` | All state, tick loop, OpenSky polling, mode toggle |
