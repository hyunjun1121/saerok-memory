# Haru 日本実証 音声制作計画
# Haru 일본 실증 TTS 제작 계획

質問版 jp-first-meeting-2.0。9問の確定版に対応する制作台本です。この版のFish音声は未生成で、実証画面には未接続です。
문항 버전 jp-first-meeting-2.0. 확정된 9문항용 제작 대본입니다. 이 버전의 Fish 음원은 아직 생성하거나 실증 화면에 연결하지 않았습니다.

## 過去に選んだ声
## 기존에 선택한 화자

Fish Audioでは「女性アナウンサー（ベテラン）」を採用しました。プロジェクト内IDはveteran、形式はgentle_double_pauseです。
Fish Audio 최종 화자는 여성 아나운서(베테랑)입니다. 일본어 표시명은 女性アナウンサー（ベテラン）, 프로젝트 ID는 veteran, 형식은 gentle_double_pause입니다.

比較候補はank0、田中みなみ風、女性アナウンサー（ベテラン）でした。QwenのOno_Annaは別の生成系です。2026-10-26のブラウザーでは上記の声とFish Audio Drama 3の表示を確認しました。音声ページのIDと生成APIのモデルIDは区別します。
비교 후보는 ank0·田中みなみ風·女性アナウンサー（ベテラン）였습니다. Qwen의 Ono_Anna는 다른 생성 계열입니다. 2026-10-26 브라우저에서 해당 화자와 Fish Audio Drama 3 표시를 확인했습니다. 음성 페이지 ID와 생성 API 모델 ID는 구분합니다.

旧Q1「今日の気分はいかがですか。」は自動タグと短い間二つを付け、候補2音源を保存済みです。旧版の試作品として保管し、新Q1「今日は何曜日ですか？」には流用しません。
이전 Q1 今日の気分はいかがですか。는 자동 태그와 짧은 쉼 두 번을 적용해 후보 두 음원을 저장했습니다. 이전 버전 시제품으로 보존하며 새 Q1 今日は何曜日ですか？에는 재사용하지 않습니다.

根拠：raspberry-pi-demo/tools/fish-day1-browser/ja/README.md、同day1-inventory.json、public/assets/audio/narration/ja/day1/manifest.json。
근거: raspberry-pi-demo/tools/fish-day1-browser/ja/README.md, 같은 폴더의 day1-inventory.json, public/assets/audio/narration/ja/day1/manifest.json.

## 場面と音声数
## 장면과 음원 수

setup: 2件。
setup: 2개.

intro: 1件。
intro: 1개.

instruction: 3件。
instruction: 3개.

feedback: 1件。
feedback: 1개.

recording: 3件。
recording: 3개.

error: 2件。
error: 2개.

skip: 2件。
skip: 2개.

outro: 2件。
outro: 2개.

question: 14件。
question: 14개.

option: 19件。
option: 19개.

合計49枠、必須45枠、任意4枠。日本語の完全一致文は共通化でき、異なる文は49種類です。
총 49개 슬롯, 필수 45개, 선택 4개입니다. 일본어가 완전히 같은 문장은 재사용할 수 있으며 서로 다른 문장은 49종입니다.

本質問9、条件付きの追加質問5、選択肢用の音声19、共通案内16です。選択肢19は曜日7種類とQ2〜Q4の12選択肢です。1人に提示する四択の選択肢は16個です。
본질문 9개·조건부 후속 질문 5개·선택지용 음원 19개·공통 안내 16개입니다. 선택지용 19개는 요일 7종과 Q2~Q4의 보기 12개입니다. 한 사람에게 제시하는 4지선다 보기는 총 16개입니다.

Q1は7曜日の音声を用意し、その回で実際に表示した4曜日だけを表示順に読みます。曜日とボタン番号を固定で結び付けず、当日の正解を案内で漏らしません。
Q1은 일곱 요일 음원을 준비하고 해당 회차에서 실제 표시한 네 요일만 표시 순서대로 읽습니다. 요일과 버튼 번호를 고정 연결하지 않으며 당일 정답을 안내에서 미리 말하지 않습니다.

