// Haru — top-level design canvas

function PhoneFrame({ children }) {
  return <IOSDevice width={375} height={760}>{children}</IOSDevice>;
}

function App() {
  return (
    <DesignCanvas>
      <DCSection id="brand-v2" title="Brand v2 · 이미지 마크" subtitle="글자 없이 SVG로 그린 마크 — 4종 + 앱 아이콘 시트">
        <DCArtboard id="logo-a" label="A · 새싹 마스코트" width={360} height={360}>
          <LogoSprout/>
        </DCArtboard>
        <DCArtboard id="logo-b" label="B · 햇살 새싹" width={360} height={360}>
          <LogoSunSprout/>
        </DCArtboard>
        <DCArtboard id="logo-c" label="C · 기억의 꽃" width={360} height={360}>
          <LogoBloom/>
        </DCArtboard>
        <DCArtboard id="logo-d" label="D · 물방울 새싹" width={360} height={360}>
          <LogoDropSprout/>
        </DCArtboard>
        <DCArtboard id="logo-e" label="E · 앱 아이콘 시트" width={560} height={240}>
          <LogoIconSheet/>
        </DCArtboard>
      </DCSection>

      <DCSection id="brand-v1" title="Brand v1 · 타이포 워드마크" subtitle="첫 라운드 — 글자 중심 로고 (보존용)">
        <DCArtboard id="v1-a" label="V1 · Sprout 워드마크" width={520} height={360}>
          <LogoV1Sprout/>
        </DCArtboard>
        <DCArtboard id="v1-b" label="V1 · 하루 한글" width={520} height={360}>
          <LogoV1Korean/>
        </DCArtboard>
        <DCArtboard id="v1-c" label="V1 · 마크 + 워드마크" width={520} height={360}>
          <LogoV1Roundel/>
        </DCArtboard>
        <DCArtboard id="v1-d" label="V1 · 정원 표지" width={520} height={360}>
          <LogoV1GardenTile/>
        </DCArtboard>
      </DCSection>

      <DCSection id="home" title="① 홈 — 학습 경로" subtitle="Duolingo 스타일의 노드 경로를 Haru 컬러와 새록정원 활동에 맞게 재구성">
        <DCArtboard id="home-path" label="홈 · 경로형" width={375} height={760}>
          <PhoneFrame><ScreenHomePath/></PhoneFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="act1" title="② 활동 1 — 숫자 빼기" subtitle="MMSE Serial-7을 보기형 4지선다 + 물방울 진행 표시로">
        <DCArtboard id="sub-intro" label="안내" width={375} height={760}>
          <PhoneFrame><ScreenSubtractIntro/></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="sub-q1" label="문제 1 · 100−7" width={375} height={760}>
          <PhoneFrame><ScreenSubtractQuiz stepIndex={0}/></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="sub-q1-correct" label="정답 피드백" width={375} height={760}>
          <PhoneFrame><ScreenSubtractQuiz stepIndex={0} selected={93} locked/></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="sub-q3" label="문제 3 · 86−7" width={375} height={760}>
          <PhoneFrame><ScreenSubtractQuiz stepIndex={2}/></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="sub-q5" label="문제 5 · 72−7" width={375} height={760}>
          <PhoneFrame><ScreenSubtractQuiz stepIndex={4} selected={65} locked/></PhoneFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="act2" title="③ 활동 2 — 그림 그리기" subtitle="MMSE 겹쳐진 오각형. 손가락·펜으로 실제로 그릴 수 있어요.">
        <DCArtboard id="draw-intro" label="모양 고르기" width={375} height={760}>
          <PhoneFrame><ScreenDrawIntro/></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="draw-empty" label="캔버스 · 시작 전" width={375} height={760}>
          <PhoneFrame><ScreenDrawCanvas shape="penta"/></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="draw-filled" label="캔버스 · 그리는 중" width={375} height={760}>
          <PhoneFrame><ScreenDrawCanvas shape="penta" prefilled/></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="draw-spring" label="스프링 모양" width={375} height={760}>
          <PhoneFrame><ScreenDrawCanvas shape="spring"/></PhoneFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="done" title="④ 마무리" subtitle="물방울이 모이고 정원에 새싹이 자라요">
        <DCArtboard id="result" label="오늘의 결과" width={375} height={760}>
          <PhoneFrame><ScreenResult/></PhoneFrame>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
