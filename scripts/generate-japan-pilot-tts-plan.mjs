import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { pilotKoreanQuestionCopy } from './pilot-document-copy.mjs';

const vite = await createServer({ appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { PILOT_PROTOCOL_VERSION, PILOT_QUESTIONS, PILOT_COPY } = await vite.ssrLoadModule('/src/features/pilot/pilotProtocol.ts');
  const { getLocalizedText } = await vite.ssrLoadModule('/src/utils/localizedText.ts');
  const local = (value, language) => getLocalizedText(value, language);
  const previous = JSON.parse(await readFile('public/assets/audio/narration/ja/day1/manifest.json', 'utf8'));
  const entries = [];
  function add(id, category, triggerKo, textJa, textKo, extra = {}) {
    const matches = previous.entries.filter(entry => entry.text === textJa);
    const taggedText = textJa.includes('、') ? `${textJa.replace('、', '、[short pause]')}[short pause]` : `[short pause]${textJa}[short pause]`;
    entries.push({ id, category, triggerKo, textJa, textKo, taggedText,
      proposedRuntimePath: `/assets/audio/narration/ja/pilot/${id.replaceAll('.', '_')}.mp3`,
      productionStatus: matches.length ? 'existing-text-match-review-required' : 'not-generated',
      existingCandidates: matches.map(entry => ({ id: entry.id, runtimePath: entry.runtimePath, sourceSha256: entry.sourceSha256 })),
      ...extra });
  }
  const copy = (key, language) => local(PILOT_COPY[key], language);
  add('common.setup', 'setup', '진행자 준비 화면, 필요한 경우에만 재생',
    'これから、お話をうかがいます。録音と保存について、係の者がご説明します。', '지금부터 이야기를 여쭙겠습니다. 녹음과 저장에 관해서 진행자가 설명해 드립니다.', { priority: 'optional' });
  add('common.intro', 'intro', '동의 확인 후 시작 소개 화면', copy('intro', 'ja'), copy('intro', 'ko'));
  add('common.choice_guide', 'instruction', '첫 선택형 설명, 이후 요청 시 다시 듣기', copy('choose', 'ja'), copy('choose', 'ko'));
  add('common.choice_confirmed', 'feedback', '선택 확정 뒤, 다음 질문과 겹치지 않을 때', 'お答えを受け取りました。次へ進みましょう。', '답변을 받았습니다. 다음으로 넘어갈게요.', { priority: 'optional' });
  add('common.voice_guide', 'instruction', '첫 음성 문항에서 녹음 전에 설명, 이후 요청 시', copy('voiceGuide', 'ja'), copy('voiceGuide', 'ko'));
  add('common.voice_limit', 'instruction', '첫 녹음 전에만 상한 설명', copy('recordingLimit', 'ja'), copy('recordingLimit', 'ko'));
  add('common.recording_ended', 'recording', '60초 자동 정지 후, 마이크가 완전히 닫힌 뒤', copy('recordingEnded', 'ja'), copy('recordingEnded', 'ko'));
  add('common.recording_saved', 'recording', '저장 완료 후 다음/재녹음 버튼을 안내할 때',
    'お話を保存しました。右のボタンで次へ進みます。録り直すときは、左のボタンを押してください。', '이야기를 저장했어요. 오른쪽 버튼으로 다음으로 갑니다. 다시 녹음하려면 왼쪽 버튼을 눌러 주세요.');
  add('common.retry_ready', 'recording', '재녹음 준비, 안내를 끝낸 다음에만 녹음 시작하도록 흐름 보완 필요',
    'もう一度、お話しいただけます。準備ができたら、右のボタンを押してください。', '다시 이야기하실 수 있어요. 준비되면 오른쪽 버튼을 눌러 주세요.');
  add('common.mic_error', 'error', '마이크 권한/장치/빈 녹음 오류, 녹음 중이 아닐 때',
    '音声を録音できませんでした。係の者にお知らせください。', '음성을 녹음하지 못했어요. 진행자에게 알려 주세요.');
  add('common.skip_menu', 'skip', '건너뛰기 이유 화면',
    'お話ししたくない、当てはまらない、答えが浮かばない、録音できない。近いものを選んでください。', '말하고 싶지 않음, 해당 없음, 답이 떠오르지 않음, 녹음할 수 없음 중 가까운 이유를 골라 주세요.');
  add('common.skipped', 'skip', '이유 선택 뒤 다음 질문으로 넘어갈 때', '大丈夫です。次のお話へ進みましょう。', '괜찮습니다. 다음 이야기로 넘어갈게요.', { priority: 'optional' });
  add('common.save_wait', 'error', '저장 실패로 진행이 막혔을 때, 반복 루프 재생 금지',
    '少しお待ちください。係の者が確認します。', '잠시만 기다려 주세요. 진행자가 확인하겠습니다.');
  add('common.stopped', 'outro', '진행자가 중단한 경우, 정상 완료와 구분',
    '今日は、ここで終わりにしましょう。お話しくださって、ありがとうございます。', '오늘은 여기서 마칠게요. 이야기를 들려주셔서 고맙습니다.');
  add('common.complete', 'outro', '12문항을 모두 마친 뒤', `${copy('complete', 'ja')}。${copy('thanks', 'ja')}`, `${copy('complete', 'ko')}. ${copy('thanks', 'ko')}`);
  add('common.same_participant', 'setup', '같은 번호로 다시 시작하기 전, 진행자가 필요할 때만',
    'もう一度、最初から始めます。先ほどのお話も、そのまま残ります。', '다시 처음부터 시작할게요. 앞서 나눈 이야기도 그대로 남습니다.', { priority: 'optional' });

  const shapes = { '●': ['丸', '동그라미'], '▲': ['三角', '세모'], '■': ['四角', '네모'] };
  const spoken = (value, language) => /^[●▲■\s]+$/.test(value)
    ? value.trim().split(/\s+/).map(char => shapes[char][language === 'ja' ? 0 : 1]).join(language === 'ja' ? '、' : ', ')
    : value.trim();
  for (const [index, question] of PILOT_QUESTIONS.entries()) {
    const prefix = `q${String(index + 1).padStart(2, '0')}`;
    const meta = { questionId: question.id };
    add(`${prefix}.main`, 'question', `${index + 1}번 본질문 진입/다시 듣기, 안내 종료 후 응답`, local(question.prompt, 'ja'), pilotKoreanQuestionCopy(question, local), { ...meta, part: 'main' });
    if (question.kind === 'voice') {
      if (question.hint) add(`${prefix}.hint`, 'hint', `${index + 1}번 본질문 뒤, 응답을 유도하는 예시를 추가하지 않음`, local(question.hint, 'ja'), local(question.hint, 'ko'), meta);
      add(`${prefix}.follow_up`, 'question', `${index + 1}번 본질문 저장 후 후속 질문 진입/다시 듣기`, local(question.followUp, 'ja'), local(question.followUp, 'ko'), { ...meta, part: 'followUp' });
    } else {
      if (question.reference) add(`${prefix}.reference`, 'reference', `${index + 1}번 보기 도형 읽기, 실제 시각 자극만 언어화`, `見本は、${spoken(question.reference, 'ja')}です。`, `보기는 ${spoken(question.reference, 'ko')}입니다.`, meta);
      for (const [slot, option] of question.options.entries()) {
        add(`${prefix}.option_${option.id.toLowerCase()}`, 'option', `${index + 1}번 ${slot + 1}번/${option.id} 선택지, 고정 순서 읽기 또는 재생 요청`,
          spoken(local(option.label, 'ja'), 'ja'), spoken(pilotKoreanQuestionCopy(question, local, option), 'ko'),
          { ...meta, optionId: option.id, buttonNumber: slot + 1, visualTextJa: local(option.label, 'ja') });
      }
    }
  }
  const inventory = { schemaVersion: 1, protocolVersion: PILOT_PROTOCOL_VERSION,
    status: 'production-plan-only-not-wired-to-runtime',
    voice: { provider: 'Fish Audio', projectVoiceId: 'veteran', label: '女性アナウンサー（ベテラン）', providerReferenceId: null,
      tagStyle: 'gentle_double_pause', evidence: ['raspberry-pi-demo/tools/fish-day1-browser/ja/README.md', 'raspberry-pi-demo/tools/fish-day1-browser/ja/day1-inventory.json', 'public/assets/audio/narration/ja/day1/manifest.json'] },
    entryCount: entries.length, requiredCount: entries.filter(entry => entry.priority !== 'optional').length,
    uniqueJapaneseTextCount: new Set(entries.map(entry => entry.textJa)).size, entries };
  const lines = [];
  const pair = (ja, ko) => lines.push(ja, ko, '');
  pair('# Haru 日本実証 音声制作計画', '# Haru 일본 실증 TTS 제작 계획');
  pair(`質問版 ${PILOT_PROTOCOL_VERSION}。これは制作台本です。新しいFish音声は未生成で、実証画面にはまだ接続していません。`, `문항 버전 ${PILOT_PROTOCOL_VERSION}. 제작 대본입니다. 새 Fish 음원은 아직 생성하거나 실증 화면에 연결하지 않았습니다.`);
  pair('## 過去に選んだ声', '## 기존에 선택한 화자');
  pair('Fish Audioでは「女性アナウンサー（ベテラン）」を採用しました。プロジェクト内IDはveteran、形式はgentle_double_pauseです。', 'Fish Audio 최종 화자는 여성 아나운서(베테랑)입니다. 일본어 표시명은 女性アナウンサー（ベテラン）, 프로젝트 ID는 veteran, 형식은 gentle_double_pause입니다.');
  pair('比較候補はank0、田中みなみ風、女性アナウンサー（ベテラン）でした。QwenのOno_Annaは別の生成系です。Fishの実際のreference/model IDは保存記録から断定しません。', '비교 후보는 ank0·田中みなみ風·女性アナウンサー（ベテラン）였습니다. Qwen의 Ono_Anna는 다른 생성 계열입니다. Fish의 실제 reference/model ID는 저장 기록만으로 단정하지 않습니다.');
  pair('根拠：raspberry-pi-demo/tools/fish-day1-browser/ja/README.md、同day1-inventory.json、public/assets/audio/narration/ja/day1/manifest.json。', '근거: raspberry-pi-demo/tools/fish-day1-browser/ja/README.md, 같은 폴더의 day1-inventory.json, public/assets/audio/narration/ja/day1/manifest.json.');
  pair('## 場面と音声数', '## 장면과 음원 수');
  for (const category of [...new Set(entries.map(entry => entry.category))]) {
    pair(`${category}: ${entries.filter(entry => entry.category === category).length}件。`, `${category}: ${entries.filter(entry => entry.category === category).length}개.`);
  }
  pair(`合計${entries.length}枠、必須${inventory.requiredCount}枠、任意${entries.length - inventory.requiredCount}枠。日本語の完全一致文は共通化でき、異なる文は${inventory.uniqueJapaneseTextCount}種類です。`, `총 ${entries.length}개 슬롯, 필수 ${inventory.requiredCount}개, 선택 ${entries.length - inventory.requiredCount}개입니다. 일본어가 완전히 같은 문장은 재사용할 수 있으며 서로 다른 문장은 ${inventory.uniqueJapaneseTextCount}종입니다.`);
  pair('質問は本質問12、追加質問8、選択肢16です。補足と見本、開始・操作・保存後・中断・終了の共通案内を別にします。', '질문은 본질문 12개, 후속 질문 8개, 선택지 16개입니다. 도움말·보기와 시작·조작·저장 후·중단·종료 공통 안내를 별도로 둡니다.');
  pair('## 再生と録音の原則', '## 재생과 녹음 원칙');
  pair('質問、必要な補足、操作案内の順に一度だけ再生し、終了してから録音を許可します。録音中はTTSを流しません。', '질문·필요한 도움말·조작 안내 순서로 한 번 재생하고 끝난 뒤 녹음할 수 있게 합니다. 녹음 중에는 TTS를 재생하지 않습니다.');
  pair('現在は再生ボタンによるブラウザー読み上げのみです。自動再生、選択肢の読み上げ、録り直し前の待機、60秒後の案内、中断と完了の音声分岐は今後の実装対象です。', '현재는 다시 듣기 버튼을 통한 브라우저 읽어주기만 동작합니다. 자동 재생·선택지 읽기·재녹음 전 대기·60초 후 안내·중단/완료 음성 분기는 이후 구현 대상입니다.');
  pair('録音開始は短い合図で知らせ、聞いていますという声を繰り返しません。保存完了の案内はサーバー保存が成功した後だけです。', '녹음 시작은 짧은 신호로 알리고 듣고 있다는 음성을 반복하지 않습니다. 저장 완료 안내는 서버 저장 성공 후에만 합니다.');
  pair('選択肢は1から4の固定順で読み、答えを先に知らせません。図形は丸・三角・四角として読みます。本人の番号、名前、曜日を固定音声に入れません。', '선택지는 1~4의 고정 순서로 읽고 정답을 미리 알려주지 않습니다. 도형은 동그라미·세모·네모로 읽습니다. 고정 음원에 참가자 번호·이름·요일을 넣지 않습니다.');
  pair('案内用の短い音声と本人の録音の再生を重ねません。画面の保存先やコマンド、ZIP、削除確認など担当者向けの情報は自動で読み上げません。', '안내 음성과 참가자 녹음 미리 듣기를 겹치지 않습니다. 저장 경로·실행 명령·ZIP·삭제 확인 등 진행자용 정보는 자동으로 읽지 않습니다.');
  pair('既存音源は文言の完全一致候補だけを示します。利用前に実ファイル、声、発音、音量を確認し、違う人名や内容の音声を流用しません。', '기존 음원은 문구 완전 일치 후보만 표시합니다. 사용 전 실제 파일·화자·발음·음량을 확인하며 다른 이름이나 내용의 음성을 그대로 쓰지 않습니다.');
  pair('JSONのtaggedTextは短い間を二つ入れた制作案です。Fish画面への入力前に自然な区切りを確認し、タグを二重に追加しないようにします。', 'JSON의 taggedText는 짧은 쉼을 두 번 넣은 제작안입니다. Fish 화면에 넣기 전 자연스러운 구분을 확인하고 태그가 중복되지 않게 합니다.');
  pair('## 全台本', '## 전체 제작 대본');
  for (const entry of entries) {
    pair(`### ${entry.id}（${entry.priority === 'optional' ? '任意' : '必須'}）`, `### ${entry.id} (${entry.priority === 'optional' ? '선택' : '필수'})`);
    pair(entry.textJa, entry.textKo);
    lines.push(`재생 시점: ${entry.triggerKo}`, `파일: ${entry.proposedRuntimePath}`, '');
    if (entry.existingCandidates.length) lines.push(`문구 일치 후보: ${entry.existingCandidates.map(candidate => candidate.runtimePath).join(', ')}. 아직 연결하지 않았으며 검수 후 재사용합니다.`, '');
  }
  pair('## 制作後の確認', '## 제작 후 확인');
  pair('同じ声で生成し、文言・読み・無音・音量を一文ずつ確認します。承認した元音声、SHA-256、選択した声、生成日時、実行パスをmanifestに残します。', '같은 화자로 생성하고 문구·발음·무음·음량을 문장별로 확인합니다. 확정한 원본 음원·SHA-256·선택 화자·생성 일시·실행 경로를 manifest에 남깁니다.');
  pair('この計画は参加者の発話をFishに送るものではありません。送るのは固定した案内文だけです。音声生成や公開を済ませたと記録しません。', '이 계획은 참가자 발화를 Fish에 보내는 작업이 아닙니다. 전송 대상은 고정 안내 대본뿐입니다. 음원 생성이나 공개가 끝났다고 기록하지 않습니다.');
  await mkdir('docs', { recursive: true });
  await writeFile('docs/japan-pilot-tts-inventory.json', `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile('docs/japan-pilot-tts-plan-ja-ko.md', lines.join('\n'), 'utf8');
  process.stdout.write(`Created pilot TTS plan: ${entries.length} slots, ${inventory.uniqueJapaneseTextCount} unique Japanese texts; audio not generated.\n`);
} finally { await vite.close(); }
