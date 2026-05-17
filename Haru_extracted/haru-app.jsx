// Haru — App screens
// Each Screen* renders inside an IOSDevice (375 × 760)

const { useState, useRef, useEffect, useMemo } = React;

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────

const SCREEN_BG = 'linear-gradient(180deg, #FAF4E7 0%, #F4E8CD 100%)';

function StatusSpacer() {
  // leave room under the iOS notch / status bar
  return <div style={{ height: 60 }} />;
}

function SmallMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <circle cx="80" cy="80" r="76" fill="var(--sun)"/>
      <path d="M0 102 Q 80 96 160 102 L 160 160 L 0 160 Z" fill="var(--sage-tint)"/>
      <path d="M80 132 C 80 112, 80 96, 80 78" stroke="var(--sage-deep)" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M80 104 C 56 100, 46 84, 50 64 C 72 66, 82 80, 80 104 Z" fill="var(--sage)"/>
      <path d="M80 94 C 104 92, 116 78, 114 58 C 92 58, 82 70, 80 94 Z" fill="var(--sage-deep)"/>
    </svg>
  );
}

function ProgressDrops({ total, done }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <svg key={i} width="18" height="22" viewBox="0 0 18 22">
          <path d="M9 1 C 9 1, 16 11, 16 15 A 7 7 0 0 1 2 15 C 2 11, 9 1, 9 1 Z"
            fill={i < done ? 'var(--sage)' : 'transparent'}
            stroke={i < done ? 'var(--sage-deep)' : 'var(--ink-muted)'}
            strokeWidth="1.5" opacity={i < done ? 1 : 0.45}/>
        </svg>
      ))}
    </div>
  );
}

