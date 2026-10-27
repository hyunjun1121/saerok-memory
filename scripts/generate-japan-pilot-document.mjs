import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { pilotKoreanQuestionCopy } from './pilot-document-copy.mjs';

const vite = await createServer({ appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { PILOT_PROTOCOL_VERSION, PILOT_QUESTIONS, PILOT_COPY } = await vite.ssrLoadModule('/src/features/pilot/pilotProtocol.ts');
  const { getLocalizedText } = await vite.ssrLoadModule('/src/utils/localizedText.ts');
  const lines = [];
  const pair = (ja, ko) => lines.push(ja, ko, '');
  const local = (value, language) => getLocalizedText(value, language);
  pair('# Haru 日本の高齢者向け 1回の実証セッション 最終版', '# Haru 일본 고령자 대상 1회 실증 문항 세트 — 최종 확정안');
  pair(`実施手順と質問構成 版 ${PILOT_PROTOCOL_VERSION}`, `진행 방법과 문항 구성 버전 ${PILOT_PROTOCOL_VERSION}`);
  pair('さまざまな認知活動への応答を観察し、個人の記憶RAGに使う自伝的な経験と日常の情報を音声で集めます。', '다양한 인지 활동에 대한 응답을 관찰하고, 개인 기억 RAG 구축에 활용할 자전적 경험과 일상 정보를 음성으로 수집합니다.');
  pair('確定した構成は全9問です。Q1〜Q4は四択4問、Q5〜Q9は音声5問です。全員に同じ順序で提示し、曜日だけは当日の日本の日付に合わせます。', '확정 구성은 총 9문항입니다. Q1~Q4는 4지선다 4문항, Q5~Q9는 음성 5문항입니다. 모든 참가자에게 같은 순서로 제시하며 요일만 실증 당일의 일본 날짜에 맞춥니다.');
  pair('目標は8〜10分です。導入30秒、四択165秒、音声375秒、終了20秒で、配分上は9分50秒です。実際の発話を優先し、セッション全体の強制終了はしません。', '목표 시간은 8~10분입니다. 도입 30초·선택형 165초·음성 375초·종료 20초로 배분상 9분 50초입니다. 실제 발화를 우선하며 세션 전체를 강제로 종료하지 않습니다.');
  pair('本実証は認知活動への反応と個人の記憶収集の可能性を見るものです。臨床的に検証された認知症の判別や診断の道具として解釈しません。', '이번 실증은 인지 활동에 대한 반응과 개인 기억 수집 가능성을 살펴보는 목적입니다. 임상적으로 검증된 치매 선별검사나 진단 도구로 해석하지 않습니다.');
  pair('## 実施前の準備', '## 진행 전 준비');
  pair('参加目的、録音、保管期間、後の個別利用を担当者が説明し、同意を確認します。説明と同意の時間は10分に含めません。', '진행자가 참여 목적·녹음·보관 기간·후속 개인화 활용을 설명하고 동의를 확인합니다. 설명과 동의 시간은 10분에 포함하지 않습니다.');
  pair('開始画面で1、2、3、4、5、6の参加者番号を選びます。7以上も入力できます。番号を再び選んでも、必ず最初から別の回として開始します。', '시작 화면에서 1·2·3·4·5·6 참가자 번호를 고릅니다. 7번 이상도 입력할 수 있습니다. 같은 번호를 다시 골라도 항상 처음부터 별도 회차로 시작합니다.');
  pair('例えば1番を二度選ぶと、参加者1の1回目と2回目が別のIDで残ります。前回の選択、途中の音声、滞在記録を上書きしません。', '예를 들어 1번을 두 번 선택하면 참가자 1의 1회차와 2회차가 서로 다른 ID로 남습니다. 이전 선택·중간 음성·체류 기록을 덮어쓰지 않습니다.');
  pair('録音、途中や録り直しの音声、回答、操作記録のPC保存への同意を確認します。後の文字起こしと、明示された記憶の保存・個別利用への同意は別に選びます。', '녹음, 중간·재녹음 음성, 답변, 조작 기록의 PC 저장 동의를 확인합니다. 이후 전사와 명시적으로 말한 기억의 저장·개인화 활용 동의는 별도로 선택합니다.');
  pair('新しい同意文の版はjp-pilot-consent-2.0です。過去の同意を新しい範囲に書き換えません。後の文字起こしと記憶利用への適格性は、今回の範囲への明示的な同意で区別します。', '새 동의 문구 버전은 jp-pilot-consent-2.0입니다. 이전 동의를 새 범위로 바꾸지 않습니다. 이후 전사·기억 활용 가능 여부는 이번 범위의 명시적 동의로 구분합니다.');
  pair('データはこのPCのlocal-data/japan-pilotに自動保存します。回答の外部送信、自動文字起こし、自動の人物像推定は実行しません。', '데이터는 이 PC의 local-data/japan-pilot에 자동 저장합니다. 답변 외부 전송·자동 전사·자동 인물 프로필 추정은 실행하지 않습니다.');
  pair('## 導入 30秒', '## 도입 30초');
  pair(local(PILOT_COPY.intro, 'ja'), local(PILOT_COPY.intro, 'ko'));
  pair('## 共通の進め方', '## 공통 진행 방법');
  pair('画面の四つのボタンは、左上が1とA、右上が2とB、左下が3とC、右下が4とDです。色は赤、黄、緑、青の順です。', '화면 버튼은 왼쪽 위가 1·A, 오른쪽 위가 2·B, 왼쪽 아래가 3·C, 오른쪽 아래가 4·D입니다. 색은 빨강·노랑·초록·파랑 순서입니다.');
  pair('四択は一度押して選び、同じボタンをもう一度押して決定します。画面の決定ボタンも使えます。', '4지선다는 한 번 눌러 선택한 뒤 같은 버튼을 다시 눌러 확정합니다. 화면의 선택 확정 버튼도 사용할 수 있습니다.');
  pair('音声は正解のない自由なお話です。本質問に十分答えられたら「次へ」で次の項目へ進み、追加質問は出しません。', '음성은 정답이 없는 개방형 질문입니다. 본질문에 충분히 답하셨으면 다음으로 다음 문항에 진행하고 후속 질문은 제시하지 않습니다.');
  pair('答えが短いと担当者が判断した場合だけ、保存後に「追加で聞く（担当者）」を押し、用意した追加質問を一度使います。発話の長さや内容を自動判定しません。', '답변이 짧다고 진행자가 판단한 경우에만 저장 후 후속 질문하기 (진행자)를 눌러 준비된 후속 질문을 한 번 사용합니다. 발화 길이나 내용을 자동 판정하지 않습니다.');
  pair('会話では右側の2か4で録音開始、もう一度右で録音終了、保存後に右で次へ進みます。左側の1か3で質問の再生か録り直しを行います。', '음성에서는 오른쪽 2·4로 녹음을 시작하고 다시 오른쪽으로 마칩니다. 저장 후 오른쪽으로 다음 단계로 갑니다. 왼쪽 1·3은 질문 다시 듣기 또는 다시 녹음입니다.');
  pair('音声は1項目45〜90秒を目安に自然に話していただきます。60秒では止めず、1回の録音上限は3分です。本質問と使用した追加質問は別に保存します。', '음성은 문항당 45~90초를 목표로 자연스럽게 말씀하시도록 합니다. 60초에 끊지 않으며 한 번의 녹음 상한은 3분입니다. 본질문과 사용한 후속 질문은 따로 저장합니다.');
  pair('追加質問を断った場合も、本質問の録音は残します。追加質問は不要、提示済み、回答済み、スキップを区別し、担当者の判断と理由を記録します。', '후속 질문을 거절해도 본질문 녹음은 보존합니다. 후속 질문은 불필요·제시·응답·건너뛰기를 구분하고 진행자의 판단과 이유를 기록합니다.');
  pair('質問を一つずつ読み、返答を待ちます。誘導する具体例や、本人が話していない家族関係を付け足しません。', '질문을 하나씩 읽고 대답을 기다립니다. 답을 유도하는 구체적 예나 본인이 말하지 않은 가족관계를 덧붙이지 않습니다.');
  pair('思い出せない、または話しづらい項目は飛ばせます。特に家族の項目は気持ちの負担を確かめ、答えを求め続けません。', '기억이 나지 않거나 답하기 불편한 문항은 건너뛸 수 있습니다. 특히 가족 문항은 정서적 부담이 없는지 살피고 답변을 재촉하지 않습니다.');
  pair('飛ばす理由は、話したくない、当てはまらない、答えが出てこない、録音できないに分けます。今回の収集では、同意した途中の音声や録り直しも別々に残します。', '건너뛰기 이유는 응답 건너뛰기·해당 없음·답이 떠오르지 않음·녹음 실패로 구분합니다. 이번 수집에서는 동의한 중간 음성과 재녹음도 각각 보존합니다.');
  pair('## 質問一覧', '## 문항 구성');
  for (const [index, question] of PILOT_QUESTIONS.entries()) {
    if (index === 0) pair('## Part 1 四択 Q1〜Q4', '## Part 1 4지선다 Q1~Q4');
    if (index === 4) pair('## Part 2 音声 Q5〜Q9', '## Part 2 음성 응답 Q5~Q9');
    pair(`### ${index + 1} ${local(question.title, 'ja')}`, `### ${index + 1} ${local(question.title, 'ko')}`);
    pair(`形式 ${question.kind === 'voice' ? '音声 本質問と必要時のみ追加質問' : '四択'} 目安 ${question.targetSeconds}秒`, `방식 ${question.kind === 'voice' ? '음성 본질문과 필요할 때만 후속 질문' : '4지선다'} 목표 ${question.targetSeconds}초`);
    pair(`質問 ${local(question.prompt, 'ja')}`, `질문 ${pilotKoreanQuestionCopy(question, local)}`);
    if (question.kind === 'voice') {
      if (question.hint) pair(`補足 ${local(question.hint, 'ja')}`, `도움말 ${local(question.hint, 'ko')}`);
      pair(`短いお答えのときだけの追加質問 ${local(question.followUp, 'ja')}`, `짧은 답변일 때만 사용하는 후속 질문 ${local(question.followUp, 'ko')}`);
      pair(`記録項目 ${question.informationFields.join(' / ')}`, `수집 항목 ${question.informationFields.join(' / ')}`);
    } else {
      if (question.reference) pair(`見本 ${question.reference}`, `기준 모양 ${question.reference}`);
      for (const option of question.options) pair(`選択肢 ${option.id} ${local(option.label, 'ja')}`, `선택지 ${option.id} ${pilotKoreanQuestionCopy(question, local, option)}`);
      if (question.dynamic === 'japan-weekday') {
        pair('上の選択肢は日曜日が答えの例です。実行時はAsia/Tokyoの当日曜日を必ず含め、他の3曜日を重複なく選び、4択の順を無作為にします。', '위 보기는 일요일이 정답인 예시입니다. 실행 시 Asia/Tokyo의 실제 당일 요일을 반드시 포함하고 나머지 세 요일을 중복 없이 뽑아 네 보기 순서를 무작위로 섞습니다.');
        pair('開始時の日本の日付、曜日、タイムゾーン、実際の選択肢と正解をその回に固定して保存します。回答中の再描画や後日の書き出しでは変わりません。PCの時計を事前に確認し、日付をまたいで実施する場合は新しい回を開始します。', '시작 시 일본 날짜·요일·시간대·실제 보기·정답을 회차에 고정해 저장합니다. 응답 중 다시 그리거나 나중에 내보낼 때 바뀌지 않습니다. PC 시계를 사전에 확인하고 날짜가 바뀐 뒤 진행한다면 새 회차를 시작합니다.');
      } else pair(`活動の答え ${question.correctOptionId}。正誤と応答時間を保存し、人物の事実としては扱いません。`, `활동 정답 ${question.correctOptionId}. 정오답과 응답 시간을 저장하며 인물의 사실로 취급하지 않습니다.`);
      if (question.explanation) pair(`説明 ${local(question.explanation, 'ja')}`, `설명 ${local(question.explanation, 'ko')}`);
    }
    pair(`目的 ${local(question.purpose, 'ja')}`, `목적 ${local(question.purpose, 'ko')}`);
  }
  pair('## 終了 20秒', '## 종료 20초');
  pair(`${local(PILOT_COPY.complete, 'ja')}。${local(PILOT_COPY.thanks, 'ja')}`, `${local(PILOT_COPY.complete, 'ko')}. ${local(PILOT_COPY.thanks, 'ko')}`);
  pair('担当者は保存表示を確認し、その回か全員分をZIPで書き出します。戻った方も同じ参加者番号を選び、新しい回として最初から収集します。', '진행자는 저장 표시를 확인하고 해당 회차 또는 전체 참가자 답변을 ZIP으로 내보냅니다. 다시 온 분도 같은 참가자 번호를 선택해 새 회차로 처음부터 수집합니다.');
  pair('## 保存内容と後の利用', '## 저장 내용과 후속 활용');
  pair('SQLiteのpilot.sqliteに参加者と回、回答、時刻、操作イベントを保存し、participants/参加者番号/attempt-回-ID/audioに音声を残します。', 'SQLite pilot.sqlite에는 참가자·회차·응답·시각·조작 이벤트를 저장하고, participants/참가자번호/attempt-회차-ID/audio에 음성을 남깁니다.');
  pair('録音中も約1秒ごとに小さな音声データを保存します。終了前の音声はpartialとして残り、正常終了した録音は一つの音声ファイルにまとめます。', '녹음 중에도 약 1초마다 작은 음성 데이터를 저장합니다. 마치지 못한 음성은 partial로 남고, 정상 종료한 녹음은 하나의 음성 파일로 합칩니다.');
  pair('通信の再試行はイベントIDと音声の連番で重複を防ぎます。サーバーに届かなかったデータはブラウザーの送信待ち領域から再送します。', '이벤트 ID와 음성 순번으로 재전송 중복을 방지합니다. 서버에 도착하지 못한 데이터는 브라우저 전송 대기 영역에서 재전송합니다.');
  pair('ZIPにはsessions.json、実音声、attempts.csv、questions.csv、events.csvを含めます。参加者番号と回のIDで、同じ方の複数回の回答を結び付けます。', 'ZIP에는 sessions.json·실제 음성·attempts.csv·questions.csv·events.csv를 포함합니다. 참가자 번호와 회차 ID로 같은 사람의 여러 수집 회차를 연결합니다.');
  pair('質問の表示と退出、選択変更、確定、録音開始と停止、録り直し、再生、画面の非表示、フォーカス、通信状態、端末環境を記録します。', '문항 진입·이탈, 선택 변경·확정, 녹음 시작·중지·재녹음, 다시 듣기, 화면 숨김·포커스, 연결 상태, 기기 환경을 기록합니다.');
  pair('滞在時間は画面表示からの経過時間と、表示されフォーカスがある時間に分けます。5秒ごとに途中経過を残し、最後の質問と本質問か追加質問かも保存します。', '체류 시간은 화면 진입 후 경과 시간과 화면이 표시되고 포커스가 있는 시간으로 나눕니다. 5초마다 중간 시점을 남기고 마지막 문항·본질문·후속 질문 위치도 저장합니다.');
  pair('キーボードとUSBの物理ボタンが同じキーを送る場合、入力元はkeyboard_or_physicalとして記録します。集中や能力を直接表す値とは解釈しません。', '키보드와 USB 물리 버튼이 같은 키를 보내면 입력 출처는 keyboard_or_physical로 기록합니다. 집중도나 능력을 직접 나타내는 값으로 해석하지 않습니다.');
  pair('強制終了や停電では最後の送信が間に合わない場合があります。退出イベントがなければ、最後の確認時点までの時間として記録し、正確な終了時刻を推測で埋めません。', '강제 종료·전원 차단 때는 마지막 전송이 끝나지 않을 수 있습니다. 이탈 이벤트가 없으면 마지막 확인 시점까지의 시간으로 기록하고 정확한 종료 시각을 추측으로 채우지 않습니다.');
  pair('本質問と追加質問はmainとfollowUpで区別します。文字起こしはnot_requested、人物情報は未確認として書き出します。', '본질문과 후속 질문은 main과 followUp으로 구분합니다. 전사는 not_requested로, 인물 정보는 미확인 상태로 내보냅니다.');
  pair('後で音声を文字に起こして確認する際は、情報ごとに質問番号と発言区間を残します。同居、名前、時期など不明な点を推測で補いません。', '나중에 음성을 전사·확인할 때 정보마다 문항 번호와 발화 구간을 남깁니다. 동거 여부·이름·시기 등 불명확한 내용을 추측으로 채우지 않습니다.');
  pair('RAGには本人が明示的に話した人、場所、職業、活動、出来事、好みだけを抽出します。質問文の田中・佐藤・鈴木や計算の正誤を本人の人間関係・経験に変換しません。', 'RAG에는 본인이 명시적으로 언급한 인물·장소·직업·활동·사건·취향만 추출합니다. 문항 속 다나카·사토·스즈키나 계산 정오답을 참가자의 인간관계·경험으로 바꾸지 않습니다.');
  pair('版1.0の12問の記録は元の質問スナップショットとともに残します。版2.0は新しい回だけに適用し、旧記録を9問に書き換えません。混在ZIPでは各回のprotocolVersionとprotocolSnapshotを参照します。', '버전 1.0의 12문항 기록은 원래 문항 스냅샷과 함께 보존합니다. 버전 2.0은 새 회차에만 적용하며 이전 기록을 9문항으로 바꾸지 않습니다. 혼합 ZIP에서는 각 회차의 protocolVersion과 protocolSnapshot을 참조합니다.');
  pair('個別利用に同意していない記録は、後の個別質問づくりから除外します。書き出したファイルの保管と削除も担当者が管理します。', '개인화 활용에 동의하지 않은 기록은 이후 개인화 문항 생성에서 제외합니다. 내보낸 파일의 보관·삭제도 진행자가 관리합니다.');
  pair('明示的な削除操作は選んだ一回だけを削除します。同じ参加者の他の回は残ります。書き出したZIPとバックアップは別に管理します。', '명시적 삭제는 선택한 회차 하나만 삭제합니다. 같은 참가자의 다른 회차는 남습니다. 내보낸 ZIP과 백업은 별도로 관리합니다.');
  pair('PCのフォルダー全体をコピーして保管するときは収集サーバーを終了してから行います。サーバー実行中はZIP書き出しを使います。', 'PC의 저장 폴더 전체를 복사해 보관할 때는 수집 서버를 종료한 뒤 진행합니다. 서버가 실행 중일 때는 ZIP 내보내기를 사용합니다.');
  pair('## 起動方法と確認事項', '## 실행 방법과 확인 사항');
  pair('別のPCではGitとNode.js 24.x、npm 11以上を用意します。Python、GPU、APIキー、別のSQLiteインストールは不要です。', '다른 PC에서는 Git·Node.js 24.x·npm 11 이상을 준비합니다. Python·GPU·API 키·별도 SQLite 설치는 필요하지 않습니다.');
  pair('git clone --branch japan-pilot --single-branch https://github.com/hyunjun1121/saerok-memory.git を実行し、cd saerok-memory で移動します。', 'git clone --branch japan-pilot --single-branch https://github.com/hyunjun1121/saerok-memory.git 실행 후 cd saerok-memory로 이동합니다.');
  pair('npm ci --include=dev --include=optional --no-audit --no-fund の後、npm run start:pilot でビルドと収集サーバーの起動を行います。', 'npm ci --include=dev --include=optional --no-audit --no-fund 실행 후 npm run start:pilot로 빌드와 수집 서버 실행을 함께 진행합니다.');
  pair('日本実証版の起動 npm run dev:pilot 画面 /pilot 日本語が標準です。', '일본 실증 버전 실행 npm run dev:pilot 화면 /pilot 기본 언어는 일본어입니다.');
  pair('http://127.0.0.1:5188/pilotを開きます。韓国語の確認画面は /pilot?lang=ko です。通常のViteだけでなく、収集サーバーを含むコマンドを使います。', 'http://127.0.0.1:5188/pilot을 엽니다. 한국어 확인 화면은 /pilot?lang=ko입니다. 일반 Vite 실행 대신 수집 서버가 포함된 명령을 사용합니다.');
  pair('実証版ビルド npm run build:pilot ビルド後のローカル起動 npm run preview:pilot 文書の再生成 npm run docs:pilot', '실증 버전 빌드 npm run build:pilot 빌드 후 로컬 실행 npm run preview:pilot 문서 재생성 npm run docs:pilot');
  pair('現場ではビルド後のpreview:pilotを推奨します。dev:pilotでも自動の画面更新を無効にし、収集中のソース変更で回答が途切れないようにします。', '현장에서는 빌드 후 preview:pilot 실행을 권장합니다. dev:pilot에서도 자동 화면 갱신을 꺼 수집 중 소스 변경으로 응답이 끊기지 않도록 합니다.');
  pair('Node.js 24を使います。保存先を変える場合はHARU_PILOT_DATA_DIRを設定します。収集データはGitとVercelへの公開対象から除外します。', 'Node.js 24를 사용합니다. 저장 폴더를 바꾸려면 HARU_PILOT_DATA_DIR을 설정합니다. 수집 데이터는 Git·Vercel 공개 대상에서 제외합니다.');
  pair('Git cloneで参加者データは移りません。別のPCでは空の状態から始まります。同じ方の過去の回も移す場合は、サーバー停止後に保存フォルダー全体を移します。', 'Git clone으로 참가자 데이터는 이동하지 않습니다. 다른 PC에서는 빈 상태로 시작합니다. 기존 회차도 옮기려면 서버 종료 후 저장 폴더 전체를 복사합니다.');
  pair('詳しい設置・バックアップ・復元・更新の手順は [ローカル運用ガイド](japan-pilot-local-guide.md) にあります。', '자세한 설치·백업·복구·업데이트 절차는 [로컬 운영 가이드](japan-pilot-local-guide.md)에 있습니다.');
  pair('Raspberry Piでは [Pi向けの更新・テスト・ビルド手順](japan-pilot-raspberry-pi-guide.md) に従い、999番で実際のマイクとボタン、音声保存を確認します。', 'Raspberry Pi에서는 [Pi용 업데이트·테스트·빌드 가이드](japan-pilot-raspberry-pi-guide.md)를 따르고 999번으로 실제 마이크·버튼·음성 저장을 확인합니다.');
  pair('これはルートのWebアプリへの実装です。別プロジェクトのraspberry-pi-demoは変更していません。', '루트 웹앱에 구현한 기능입니다. 별도 프로젝트인 raspberry-pi-demo는 변경하지 않았습니다.');
  pair('音声案内はブラウザーの読み上げ機能を使います。日本語音声が使えない環境では、担当者が同じ文を読みます。マイクの実録音、保存、ZIPの再生を現場端末で確認してください。', '음성 안내는 브라우저 읽어주기 기능을 사용합니다. 일본어 음성이 없는 환경에서는 진행자가 같은 문장을 읽습니다. 현장 기기에서 실제 녹음·저장·ZIP 음성 재생을 확인해 주세요.');
  pair('以前のFish Audio選択は女性アナウンサー（ベテラン）、ID veteranです。9問用の [TTS計画](japan-pilot-tts-plan-ja-ko.md) は制作台本で、音源は未接続です。旧Q1の気分の試作2音源は履歴として残し、新Q1の曜日には使いません。', '기존 Fish Audio 선택은 여성 아나운서(베테랑), ID veteran입니다. 9문항용 [TTS 계획](japan-pilot-tts-plan-ja-ko.md)은 제작 대본이며 음원은 연결하지 않았습니다. 이전 Q1 기분 질문의 시제품 두 음원은 이력으로 남기고 새 Q1 요일에는 사용하지 않습니다.');
  pair('実施前に少人数で理解しやすさと時間を確かめ、文言を固定します。この文書と実装は同じ質問定義から生成しています。', '실증 전 소수 인원으로 이해도와 시간을 확인한 뒤 문구를 고정합니다. 이 문서와 구현은 같은 문항 정의를 사용합니다.');
  await mkdir('docs', { recursive: true });
  await writeFile('docs/japan-first-meeting-pilot-ja-ko.md', lines.join('\n'), 'utf8');
  process.stdout.write('Created docs/japan-first-meeting-pilot-ja-ko.md\n');
} finally { await vite.close(); }
