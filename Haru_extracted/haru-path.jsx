// Haru — Path-style home (Duolingo-inspired, Haru palette)

// ─────────────────────────────────────────────────────────────
// Top status bar — streak + drops
// ─────────────────────────────────────────────────────────────
function TopBar({ streak = 12, drops = 27 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 22px 12px',
    }}>
      <div style={{ display: 'flex', gap: 18 }}>
        <Counter color="#E08A6E" value={streak} icon={
          <svg width="22" height="24" viewBox="0 0 22 24"><path d="M11 1 C 11 6, 17 8, 17 14 A 6 6 0 0 1 5 14 C 5 10, 8 9, 8 6 C 8 4, 9 2, 11 1 Z" fill="#E08A6E"/><path d="M11 8 C 11 11, 14 12, 14 15 A 3 3 0 0 1 8 15 C 8 13, 9 12, 9 11 C 9 10, 10 9, 11 8 Z" fill="#F4B27D"/></svg>
        }/>
        <Counter color="#3F7456" value={drops} icon={
          <svg width="20" height="24" viewBox="0 0 20 24"><path d="M10 2 C 10 2, 18 12, 18 16 A 8 8 0 0 1 2 16 C 2 12, 10 2, 10 2 Z" fill="#5A9966"/><path d="M7 8 C 5 10, 4 12, 4 14" stroke="#FFFEF8" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7"/></svg>
        }/>
      </div>
      <Mascot size={36}/>
    </div>
  );
}
function Counter({ value, icon, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {icon}
      <span style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'Pretendard Variable' }}>{value}</span>
    </div>
  );
}
function Mascot({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M50 30 C 50 20, 50 10, 50 6" stroke="#2C5840" strokeWidth="4" strokeLinecap="round" fill="none"/>
      <path d="M50 30 C 36 28, 28 20, 30 6 C 46 8, 54 18, 50 30 Z" fill="#3F7456"/>
      <path d="M50 30 C 64 28, 72 20, 70 6 C 54 8, 46 18, 50 30 Z" fill="#5A9966"/>
      <ellipse cx="50" cy="64" rx="32" ry="28" fill="#FFFEF8" stroke="#3F7456" strokeWidth="2"/>
      <circle cx="40" cy="60" r="3.2" fill="#2A2620"/>
      <circle cx="60" cy="60" r="3.2" fill="#2A2620"/>
      <path d="M42 72 Q 50 78 58 72" stroke="#2A2620" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Unit banner — chunky 3D card with section title
// ─────────────────────────────────────────────────────────────
function UnitBanner({ unit = 1, title = '오늘의 활동: 좋은 기억' }) {
  return (
    <div style={{ padding: '6px 22px 18px' }}>
      <div style={{
        background: '#5A9966',
        borderRadius: 22,
        padding: '18px 20px 22px',
        color: '#fff',
        boxShadow: '0 8px 0 #3F7456',
        position: 'relative',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', opacity: 0.85 }}>UNIT {unit}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, lineHeight: 1.3 }}>{title}</div>
        <div style={{
          position: 'absolute', right: 16, bottom: 16,
          width: 36, height: 36, borderRadius: 12,
          background: 'rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 16 16"><path d="M3 4 L 13 4 M 3 8 L 13 8 M 3 12 L 9 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Path node — chunky 3D circular button on a path
// ─────────────────────────────────────────────────────────────
function PathNode({ x, tone = 'sage', icon, ring, label, sub, locked, popupRight }) {
  const palettes = {
    sage:   { bg: '#5A9966', shadow: '#3F7456' },
    coral:  { bg: '#E08A6E', shadow: '#B86A52' },
    sun:    { bg: '#EFC25C', shadow: '#C99A36' },
    locked: { bg: '#D9CFB8', shadow: '#B8AC92' },
  };
  const p = palettes[tone] || palettes.sage;
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginLeft: x, marginTop: 18, marginBottom: 18 }}>
      {ring && (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          width: 102, height: 102, borderRadius: 51,
          border: '4px solid #5A9966',
          opacity: 0.55,
        }}/>
      )}
      <div style={{
        width: 82, height: 82, borderRadius: 41,
        background: p.bg, boxShadow: `0 8px 0 ${p.shadow}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 2,
      }}>
        {icon}
      </div>
      {label && (
        <div style={{
          position: 'absolute',
          [popupRight ? 'left' : 'right']: '52%',
          [popupRight ? 'marginLeft' : 'marginRight']: 18,
          top: 8,
          background: '#FFFEF8',
          borderRadius: 14, padding: '6px 12px',
          boxShadow: '0 4px 0 rgba(60,40,0,0.08), inset 0 0 0 1px var(--border)',
          minWidth: 92, textAlign: popupRight ? 'left' : 'right',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 1 }}>{sub}</div>}
        </div>
      )}
    </div>
  );
}

// path connecting line behind the nodes
function PathSpine() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 320 600" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <path d="M180 0 C 180 60, 100 90, 100 150 C 100 210, 220 230, 220 290 C 220 350, 110 360, 110 420 C 110 480, 200 490, 200 540 L 200 600"
        stroke="#E5D9BD" strokeWidth="22" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

// Path icons (white glyphs)
const IconCheck = (
  <svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 12 L 10 18 L 20 6" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const IconStar = (
  <svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 3 L 14.6 9.2 L 21.5 9.8 L 16.3 14.3 L 17.9 21 L 12 17.4 L 6.1 21 L 7.7 14.3 L 2.5 9.8 L 9.4 9.2 Z" fill="#fff"/></svg>
);
const IconMinus = (
  <svg width="40" height="40" viewBox="0 0 40 40"><text x="20" y="28" textAnchor="middle" fill="#fff" fontFamily="Pretendard Variable" fontWeight="800" fontSize="24">−7</text></svg>
);
const IconBrush = (
  <svg width="34" height="34" viewBox="0 0 24 24"><path d="M3 21 L 7 21 C 9 21, 10 19, 10 17 L 10 16 L 6 16 C 4 16, 3 18, 3 21 Z" fill="#fff"/><path d="M10 16 L 18 8 L 16 6 L 8 14 Z" fill="#fff"/><path d="M18 8 L 21 5 C 22 4, 22 3, 21 2 C 20 1, 19 1, 18 2 L 15 5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
);
const IconLock = (
  <svg width="30" height="30" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="11" rx="2" fill="#fff" opacity="0.85"/><path d="M8 11 V 8 A 4 4 0 0 1 16 8 V 11" stroke="#fff" strokeWidth="2.5" fill="none" opacity="0.85"/></svg>
);
const IconHeart = (
  <svg width="32" height="32" viewBox="0 0 24 24"><path d="M12 21 C 6 16, 2 12, 2 8 A 4 4 0 0 1 12 6 A 4 4 0 0 1 22 8 C 22 12, 18 16, 12 21 Z" fill="#fff"/></svg>
);

// ─────────────────────────────────────────────────────────────
// Bottom nav — rounded square highlight (path-app style)
// ─────────────────────────────────────────────────────────────
function PathBottomNav({ active = 'learn' }) {
  const items = [
    { k: 'learn', l: '학습', i: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M4 12 L 13 4 L 22 12 L 22 22 L 16 22 L 16 16 L 10 16 L 10 22 L 4 22 Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/></svg>
    )},
    { k: 'garden', l: '정원', i: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 5 C 8 5, 4 9, 4 14 C 4 16, 5 18, 7 19 C 7 14, 10 11, 13 11 C 16 11, 19 14, 19 19 C 21 18, 22 16, 22 14 C 22 9, 18 5, 13 5 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M13 11 L 13 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    )},
    { k: 'family', l: '가족', i: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="9" cy="10" r="3.2" stroke="currentColor" strokeWidth="2"/><circle cx="17" cy="10" r="3.2" stroke="currentColor" strokeWidth="2"/><path d="M3 22 C 3 17, 6 15, 9 15 C 12 15, 15 17, 15 22 M 11 22 C 11 18, 14 15, 17 15 C 20 15, 23 17, 23 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
    )},
  ];
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around', padding: '10px 18px 28px',
      background: '#FFFEF8',
      borderTop: '1px solid var(--border)',
    }}>
      {items.map(it => {
        const on = active === it.k;
        return (
          <div key={it.k} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 14,
            background: on ? 'var(--sage-tint)' : 'transparent',
            border: on ? '1.5px solid var(--sage)' : '1.5px solid transparent',
            color: on ? 'var(--sage-deep)' : 'var(--ink-muted)',
            minWidth: 70,
          }}>
            {it.i}
            <div style={{ fontSize: 12, fontWeight: 700 }}>{it.l}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN — path home screen
// ─────────────────────────────────────────────────────────────
function ScreenHomePath() {
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #FAF4E7 0%, #F4E8CD 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <StatusSpacer/>
      <TopBar streak={12} drops={27}/>
      <UnitBanner unit={1} title="오늘의 활동: 좋은 기억"/>

      {/* path zone */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <PathSpine/>
        <div style={{ position: 'relative', zIndex: 1, paddingTop: 4 }}>
          <PathNode x={70} tone="locked" icon={IconLock} label="내일 열려요" sub="기억 회상" popupRight/>
          <PathNode x={-70} tone="coral" icon={IconBrush} label="그림 그리기" sub="2분 · 다음 차례"/>
          <PathNode x={50} tone="sage" icon={IconMinus} ring label="숫자 빼기" sub="시작!" popupRight/>
          <PathNode x={-80} tone="sage" icon={IconCheck} label="사자성어" sub="완료 ✓"/>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 22px 12px' }}>
        <button style={{
          width: '100%', minHeight: 64,
          background: '#5A9966', color: '#fff', border: 'none',
          borderRadius: 22, fontSize: 20, fontWeight: 800,
          fontFamily: 'Pretendard Variable', cursor: 'pointer',
          boxShadow: '0 8px 0 #3F7456',
          letterSpacing: '0.02em',
        }}>계속하기</button>
      </div>

      <PathBottomNav active="learn"/>
    </div>
  );
}

Object.assign(window, { ScreenHomePath, TopBar, UnitBanner, PathBottomNav, Mascot });
