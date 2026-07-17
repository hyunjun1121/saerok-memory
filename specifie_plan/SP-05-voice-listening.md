# SP-05 — 음성 우선 회상·말하기 + "듣고 있어요" 실시간 표시

> **AXIS 고정**: 본 파일은 실행 워크플로. 방향·우선순위·수용기준은 `high_level_plan.md` 의 HL-5 와 `specifie_plan.md` 의 SP-05 에 고정된다. 본 파일에서 새 범위를 추가하지 않는다.

| 우선순위 | 의존(선행 SP) | 터치 파일 | 미터치(HL-10) |
|---|---|---|---|
| P1 | 없음(정렬 권장: SP-2 토큰 정합 후) | `src/features/speech/SpeechCapturePanel.tsx`, `src/features/speech/useSpeechCapture.ts`, `src/features/lessons/exerciseTypes/SpeechRepeatPractice.tsx`, `src/features/lessons/exerciseTypes/PersonalMemoryRecall.tsx`, `src/features/memory/types.ts`, `src/locales/ko.json`(및 `en.json`/`ja.json` 동기) | 키오스크/복지관대시보드/일본/임상 |

> **음성 입력 위치 주의**: 음성은 이미 DEFAULT 입력이다. `PersonalMemoryRecall.tsx:176-187`·`VerbalFluencyPractice.tsx:196-207`·`SpeechRepeatPractice.tsx:100-111` 모두 `SpeechCapturePanel`이 textarea **위**에 렌더된다. 본 SP는 textarea를 우선 입력으로 올리거나 음성을 강등하지 않는다. 파형·cap·폴백·메타데이터만 다룬다.

---

## 0. 목표

멘토 요구인 "듣고 있어요" 명확 표시를 정적 펄스 점에서 **실시간 멀티바 파형**으로 바꾼다. 발화가 무한히 길어지지 않도록 `useSpeechCapture`에 `maxDurationMs` cap 자동 종료를 넣고, SpeechRecognition 미지원/실패 시에도 루틴이 깨지지 않도록 **MediaRecorder 오디오 폴백**을 추가한다. `SpeechRepeatPractice`에 target 대비 `pronunciationSimilarity` 메타데이터를 산출하고, ex_6(`PersonalMemoryRecall` story)의 음성 메타데이터(inputMode/durationMs/recognitionError/audioAssetUrl)가 저장 시 누락되지 않게 한다.

---

## 1. 현재 구현 (소스 재확인 결과)

### `src/features/speech/useSpeechCapture.ts`
- `:28-37` `SpeechCapture` 인터페이스: `isSupported/isListening/transcript/error/durationMs/start/stop/reset`. **`audioAssetUrl` 필드 없음**.
- `:60-77` `stop()`: `recognition.stop()` + `durationMs` 측정. **maxDuration timeout 없음**.
- `:79-135` `start()`: `recognition.continuous = true`(`:88`), `interimResults = false`(`:89`). `onresult`에서 transcript 누적. **자동 stop 없음 → 무한 실행 가능**.
- `:105-113` `onerror` / `:115-122` `onend`: `durationMs` 측정 후 listening 종료. **오디오 자산 보존 없음**.
- 멘토 갭: 발화 cap 없음(갭 2), MediaRecorder 폴백 없음(갭 3).

### `src/features/speech/SpeechCapturePanel.tsx`
- `:53-54` listening 시 `border-primary-500 bg-primary-50 ring-4 ring-primary-200`(초록 링).
- `:76-81` listening 표시 = 단일 점 `<span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-primary-500" />`. **정적 점 1개, 실시간 파형 아님**(갭 1).
- 멘토 갭: 줌/디스코드식 파형 미구현.

### `src/features/lessons/exerciseTypes/SpeechRepeatPractice.tsx`
- `:39-49` `handlePlay()`: raw `SpeechSynthesisUtterance` 직접 사용(`rate = 0.92`). calm TTS는 양호하나 `speakCalmly` 우회(SP-04 범위).
- `:51-69` `handleFinish()`: `saveCognitiveRoutineResult` metadata에 `phrase/transcript/speechSupported/listeningDurationMs/recognitionError/locale/inputMode` 저장. **`pronunciationSimilarity` 산출 없음**(갭 4).
- `:67-69` Continue 대기 유지(SP-03/SP-04 정합, 변경 금지).

