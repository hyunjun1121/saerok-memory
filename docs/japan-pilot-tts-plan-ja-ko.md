# Haru 日本実証 音声制作計画
# Haru 일본 실증 TTS 제작 계획

質問版 jp-first-meeting-1.0。これは制作台本です。新しいFish音声は未生成で、実証画面にはまだ接続していません。
문항 버전 jp-first-meeting-1.0. 제작 대본입니다. 새 Fish 음원은 아직 생성하거나 실증 화면에 연결하지 않았습니다.

## 過去に選んだ声
## 기존에 선택한 화자

Fish Audioでは「女性アナウンサー（ベテラン）」を採用しました。プロジェクト内IDはveteran、形式はgentle_double_pauseです。
Fish Audio 최종 화자는 여성 아나운서(베테랑)입니다. 일본어 표시명은 女性アナウンサー（ベテラン）, 프로젝트 ID는 veteran, 형식은 gentle_double_pause입니다.

比較候補はank0、田中みなみ風、女性アナウンサー（ベテラン）でした。QwenのOno_Annaは別の生成系です。Fishの実際のreference/model IDは保存記録から断定しません。
비교 후보는 ank0·田中みなみ風·女性アナウンサー（ベテラン）였습니다. Qwen의 Ono_Anna는 다른 생성 계열입니다. Fish의 실제 reference/model ID는 저장 기록만으로 단정하지 않습니다.

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

question: 20件。
question: 20개.

option: 16件。
option: 16개.

hint: 5件。
hint: 5개.

reference: 1件。
reference: 1개.

合計58枠、必須54枠、任意4枠。日本語の完全一致文は共通化でき、異なる文は57種類です。
총 58개 슬롯, 필수 54개, 선택 4개입니다. 일본어가 완전히 같은 문장은 재사용할 수 있으며 서로 다른 문장은 57종입니다.

質問は本質問12、追加質問8、選択肢16です。補足と見本、開始・操作・保存後・中断・終了の共通案内を別にします。
질문은 본질문 12개, 후속 질문 8개, 선택지 16개입니다. 도움말·보기와 시작·조작·저장 후·중단·종료 공통 안내를 별도로 둡니다.

## 再生と録音の原則
## 재생과 녹음 원칙

質問、必要な補足、操作案内の順に一度だけ再生し、終了してから録音を許可します。録音中はTTSを流しません。
질문·필요한 도움말·조작 안내 순서로 한 번 재생하고 끝난 뒤 녹음할 수 있게 합니다. 녹음 중에는 TTS를 재생하지 않습니다.

現在は再生ボタンによるブラウザー読み上げのみです。自動再生、選択肢の読み上げ、録り直し前の待機、60秒後の案内、中断と完了の音声分岐は今後の実装対象です。
현재는 다시 듣기 버튼을 통한 브라우저 읽어주기만 동작합니다. 자동 재생·선택지 읽기·재녹음 전 대기·60초 후 안내·중단/완료 음성 분기는 이후 구현 대상입니다.

録音開始は短い合図で知らせ、聞いていますという声を繰り返しません。保存完了の案内はサーバー保存が成功した後だけです。
녹음 시작은 짧은 신호로 알리고 듣고 있다는 음성을 반복하지 않습니다. 저장 완료 안내는 서버 저장 성공 후에만 합니다.

選択肢は1から4の固定順で読み、答えを先に知らせません。図形は丸・三角・四角として読みます。本人の番号、名前、曜日を固定音声に入れません。
선택지는 1~4의 고정 순서로 읽고 정답을 미리 알려주지 않습니다. 도형은 동그라미·세모·네모로 읽습니다. 고정 음원에 참가자 번호·이름·요일을 넣지 않습니다.

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

これから、あなたの暮らしや好きなことを伺います。約10分です。話したくないことは飛ばせます。ご自分のペースでお話しください。
지금부터 생활과 좋아하는 것에 대해 여쭙겠습니다. 약 10분입니다. 말하고 싶지 않은 내용은 건너뛰셔도 됩니다. 편안한 속도로 말씀해 주세요.

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