## 再生と録音の原則
## 재생과 녹음 원칙

質問、必要な補足、操作案内の順に一度だけ再生し、終了してから録音を許可します。録音中はTTSを流しません。
질문·필요한 도움말·조작 안내 순서로 한 번 재생하고 끝난 뒤 녹음할 수 있게 합니다. 녹음 중에는 TTS를 재생하지 않습니다.

現在は再生ボタンによるブラウザー読み上げです。Fish音源、自動再生、選択肢の音声組み立て、録り直し前の待機、3分上限後の案内、中断と完了の音声分岐は今後の実装対象です。
현재는 다시 듣기 버튼을 통한 브라우저 읽어주기입니다. Fish 음원·자동 재생·선택지 음성 조합·재녹음 전 대기·3분 상한 후 안내·중단/완료 음성 분기는 이후 구현 대상입니다.

録音開始は短い合図で知らせ、聞いていますという声を繰り返しません。保存完了の案内はサーバー保存が成功した後だけです。
녹음 시작은 짧은 신호로 알리고 듣고 있다는 음성을 반복하지 않습니다. 저장 완료 안내는 서버 저장 성공 후에만 합니다.

選択肢は実際の1〜4の表示順で読み、正解は先に知らせません。本人の番号や名前は固定音声に入れません。Q4の田中・佐藤・鈴木は問題中の人物で、本人の知人とは扱いません。
선택지는 실제 1~4 표시 순서로 읽고 정답을 미리 알려주지 않습니다. 고정 음원에 참가자 번호나 이름을 넣지 않습니다. Q4의 다나카·사토·스즈키는 문제 속 인물이며 참가자의 지인으로 취급하지 않습니다.

追加質問の音声は、短い回答と担当者が判断して一度だけ開いた場合に使います。十分な回答の後には再生せず、追加質問を飛ばしても本質問の音声は保存します。
후속 질문 음성은 짧은 답변이라고 진행자가 판단해 한 번 연 경우에만 사용합니다. 충분한 답변 뒤에는 재생하지 않으며 후속 질문을 건너뛰어도 본질문 음성은 보존합니다.

案内用の短い音声と本人の録音の再生を重ねません。画面の保存先やコマンド、ZIP、削除確認など担当者向けの情報は自動で読み上げません。
안내 음성과 참가자 녹음 미리 듣기를 겹치지 않습니다. 저장 경로·실행 명령·ZIP·삭제 확인 등 진행자용 정보는 자동으로 읽지 않습니다.

既存音源は文言の完全一致候補だけを示します。利用前に実ファイル、声、発音、音量を確認し、違う人名や内容の音声を流用しません。
기존 음원은 문구 완전 일치 후보만 표시합니다. 사용 전 실제 파일·화자·발음·음량을 확인하며 다른 이름이나 내용의 음성을 그대로 쓰지 않습니다.

JSONのtaggedTextは短い間を二つ入れた制作案です。Fish画面への入力前に自然な区切りを確認し、タグを二重に追加しないようにします。
JSON의 taggedText는 짧은 쉼을 두 번 넣은 제작안입니다. Fish 화면에 넣기 전 자연스러운 구분을 확인하고 태그가 중복되지 않게 합니다.

## 全台本
## 전체 제작 대본

### common.setup（任意）
### common.setup (선택)

これから、お話をうかがいます。録音と保存について、係の者がご説明します。
지금부터 이야기를 여쭙겠습니다. 녹음과 저장에 관해서 진행자가 설명해 드립니다.

재생 시점: 진행자 준비 화면, 필요한 경우에만 재생
파일: /assets/audio/narration/ja/pilot/common_setup.mp3

### common.intro（必須）
### common.intro (필수)

