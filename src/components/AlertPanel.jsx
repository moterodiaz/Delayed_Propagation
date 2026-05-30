import { useState, useEffect, useRef } from 'react';

const ALERTS = [
  { tick:100, sev:'critical', icon:'⚠️', title:'TFR IMPACT DETECTED',
    msg:'31 flights entering restricted Gulf corridor. Rerouting protocol active — 4 primary carriers affected with avg 280nm path extension.' },
  { tick:220, sev:'warning',  icon:'📊', title:'DELAY CASCADE ANALYSIS',
    msg:'Avg delay 47 min/flight. Cascading impact on 12 downstream connections at ORD, ATL, DFW. Ground crew realignment required.' },
  { tick:340, sev:'critical', icon:'💸', title:'REVENUE EXPOSURE',
    msg:'Projected impact $2.3M across affected carriers. Fuel surcharge delta +$14K/flight. Window for dynamic pricing intervention: NOW.' },
  { tick:430, sev:'info',     icon:'🤖', title:'AI RECOMMENDATION',
    msg:'Activate surge pricing IAH→MEX +18%, MIA→MEX +15%. Offer reroute incentive -12% on alt paths. Estimated recovery: +$614K.' },
];

const SEV = {
  critical: { c:'#ff3355', bg:'rgba(255,51,85,0.07)',  border:'rgba(255,51,85,0.28)' },
  warning:  { c:'#ffc107', bg:'rgba(255,193,7,0.07)',  border:'rgba(255,193,7,0.28)' },
  info:     { c:'#00c8ff', bg:'rgba(0,200,255,0.07)', border:'rgba(0,200,255,0.28)' },
};

function Typewriter({ text }) {
  const [out, setOut] = useState('');
  const i = useRef(0);
  useEffect(() => {
    setOut(''); i.current = 0;
    const t = setInterval(() => {
      if (i.current < text.length) { setOut(text.slice(0, ++i.current)); }
      else clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [text]);
  return <>{out}<span style={{ animation:'blink 0.8s infinite', opacity: out.length < text.length ? 1 : 0 }}>▋</span></>;
}

export default function AlertPanel({ tick }) {
  const [shown, setShown] = useState([]);
  const seen = useRef(new Set());

  useEffect(() => {
    ALERTS.forEach(a => {
      if (tick >= a.tick && !seen.current.has(a.tick)) {
        seen.current.add(a.tick);
        setShown(s => [...s, a]);
      }
    });
  }, [tick]);

  return (
    <div style={{
      flex:1, minHeight:0,
      background:'rgba(2,8,22,0.97)',
      borderBottom:'1px solid rgba(0,160,255,0.09)',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      <div style={{
        padding:'11px 14px', flexShrink:0,
        borderBottom:'1px solid rgba(0,160,255,0.07)',
        display:'flex', alignItems:'center', gap:8,
      }}>
        <span style={{ fontSize:13 }}>🤖</span>
        <span style={{ fontSize:9, fontWeight:700, color:'#4a6a8a', letterSpacing:3 }}>AI ALERTS</span>
        {shown.length > 0 && (
          <span style={{
            marginLeft:'auto', background:'#ff3355', color:'#fff',
            fontSize:9, fontWeight:800, padding:'1px 7px', borderRadius:10,
          }}>{shown.length}</span>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'10px' }}>
        {shown.length === 0 ? (
          <div style={{ textAlign:'center', padding:'28px 0' }}>
            <div style={{ fontSize:22, opacity:0.3, marginBottom:8 }}>🛡️</div>
            <div style={{ fontSize:10, color:'#1e3050', letterSpacing:2 }}>MONITORING AIRSPACE</div>
          </div>
        ) : shown.map((a, i) => {
          const s = SEV[a.sev];
          return (
            <div key={a.tick} style={{
              animation:'slideInUp 0.4s ease forwards',
              background:s.bg, border:`1px solid ${s.border}`,
              borderLeft:`3px solid ${s.c}`,
              borderRadius:5, padding:'10px 12px', marginBottom:8,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                <span style={{ fontSize:12 }}>{a.icon}</span>
                <span style={{ fontSize:9, fontWeight:700, color:s.c, letterSpacing:1.5 }}>{a.title}</span>
              </div>
              <p style={{ margin:0, fontSize:11.5, color:'#9abcda', lineHeight:1.6 }}>
                {i === shown.length - 1 ? <Typewriter text={a.msg}/> : a.msg}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}