1回の録音は最大60秒です。短いお答えでもかまいません。
한 번에 최대 60초 녹음합니다. 짧게 답하셔도 괜찮습니다.

재생 시점: 첫 녹음 전에만 상한 설명
파일: /assets/audio/narration/ja/pilot/common_voice_limit.mp3

### common.recording_ended（必須）
### common.recording_ended (필수)

録音が終わりました。右のボタンで保存してください。
녹음이 끝났어요. 오른쪽 버튼으로 저장해 주세요.

재생 시점: 60초 자동 정지 후, 마이크가 완전히 닫힌 뒤
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

재생 시점: 12문항을 모두 마친 뒤
파일: /assets/audio/narration/ja/pilot/common_complete.mp3

### common.same_participant（任意）
### common.same_participant (선택)

もう一度、最初から始めます。先ほどのお話も、そのまま残ります。
다시 처음부터 시작할게요. 앞서 나눈 이야기도 그대로 남습니다.

재생 시점: 같은 번호로 다시 시작하기 전, 진행자가 필요할 때만
파일: /assets/audio/narration/ja/pilot/common_same_participant.mp3

### q01.main（必須）
### q01.main (필수)

今日の気分はいかがですか。
오늘 기분은 어떠세요?

재생 시점: 1번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q01_main.mp3

### q01.option_a（必須）
### q01.option_a (필수)

とても良い
매우 좋음

재생 시점: 1번 1번/A 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q01_option_a.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/03_exercise_d1_q1_option_a.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q01.option_b（必須）
### q01.option_b (필수)

良い
좋음

재생 시점: 1번 2번/B 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q01_option_b.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/04_exercise_d1_q1_option_b.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q01.option_c（必須）
### q01.option_c (필수)

まあまあ
그저 그럼

재생 시점: 1번 3번/C 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q01_option_c.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/05_exercise_d1_q1_option_c.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q01.option_d（必須）
### q01.option_d (필수)

あまり良くない
좋지 않음

재생 시점: 1번 4번/D 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q01_option_d.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/06_exercise_d1_q1_option_d.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q02.main（必須）
### q02.main (필수)

子どものころは、どのあたりで暮らしていましたか。
어릴 때는 어느 지역에서 사셨나요?

재생 시점: 2번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q02_main.mp3

### q02.follow_up（必須）
### q02.follow_up (필수)

そのころ、よくしていた遊びや楽しみを一つ教えてください。
그때 자주 하던 놀이나 즐기던 일을 하나 알려 주세요.

재생 시점: 2번 본질문 저장 후 후속 질문 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q02_follow_up.mp3

### q03.main（必須）
### q03.main (필수)

これまで、長く続けてきた仕事や役割を一つ教えてください。
지금까지 오래 해 오신 일이나 역할을 하나 알려 주세요.

재생 시점: 3번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q03_main.mp3

### q03.hint（必須）
### q03.hint (필수)

お仕事のほか、家事や地域での活動でもかまいません。
직장 일 외에 집안일이나 지역 활동도 괜찮습니다.

재생 시점: 3번 본질문 뒤, 응답을 유도하는 예시를 추가하지 않음
파일: /assets/audio/narration/ja/pilot/q03_hint.mp3

### q03.follow_up（必須）
### q03.follow_up (필수)

ふだん、どんなことをしていましたか。
평소에 구체적으로 어떤 일을 하셨나요?

재생 시점: 3번 본질문 저장 후 후속 질문 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q03_follow_up.mp3

### q04.main（必須）
### q04.main (필수)

豆腐を150円、卵を250円で買い、500円を払いました。おつりはいくらですか。
두부 150엔과 달걀 250엔을 사고 500엔을 냈습니다. 거스름돈은 얼마인가요?

재생 시점: 4번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q04_main.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/17_exercise_d1_q4_prompt.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q04.option_a（必須）
### q04.option_a (필수)

0円
0엔

재생 시점: 4번 1번/A 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q04_option_a.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/18_exercise_d1_q4_option_a.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q04.option_b（必須）
### q04.option_b (필수)

50円
50엔

재생 시점: 4번 2번/B 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q04_option_b.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/19_exercise_d1_q4_option_b.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q04.option_c（必須）
### q04.option_c (필수)

