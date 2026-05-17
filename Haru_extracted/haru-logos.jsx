// Haru — Image-only SVG logos (no wordmark text)
// All marks built from primitive SVG paths. Each Logo* fits its artboard.

// ─────────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────────

function ChunkyMark({ children, bg = '#FAF4E7', radius = 56, size = 240, shadow = true }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, background: bg,
      boxShadow: shadow ? '0 10px 0 rgba(60,40,0,0.10), 0 28px 50px rgba(120,90,30,0.14), inset 0 0 0 1px rgba(0,0,0,0.04)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      position: 'relative',
    }}>{children}</div>
  );
}

function ArtboardStage({ children, bg = 'var(--cream)' }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 32, boxSizing: 'border-box',
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// A · 새싹 마스코트 — Haru sprout character
//     Round soft body, two leaves up top, gentle face. Friendly.
// ─────────────────────────────────────────────────────────────
function MarkSprout({ size = 220 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      {/* warm halo */}
      <circle cx="100" cy="105" r="86" fill="#FDE9B8" opacity="0.55"/>
      {/* body */}
      <ellipse cx="100" cy="128" rx="58" ry="54" fill="#7AB97F"/>
      {/* belly highlight */}
      <ellipse cx="100" cy="138" rx="38" ry="32" fill="#A8D6A7" opacity="0.7"/>
      {/* base shadow line */}
      <ellipse cx="100" cy="184" rx="36" ry="4" fill="#2C5840" opacity="0.18"/>
      {/* stem */}
      <path d="M100 78 C 100 64, 100 50, 100 36" stroke="#3F7456" strokeWidth="6" strokeLinecap="round" fill="none"/>
      {/* big back leaf */}
      <path d="M100 50 C 78 46, 64 32, 66 8 C 92 12, 104 28, 100 50 Z" fill="#3F7456"/>
      {/* front leaf */}
      <path d="M100 60 C 124 56, 138 40, 134 18 C 110 22, 96 38, 100 60 Z" fill="#5A9966"/>
      <path d="M118 28 C 124 36, 126 46, 124 54" stroke="#3F7456" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/>
      {/* face */}
      <g>
        {/* eyes */}
        <circle cx="82" cy="120" r="7" fill="#2A2620"/>
        <circle cx="118" cy="120" r="7" fill="#2A2620"/>
        <circle cx="84" cy="118" r="2.2" fill="#fff"/>
        <circle cx="120" cy="118" r="2.2" fill="#fff"/>
        {/* cheek blush */}
        <ellipse cx="74" cy="138" rx="8" ry="5" fill="#E08A6E" opacity="0.55"/>
        <ellipse cx="126" cy="138" rx="8" ry="5" fill="#E08A6E" opacity="0.55"/>
        {/* smile */}
        <path d="M88 140 Q 100 152, 112 140" stroke="#2A2620" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </g>
    </svg>
  );
}
function LogoSprout() {
  return <ArtboardStage><ChunkyMark><MarkSprout/></ChunkyMark></ArtboardStage>;
}

// ─────────────────────────────────────────────────────────────
// B · 햇살 새싹 로고 — sun-and-sprout roundel, app-icon ready
// ─────────────────────────────────────────────────────────────
function MarkSunSprout({ size = 220 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="sun-g" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#FFE9A8"/>
          <stop offset="65%" stopColor="#F1C25E"/>
          <stop offset="100%" stopColor="#DDA640"/>
        </radialGradient>
      </defs>
      {/* sun */}
      <circle cx="100" cy="100" r="92" fill="url(#sun-g)"/>
      {/* sun rays carved into rim */}
      {Array.from({length: 12}).map((_,i)=>{
        const a = (i * Math.PI*2/12) - Math.PI/2;
        const x1 = 100 + Math.cos(a)*92;
        const y1 = 100 + Math.sin(a)*92;
        const x2 = 100 + Math.cos(a)*102;
        const y2 = 100 + Math.sin(a)*102;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#DDA640" strokeWidth="3" strokeLinecap="round" opacity="0.45"/>;
      })}
      {/* hill horizon */}
      <path d="M0 130 Q 100 110 200 130 L 200 200 L 0 200 Z" fill="#7AB97F"/>
      <path d="M0 150 Q 100 138 200 150 L 200 200 L 0 200 Z" fill="#5A9966" opacity="0.85"/>
      {/* stem */}
      <path d="M100 168 C 100 140, 100 116, 100 88" stroke="#2C5840" strokeWidth="6" strokeLinecap="round" fill="none"/>
      {/* left leaf */}
      <path d="M100 122 C 70 116, 56 96, 60 70 C 88 74, 102 92, 100 122 Z" fill="#3F7456"/>
      <path d="M68 80 C 80 92, 92 108, 100 122" stroke="#2C5840" strokeWidth="2" fill="none" opacity="0.4"/>
      {/* right leaf */}
      <path d="M100 108 C 130 102, 144 84, 140 60 C 114 64, 102 80, 100 108 Z" fill="#5A9966"/>
      <path d="M134 70 C 122 82, 110 96, 100 108" stroke="#2C5840" strokeWidth="2" fill="none" opacity="0.35"/>
    </svg>
  );
}
function LogoSunSprout() {
  return <ArtboardStage><ChunkyMark><MarkSunSprout/></ChunkyMark></ArtboardStage>;
}

// ─────────────────────────────────────────────────────────────
// C · 기억의 꽃 — memory bloom (abstract flower-of-petals)
//     5 petals = 5 days a week of practice; center sun
// ─────────────────────────────────────────────────────────────
function MarkBloom({ size = 220 }) {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * 72) - 90; // -90 to point first petal up
    petals.push(
      <g key={i} transform={`rotate(${a} 100 100)`}>
        <ellipse cx="100" cy="48" rx="22" ry="38" fill="#F4B27D"/>
        <ellipse cx="100" cy="38" rx="14" ry="22" fill="#F8CBA0" opacity="0.85"/>
      </g>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      {/* under leaf */}
      <path d="M100 200 C 60 200, 30 168, 30 130 C 60 130, 100 160, 100 200 Z" fill="#5A9966"/>
      <path d="M100 200 C 140 200, 170 168, 170 130 C 140 130, 100 160, 100 200 Z" fill="#3F7456"/>
      {/* stem */}
      <path d="M100 200 C 100 160, 100 130, 100 110" stroke="#2C5840" strokeWidth="5" strokeLinecap="round" fill="none"/>
      {petals}
      {/* center sun */}
      <circle cx="100" cy="100" r="28" fill="#EFC25C"/>
      <circle cx="100" cy="100" r="20" fill="#F4D789"/>
      <circle cx="94" cy="92" r="6" fill="#FBE9B8"/>
    </svg>
  );
}
function LogoBloom() {
  return <ArtboardStage bg="#F5EBD4"><ChunkyMark bg="#FFFEF8"><MarkBloom/></ChunkyMark></ArtboardStage>;
}

