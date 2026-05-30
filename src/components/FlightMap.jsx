import { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Polygon, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { flights, TFR_ZONE, STARBASE } from '../data/flightData';

function lerp(waypoints, progress) {
  const p = Math.max(0, Math.min(1, progress));
  const total = waypoints.length - 1;
  const scaled = p * total;
  const idx = Math.min(Math.floor(scaled), total - 1);
  const frac = scaled - idx;
  const a = waypoints[idx], b = waypoints[idx + 1];
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
}

function bearing(a, b) {
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const dL = (b[1] - a[1]) * Math.PI / 180;
  const y = Math.sin(dL) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dL);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function planeIcon(deg, affected) {
  const c = affected ? '#ff6b35' : '#00e5ff';
  const g = affected ? 'rgba(255,107,53,0.55)' : 'rgba(0,229,255,0.55)';
  return L.divIcon({
    html: `<div style="transform:rotate(${deg - 45}deg);filter:drop-shadow(0 0 5px ${g})">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="${c}">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg></div>`,
    className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  });
}

function starbaseIcon() {
  return L.divIcon({
    html: `<div style="position:relative;width:14px;height:14px">
      <div style="position:absolute;inset:0;border-radius:50%;background:#ff3355;box-shadow:0 0 14px #ff3355"></div>
      <div style="position:absolute;inset:-4px;border-radius:50%;border:1px solid #ff335560;animation:ping 1.5s infinite"></div>
    </div>`,
    className: '', iconSize: [14, 14], iconAnchor: [7, 7],
  });
}

const SPEED = 1 / 600;

export default function FlightMap({ tick, showTFR }) {
  const states = useMemo(() => flights.map(f => {
    const prog = ((tick * SPEED) + f.phaseOffset) % 1;
    const pos = lerp(f.waypoints, prog);
    const next = lerp(f.waypoints, Math.min(prog + 0.012, 1));
    return { ...f, position: pos, bearing: bearing(pos, next) };
  }), [tick]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Scanline overlay */}
      <div style={{
        position:'absolute', inset:0, zIndex:800, pointerEvents:'none',
        background:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.018) 3px,rgba(0,0,0,0.018) 4px)',
      }}/>

      {/* Corner brackets */}
      {[{top:12,left:12},{top:12,right:12},{bottom:12,left:12},{bottom:12,right:12}].map((s,i) => (
        <div key={i} style={{
          position:'absolute', ...s, zIndex:900, pointerEvents:'none',
          width:20, height:20,
          borderTop: i < 2 ? '2px solid rgba(0,200,255,0.3)' : 'none',
          borderBottom: i >= 2 ? '2px solid rgba(0,200,255,0.3)' : 'none',
          borderLeft: i%2===0 ? '2px solid rgba(0,200,255,0.3)' : 'none',
          borderRight: i%2===1 ? '2px solid rgba(0,200,255,0.3)' : 'none',
        }}/>
      ))}

      {/* Top-left info */}
      <div style={{
        position:'absolute', top:20, left:20, zIndex:1000, pointerEvents:'none',
        background:'rgba(2,8,22,0.88)',
        border:'1px solid rgba(0,180,255,0.14)',
        borderRadius:5, padding:'8px 12px',
      }}>
        <div style={{ fontSize:9, color:'#3a5a7a', letterSpacing:2.5, marginBottom:5 }}>TRACKING</div>
        <div style={{ fontFamily:'monospace', color:'#00e5ff', fontSize:18, fontWeight:700, lineHeight:1 }}>
          {flights.length}
          <span style={{ fontSize:10, color:'#3a5a7a', marginLeft:4 }}>FLIGHTS</span>
        </div>
        <div style={{ fontFamily:'monospace', color:'#ff6b35', fontSize:13, fontWeight:700, marginTop:3 }}>
          {flights.filter(f=>f.affected).length}
          <span style={{ fontSize:9, color:'#3a5a7a', marginLeft:4 }}>AFFECTED</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position:'absolute', bottom:20, left:16, zIndex:1000, pointerEvents:'none',
        background:'rgba(2,8,22,0.88)',
        border:'1px solid rgba(0,180,255,0.12)',
        borderRadius:5, padding:'8px 12px',
      }}>
        <div style={{ fontSize:9, color:'#3a5a7a', letterSpacing:2.5, marginBottom:6 }}>LEGEND</div>
        {[
          { c:'#00e5ff', label:'Normal Flight' },
          { c:'#ff6b35', label:'TFR Affected' },
          { c:'#ff3355', label:'Restricted Zone' },
          { c:'#ff3355', label:'SpaceX Starbase' },
        ].map(({ c, label }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:c, boxShadow:`0 0 6px ${c}`, flexShrink:0 }}/>
            <span style={{ fontSize:10, color:'#8aadcc' }}>{label}</span>
          </div>
        ))}
      </div>

      <MapContainer
        center={[27.5, -92.0]} zoom={5}
        style={{ width:'100%', height:'100%' }}
        zoomControl={false} attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"/>

        {flights.map(f => (
          <Polyline key={`r-${f.id}`} positions={f.waypoints}
            pathOptions={{ color: f.affected ? '#ff6b3540' : '#00e5ff22', weight:1.5, dashArray:'5 8' }}
          />
        ))}

        {showTFR && (
          <Polygon positions={TFR_ZONE} pathOptions={{
            color:'#ff3355', fillColor:'#ff1744',
            fillOpacity:0.1, weight:2, dashArray:'10 5',
          }}/>
        )}

        <Marker position={STARBASE} icon={starbaseIcon()}>
          <Popup>
            <div style={{ fontWeight:700, color:'#ff3355', marginBottom:3 }}>🚀 SpaceX Starbase</div>
            <div style={{ color:'#8aadcc', fontSize:11 }}>Boca Chica, TX — Starship Flight 9</div>
          </Popup>
        </Marker>

        {states.map(f => (
          <Marker key={f.id} position={f.position} icon={planeIcon(f.bearing, f.affected)}>
            <Popup>
              <div style={{ fontWeight:700, color: f.affected ? '#ff6b35':'#00e5ff', marginBottom:4 }}>
                {f.callsign}
              </div>
              <div style={{ color:'#8aadcc', fontSize:11 }}>{f.from} → {f.to}</div>
              {f.affected && (
                <div style={{
                  marginTop:6, padding:'2px 7px', borderRadius:3,
                  background:'rgba(255,107,53,0.12)', color:'#ff6b35',
                  fontSize:10, fontWeight:600,
                }}>⚠ REROUTED — TFR IMPACT</div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}