これから、四つのボタンで答える質問を4問、そのあと暮らしや思い出のお話を5問伺います。8〜10分ほどです。思い出せないことや、話したくないことは飛ばせます。ご自分のペースでお答えください。
먼저 네 버튼으로 답하는 질문 4개, 이어서 생활과 추억에 관한 이야기 5개를 여쭙겠습니다. 약 8~10분입니다. 기억이 나지 않거나 말하기 불편한 내용은 건너뛰셔도 됩니다. 편안한 속도로 답해 주세요.

재생 시점: 동의 확인 후 시작 소개 화면
파일: /assets/audio/narration/ja/pilot/common_intro.mp3

### common.choice_guide（必須）
### common.choice_guide (필수)

一つ選んで、同じボタンでもう一度決めます。
하나를 고른 뒤 같은 버튼을 한 번 더 누르세요.

재생 시점: 첫 선택형 설명, 이후 요청 시 다시 듣기
파일: /assets/audio/narration/ja/pilot/common_choice_guide.mp3

### common.choice_confirmed（任意）
### common.choice_confirmed (선택)

お答えを受け取りました。次へ進みましょう。
답변을 받았습니다. 다음으로 넘어갈게요.

재생 시점: 선택 확정 뒤, 다음 질문과 겹치지 않을 때
파일: /assets/audio/narration/ja/pilot/common_choice_confirmed.mp3

### common.voice_guide（必須）
### common.voice_guide (필수)

右のボタンで話し始めます。終わったら、もう一度右を押します。
오른쪽 버튼으로 말하기를 시작하고, 마치면 오른쪽을 한 번 더 누르세요.

재생 시점: 첫 음성 문항에서 녹음 전에 설명, 이후 요청 시
파일: /assets/audio/narration/ja/pilot/common_voice_guide.mp3

### common.voice_limit（必須）
### common.voice_limit (필수)

お話の目安は45〜90秒です。急がずお話しください。1回の録音は最長3分です。
이야기는 45~90초를 목표로 하되 서두르지 않으셔도 됩니다. 한 번에 최대 3분 녹음합니다.

재생 시점: 첫 녹음 전에만 상한 설명
파일: /assets/audio/narration/ja/pilot/common_voice_limit.mp3

### common.recording_ended（必須）
### common.recording_ended (필수)

録音が終わりました。右のボタンで保存してください。
녹음이 끝났어요. 오른쪽 버튼으로 저장해 주세요.

재생 시점: 3분 안전 상한으로 자동 정지 후, 마이크가 완전히 닫힌 뒤
파일: /assets/audio/narration/ja/pilot/common_recording_ended.mp3

### common.recording_saved（必須）
### common.recording_saved (필수)

お話を保存しました。右のボタンで次へ進みます。録り直すときは、左のボタンを押してください。
이야기를 저장했어요. 오른쪽 버튼으로 다음으로 갑니다. 다시 녹음하려면 왼쪽 버튼을 눌러 주세요.

재생 시점: 저장 완료 후 다음/재녹음 버튼을 안내할 때
파일: /assets/audio/narration/ja/pilot/common_recording_saved.mp3

### common.retry_ready（必須）
### common.retry_ready (필수)

もう一度、お話しいただけます。準備ができたら、右のボタンを押してください。
다시 이야기하실 수 있어요. 준비되면 오른쪽 버튼을 눌러 주세요.

재생 시점: 재녹음 준비, 안내를 끝낸 다음에만 녹음 시작하도록 흐름 보완 필요
파일: /assets/audio/narration/ja/pilot/common_retry_ready.mp3

### common.mic_error（必須）
### common.mic_error (필수)

音声を録音できませんでした。係の者にお知らせください。
음성을 녹음하지 못했어요. 진행자에게 알려 주세요.

재생 시점: 마이크 권한/장치/빈 녹음 오류, 녹음 중이 아닐 때
파일: /assets/audio/narration/ja/pilot/common_mic_error.mp3

### common.skip_menu（必須）
### common.skip_menu (필수)

