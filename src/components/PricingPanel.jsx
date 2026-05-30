import { useState } from 'react';

const OPTIONS = [
  {
    id:'surge', icon:'📈', label:'Surge Pricing', recommended:true,
    desc:'Dynamic increase on affected Gulf routes based on demand spike',
    detail:'IAH→MEX +18%  ·  MIA→MEX +15%',
    impact:'+$412K', risk:'LOW', rc:'#43a047',
  },
  {
    id:'reroute', icon:'🔄', label:'Reroute Incentive', recommended:false,
    desc:'Discount passengers who accept longer alternate routing',
    detail:'DFW→CUN −12%  ·  HOU→GDL −10%',
    impact:'+$187K', risk:'LOW', rc:'#43a047',
  },
  {
    id:'bundle', icon:'🤖', label:'AI Dynamic Bundle', recommended:false,
    desc:'ML-optimized blended strategy across all affected routes',
    detail:'All 4 routes  ·  adaptive real-time',
    impact:'+$614K', risk:'MED', rc:'#ffc107',
  },
];

export default function PricingPanel({ tick }) {
  const [active, setActive] = useState(null);
  const visible = tick >= 400;

  return (
    <div style={{
      flexShrink:0,
      background:'rgba(2,6,18,0.98)',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      <div style={{
        padding:'11px 14px', flexShrink:0,
        borderBottom:'1px solid rgba(0,160,255,0.07)',
        display:'flex', alignItems:'center', gap:8,
      }}>
        <span style={{ fontSize:13 }}>💰</span>
        <span style={{ fontSize:9, fontWeight:700, color:'#4a6a8a', letterSpacing:3 }}>
          PRICING STRATEGIES
        </span>
        {active && (
          <span style={{ marginLeft:'auto', fontSize:9, color:'#43a047', letterSpacing:1 }}>
            ✓ ACTIVE
          </span>
        )}
      </div>

      <div style={{ overflowY:'auto', padding:'10px' }}>
        {!visible ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:20, opacity:0.25, marginBottom:6 }}>⏳</div>
            <div style={{ fontSize:10, color:'#1e3050', letterSpacing:2 }}>
              AWAITING IMPACT DATA
            </div>
          </div>
        ) : OPTIONS.map(o => (
          <div
            key={o.id}
            onClick={() => setActive(o.id)}
            style={{
              animation:'slideInUp 0.4s ease forwards',
              cursor:'pointer', position:'relative',
              background: active===o.id ? 'rgba(0,200,255,0.07)' : 'rgba(6,16,38,0.85)',
              border: active===o.id
                ? '1px solid rgba(0,200,255,0.35)'
                : '1px solid rgba(0,160,255,0.1)',
              borderRadius:5, padding:'10px 12px', marginBottom:8,
              transition:'all 0.2s ease',
              boxShadow: active===o.id ? '0 0 16px rgba(0,200,255,0.12)' : 'none',
            }}
          >
            {o.recommended && (
              <div style={{
                position:'absolute', top:0, right:10,
                fontSize:8, fontWeight:800, letterSpacing:1,
                color:'#050d1a', background:'#43a047',
                padding:'2px 7px', borderRadius:'0 0 4px 4px',
              }}>RECOMMENDED</div>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
              <span style={{ fontSize:13 }}>{o.icon}</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#c8e0f8' }}>{o.label}</span>
              <span style={{
                marginLeft:'auto', fontSize:13, fontWeight:700,
                color:'#00ff88', fontFamily:'monospace',
              }}>{o.impact}</span>
            </div>

            <p style={{ margin:'0 0 5px', fontSize:11, color:'#4a6a8a', lineHeight:1.4 }}>
              {o.desc}
            </p>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:10, color:'#2a4060', fontFamily:'monospace' }}>{o.detail}</span>
              <span style={{ fontSize:9, fontWeight:700, color:o.rc, letterSpacing:1 }}>
                {o.risk} RISK
              </span>
            </div>

            {active === o.id && (
              <div style={{
                marginTop:8, paddingTop:8,
                borderTop:'1px solid rgba(0,200,255,0.12)',
                display:'flex', alignItems:'center', gap:6,
                fontSize:10, color:'#00c8ff',
              }}>
                <div style={{
                  width:6, height:6, borderRadius:'50%',
                  background:'#00ff88', boxShadow:'0 0 8px #00ff88',
                  animation:'pulse 1s infinite', flexShrink:0,
                }}/>
                Applying to live pricing engine...
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}