// ─────────────────────────────────────────────────────────────
// D · 물방울 새싹 — water drop holding a sprout
//     Represents 물방울 보상 + 회상이 자란다는 비유
// ─────────────────────────────────────────────────────────────
function MarkDropSprout({ size = 220 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      {/* drop shape */}
      <defs>
        <linearGradient id="drop-g" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C8E4D0"/>
          <stop offset="100%" stopColor="#7AB97F"/>
        </linearGradient>
      </defs>
      <path d="M100 14 C 100 14, 168 96, 168 130 A 68 68 0 0 1 32 130 C 32 96, 100 14, 100 14 Z" fill="url(#drop-g)"/>
      {/* drop highlight */}
      <ellipse cx="74" cy="84" rx="14" ry="22" fill="#fff" opacity="0.45" transform="rotate(-20 74 84)"/>
      {/* inner sprout */}
      <path d="M100 162 C 100 140, 100 122, 100 102" stroke="#2C5840" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M100 124 C 80 120, 70 108, 72 92 C 92 94, 102 106, 100 124 Z" fill="#3F7456"/>
      <path d="M100 116 C 120 112, 130 100, 128 84 C 108 86, 98 98, 100 116 Z" fill="#5A9966"/>
      {/* tiny base shadow */}
      <ellipse cx="100" cy="186" rx="42" ry="5" fill="#2C5840" opacity="0.15"/>
    </svg>
  );
}
function LogoDropSprout() {
  return <ArtboardStage><ChunkyMark bg="#FAF4E7"><MarkDropSprout/></ChunkyMark></ArtboardStage>;
}

