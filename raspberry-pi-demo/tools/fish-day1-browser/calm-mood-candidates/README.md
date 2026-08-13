# Day 1 mood-option calm TTS candidates

Day 1 첫 문항의 선택지 네 개에 대해 후보를 여섯 개씩 보관한다.

- 음색: `똑부러지는 긍정 아나운서 여자`
- 자동 태그: 사용하지 않음
- 수동 태그: `차분하고 부드럽게`, `따뜻하고 천천히`, `편안하고 또렷하게`
- 각 태그에서 생성된 왼쪽·오른쪽 결과를 모두 보존
- 총 파일: 4개 선택지 × 3개 태그 × 2개 결과 = 24 MP3

파일명은 `선택지_문구_태그_결과위치.mp3` 형식이다. 원래 Chrome
다운로드는 `C:\Users\mnb92\Downloads`에 백업으로 남겨 두었다.

최종 선택 4개는 Day 1 첫 문항의 런타임 음원으로 적용되었다. 선택은
`selections.json`, MP3→Ogg 매핑과 SHA-256은
`calm-mood-runtime-import.json`에 기록한다.

## 선택 화면

```powershell
cd C:\project\saerok-memory\raspberry-pi-demo
npm run tts:calm-mood:preview
```

브라우저에서 `http://127.0.0.1:4193`을 연다.

- 각 문구에서 후보 6개를 재생할 수 있다.
- 재생과 선택은 분리된다.
- 문구마다 후보 1개만 선택할 수 있다.
- 선택은 `selections.json`에 즉시 저장되고 새로고침 뒤 복원된다.
- 4개 선택 완료 후 JSON으로 내보낼 수 있다.
- 선택 화면은 선택만 저장한다. 변경한 선택을 앱에 다시 적용하려면 아래 명령을 실행한다.

```powershell
npm run tts:calm-mood:apply
```

전체 Day 1 B안 재생성 명령도 마지막에 이 선택 4개를 다시 적용하므로
선택 음원이 B안으로 되돌아가지 않는다.

검증:

```powershell
npm run tts:calm-mood:test
```