### `src/features/lessons/exerciseTypes/PersonalMemoryRecall.tsx`
- `:176-187` story 모드에서 `SpeechCapturePanel`이 textarea(`:189-205`) **위**에 렌더(음성 우선, 양호).
- `:144-157` `handleSaveStory()`: `upsertMemoryCueCard`에 `originalTranscript/textSummary/storyCues/sensitivity`만 저장. **`inputMode/durationMs/recognitionError/audioAssetUrl`는 capture에서 읽지 않고 버림**(갭 5).

### `src/features/memory/types.ts`
- `:28-46` `MemoryCard`: `originalTranscript/textSummary/storyCues` 등은 있으나 **`inputMode/durationMs/recognitionError/audioAssetUrl` 필드 없음**. Step 5에서 타입 확장 필요.

### `src/locales/ko.json`
- `:36-45` `speech` namespace: `listeningTitle "듣고 있어요"` / `listeningBody` / `start` / `stop` / `unsupported` / `durationHint "20초 정도 편하게 말씀해 주세요."` / `transcriptLabel` / `recognized`. cap 안내값 재사용 가능.

---

## 2. 전제 / 선행 작업

- **deps: 없음.** SP-05는 단독 실행 가능.
- **정렬 권장(강제 아님)**: `SpeechCapturePanel.tsx:53-54`의 초록 링 색상이 SP-2 고대비 재정의 후 저명도 문제가 될 수 있다. SP-2가 먼저 끝났으면 amber/ink 테두리로 정합; 그렇지 않으면 일단 `primary` 계열을 유지하고 SP-2에서 일괄 보정한다. 본 SP에서 색 토큰을 새로 정의하지 않는다.
- **공유 파일 주의**:
  - `SpeechCapturePanel.tsx`·`useSpeechCapture.ts`는 `SpeechRepeatPractice`/`PersonalMemoryRecall`/`VerbalFluencyPractice` 3곳이 공유. 인터페이스에 필드를 **추가 전용**으로 넣는다(기존 호출처 깨짐 방지). `VerbalFluencyPractice`는 이미 `inputMode`/`speechDurationMs`를 metadata에 저장 중(`:138-156`)이므로 본 SP에서 손대지 않는다.
  - `SpeechRepeatPractice.tsx:67-69` Continue 대기 동작은 SP-03/SP-04 고정 → 변경 금지. 발음 메타데이터만 추가.
  - 음성 입력 순서(Panel이 textarea 위)는 DEFAULT 그대로 유지. textarea를 우선으로 올리지 않는다.

---

## 3. 작업 워크플로

### Step 1 — "듣고 있어요" 단일 점을 실시간 멀티바 파형으로 교체
- 파일: `src/features/speech/SpeechCapturePanel.tsx:76-81`
- FROM:
```tsx
            {isListening && (
              <span
                className="inline-flex h-3 w-3 animate-pulse rounded-full bg-primary-500"
                aria-hidden="true"
              />
            )}
```
- TO:
```tsx
            {isListening && (
              <span
                className="inline-flex items-end gap-1"
                role="img"
                aria-label={listeningTitle}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-primary-500 motion-safe:animate-pulse"
                    style={{
                      height: `${8 + ((i % 3) + 1) * 4}px`,
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
              </span>
            )}
```
  - 5개 세로바, 높이 변화 + delay 차등으로 실시간 파형 인상. `motion-safe:`로 접근성 존중. 초록 링(`:53-54`)은 유지(SP-2에서 토큰 보정 시 일괄).
- verify: `npm run typecheck && npm test -- SpeechCapturePanel`
- checkpoint: `git add -A && git commit -m "SP-05: 실시간 멀티바 파형으로 '듣고 있어요' 표시 강화"`