お話ししたくない、当てはまらない、答えが浮かばない、録音できない。近いものを選んでください。
말하고 싶지 않음, 해당 없음, 답이 떠오르지 않음, 녹음할 수 없음 중 가까운 이유를 골라 주세요.

재생 시점: 건너뛰기 이유 화면
파일: /assets/audio/narration/ja/pilot/common_skip_menu.mp3

### common.skipped（任意）
### common.skipped (선택)

大丈夫です。次のお話へ進みましょう。
괜찮습니다. 다음 이야기로 넘어갈게요.

재생 시점: 이유 선택 뒤 다음 질문으로 넘어갈 때
파일: /assets/audio/narration/ja/pilot/common_skipped.mp3

### common.save_wait（必須）
### common.save_wait (필수)

少しお待ちください。係の者が確認します。
잠시만 기다려 주세요. 진행자가 확인하겠습니다.

재생 시점: 저장 실패로 진행이 막혔을 때, 반복 루프 재생 금지
파일: /assets/audio/narration/ja/pilot/common_save_wait.mp3

### common.stopped（必須）
### common.stopped (필수)

今日は、ここで終わりにしましょう。お話しくださって、ありがとうございます。
오늘은 여기서 마칠게요. 이야기를 들려주셔서 고맙습니다.

재생 시점: 진행자가 중단한 경우, 정상 완료와 구분
파일: /assets/audio/narration/ja/pilot/common_stopped.mp3

### common.complete（必須）
### common.complete (필수)

今日のお話は ここまでです。お話しくださって、ありがとうございます。
오늘 이야기는 여기까지예요. 이야기를 들려주셔서 고맙습니다.

재생 시점: 9문항을 모두 마친 뒤
파일: /assets/audio/narration/ja/pilot/common_complete.mp3

### common.same_participant（任意）
### common.same_participant (선택)

もう一度、最初から始めます。先ほどのお話も、そのまま残ります。
다시 처음부터 시작할게요. 앞서 나눈 이야기도 그대로 남습니다.

재생 시점: 같은 번호로 다시 시작하기 전, 진행자가 필요할 때만
파일: /assets/audio/narration/ja/pilot/common_same_participant.mp3

### q01.main（必須）
### q01.main (필수)

今日は何曜日ですか？
오늘은 무슨 요일인가요?

재생 시점: 1번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q01_main.mp3

### q01.weekday_0（必須）
### q01.weekday_0 (필수)

日曜日
일요일

재생 시점: Q1 회차에 실제 배치된 네 요일만 1~4 순서로 조합해 읽기. 이 파일과 버튼 위치를 고정 연결하지 않음
파일: /assets/audio/narration/ja/pilot/q01_weekday_0.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/11_exercise_d1_q2_option_d.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q01.weekday_1（必須）
### q01.weekday_1 (필수)

月曜日
월요일

재생 시점: Q1 회차에 실제 배치된 네 요일만 1~4 순서로 조합해 읽기. 이 파일과 버튼 위치를 고정 연결하지 않음
파일: /assets/audio/narration/ja/pilot/q01_weekday_1.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/08_exercise_d1_q2_option_a.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q01.weekday_2（必須）
### q01.weekday_2 (필수)

火曜日
화요일

재생 시점: Q1 회차에 실제 배치된 네 요일만 1~4 순서로 조합해 읽기. 이 파일과 버튼 위치를 고정 연결하지 않음
파일: /assets/audio/narration/ja/pilot/q01_weekday_2.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/09_exercise_d1_q2_option_b.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q01.weekday_3（必須）
### q01.weekday_3 (필수)

水曜日
수요일

재생 시점: Q1 회차에 실제 배치된 네 요일만 1~4 순서로 조합해 읽기. 이 파일과 버튼 위치를 고정 연결하지 않음
파일: /assets/audio/narration/ja/pilot/q01_weekday_3.mp3

### q01.weekday_4（必須）
### q01.weekday_4 (필수)

木曜日
목요일