100円
100엔

재생 시점: 4번 3번/C 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q04_option_c.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/20_exercise_d1_q4_option_c.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q04.option_d（必須）
### q04.option_d (필수)

150円
150엔

재생 시점: 4번 4번/D 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q04_option_d.mp3

문구 일치 후보: /assets/audio/narration/ja/day1/21_exercise_d1_q4_option_d.mp3. 아직 연결하지 않았으며 검수 후 재사용합니다.

### q05.main（必須）
### q05.main (필수)

今は、どなたと一緒に暮らしていますか。
지금은 누구와 함께 살고 계신가요?

재생 시점: 5번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q05_main.mp3

### q05.hint（必須）
### q05.hint (필수)

一人暮らしや施設での暮らしも、そのまま教えてください。お名前は言わなくてもかまいません。
혼자 살거나 시설에서 생활하시는 경우도 그대로 알려 주세요. 이름은 말하지 않으셔도 됩니다.

재생 시점: 5번 본질문 뒤, 응답을 유도하는 예시를 추가하지 않음
파일: /assets/audio/narration/ja/pilot/q05_hint.mp3

### q05.follow_up（必須）
### q05.follow_up (필수)

離れて暮らしているご家族や、よく連絡を取る方についても、話せる範囲で教えてください。
따로 사는 가족이나 자주 연락하는 분에 대해서도 편한 만큼 알려 주세요.

재생 시점: 5번 본질문 저장 후 후속 질문 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q05_follow_up.mp3

### q06.main（必須）
### q06.main (필수)

ご家族やご友人とのことで、うれしかった出来事を一つ教えてください。
가족이나 친구와 있었던 일 중 기뻤던 일을 하나 들려주세요.

재생 시점: 6번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q06_main.mp3

### q06.follow_up（必須）
### q06.follow_up (필수)

そのときの様子を、もう少し聞かせてください。
그때의 모습을 조금 더 들려주세요.

재생 시점: 6번 본질문 저장 후 후속 질문 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q06_follow_up.mp3

### q07.main（必須）
### q07.main (필수)

ことわざ「笑う門には」に続く言葉はどれですか。
속담 ‘웃는 집에는’ 뒤에 이어지는 말은 무엇인가요?

재생 시점: 7번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q07_main.mp3

### q07.option_a（必須）
### q07.option_a (필수)

福来る
복이 온다

재생 시점: 7번 1번/A 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q07_option_a.mp3

### q07.option_b（必須）
### q07.option_b (필수)

足が軽くなる
발걸음이 가벼워진다

재생 시점: 7번 2번/B 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q07_option_b.mp3

### q07.option_c（必須）
### q07.option_c (필수)

ご飯がおいしくなる
밥이 맛있어진다

재생 시점: 7번 3번/C 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q07_option_c.mp3

### q07.option_d（必須）
### q07.option_d (필수)

道が開ける
길이 열린다

재생 시점: 7번 4번/D 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q07_option_d.mp3

### q08.main（必須）
### q08.main (필수)

このごろ、楽しみにしていることを一つ教えてください。
요즘 즐기거나 기대하는 일을 하나 알려 주세요.

재생 시점: 8번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q08_main.mp3

### q08.hint（必須）
### q08.hint (필수)

毎日の小さな楽しみでもかまいません。
일상의 작은 즐거움도 괜찮습니다.

재생 시점: 8번 본질문 뒤, 응답을 유도하는 예시를 추가하지 않음
파일: /assets/audio/narration/ja/pilot/q08_hint.mp3

### q08.follow_up（必須）
### q08.follow_up (필수)

どんなところが好きですか。
어떤 점이 좋으세요?

재생 시점: 8번 본질문 저장 후 후속 질문 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q08_follow_up.mp3

### q09.main（必須）
### q09.main (필수)

好きな食べ物を一つ教えてください。
좋아하는 음식을 하나 알려 주세요.

재생 시점: 9번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q09_main.mp3

### q09.follow_up（必須）
### q09.follow_up (필수)