### Step 2 — `useSpeechCapture` 인터페이스 확장(audioAssetUrl) + maxDurationMs cap
- 파일: `src/features/speech/useSpeechCapture.ts:28-37` (인터페이스), `:49-58` (state/refs)
- FROM (인터페이스):
```ts
export interface SpeechCapture {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  durationMs: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}
```
- TO:
```ts
export interface SpeechCapture {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  durationMs: number;
  audioAssetUrl: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

const MAX_DURATION_MS = 60000;
```
- FROM (state 선언부, `:50-56`):
```ts
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef<number | null>(null);
```
- TO:
```ts
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [audioAssetUrl, setAudioAssetUrl] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
```
- 그리고 `return` 객체(`:157-166`)에 `audioAssetUrl,` 추가.
- verify: `npm run typecheck`(새 필드 미사용 호출처에서 에러 안 나는지; 추가 전용이라 안 남)
- checkpoint: `git add -A && git commit -m "SP-05: SpeechCapture 인터페이스에 audioAssetUrl 추가"`


### Step 3 — maxDurationMs cap 자동 종료 + stop/error/end에서 timeout 정리
- 파일: `src/features/speech/useSpeechCapture.ts:60-77`(stop), `:79-135`(start)
- FROM (`stop()` 본체 시작, `:60-77`):
```ts
  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // no-op
      }
    }

    if (startedAtRef.current !== null) {
      setDurationMs(Date.now() - startedAtRef.current);
      startedAtRef.current = null;
    }
    setIsListening(false);
  }, []);
```
- TO:
```ts
  const stop = useCallback(() => {
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // no-op
      }
    }

    if (startedAtRef.current !== null) {
      setDurationMs(Date.now() - startedAtRef.current);
      startedAtRef.current = null;
    }
    setIsListening(false);
  }, []);
```
- FROM (`start()` 마지막 블록, `:124-130`):
```ts
      recognitionRef.current = recognition;
      startedAtRef.current = Date.now();
      setError(null);
      setTranscript("");
      setDurationMs(0);
      recognition.start();
      setIsListening(true);
```
- TO:
```ts
      recognitionRef.current = recognition;
      startedAtRef.current = Date.now();
      setError(null);
      setTranscript("");
      setDurationMs(0);
      setAudioAssetUrl(null);
      recognition.start();
      setIsListening(true);
      maxTimerRef.current = window.setTimeout(() => {
        maxTimerRef.current = null;
        stop();
      }, MAX_DURATION_MS);
```
  - cap 도달 시 `stop()` 호출로 자동 종료(`durationMs`까지 정상 측정). `onerror`(`:105-113`)/`onend`(`:115-122`)에서도 `maxTimerRef` 정리를 동일 패턴으로 추가(각 블록 시작에 `if (maxTimerRef.current !== null) { window.clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }`). 언마운트 cleanup(`:143-155`)에도 동일 정리 추가.
- verify: `npm run typecheck && npm test -- useSpeechCapture`
- checkpoint: `git add -A && git commit -m "SP-05: 발화 maxDurationMs(60s) cap 자동 종료 추가"`


### Step 4 — MediaRecorder 오디오 폴백(미지원/실패 시 루틴 유지 + 오디오 보존)
- 파일: `src/features/speech/useSpeechCapture.ts:79-135`(start 내부), `:143-155`(cleanup)
- 행동: `start()`에서 `Ctor`가 null(미지원)이거나 `new Ctor()` try 실패 시, `navigator.mediaDevices.getUserMedia` 가드 후 `MediaRecorder`로 blob 녹음을 시작한다. `stop()`과 cleanup에서 `mediaRecorder.stop()` + `stream.getTracks().forEach(t => t.stop())` + URL.revokeObjectURL 정리. 녹음 완료(`onstop`) 시 `setAudioAssetUrl(URL.createObjectURL(blob))`. 미지원 환경에서 폴백마저 실패하면 no-op(루틴은 계속, textarea로 완료 가능).
- FROM (`start()` 선두 가드, `:79-83`):
```ts
  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor || recognitionRef.current) {
      return;
    }
```
- TO:
```ts
  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor || recognitionRef.current) {
      // SpeechRecognition unavailable/already running — try MediaRecorder
      // fallback so the routine keeps an audio record and never breaks.
      startMediaRecorderFallback();
      return;
    }
```
- `startMediaRecorderFallback`는 별도 `useCallback`로 정의: `mediaRecorderRef`/`mediaStreamRef` ref 추가, `getUserMedia({ audio: true })` 시도 → 실패 시 no-op 반환. `stop()`·cleanup에 정리 로직 추가.
- 주의: `MAX_DURATION_MS` cap은 폴백에도 동일 적용(`maxTimerRef` setTimeout에서 폴백 stop까지 포함하도록 `stop()`이 mediaRecorder도 정리).
- verify: `npm run typecheck && npm test -- useSpeechCapture`(jsdom 환경에서 getUserMedia 미지원 → 폴백 no-op 경로가 throw 없는지 단정 추가)
- checkpoint: `git add -A && git commit -m "SP-05: SpeechRecognition 미지원/실패 시 MediaRecorder 오디오 폴백 추가"`