재생 시점: Q1 회차에 실제 배치된 네 요일만 1~4 순서로 조합해 읽기. 이 파일과 버튼 위치를 고정 연결하지 않음
파일: /assets/audio/narration/ja/pilot/q01_weekday_4.mp3

### q01.weekday_5（必須）
### q01.weekday_5 (필수)

金曜日
금요일

재생 시점: Q1 회차에 실제 배치된 네 요일만 1~4 순서로 조합해 읽기. 이 파일과 버튼 위치를 고정 연결하지 않음
파일: /assets/audio/narration/ja/pilot/q01_weekday_5.mp3

### q01.weekday_6（必須）
### q01.weekday_6 (필수)

土曜日
토요일

재생 시점: Q1 회차에 실제 배치된 네 요일만 1~4 순서로 조합해 읽기. 이 파일과 버튼 위치를 고정 연결하지 않음
파일: /assets/audio/narration/ja/pilot/q01_weekday_6.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/10_exercise_d1_q2_option_c.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q02.main（必須）
### q02.main (필수)

八百屋で、赤いりんごは1個120円、青いりんごは1個80円です。赤いりんごを2個、青いりんごを3個買いました。合計はいくらですか？
과일가게에서 빨간 사과는 개당 120엔, 초록 사과는 개당 80엔입니다. 빨간 사과 2개와 초록 사과 3개를 사면 총 얼마인가요?

재생 시점: 2번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q02_main.mp3

### q02.option_a（必須）
### q02.option_a (필수)

440円
440엔

재생 시점: 2번 1번/A 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q02_option_a.mp3

### q02.option_b（必須）
### q02.option_b (필수)

480円
480엔

재생 시점: 2번 2번/B 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q02_option_b.mp3

### q02.option_c（必須）
### q02.option_c (필수)

520円
520엔

재생 시점: 2번 3번/C 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q02_option_c.mp3

### q02.option_d（必須）
### q02.option_d (필수)

400円
400엔

재생 시점: 2번 4번/D 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q02_option_d.mp3

### q03.main（必須）
### q03.main (필수)

午前9時40分に家を出て、バスに25分乗り、そのあと15分歩きました。目的地に着いたのは何時ですか？
오전 9시 40분에 집에서 나와 버스를 25분 타고, 이후 15분 걸었습니다. 목적지에 도착한 시간은 몇 시인가요?

재생 시점: 3번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q03_main.mp3

### q03.option_a（必須）
### q03.option_a (필수)

午前10時10分
오전 10시 10분

재생 시점: 3번 1번/A 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q03_option_a.mp3

### q03.option_b（必須）
### q03.option_b (필수)

午前10時30分
오전 10시 30분

재생 시점: 3번 2번/B 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q03_option_b.mp3

### q03.option_c（必須）
### q03.option_c (필수)

午前10時20分
오전 10시 20분

재생 시점: 3번 3번/C 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q03_option_c.mp3

### q03.option_d（必須）
### q03.option_d (필수)

午前10時40分
오전 10시 40분

재생 시점: 3번 4번/D 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q03_option_d.mp3

### q04.main（必須）
### q04.main (필수)

ある集まりで、田中さんは佐藤さんより早く来ました。鈴木さんは田中さんより早く来ました。3人の中で、最も早く来たのは誰ですか？
어떤 모임에서 다나카 씨는 사토 씨보다 먼저 왔습니다. 스즈키 씨는 다나카 씨보다 먼저 왔습니다. 세 사람 중 가장 먼저 온 사람은 누구인가요?

재생 시점: 4번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q04_main.mp3

### q04.option_a（必須）
### q04.option_a (필수)

佐藤さん
사토 씨

재생 시점: 4번 1번/A 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q04_option_a.mp3

### q04.option_b（必須）
### q04.option_b (필수)

田中さん
다나카 씨

재생 시점: 4번 2번/B 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q04_option_b.mp3

### q04.option_c（必須）
### q04.option_c (필수)