その食べ物にまつわる思い出があれば、聞かせてください。
그 음식과 관련된 추억이 있다면 들려주세요.

재생 시점: 9번 본질문 저장 후 후속 질문 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q09_follow_up.mp3

### q10.main（必須）
### q10.main (필수)

上に見える形とまったく同じものを選んでください。
위에 보이는 모양과 똑같은 것을 고르세요.

재생 시점: 10번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q10_main.mp3

### q10.reference（必須）
### q10.reference (필수)

見本は、丸、三角です。
보기는 동그라미, 세모입니다.

재생 시점: 10번 보기 도형 읽기, 실제 시각 자극만 언어화
파일: /assets/audio/narration/ja/pilot/q10_reference.mp3

### q10.option_a（必須）
### q10.option_a (필수)

丸、三角
동그라미, 세모

재생 시점: 10번 1번/A 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q10_option_a.mp3

### q10.option_b（必須）
### q10.option_b (필수)

三角、丸
세모, 동그라미

재생 시점: 10번 2번/B 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q10_option_b.mp3

### q10.option_c（必須）
### q10.option_c (필수)

丸、丸
동그라미, 동그라미

재생 시점: 10번 3번/C 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q10_option_c.mp3

### q10.option_d（必須）
### q10.option_d (필수)

三角、三角
세모, 세모

재생 시점: 10번 4번/D 선택지, 고정 순서 읽기 또는 재생 요청
파일: /assets/audio/narration/ja/pilot/q10_option_d.mp3

### q11.main（必須）
### q11.main (필수)

最近あったことで、誰かに話したいことを一つ教えてください。
최근 있었던 일 중 누군가에게 이야기하고 싶은 일을 하나 들려주세요.

재생 시점: 11번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q11_main.mp3

### q11.hint（必須）
### q11.hint (필수)

今日のことでも、少し前のことでもかまいません。
오늘 일도, 조금 전의 일도 괜찮습니다.

재생 시점: 11번 본질문 뒤, 응답을 유도하는 예시를 추가하지 않음
파일: /assets/audio/narration/ja/pilot/q11_hint.mp3

### q11.follow_up（必須）
### q11.follow_up (필수)

そのときの様子を、もう少し聞かせてください。
그때의 모습을 조금 더 들려주세요.

재생 시점: 11번 본질문 저장 후 후속 질문 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q11_follow_up.mp3

### q12.main（必須）
### q12.main (필수)

これから、やってみたいことを一つ教えてください。
앞으로 해 보고 싶은 일을 하나 알려 주세요.

재생 시점: 12번 본질문 진입/다시 듣기, 안내 종료 후 응답
파일: /assets/audio/narration/ja/pilot/q12_main.mp3

### q12.hint（必須）
### q12.hint (필수)

以前していて、またやりたいことでもかまいません。
예전에 하셨다가 다시 하고 싶은 일도 괜찮습니다.

재생 시점: 12번 본질문 뒤, 응답을 유도하는 예시를 추가하지 않음
파일: /assets/audio/narration/ja/pilot/q12_hint.mp3

### q12.follow_up（必須）
### q12.follow_up (필수)

そのことの、どんなところを楽しみにしていますか。
그 일의 어떤 점이 기대되세요?

재생 시점: 12번 본질문 저장 후 후속 질문 진입/다시 듣기
파일: /assets/audio/narration/ja/pilot/q12_follow_up.mp3

## 制作後の確認
## 제작 후 확인

同じ声で生成し、文言・読み・無音・音量を一文ずつ確認します。承認した元音声、SHA-256、選択した声、生成日時、実行パスをmanifestに残します。
같은 화자로 생성하고 문구·발음·무음·음량을 문장별로 확인합니다. 확정한 원본 음원·SHA-256·선택 화자·생성 일시·실행 경로를 manifest에 남깁니다.

この計画は参加者の発話をFishに送るものではありません。送るのは固定した案内文だけです。音声生成や公開を済ませたと記録しません。
이 계획은 참가자 발화를 Fish에 보내는 작업이 아닙니다. 전송 대상은 고정 안내 대본뿐입니다. 음원 생성이나 공개가 끝났다고 기록하지 않습니다.