### Step 5 — `SpeechRepeatPractice` 발음 유사도 메타데이터 산출
- 파일: `src/features/lessons/exerciseTypes/SpeechRepeatPractice.tsx:51-69`(handleFinish)
- 행동: target `phrase`와 `capture.transcript`의 토큰 중첩 기반 `pronunciationSimilarity`(0~1)를 산출해 metadata에 추가. 정규화(소문자/구두점 제거) 후 토큰 교집합/합집합 비율. transcript 비어 있으면 `null`(스킵/미입력 구분).
- FROM (`:53-65`):
```tsx
    saveCognitiveRoutineResult({
      type: "speech_repeat_practice",
      completed: true,
      metadata: {
        phrase,
        transcript: capture.transcript,
        speechSupported: capture.isSupported,
        listeningDurationMs: capture.durationMs,
        recognitionError: capture.error,
        locale: i18n.language,
        inputMode: capture.transcript ? "speech" : "skipped",
      },
    });
```
- TO:
```tsx
    saveCognitiveRoutineResult({
      type: "speech_repeat_practice",
      completed: true,
      metadata: {
        phrase,
        transcript: capture.transcript,
        speechSupported: capture.isSupported,
        listeningDurationMs: capture.durationMs,
        recognitionError: capture.error,
        audioAssetUrl: capture.audioAssetUrl,
        locale: i18n.language,
        inputMode: capture.transcript ? "speech" : "skipped",
        pronunciationSimilarity: capture.transcript
          ? computePronunciationSimilarity(phrase, capture.transcript)
          : null,
      },
    });
```
- 모듈 최상단에 헬퍼 추가:
```ts
function computePronunciationSimilarity(target: string, transcript: string): number {
  const tokenize = (s: string) =>
    s.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  const a = new Set(tokenize(target));
  const b = new Set(tokenize(transcript));
  if (a.size === 0) return 0;
  let overlap = 0;
  a.forEach((tok) => { if (b.has(tok)) overlap += 1; });
  return overlap / a.size;
}
```
  - 이 값은 발음 추이(언어 도메인 신호) 보존용 메타데이터. 점수/진단 카피 노출 없음(HL-1).
- verify: `npm run typecheck && npm test -- SpeechRepeatPractice`
- checkpoint: `git add -A && git commit -m "SP-05: SpeechRepeat 발음 유사도 메타데이터 산출"`