// ─────────────────────────────────────────────────────────────
// E · 앱 아이콘 시트 — three icon-size renderings on a background
// ─────────────────────────────────────────────────────────────
function LogoIconSheet() {
  const icons = [
    { bg: '#7AB97F', node: <MarkSproutIcon/> },
    { bg: '#F1C25E', node: <MarkSunSproutIcon/> },
    { bg: '#FFFEF8', node: <MarkDropSproutIcon/>, border: true },
  ];
  return (
    <div style={{
      width: '100%', height: '100%', background: 'linear-gradient(180deg, #F5E0AE 0%, #E8C880 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24, boxSizing: 'border-box',
    }}>
      {icons.map((it, i) => (
        <div key={i} style={{
          width: 130, height: 130, borderRadius: 30, background: it.bg,
          boxShadow: '0 14px 0 rgba(60,40,0,0.18), 0 24px 40px rgba(80,50,10,0.20)',
          border: it.border ? '1.5px solid var(--border)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{it.node}</div>
      ))}
    </div>
  );
}
function MarkSproutIcon() {
  return (
    <svg width="92" height="92" viewBox="0 0 100 100">
      <path d="M50 30 C 50 20, 50 10, 50 6" stroke="#2C5840" strokeWidth="4" strokeLinecap="round" fill="none"/>
      <path d="M50 22 C 36 20, 28 12, 30 -2 C 46 0, 54 10, 50 22 Z" fill="#3F7456" transform="translate(0,8)"/>
      <path d="M50 22 C 64 20, 72 12, 70 -2 C 54 0, 46 10, 50 22 Z" fill="#5A9966" transform="translate(0,12)"/>
      <ellipse cx="50" cy="64" rx="32" ry="28" fill="#FFFEF8"/>
      <circle cx="40" cy="60" r="4" fill="#2A2620"/>
      <circle cx="60" cy="60" r="4" fill="#2A2620"/>
      <path d="M42 72 Q 50 80 58 72" stroke="#2A2620" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
    </svg>
  );
}
function MarkSunSproutIcon() {
  return (
    <svg width="92" height="92" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="44" fill="#FBE0A0"/>
      <path d="M0 64 Q 50 56 100 64 L 100 100 L 0 100 Z" fill="#7AB97F"/>
      <path d="M50 92 C 50 76, 50 64, 50 50" stroke="#2C5840" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <path d="M50 72 C 36 68, 30 60, 32 48 C 46 50, 52 60, 50 72 Z" fill="#3F7456"/>
      <path d="M50 66 C 64 62, 70 54, 68 42 C 54 44, 48 54, 50 66 Z" fill="#5A9966"/>
    </svg>
  );
}
function MarkDropSproutIcon() {
  return (
    <svg width="86" height="86" viewBox="0 0 100 100">
      <path d="M50 8 C 50 8, 84 50, 84 68 A 34 34 0 0 1 16 68 C 16 50, 50 8, 50 8 Z" fill="#7AB97F"/>
      <ellipse cx="38" cy="44" rx="6" ry="10" fill="#fff" opacity="0.5" transform="rotate(-20 38 44)"/>
      <path d="M50 82 C 50 70, 50 62, 50 52" stroke="#2C5840" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M50 66 C 40 62, 36 56, 38 48 C 48 50, 52 56, 50 66 Z" fill="#2C5840"/>
      <path d="M50 60 C 60 58, 64 50, 62 42 C 52 44, 48 52, 50 60 Z" fill="#3F7456"/>
    </svg>
  );
}

Object.assign(window, {
  MarkSprout, MarkSunSprout, MarkBloom, MarkDropSprout,
  MarkSproutIcon, MarkSunSproutIcon, MarkDropSproutIcon,
  LogoSprout, LogoSunSprout, LogoBloom, LogoDropSprout, LogoIconSheet,
});