function BigButton({ children, tone = 'paper', onClick, selected, correct, wrong, fontSize = 36 }) {
  let bg = '#FFFFFF', border = 'var(--border)', color = 'var(--ink)';
  let shadow = '0 6px 0 rgba(0,0,0,0.04), 0 2px 18px rgba(120, 90, 30, 0.10)';
  if (tone === 'sage') { bg = 'var(--sage)'; color = '#fff'; border = 'transparent'; }
  if (tone === 'paper') { bg = '#FFFEF8'; }
  if (selected) { bg = 'var(--sage-tint)'; border = 'var(--sage)'; }
  if (correct) { bg = 'var(--sage)'; color = '#fff'; border = 'transparent'; }
  if (wrong)   { bg = '#F4DDD7'; border = 'var(--coral)'; color = 'var(--ink)'; }
  return (
    <button onClick={onClick} style={{
      width: '100%', minHeight: 76, padding: '14px 20px',
      background: bg, border: `2px solid ${border}`,
      borderRadius: 22, color, fontSize, fontWeight: 600,
      fontFamily: 'Pretendard Variable', cursor: 'pointer',
      boxShadow: shadow, transition: 'all 0.15s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>{children}</button>
  );
}

function ScreenShell({ children, title, onBack, label }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: SCREEN_BG,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <StatusSpacer/>
      {title !== undefined && (
        <div style={{
          display: 'flex', alignItems: 'center', padding: '6px 22px 14px',
          gap: 14, fontFamily: 'Pretendard Variable',
        }}>
          {onBack && (
            <button onClick={onBack} style={{
              width: 44, height: 44, borderRadius: 22, border: 'none',
              background: '#FFFFFFAA', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M11 2 L 4 8 L 11 14" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {label && <span style={{ fontSize: 13, color: 'var(--ink-muted)', letterSpacing: '0.04em' }}>{label}</span>}
            <span style={{ fontSize: 20, color: 'var(--ink)', fontWeight: 600 }}>{title}</span>
          </div>
          <SmallMark size={32}/>
        </div>
      )}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. Home — "오늘의 하루"
// ─────────────────────────────────────────────────────────────
function ScreenHome() {
  return (
    <div style={{ width: '100%', height: '100%', background: SCREEN_BG, display: 'flex', flexDirection: 'column' }}>
      <StatusSpacer/>
      <div style={{ padding: '8px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SmallMark size={38}/>
          <span className="serif" style={{ fontStyle: 'italic', fontSize: 32, color: 'var(--ink)' }}>haru</span>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 22, background: '#FFFFFFAA',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v2M12 18v2M4 12H2M22 12h-2M19 5l-1.5 1.5M6.5 17.5L5 19M19 19l-1.5-1.5M6.5 6.5L5 5" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round"/><circle cx="12" cy="12" r="4" fill="var(--sun)"/></svg>
        </div>
      </div>

      <div style={{ padding: '32px 28px 16px' }}>
        <div style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 4 }}>오늘은 5월 17일 토요일</div>
        <div style={{ fontSize: 32, color: 'var(--ink)', fontWeight: 700, lineHeight: 1.25 }}>
          안녕하세요,<br/>
          <span style={{ color: 'var(--sage-deep)' }}>영희</span>님 🌱
        </div>
      </div>

      {/* today's card */}
      <div style={{ padding: '8px 22px' }}>
        <div style={{
          background: '#FFFEF8', borderRadius: 28, padding: '22px 22px 20px',
          boxShadow: '0 12px 28px rgba(120, 90, 30, 0.10), inset 0 0 0 1px var(--border)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.85 }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="40" fill="var(--sun)" opacity="0.35"/>
              <path d="M55 90 C 55 70, 55 56, 55 42" stroke="var(--sage-deep)" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <path d="M55 70 C 38 66, 30 54, 33 38 C 50 40, 57 52, 55 70 Z" fill="var(--sage)"/>
              <path d="M55 60 C 72 58, 80 46, 78 30 C 62 30, 54 40, 55 60 Z" fill="var(--sage-deep)"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, color: 'var(--coral)', fontWeight: 600, letterSpacing: '0.06em' }}>오늘의 활동</div>
          <div style={{ fontSize: 28, color: 'var(--ink)', fontWeight: 700, marginTop: 6, lineHeight: 1.25 }}>
            숫자 빼기와<br/>그림 그리기
          </div>
          <div style={{ fontSize: 15, color: 'var(--ink-soft)', marginTop: 8 }}>5분 안에 끝나요 · 활동 2개</div>

          <button style={{
            marginTop: 22, width: '100%', minHeight: 64,
            background: 'var(--sage-deep)', color: '#fff', border: 'none',
            borderRadius: 20, fontSize: 20, fontWeight: 700,
            fontFamily: 'Pretendard Variable', cursor: 'pointer',
            boxShadow: '0 8px 0 #2C5840, 0 12px 24px rgba(63, 116, 86, 0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            시작하기
            <svg width="18" height="18" viewBox="0 0 16 16"><path d="M5 2 L 12 8 L 5 14" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* streak + garden mini */}
      <div style={{ padding: '14px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          background: '#FFFEF8', borderRadius: 22, padding: '16px 18px',
          boxShadow: 'inset 0 0 0 1px var(--border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>연속 학습</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>
            12<span style={{ fontSize: 16, color: 'var(--ink-soft)', fontWeight: 500, marginLeft: 4 }}>일째</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {[1,1,1,1,1,1,0].map((v,i) => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: 4,
                background: v ? 'var(--sage)' : 'var(--border)',
              }}/>
            ))}
          </div>
        </div>
        <div style={{
          background: '#FFFEF8', borderRadius: 22, padding: '16px 18px',
          boxShadow: 'inset 0 0 0 1px var(--border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>나의 정원</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 6, height: 50 }}>
            <SproutIcon h={28}/>
            <SproutIcon h={36}/>
            <SproutIcon h={22}/>
            <SproutIcon h={42}/>
            <SproutIcon h={30} dim/>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>새싹 4개 · 물 12방울</div>
        </div>
      </div>

      <div style={{ flex: 1 }}/>
      {/* bottom nav */}
      <BottomNav active="home"/>
    </div>
  );
}

function SproutIcon({ h = 28, dim }) {
  return (
    <svg width="20" height={h} viewBox={`0 0 20 ${h}`} style={{ opacity: dim ? 0.35 : 1 }}>
      <line x1="10" y1={h} x2="10" y2={h*0.4} stroke="var(--sage-deep)" strokeWidth="1.6"/>
      <path d={`M10 ${h*0.6} C 2 ${h*0.55}, 0 ${h*0.4}, 1 ${h*0.2} C 9 ${h*0.22}, 11 ${h*0.4}, 10 ${h*0.6} Z`} fill="var(--sage)"/>
      <path d={`M10 ${h*0.45} C 18 ${h*0.4}, 20 ${h*0.25}, 19 ${h*0.05} C 11 ${h*0.07}, 9 ${h*0.25}, 10 ${h*0.45} Z`} fill="var(--sage-deep)"/>
    </svg>
  );
}

function BottomNav({ active }) {
  const items = [
    { k: 'home', l: '오늘', i: '🏡' },
    { k: 'garden', l: '정원', i: '🌿' },
    { k: 'family', l: '가족', i: '💌' },
    { k: 'settings', l: '설정', i: '⚙︎' },
  ];
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around', padding: '8px 12px 28px',
      background: '#FFFEF8DD', backdropFilter: 'blur(8px)',
      borderTop: '1px solid var(--border)',
    }}>
      {items.map(it => (
        <div key={it.k} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '8px 12px', minWidth: 60,
          color: active === it.k ? 'var(--sage-deep)' : 'var(--ink-muted)',
        }}>
          <div style={{ fontSize: 22 }}>{it.i}</div>
          <div style={{ fontSize: 12, fontWeight: active === it.k ? 700 : 500 }}>{it.l}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Activity 1 — Subtract 7 (intro)
// ─────────────────────────────────────────────────────────────
function ScreenSubtractIntro() {
  return (
    <ScreenShell title="숫자 빼기" label="오늘의 활동 1 / 2" onBack={() => {}}>
      <div style={{ padding: '12px 28px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: '#FFFEF8', borderRadius: 28, padding: '32px 24px',
          boxShadow: 'inset 0 0 0 1px var(--border)',
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'flex-start', gap: 18,
        }}>
          <div style={{
            width: 120, height: 120, borderRadius: 60, background: 'var(--sage-tint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 52, fontWeight: 700, color: 'var(--sage-deep)',
            fontFamily: 'Pretendard Variable',
          }}>−7</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.35 }}>
            100에서 7씩<br/>다섯 번 빼볼게요
          </div>
          <div style={{ fontSize: 17, color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.55, maxWidth: 280 }}>
            천천히 보기에서 골라주세요.<br/>틀려도 괜찮습니다.
          </div>

          {/* sample */}
          <div style={{
            marginTop: 8, background: 'var(--cream)', borderRadius: 18,
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10,
            border: '1px dashed var(--border)',
          }}>
            <span style={{ fontSize: 22, color: 'var(--ink-soft)' }}>예) </span>
            <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>100 − 7 = </span>
            <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage-deep)' }}>93</span>
          </div>
        </div>

        <div style={{ padding: '16px 0 24px' }}>
          <button style={{
            width: '100%', minHeight: 68,
            background: 'var(--sage-deep)', color: '#fff', border: 'none',
            borderRadius: 22, fontSize: 22, fontWeight: 700,
            fontFamily: 'Pretendard Variable', cursor: 'pointer',
            boxShadow: '0 8px 0 #2C5840',
          }}>준비됐어요</button>
        </div>
      </div>
    </ScreenShell>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Activity 1 — Subtract 7 (interactive question)
// ─────────────────────────────────────────────────────────────
const SUBTRACT_STEPS = [
  { from: 100, ans: 93, choices: [93, 97, 83, 103] },
  { from:  93, ans: 86, choices: [86, 84, 80, 89] },
  { from:  86, ans: 79, choices: [79, 73, 81, 76] },
  { from:  79, ans: 72, choices: [72, 71, 75, 69] },
  { from:  72, ans: 65, choices: [65, 67, 63, 58] },
];

function ScreenSubtractQuiz({ stepIndex = 0, selected = null, locked = false }) {
  const step = SUBTRACT_STEPS[stepIndex];

  return (
    <ScreenShell title="숫자 빼기" label={`문제 ${stepIndex + 1} / 5`} onBack={() => {}}>
      <div style={{ padding: '4px 22px 0' }}>
        <ProgressDrops total={5} done={stepIndex + (locked ? 1 : 0)}/>
      </div>

      <div style={{ padding: '20px 28px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: '#FFFEF8', borderRadius: 28, padding: '28px 22px',
          boxShadow: 'inset 0 0 0 1px var(--border), 0 12px 24px rgba(120, 90, 30, 0.06)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 16, color: 'var(--ink-muted)', marginBottom: 10 }}>이 식의 답은 무엇일까요?</div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
            fontFamily: 'Pretendard Variable', fontWeight: 700,
            color: 'var(--ink)',
          }}>
            <span style={{ fontSize: 64 }}>{step.from}</span>
            <span style={{ fontSize: 48, color: 'var(--coral)' }}>−</span>
            <span style={{ fontSize: 64 }}>7</span>
            <span style={{ fontSize: 48, color: 'var(--ink-muted)' }}>=</span>
            <span style={{
              fontSize: 64, color: locked ? 'var(--sage-deep)' : 'var(--ink-muted)',
              minWidth: 90, textAlign: 'left',
            }}>{locked ? step.ans : '?'}</span>
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 15, color: 'var(--ink-soft)', textAlign: 'center' }}>
          천천히 골라보세요
        </div>

        <div style={{
          marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          {step.choices.map((c) => {
            const isSelected = selected === c;
            const isCorrect = locked && c === step.ans;
            const isWrong = locked && isSelected && c !== step.ans;
            return (
              <BigButton key={c} selected={isSelected && !locked}
                correct={isCorrect} wrong={isWrong} fontSize={40}>
                {c}
              </BigButton>
            );
          })}
        </div>

        {locked && (
          <div style={{
            marginTop: 18, background: 'var(--sage-tint)', borderRadius: 20,
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
            border: '1px solid var(--sage)',
          }}>
            <div style={{ fontSize: 28 }}>🌱</div>
            <div style={{ flex: 1, fontSize: 16, color: 'var(--sage-deep)', fontWeight: 600 }}>
              정답이에요! 물방울 한 방울이 모였어요.
            </div>
          </div>
        )}

        <div style={{ flex: 1 }}/>
        {locked && (
          <div style={{ padding: '0 0 24px' }}>
            <button style={{
              width: '100%', minHeight: 64,
              background: 'var(--sage-deep)', color: '#fff', border: 'none',
              borderRadius: 22, fontSize: 22, fontWeight: 700,
              fontFamily: 'Pretendard Variable', cursor: 'pointer',
              boxShadow: '0 8px 0 #2C5840',
            }}>다음 문제</button>
          </div>
        )}
      </div>
    </ScreenShell>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Activity 2 — Drawing intro (pick a shape)
// ─────────────────────────────────────────────────────────────
function PentagonsRef({ size = 90 }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 120 90" fill="none">
      <polygon points="35,8 65,8 73,38 50,56 12,38" stroke="var(--ink)" strokeWidth="2.4" fill="#FFFDF6"/>
      <polygon points="55,32 85,32 93,62 70,80 32,62" stroke="var(--ink)" strokeWidth="2.4" fill="#FFFDF6" opacity="0.9"/>
    </svg>
  );
}
function SpringRef({ size = 90 }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 120 90" fill="none">
      <path d="M10 78 L 18 78 C 30 78, 30 12, 42 12 C 54 12, 54 78, 66 78 C 78 78, 78 12, 90 12 C 100 12, 102 28, 102 40 L 110 40"
        stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}
function CubeRef({ size = 90 }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 120 90" fill="none">
      <path d="M30 30 L 70 30 L 70 70 L 30 70 Z M 30 30 L 50 12 L 90 12 L 70 30 M 70 70 L 90 52 L 90 12 M 50 12 L 50 14" stroke="var(--ink)" strokeWidth="2.4" fill="#FFFDF6" strokeLinejoin="round"/>
    </svg>
  );
}

function ScreenDrawIntro() {
  const items = [
    { k: 'penta', label: '겹쳐진 오각형', Ref: PentagonsRef, selected: true },
    { k: 'spring', label: '스프링 모양', Ref: SpringRef },
    { k: 'cube', label: '입체 상자', Ref: CubeRef },
  ];
  return (
    <ScreenShell title="그림 그리기" label="오늘의 활동 2 / 2" onBack={() => {}}>
      <div style={{ padding: '8px 28px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>
          왼쪽 그림을 보고<br/>똑같이 그려볼까요?
        </div>
        <div style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 6 }}>
          오늘 따라 그릴 모양을 골라주세요.
        </div>

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(({ k, label, Ref, selected }) => (
            <div key={k} style={{
              background: selected ? 'var(--sage-tint)' : '#FFFEF8',
              border: `2px solid ${selected ? 'var(--sage)' : 'var(--border)'}`,
              borderRadius: 22, padding: '14px 20px',
              display: 'flex', alignItems: 'center', gap: 18,
              boxShadow: selected ? '0 6px 0 rgba(63,116,86,0.18)' : '0 2px 8px rgba(120,90,30,0.06)',
            }}>
              <div style={{
                width: 92, height: 70, borderRadius: 14,
                background: '#FFFDF6', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ref size={80}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--ink-muted)', marginTop: 2 }}>약 2분</div>
              </div>
              {selected && (
                <div style={{
                  width: 32, height: 32, borderRadius: 16, background: 'var(--sage)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5 L 7 12 L 13 4.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}/>
        <div style={{ padding: '8px 0 24px' }}>
          <button style={{
            width: '100%', minHeight: 68,
            background: 'var(--sage-deep)', color: '#fff', border: 'none',
            borderRadius: 22, fontSize: 22, fontWeight: 700,
            fontFamily: 'Pretendard Variable', cursor: 'pointer',
            boxShadow: '0 8px 0 #2C5840',
          }}>이걸로 그릴게요</button>
        </div>
      </div>
    </ScreenShell>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Activity 2 — Drawing canvas (interactive!)
// ─────────────────────────────────────────────────────────────
function ScreenDrawCanvas({ shape = 'penta', prefilled = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const [hasStrokes, setHasStrokes] = useState(prefilled);

  // initial prefilled drawing
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2A2620';
    ctx.lineWidth = 3.5;

    if (prefilled) {
      // draw an example pentagons sketch
      ctx.beginPath();
      const W = rect.width, H = rect.height;
      const cx1 = W*0.36, cy1 = H*0.46, r1 = Math.min(W,H)*0.18;
      const cx2 = W*0.58, cy2 = H*0.56, r2 = Math.min(W,H)*0.18;
      const drawPenta = (cx, cy, r, jitter = 1.5) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI/2 + i * (Math.PI*2/5);
          const jx = (Math.random()-0.5)*jitter;
          const jy = (Math.random()-0.5)*jitter;
          const x = cx + Math.cos(a)*r + jx;
          const y = cy + Math.sin(a)*r + jy;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      };
      drawPenta(cx1, cy1, r1);
      drawPenta(cx2, cy2, r2);
    }
  }, [prefilled]);

  const getPos = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const start = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = getPos(e);
    setHasStrokes(true);
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const p = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };
  const end = () => { drawingRef.current = false; };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    setHasStrokes(false);
  };

  const Ref = shape === 'spring' ? SpringRef : shape === 'cube' ? CubeRef : PentagonsRef;
  const refLabel = shape === 'spring' ? '스프링 모양' : shape === 'cube' ? '입체 상자' : '겹쳐진 오각형';

  return (
    <ScreenShell title="그림 그리기" label={refLabel} onBack={() => {}}>
      <div style={{ padding: '4px 22px 0', display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
        {/* reference card */}
        <div style={{
          background: '#FFFEF8', borderRadius: 22, padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: 'inset 0 0 0 1px var(--border)',
        }}>
          <div style={{
            width: 92, height: 70, borderRadius: 12,
            background: '#FFFDF6', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ref size={80}/>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600 }}>이 모양을 보고</div>
            <div style={{ fontSize: 18, color: 'var(--ink)', fontWeight: 700, marginTop: 2 }}>아래에 그려주세요</div>
          </div>
        </div>

        {/* canvas */}
        <div style={{
          flex: 1, position: 'relative', borderRadius: 22, overflow: 'hidden',
          background: '#FFFDF6',
          boxShadow: 'inset 0 0 0 1px var(--border)',
        }}>
          {/* faint baseline grid */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
            <defs>
              <pattern id="dot" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#D7C9A8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dot)"/>
          </svg>
          <canvas ref={canvasRef}
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              touchAction: 'none', cursor: 'crosshair',
            }}/>
          {!hasStrokes && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              color: 'var(--ink-muted)', fontSize: 16,
            }}>
              <span className="hand" style={{ fontSize: 26 }}>여기에 그려보세요 ✎</span>
            </div>
          )}
        </div>

        {/* tools row */}
        <div style={{ display: 'flex', gap: 10, paddingBottom: 4 }}>
          <button onClick={clear} style={{
            flex: 1, minHeight: 60, background: '#FFFEF8', color: 'var(--ink)',
            border: '2px solid var(--border)', borderRadius: 18,
            fontSize: 18, fontWeight: 600, fontFamily: 'Pretendard Variable',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer',
          }}>
            <svg width="18" height="18" viewBox="0 0 16 16"><path d="M14 6 L 10 2 L 2 10 L 4 12 L 6 12 L 14 6 Z M 7 14 L 14 14" stroke="var(--ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            다시 그리기
          </button>
          <button style={{
            flex: 1.4, minHeight: 60, background: 'var(--sage-deep)', color: '#fff',
            border: 'none', borderRadius: 18,
            fontSize: 18, fontWeight: 700, fontFamily: 'Pretendard Variable',
            cursor: 'pointer', boxShadow: '0 6px 0 #2C5840',
          }}>다 그렸어요</button>
        </div>
        <div style={{ height: 12 }}/>
      </div>
    </ScreenShell>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Result / garden reward
// ─────────────────────────────────────────────────────────────
function ScreenResult() {
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #FAE9C2 0%, #F5E0AE 60%, #E3D196 100%)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <StatusSpacer/>

      {/* sun */}
      <div style={{
        position: 'absolute', top: 60, right: 40,
        width: 140, height: 140, borderRadius: '50%',
        background: 'radial-gradient(circle, #FFEDC0 0%, #F4C25C 65%, #DDA640 100%)',
        boxShadow: '0 0 80px rgba(244,194,92,0.55)',
      }}/>

      <div style={{ padding: '20px 28px 0', position: 'relative', zIndex: 2 }}>
        <div className="serif" style={{ fontStyle: 'italic', fontSize: 30, color: 'var(--ink)' }}>haru</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--ink)', marginTop: 28, lineHeight: 1.2 }}>
          오늘의 하루를<br/>
          <span style={{ color: 'var(--sage-deep)' }}>마쳤어요</span> 🌿
        </div>
        <div style={{ fontSize: 17, color: 'var(--ink-soft)', marginTop: 10 }}>
          숫자 빼기 5문제, 그림 1개를 완성했어요.
        </div>
      </div>

      {/* stats */}
      <div style={{ padding: '24px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, position: 'relative', zIndex: 2 }}>
        {[
          { v: '4', u: '/5', l: '맞힌 답' },
          { v: '+5', u: '', l: '물방울' },
          { v: '13', u: '일째', l: '연속' },
        ].map((s, i) => (
          <div key={i} style={{
            background: '#FFFEF8CC', backdropFilter: 'blur(6px)',
            borderRadius: 18, padding: '14px 12px',
            textAlign: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>
              {s.v}<span style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 500 }}>{s.u}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* garden ground */}
      <div style={{ flex: 1, position: 'relative' }}>
        <svg viewBox="0 0 375 280" width="100%" height="100%" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} preserveAspectRatio="none">
          <path d="M0 140 Q 90 90 188 120 T 375 110 L 375 280 L 0 280 Z" fill="#9CC2A2" opacity="0.8"/>
          <path d="M0 190 Q 90 150 188 175 T 375 165 L 375 280 L 0 280 Z" fill="#6FA37C"/>
        </svg>
        {/* sprouts + new flower */}
        <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', padding: '0 24px' }}>
          <SproutIcon h={48}/>
          <SproutIcon h={62}/>
          <FlowerSprout/>
          <SproutIcon h={56}/>
          <SproutIcon h={42}/>
        </div>

        {/* CTA */}
        <div style={{ position: 'absolute', left: 22, right: 22, bottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button style={{
            width: '100%', minHeight: 64,
            background: 'var(--ink)', color: '#fff', border: 'none',
            borderRadius: 22, fontSize: 20, fontWeight: 700,
            fontFamily: 'Pretendard Variable', cursor: 'pointer',
            boxShadow: '0 8px 0 #0E0B05',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            🌿 나의 정원 보기
          </button>
          <button style={{
            width: '100%', minHeight: 56,
            background: 'transparent', color: 'var(--ink-soft)',
            border: '1.5px solid var(--ink-soft)', borderRadius: 22,
            fontSize: 16, fontWeight: 600, fontFamily: 'Pretendard Variable',
            cursor: 'pointer',
          }}>가족에게 안부 한 마디</button>
        </div>
      </div>
    </div>
  );
}

function FlowerSprout() {
  return (
    <svg width="46" height="90" viewBox="0 0 46 90" style={{ filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.08))' }}>
      <line x1="23" y1="90" x2="23" y2="40" stroke="var(--sage-deep)" strokeWidth="2.4"/>
      <path d="M23 60 C 8 56, 4 44, 8 28 C 22 32, 26 44, 23 60 Z" fill="var(--sage)"/>
      {/* flower head */}
      <g transform="translate(23,22)">
        {[0,72,144,216,288].map((a,i)=>(
          <ellipse key={i} cx="0" cy="-14" rx="7" ry="11" fill="var(--coral)" transform={`rotate(${a})`}/>
        ))}
        <circle cx="0" cy="0" r="6" fill="var(--sun)"/>
      </g>
    </svg>
  );
}

Object.assign(window, {
  ScreenHome, ScreenSubtractIntro, ScreenSubtractQuiz,
  ScreenDrawIntro, ScreenDrawCanvas, ScreenResult,
});