### Step 6 — ex_6 음성 메타데이터 저장(MemoryCard 타입 확장 + handleSaveStory)
- 파일: `src/features/memory/types.ts:28-46`(MemoryCard), `src/features/lessons/exerciseTypes/PersonalMemoryRecall.tsx:144-157`(handleSaveStory)
- FROM (`types.ts` `MemoryCard`, `:42-43` 사이):
```ts
  storyCues?: MemoryStoryCues;
  sensitivity: "low" | "personal" | "sensitive";
```
- TO:
```ts
  storyCues?: MemoryStoryCues;
  inputMode?: "speech" | "typed" | "mixed" | "skipped";
  speechDurationMs?: number;
  recognitionError?: string | null;
  audioAssetUrl?: string | null;
  sensitivity: "low" | "personal" | "sensitive";
```
- FROM (`PersonalMemoryRecall.tsx:148-154`):
```tsx
    upsertMemoryCueCard({
      linkedConceptId: linkedConceptId || "daily_memory",
      originalTranscript: normalizedStory,
      textSummary: summarizeMemoryStory(normalizedStory),
      storyCues: extractMemoryStoryCues(normalizedStory),
      sensitivity: "sensitive",
    });
```
- TO:
```tsx
    upsertMemoryCueCard({
      linkedConceptId: linkedConceptId || "daily_memory",
      originalTranscript: normalizedStory,
      textSummary: summarizeMemoryStory(normalizedStory),
      storyCues: extractMemoryStoryCues(normalizedStory),
      inputMode: capture.transcript ? "speech" : "typed",
      speechDurationMs: capture.durationMs,
      recognitionError: capture.error,
      audioAssetUrl: capture.audioAssetUrl,
      sensitivity: "sensitive",
    });
```
  - capture는 이미 `:61`에서 `useSpeechCapture(i18n.language)`로 생성되어 있음.
- verify: `npm run typecheck && npm run lint && npm test`
- checkpoint: `git add -A && git commit -m "SP-05: ex_6 음성 메타데이터(inputMode/durationMs/error/audio) 저장"`


### Step 7 — cap 안내값 ko.json durationHint와 MAX_DURATION_MS 정합 + en/ja 동기
- 파일: `src/locales/ko.json:42`, `src/locales/en.json`, `src/locales/ja.json`
- 행동: `speech.durationHint`가 현재 "20초 정도"(`ko.json:42`)인데 cap은 60s. 안내가 cap보다 짧으므로 learner가 60s 채우기 전에 stop하는 것이 자연스럽다(의도 양호). 단 안내가 cap과 모순되지 않도록 hint를 "20초 정도 편하게 말씀해 주세요. 길어지면 자동으로 마무리돼요."로 보강하거나, hint 20초를 cap에 맞춰 60초로 올리지는 않는다(멘토 "말 길면 제한" 정합). en/ja에 동일 문구 동기화.
- FROM (`ko.json:42`):
```json
    "durationHint": "20초 정도 편하게 말씀해 주세요.",
```
- TO:
```json
    "durationHint": "20초 정도 편하게 말씀해 주세요. 길어지면 자동으로 마무리돼요.",
```
- verify: `npm run typecheck && npm run build`(3 locale raw key 누락 점검)
- checkpoint: `git add -A && git commit -m "SP-05: durationHint에 cap 자동 마무리 안내 추가(3 locale)"`

---

## 4. 단계별 테스트

- 매 단계: `npm run typecheck && npm run lint && npm test && npm run build`.
- **SP-05 전용 단정**:
  - `src/features/speech/useSpeechCapture.test.ts` 확장 — 기존 단일 테스트(`:21-34` 미지원 no-op)에 추가:
    - 미지원 환경에서 `start()`가 throw 없이 폴백(no-op 또는 getUserMedia 실패 시 no-op)으로 빠지는지.
    - `audioAssetUrl` 초기값 `null`.
  - 신규 단정(선택 파일 `src/features/speech/SpeechCapturePanel.test.tsx` 또는 기존 테스트 확장): `isListening` true일 때 파형 컨테이너(`role="img"`)가 렌더되고 자식 `<span>`이 5개인지.
  - `SpeechRepeatPractice.test.tsx`(`src/features/lessons/exerciseTypes/`)에 transcript 존재 시 `pronunciationSimilarity`가 0~1 숫자로 metadata에 들어가는지, transcript 없으면 `null`인지 단정.
  - `PersonalMemoryRecall` story 저장 경로에서 `inputMode`가 capture.transcript 유무에 따라 `"speech"`/`"typed"`로 저장되는지 단정(storage mock).
- `MAX_DURATION_MS` 자동 종료는 타이머 mock(`vi.useFakeTimers`)으로 60000ms 경과 시 `isListening===false` 단정.

---

## 5. 수용 기준 (high_level_plan HL-5에서)

