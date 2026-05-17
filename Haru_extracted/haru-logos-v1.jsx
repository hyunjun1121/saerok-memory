// Haru — v1 logos (typography / wordmark-based)
// Kept alongside v2 image-only SVG marks so both directions can be compared.

function LogoV1Sprout() {
  return (
    <div style={{
      width: '100%', height: '100%', background: 'var(--cream)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 18, padding: 32, boxSizing: 'border-box', position: 'relative',
    }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
        <span className="serif" style={{ fontStyle: 'italic', fontSize: 156, lineHeight: 0.9, color: 'var(--ink)', letterSpacing: '-0.02em' }}>haru</span>
        <svg width="46" height="58" viewBox="0 0 46 58" style={{ position: 'absolute', left: 142, top: -22 }}>
          <path d="M23 56 C 23 36, 23 22, 23 6" stroke="var(--sage-deep)" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
          <path d="M23 28 C 9 26, 4 18, 6 6 C 18 6, 24 14, 23 28 Z" fill="var(--sage)"/>
          <path d="M23 18 C 36 16, 42 10, 41 0 C 31 0, 24 6, 23 18 Z" fill="var(--sage-deep)"/>
        </svg>
      </div>
      <div style={{ fontFamily: 'Pretendard Variable', fontSize: 16, letterSpacing: '0.42em', color: 'var(--ink-soft)', textTransform: 'uppercase', paddingLeft: '0.42em' }}>하루 한 번, 마음에 봄</div>
    </div>
  );
}

function LogoV1Korean() {
  return (
    <div style={{
      width: '100%', height: '100%', background: 'var(--paper)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: 32, boxSizing: 'border-box',
    }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="kor-serif" style={{ fontWeight: 700, fontSize: 148, lineHeight: 0.9, color: 'var(--ink)', letterSpacing: '-0.04em' }}>하루</span>
        <svg width="28" height="28" viewBox="0 0 28 28" style={{ marginLeft: -6, marginBottom: 6 }}>
          <path d="M14 4 C 22 6, 26 12, 24 22 C 14 24, 6 18, 8 8 C 10 6, 12 5, 14 4 Z" fill="var(--coral)"/>
          <path d="M11 18 C 14 14, 18 12, 22 12" stroke="var(--cream)" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="serif" style={{ fontStyle: 'italic', fontSize: 32, color: 'var(--ink-soft)', letterSpacing: '0.02em', marginTop: 4 }}>haru · 春</div>
    </div>
  );
}

function LogoV1Roundel() {
  const mark = (
    <svg width="132" height="132" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r="76" fill="var(--sun)"/>
      <path d="M0 102 Q 80 96 160 102 L 160 160 L 0 160 Z" fill="var(--sage-tint)"/>
      <path d="M80 132 C 80 112, 80 96, 80 78" stroke="var(--sage-deep)" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M80 104 C 56 100, 46 84, 50 64 C 72 66, 82 80, 80 104 Z" fill="var(--sage)"/>
      <path d="M80 94 C 104 92, 116 78, 114 58 C 92 58, 82 70, 80 94 Z" fill="var(--sage-deep)"/>
    </svg>
  );
  return (
    <div style={{
      width: '100%', height: '100%', background: 'var(--cream)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 18, padding: 32, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        {mark}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="serif" style={{ fontStyle: 'italic', fontSize: 110, lineHeight: 0.85, color: 'var(--ink)', letterSpacing: '-0.02em' }}>haru</span>
          <span style={{ fontFamily: 'Pretendard Variable', fontWeight: 500, fontSize: 16, letterSpacing: '0.32em', color: 'var(--ink-soft)', paddingLeft: 4 }}>새 록 정 원</span>
        </div>
      </div>
    </div>
  );
}

function LogoV1GardenTile() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, #FAE9C2 0%, #F5DCA0 55%, #DDC684 100%)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: 36, boxSizing: 'border-box',
    }}>
      <div style={{
        position: 'absolute', top: 38, right: 56,
        width: 92, height: 92, borderRadius: '50%',
        background: 'radial-gradient(circle, #FFEEC1 0%, #F4C25C 70%, #E2A53A 100%)',
        boxShadow: '0 0 60px rgba(244, 178, 92, 0.6)',
      }}/>
      <svg viewBox="0 0 520 240" width="100%" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} preserveAspectRatio="none">
        <path d="M0 120 Q 130 80 260 110 T 520 100 L 520 240 L 0 240 Z" fill="#9CC2A2" opacity="0.7"/>
        <path d="M0 170 Q 130 140 260 160 T 520 150 L 520 240 L 0 240 Z" fill="#6FA37C"/>
        {[80, 150, 220, 310, 380, 440].map((x, i) => (
          <g key={i}>
            <path d={`M${x} 220 C ${x} 200, ${x} 184, ${x} 174`} stroke="#3F7456" strokeWidth="2" fill="none"/>
            <path d={`M${x} 192 C ${x-10} 188, ${x-14} 180, ${x-12} 172 C ${x-4} 174, ${x-1} 182, ${x} 192 Z`} fill="#3F7456"/>
            <path d={`M${x} 184 C ${x+10} 180, ${x+14} 172, ${x+12} 164 C ${x+4} 166, ${x+1} 174, ${x} 184 Z`} fill="#3F7456"/>
          </g>
        ))}
      </svg>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div className="serif" style={{ fontStyle: 'italic', fontSize: 96, lineHeight: 0.9, color: '#2A2620', letterSpacing: '-0.02em' }}>haru<span style={{ color: '#E08A6E' }}>.</span></div>
        <div style={{ fontFamily: 'Pretendard Variable', fontSize: 15, marginTop: 8, color: 'var(--ink)', opacity: 0.78, letterSpacing: '0.04em' }}>하루를 잇고, 마음에 봄을 더하다</div>
      </div>
    </div>
  );
}

Object.assign(window, { LogoV1Sprout, LogoV1Korean, LogoV1Roundel, LogoV1GardenTile });
