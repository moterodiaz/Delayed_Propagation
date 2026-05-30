import { useState, useEffect, useRef } from 'react';

const TAG = {
  BREAKING: { bg: '#e53935', glow: 'rgba(229,57,53,0.45)', pulse: true },
  ALERT:    { bg: '#f4511e', glow: 'rgba(244,81,30,0.45)', pulse: false },
  UPDATE:   { bg: '#1e88e5', glow: 'rgba(30,136,229,0.4)', pulse: false },
  CLEARED:  { bg: '#43a047', glow: 'rgba(67,160,71,0.4)',  pulse: false },
};

const MAX = 4;

function NewsItem({ item, isNew, isLeaving }) {
  const t = TAG[item.tag];
  return (
    <div style={{
      animation: isNew ? 'slideInUp 0.45s ease forwards'
                : isLeaving ? 'fadeOutUp 0.45s ease forwards' : 'none',
      background: 'rgba(6,16,38,0.92)',
      border: `1px solid ${t.bg}28`,
      borderLeft: `3px solid ${t.bg}`,
      borderRadius: 5,
      padding: '10px 12px',
      marginBottom: 8,
      boxShadow: `0 0 14px ${t.glow}, inset 0 0 20px rgba(0,0,0,0.3)`,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
          color: '#fff', background: t.bg,
          padding: '2px 7px', borderRadius: 3,
          boxShadow: `0 0 10px ${t.glow}`,
          animation: t.pulse ? 'pulse 0.9s infinite' : 'none',
        }}>{item.tag}</span>
        <span style={{ fontSize:10, color:'#4a6a8a', fontFamily:'monospace', letterSpacing:1 }}>
          {item.time}
        </span>
      </div>
      <p style={{ margin:0, fontSize:12, color:'#b8d4ec', lineHeight:1.55, letterSpacing:0.2 }}>
        {item.headline}
      </p>
    </div>
  );
}

export default function NewsFeed({ items }) {
  const [visible, setVisible] = useState([]);
  const [leaving, setLeaving] = useState(new Set());
  const [entering, setEntering] = useState(new Set());
  const prev = useRef([]);

  useEffect(() => {
    const prevIds = new Set(prev.current.map(i => i.id));
    const added = items.filter(i => !prevIds.has(i.id));
    if (!added.length) return;

    setEntering(new Set(added.map(i => i.id)));
    setTimeout(() => setEntering(new Set()), 500);

    setVisible(old => {
      const next = [...old, ...added];
      if (next.length > MAX) {
        const toGo = new Set(next.slice(0, next.length - MAX).map(i => i.id));
        setLeaving(toGo);
        setTimeout(() => {
          setVisible(v => v.filter(i => !toGo.has(i.id)));
          setLeaving(new Set());
        }, 480);
      }
      return next;
    });

    prev.current = items;
  }, [items]);

  return (
    <div style={{
      background: 'rgba(2,8,22,0.97)',
      borderRight: '1px solid rgba(0,160,255,0.1)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '11px 14px',
        borderBottom: '1px solid rgba(0,160,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0,
      }}>
        <div style={{
          width:7, height:7, borderRadius:'50%',
          background:'#e53935', boxShadow:'0 0 10px #e53935',
          animation:'pulse 0.9s infinite', flexShrink:0,
        }}/>
        <span style={{ fontSize:9, fontWeight:700, color:'#4a6a8a', letterSpacing:3 }}>
          LIVE FEED
        </span>
        <span style={{ marginLeft:'auto', fontSize:10, color:'#ff6b35', fontFamily:'monospace' }}>
          {items.length > 0 ? `${items.length} events` : ''}
        </span>
      </div>

      {/* Items — pinned to bottom */}
      <div style={{
        flex:1, padding:'12px',
        overflow:'hidden',
        display:'flex', flexDirection:'column', justifyContent:'flex-end',
      }}>
        {visible.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <div style={{ fontSize:28, marginBottom:10, opacity:0.4 }}>📡</div>
            <div style={{ fontSize:11, color:'#2a4060', letterSpacing:2 }}>
              MONITORING FEEDS
            </div>
            <div style={{
              marginTop:8, fontSize:10, color:'#1a2840',
              animation:'blink 2s infinite',
            }}>
              ● ● ●
            </div>
          </div>
        ) : (
          visible.map(item => (
            <NewsItem
              key={item.id}
              item={item}
              isNew={entering.has(item.id)}
              isLeaving={leaving.has(item.id)}
            />
          ))
        )}
      </div>

      {/* Footer ticker */}
      <div style={{
        padding:'7px 14px',
        borderTop:'1px solid rgba(0,160,255,0.07)',
        display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0,
      }}>
        <span style={{ fontSize:9, color:'#1e3050', letterSpacing:1.5 }}>
          FAA · FLIGHTAWARE · OPENSKY</span> 
          <span style={{ fontSize:9, color:'#00c8ff', animation:'blink 1.5s infinite' }}>● LIVE</span> 
          </div> 
        </div> ); 
    } 