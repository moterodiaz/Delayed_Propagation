import { useState, useEffect } from 'react';
import NewsFeed from './components/NewsFeed';
import FlightMap from './components/FlightMap';
import AlertPanel from './components/AlertPanel';
import PricingPanel from './components/PricingPanel';
import { newsTimeline } from './data/newsData';
import { flights } from './data/flightData';

const SIM_START = new Date('2025-05-22T05:30:00');
const SIM_STEP  = 30000; // 30 sim-seconds per tick

export default function App() {
  const [tick, setTick]       = useState(0);
  const [simTime, setSimTime] = useState(SIM_START);
  const [news, setNews]       = useState([]);
  const [showTFR, setShowTFR] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => {
        const n = t + 1;
        setSimTime(new Date(SIM_START.getTime() + n * SIM_STEP));
        return n;
      });
    }, 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const hit = newsTimeline.filter(n => n.tick === tick);
    if (!hit.length) return;
    setNews(p => [...p, ...hit]);
    if (hit.some(n => n.id === 5)) setShowTFR(true);
    if (hit.some(n => n.id === 9)) setShowTFR(false);
  }, [tick]);

  const fmt = d => d.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true, timeZone: 'America/Chicago',
  }) + ' CDT';

  const footerStats = [
    { label: 'FLIGHTS AFFECTED', val: tick>=160 ? '31' : tick>=80 ? '12' : '0',         c: '#ff6b35' },
    { label: 'AVG DELAY',        val: tick>=310 ? '47 MIN' : tick>=160 ? '22 MIN' : '—', c: '#ffc107' },
    { label: 'TFR STATUS',       val: showTFR ? 'ACTIVE' : tick>=555 ? 'LIFTING' : 'PENDING',
      c: showTFR ? '#ff3355' : tick>=555 ? '#ffc107' : '#3a5a7a' },
    { label: 'REVENUE IMPACT',   val: tick>=340 ? '−$2.3M' : tick>=160 ? '−$0.8M' : '$0', c: '#ff3355' },
    { label: 'MONITORED',        val: `${flights.length} FLIGHTS`, c: '#00e5ff' },
  ];

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#040c1e',
      display: 'grid',
      gridTemplateRows: '54px 1fr 44px',
      overflow: 'hidden',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>

      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', padding: '0 18px',
        background: 'rgba(2,6,18,0.98)',
        borderBottom: '1px solid rgba(0,160,255,0.12)',
        zIndex: 200,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontSize: 18, fontWeight: 900,
            color: '#00c8ff', letterSpacing: 3,
          }}>
            ✈ AEROPRICE
          </div>
          <div style={{
            fontSize: 9, color: '#00c8ff', letterSpacing: 3,
            padding: '2px 8px',
            border: '1px solid rgba(0,200,255,0.25)',
            borderRadius: 3,
          }}>
            CRISIS MODE
          </div>
        </div>

        <div style={{ margin: '0 20px', color: '#1a2840', fontSize: 12 }}>◆</div>

        <div style={{ fontSize: 11, color: '#3a5a7a', letterSpacing: 1.5 }}>
          INCIDENT · SpaceX Starship Flight 9 · Boca Chica TFR · May 22 2025
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#2a4060', letterSpacing: 2.5, marginBottom: 2 }}>
              SIM TIME (CDT)
            </div>
            <div style={{
              fontSize: 14, color: '#00c8ff',
              fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1,
            }}>
              {fmt(simTime)}
            </div>
          </div>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#00ff88', boxShadow: '0 0 10px #00ff88',
            animation: 'pulse 2s infinite',
          }} />
        </div>
      </header>

      {/* ── Main Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '285px 1fr 345px',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <NewsFeed items={news} />

        <FlightMap tick={tick} showTFR={showTFR} />

        <div style={{
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid rgba(0,160,255,0.09)',
          overflow: 'hidden', minHeight: 0,
        }}>
          <AlertPanel tick={tick} />
          <PricingPanel tick={tick} />
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{
        display: 'flex', alignItems: 'center',
        padding: '0 18px', gap: 28,
        background: 'rgba(1,4,12,0.98)',
        borderTop: '1px solid rgba(0,160,255,0.09)',
        zIndex: 200,
      }}>
        {footerStats.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 9, color: '#2a4060', letterSpacing: 2 }}>
              {s.label}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700,
              fontFamily: 'monospace', color: s.c,
              textShadow: `0 0 8px ${s.c}60`,
            }}>
              {s.val}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 9, color: '#1a2840', letterSpacing: 2 }}>
          FAA TFMS · HRRR · OPENSKY · GDELT
        </div>
      </footer>

    </div>
  );
}