鈴木さん
스즈키 씨

재생 시점: 4번 3번/C 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q04_option_c.mp3

### q04.option_d（必須）
### q04.option_d (필수)

3人とも同じ
세 사람 모두 동일

재생 시점: 4번 4번/D 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q04_option_d.mp3

### q05.main（必須）
### q05.main (필수)

子どものころは、どんなところに住んでいましたか？ その町での思い出を聞かせてください。
어릴 때 어떤 곳에 사셨나요? 그 동네에서의 추억을 들려주세요.

재생 시점: 5번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q05_main.mp3

### q05.follow_up（必須）
### q05.follow_up (필수)

近所では、どんなことをして遊びましたか？
동네에서 어떤 놀이를 하셨나요?

재생 시점: 5번 답변이 짧아 진행자가 후속 질문을 한 번 연 경우에만, 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q05_follow_up.mp3

### q06.main（必須）
### q06.main (필수)

若いころは、どんなお仕事や活動をされていましたか？ そのころのことを教えてください。
젊었을 때 어떤 일이나 활동을 하셨나요? 그 시절 이야기를 들려주세요.

재생 시점: 6번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q06_main.mp3

### q06.follow_up（必須）
### q06.follow_up (필수)

その中で、忘れられない出来事はありますか？
그중 잊을 수 없는 일이 있나요?

재생 시점: 6번 답변이 짧아 진행자가 후속 질문을 한 번 연 경우에만, 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q06_follow_up.mp3

### q07.main（必須）
### q07.main (필수)

ご家族と過ごした時間の中で、一番幸せだった思い出を聞かせてください。
가족과 함께 보낸 시간 중 가장 행복했던 추억을 들려주세요.

재생 시점: 7번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q07_main.mp3

### q07.follow_up（必須）
### q07.follow_up (필수)

そのときは、どこで何をしましたか？
그때는 어디에서 무엇을 하셨나요?

재생 시점: 7번 답변이 짧아 진행자가 후속 질문을 한 번 연 경우에만, 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q07_follow_up.mp3

### q08.main（必須）
### q08.main (필수)

最近、一番楽しかったことは何ですか？ どんなことがあったのか聞かせてください。
최근 가장 즐거웠던 일은 무엇인가요? 어떤 일이 있었는지 들려주세요.

재생 시점: 8번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q08_main.mp3

### q08.follow_up（必須）
### q08.follow_up (필수)

そのとき、どなたと一緒でしたか？
그때 누구와 함께하셨나요?

재생 시점: 8번 답변이 짧아 진행자가 후속 질문을 한 번 연 경우에만, 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q08_follow_up.mp3

### q09.main（必須）
### q09.main (필수)

普段は、どんなことをして過ごすのが好きですか？
평소 어떤 일을 하며 시간을 보내는 것을 좋아하시나요?

재생 시점: 9번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q09_main.mp3

### q09.follow_up（必須）
### q09.follow_up (필수)

その楽しみは、いつごろから続けていますか？
그 취미나 즐거움은 언제부터 이어오셨나요?

재생 시점: 9번 답변이 짧아 진행자가 후속 질문을 한 번 연 경우에만, 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q09_follow_up.mp3

## 制作後の確認
## 제작 후 확인

同じ声で生成し、文言・読み・無音・音量を一文ずつ確認します。承認した元音声、SHA-256、選択した声、生成日時、実行パスをmanifestに残します。
같은 화자로 생성하고 문구·발음·무음·음량을 문장별로 확인합니다. 확정한 원본 음원·SHA-256·선택 화자·생성 일시·실행 경로를 manifest에 남깁니다.

この計画は参加者の発話をFishに送るものではありません。送るのは固定した案内文だけです。音声生成や公開を済ませたと記録しません。
이 계획은 참가자 발화를 Fish에 보내는 작업이 아닙니다. 전송 대상은 고정 안내 대본뿐입니다. 음원 생성이나 공개가 끝났다고 기록하지 않습니다.