- **음성**: "듣고 있어요"가 실시간 파형(정적 단일 점 아님).
- **cap**: 발화 시 `maxDurationMs` 자동 종료(무한 실행 차단).
- **폴백**: 인식 미지원/실패 시 루틴이 깨지지 않음(MediaRecorder 오디오 보존 + textarea 완료 경로 유지).
- **발음 신호**: `SpeechRepeatPractice`에 `pronunciationSimilarity` 메타데이터 산출.
- **메타데이터**: ex_6 음성 메타데이터(inputMode/durationMs/recognitionError/audioAssetUrl) 저장 시 누락 없음.
- **검증**: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` 통과.
- **비의료 유지**: 발음 유사도/녹음은 메타데이터·추이 보존용이며 점수·진단·검사 카피로 노출하지 않는다(HL-1).

---

## 6. 범위 펜스 (절대 미터치)

- 키오스크 `/kiosk`, `KioskHomeScreen`, `useKioskControls` — 라우트 연결됨, 그대로 유지(HL-10).
- 복지관 운영자 대시보드 — 미구현, 별도(`docs/welfare-center-hybrid-plan.md`)(HL-10).
- 일본 현지 보상/캐릭터/기관 — 별도(`docs/japan-localization-research-plan.md`); 일본어 i18n은 본 SP의 ko 변경사항(en 포함)과 동기화만(HL-10).
- 식약처/임상 검증 — app 카피 비의료 유지만. `pronunciationSimilarity`를 진단/선별/점수로 표현하지 않음(HL-1).
- `VerbalFluencyPractice.tsx` — 이미 음성 우선 + `inputMode`/`speechDurationMs` 저장 중(`:138-156`). 본 SP에서 손대지 않음(공유 파일 추가 전용 원칙).
- `SpeechRepeatPractice.tsx:67-69` Continue 대기 동작(SP-03/SP-04 고정) — 발음 메타데이터만 추가, 자동진입 로직 변경 금지.
- raw `SpeechSynthesisUtterance`(`SpeechRepeatPractice.tsx:39-49`) → `speakCalmly` 교체는 **SP-04 범위**. 본 SP에서 미터치.

---

## 7. 추가 발견 (보류 — step화 금지)

- `useSpeechCapture.ts:89` `interimResults = false` — 실시간 파형을 **실제 진폭**과 연동하려면 `AnalyserNode`+`MediaStream`(getUserMedia)에서 진폭을 읽어 바 높이를 변동시키는 것이 멘토의 "줌/디스코드 파형"에 가장 가깝다. 본 SP는 CSS delay 파형으로 만족(비용/안정성), 실제 진폭 연동은 별도 승인 후 보류.
- `SpeechCapturePanel.tsx:84` 안내 문구 `text-sm` — SP-3(큰 글자 하한선) 범위. 본 SP 미터치.
- `useSpeechCapture.ts`에서 `continuous=true`+`interimResults=false` 조합은 브라우저별 타임아웃 정책이 있어 60s cap 전에 자동 end가 날 수 있음 → `onend`에서 의도치 않은 조기 종료 시 재시도 UX는 별도 과제로 보류.
- MediaRecorder 폴백 산출물(audioAssetUrl)의 가족 공유/보존 정책, 만료 처리는 HL-9/HL-8 보호자·보상 축과 연관 → 본 SP에서는 메타데이터 저장까지만, 정책은 보류.

---

## 8. 롤백 메모

- 각 Step은 독립 commit이므로 `git revert <sha>`로 단계별 롤백 가능.
- Step 2(인터페이스 확장) → Step 3(cap) → Step 4(폴백)는 `useSpeechCapture.ts`에 누적되므로, Step 4만 롤백 시 Step 2/3의 `audioAssetUrl`/`maxTimerRef`는 남음(미사용이지 에러 아님).
- Step 6(`MemoryCard` 타입 확장)을 롤백하면 `PersonalMemoryRecall.tsx`에서 미사용 필드 참조가 남을 수 있음 → Step 6는 Step 5 이후에 같이 롤백 권장.
- cap/폴백은 모두 기존 동작(미지원 no-op, textarea 완료)을 보존하므로, 일부 Step만 적용해도 루틴 완료 경로는 깨지지 않는다.
