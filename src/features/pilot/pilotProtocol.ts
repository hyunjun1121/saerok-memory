import type { LocalizedText, SupportedLanguage } from '@/utils/localizedText';

export const PILOT_PROTOCOL_VERSION = 'jp-first-meeting-2.0';
export const PILOT_TIME_ZONE = 'Asia/Tokyo';
export const PILOT_RECORDING_MAX_MS = 180_000;
export const text = (ja: string, ko: string, en: string): LocalizedText => ({ ja, ko, en });

interface QuestionBase {
  id: string;
  title: LocalizedText;
  prompt: LocalizedText;
  targetSeconds: number;
  purpose: LocalizedText;
}

export interface PilotChoiceQuestion extends QuestionBase {
  kind: 'choice';
  sourceExerciseId?: string;
  options: { id: string; label: LocalizedText; weekday?: number }[];
  correctOptionId: string | null;
  dynamic?: 'japan-weekday';
  dateContext?: { localDate: string; timeZone: string; correctWeekday: number; generatedAt: string };
  explanation?: LocalizedText;
  reference?: string;
}

export interface PilotVoiceQuestion extends QuestionBase {
  kind: 'voice';
  followUp: LocalizedText;
  followUpPolicy?: 'short-answer-only';
  hint?: LocalizedText;
  informationFields: string[];
}

export type PilotQuestion = PilotChoiceQuestion | PilotVoiceQuestion;

function choice(
  number: number, title: LocalizedText, targetSeconds: number,
  prompt: LocalizedText, labels: LocalizedText[], correctOptionId: string | null,
  purpose: LocalizedText, explanation?: LocalizedText,
): PilotChoiceQuestion {
  return {
    id: `JP_PILOT_Q${String(number).padStart(2, '0')}`,
    kind: 'choice', title, targetSeconds, prompt, correctOptionId, purpose, explanation,
    options: labels.map((label, index) => ({ id: 'ABCD'[index], label })),
  };
}

function voice(
  number: number, title: LocalizedText, targetSeconds: number,
  prompt: LocalizedText, followUp: LocalizedText,
  purpose: LocalizedText, informationFields: string[], hint?: LocalizedText,
): PilotVoiceQuestion {
  return {
    id: `JP_PILOT_Q${String(number).padStart(2, '0')}`,
    kind: 'voice', title, targetSeconds, prompt, followUp, purpose, informationFields, hint,
    followUpPolicy: 'short-answer-only',
  };
}

export const PILOT_WEEKDAYS = [
  text('日曜日', '일요일', 'Sunday'), text('月曜日', '월요일', 'Monday'),
  text('火曜日', '화요일', 'Tuesday'), text('水曜日', '수요일', 'Wednesday'),
  text('木曜日', '목요일', 'Thursday'), text('金曜日', '금요일', 'Friday'),
  text('土曜日', '토요일', 'Saturday'),
] as const;

// Q1's template shows the supplied Sunday example. Only buildPilotQuestions()
// supplies an administered answer and randomized choices, frozen per attempt.
export const PILOT_QUESTIONS: readonly PilotQuestion[] = [
  { ...choice(1, text('今日の曜日', '오늘의 요일', 'Today’s weekday'), 25,
    text('今日は何曜日ですか？', '오늘은 무슨 요일인가요?', 'What day of the week is it today?'),
    [PILOT_WEEKDAYS[0], PILOT_WEEKDAYS[4], PILOT_WEEKDAYS[2], PILOT_WEEKDAYS[3]], null,
    text('今日の曜日への応答を記録します。', '오늘의 요일에 대한 응답을 관찰합니다.', 'Observe the response about today’s weekday.')), dynamic: 'japan-weekday' },
  choice(2, text('りんごの代金', '사과 가격 계산', 'Apple prices'), 50,
    text('八百屋で、赤いりんごは1個120円、青いりんごは1個80円です。赤いりんごを2個、青いりんごを3個買いました。合計はいくらですか？',
      '과일가게에서 빨간 사과는 개당 120엔, 초록 사과는 개당 80엔입니다. 빨간 사과 2개와 초록 사과 3개를 사면 총 얼마인가요?',
      'At a greengrocer, red apples cost 120 yen each and green apples cost 80 yen each. You bought two red apples and three green apples. What is the total?'),
    [440, 480, 520, 400].map(amount => text(`${amount}円`, `${amount}엔`, `${amount} yen`)), 'B',
    text('二つの価格と個数を使う計算への応答を記録します。', '두 가격과 수량을 이용한 복합 계산 응답을 관찰합니다.', 'Observe a calculation involving two prices and quantities.'),
    text('（120 × 2）＋（80 × 3）＝480円', '(120 × 2) + (80 × 3) = 480엔', '(120 × 2) + (80 × 3) = 480 yen')),
  choice(3, text('到着する時刻', '이동시간 계산', 'Arrival time'), 50,
    text('午前9時40分に家を出て、バスに25分乗り、そのあと15分歩きました。目的地に着いたのは何時ですか？',
      '오전 9시 40분에 집에서 나와 버스를 25분 타고, 이후 15분 걸었습니다. 목적지에 도착한 시간은 몇 시인가요?',
      'You left home at 9:40 a.m., rode a bus for 25 minutes, then walked for 15 minutes. What time did you arrive?'),
    [10, 30, 20, 40].map(minute => text(`午前10時${minute}分`, `오전 10시 ${minute}분`, `10:${minute} a.m.`)), 'C',
    text('移動時間の加算と情報を保ちながらの応答を記録します。', '시간 연산과 정보를 유지하며 답하는 모습을 관찰합니다.', 'Observe time arithmetic and holding information while responding.'),
    text('9時40分 ＋ 25分 ＋ 15分 ＝ 10時20分', '9시 40분 + 25분 + 15분 = 10시 20분', '9:40 + 25 minutes + 15 minutes = 10:20')),
  choice(4, text('先に来た人', '도착 순서 추론', 'Arrival order'), 40,
    text('ある集まりで、田中さんは佐藤さんより早く来ました。鈴木さんは田中さんより早く来ました。3人の中で、最も早く来たのは誰ですか？',
      '어떤 모임에서 다나카 씨는 사토 씨보다 먼저 왔습니다. 스즈키 씨는 다나카 씨보다 먼저 왔습니다. 세 사람 중 가장 먼저 온 사람은 누구인가요?',
      'At a gathering, Tanaka arrived before Sato. Suzuki arrived before Tanaka. Who arrived first among the three?'),
    [text('佐藤さん', '사토 씨', 'Sato'), text('田中さん', '다나카 씨', 'Tanaka'), text('鈴木さん', '스즈키 씨', 'Suzuki'), text('3人とも同じ', '세 사람 모두 동일', 'All three at the same time')], 'C',
    text('二つの条件から順序を考える応答を記録します。', '두 조건에서 순서를 추론하는 응답을 관찰합니다.', 'Observe reasoning about order from two conditions.'),
    text('鈴木 → 田中 → 佐藤', '스즈키 → 다나카 → 사토', 'Suzuki → Tanaka → Sato')),
  voice(5, text('ふるさとと子どものころ', '고향과 어린 시절', 'Hometown and childhood'), 75,
    text('子どものころは、どんなところに住んでいましたか？ その町での思い出を聞かせてください。', '어릴 때 어떤 곳에 사셨나요? 그 동네에서의 추억을 들려주세요.', 'What kind of place did you live in as a child? Please tell us a memory of that town.'),
    text('近所では、どんなことをして遊びましたか？', '동네에서 어떤 놀이를 하셨나요?', 'What did you play in the neighborhood?'),
    text('ふるさと、地名、育った環境、子どものころの活動と思い出を集めます。', '고향·지명·성장 환경·어린 시절 활동과 추억을 수집합니다.', 'Collect hometown, place names, childhood surroundings, activities, and memories.'),
    ['hometown', 'place_name', 'childhood_environment', 'childhood_activity', 'childhood_memory']),
  voice(6, text('若いころの仕事', '젊은 시절의 직업', 'Work in younger years'), 75,
    text('若いころは、どんなお仕事や活動をされていましたか？ そのころのことを教えてください。', '젊었을 때 어떤 일이나 활동을 하셨나요? 그 시절 이야기를 들려주세요.', 'What work or activities did you do when you were younger? Please tell us about that time.'),
    text('その中で、忘れられない出来事はありますか？', '그중 잊을 수 없는 일이 있나요?', 'Is there an unforgettable experience from that time?'),
    text('仕事、活動、社会での役割、大切な人生経験を集めます。', '직업·활동·사회적 역할·중요한 인생 경험을 수집합니다.', 'Collect work, activities, social roles, and significant life experiences.'),
    ['occupation', 'activity', 'social_role', 'life_event']),
  voice(7, text('家族との幸せな思い出', '가족과 가장 행복했던 추억', 'Happiest family memory'), 75,
    text('ご家族と過ごした時間の中で、一番幸せだった思い出を聞かせてください。', '가족과 함께 보낸 시간 중 가장 행복했던 추억을 들려주세요.', 'Please tell us your happiest memory of time spent with your family.'),
    text('そのときは、どこで何をしましたか？', '그때는 어디에서 무엇을 하셨나요?', 'Where were you, and what did you do then?'),
    text('本人が話した家族、関係、幸せな出来事、場所、気持ちを集めます。', '본인이 언급한 가족 구성원·관계·행복했던 사건·장소·감정을 수집합니다.', 'Collect explicitly mentioned family members, relationships, happy events, places, and feelings.'),
    ['family_member', 'relationship', 'happy_event', 'event_place', 'event_emotion']),
  voice(8, text('最近の楽しい出来事', '최근 즐거웠던 경험', 'Recent enjoyable experience'), 75,
    text('最近、一番楽しかったことは何ですか？ どんなことがあったのか聞かせてください。', '최근 가장 즐거웠던 일은 무엇인가요? 어떤 일이 있었는지 들려주세요.', 'What have you enjoyed most recently? Please tell us what happened.'),
    text('そのとき、どなたと一緒でしたか？', '그때 누구와 함께하셨나요?', 'Who were you with then?'),
    text('最近の出来事、活動、一緒にいた人、気持ちを集めます。', '최근 사건·활동·함께한 사람·감정을 수집합니다.', 'Collect recent events, activities, companions, and feelings.'),
    ['recent_event', 'event_time_expression', 'activity', 'event_people', 'event_emotion']),
  voice(9, text('趣味とふだんの暮らし', '취미와 일상 활동', 'Hobbies and everyday activities'), 75,
    text('普段は、どんなことをして過ごすのが好きですか？', '평소 어떤 일을 하며 시간을 보내는 것을 좋아하시나요?', 'What do you like to spend time doing in everyday life?'),
    text('その楽しみは、いつごろから続けていますか？', '그 취미나 즐거움은 언제부터 이어오셨나요?', 'Since about when have you enjoyed doing that?'),
    text('趣味、関心、日常の過ごし方、好きな活動を集めます。', '취미·관심사·일상 패턴·선호 활동을 수집합니다.', 'Collect hobbies, interests, daily routines, and preferred activities.'),
    ['hobby', 'interest', 'daily_routine', 'preferred_activity', 'activity_since']),
];

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function buildPilotQuestions(now = new Date(), random = Math.random): readonly PilotQuestion[] {
  const parts = new Intl.DateTimeFormat('en', { timeZone: PILOT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  const localDate = `${value('year')}-${value('month')}-${value('day')}`;
  const correctWeekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
  const distractors = shuffled([0, 1, 2, 3, 4, 5, 6].filter(day => day !== correctWeekday), random).slice(0, 3);
  const weekdays = shuffled([correctWeekday, ...distractors], random);
  return PILOT_QUESTIONS.map(question => question.kind === 'choice' && question.dynamic === 'japan-weekday' ? {
    ...question,
    options: weekdays.map((weekday, index) => ({ id: 'ABCD'[index], label: PILOT_WEEKDAYS[weekday], weekday })),
    correctOptionId: 'ABCD'[weekdays.indexOf(correctWeekday)],
    dateContext: { localDate, timeZone: PILOT_TIME_ZONE, correctWeekday, generatedAt: now.toISOString() },
  } : question);
}

export const PILOT_COPY = {
  title: text('はじめましての お話', '처음 만나는 이야기', 'Getting to know you'),
  setup: text('担当者の準備', '진행자 준비', 'Facilitator setup'),
  participant: text('参加者番号', '참가자 번호', 'Participant number'),
  participantHint: text('番号を選んでください。同じ番号でも、毎回最初から別の回として保存します。', '참가자 번호를 고르세요. 같은 번호도 매번 처음부터 별도 회차로 저장합니다.', 'Choose a participant number. Each start creates a separate attempt from the beginning.'),
  attempt: text('回', '회차', 'Attempt'),
  existingAttempts: text('これまでに保存した回数', '기존 수집 회차 수', 'Previously saved attempts'),
  collecting: text('収集中', '수집 중', 'Collecting'),
  finished: text('終了', '완료', 'Completed'),
  stopped: text('中断', '중단', 'Stopped'),
  interrupted: text('途中で終了', '중도 이탈', 'Interrupted'),
  dataDirectory: text('このPCの保存先', '이 PC의 저장 폴더', 'Storage folder on this PC'),
  codeHint: text('1〜6のボタンか数字キーで選べます。7以上は入力欄も使えます。以前の記録は上書きしません。', '1~6 버튼이나 숫자 키로 고르세요. 7번 이상은 입력란도 사용할 수 있습니다. 이전 회차를 덮어쓰지 않습니다.', 'Choose with the number buttons or keys. You can also type a number above 6. Earlier attempts are kept.'),
  recordingConsent: text('回答、途中や録り直しを含む音声、操作と滞在時間の記録を、このPCに保存することに同意します。', '답변, 중간·재녹음을 포함한 음성, 조작·체류 시간 기록을 이 PC에 저장하는 데 동의합니다.', 'I agree to storing responses, partial recordings and retakes, interactions, and time spent on this PC.'),
  personalizationConsent: text('今後の個別の問いかけづくりのため、回答の文字起こしと、話した内容の記憶データとしての保存・利用に同意します。', '이후 개인화 질문을 만들기 위한 답변 전사와, 말한 내용의 기억 데이터 저장·활용에 동의합니다.', 'I agree to later transcription and storage and use of explicitly stated memories to prepare personalized questions.'),
  localOnly: text('回答と音声はこのPCのフォルダーに自動保存します。外部サービスへの送信や自動の文字起こしは行いません。', '답변과 음성은 이 PC의 폴더에 자동 저장합니다. 외부 서비스 전송이나 자동 전사는 하지 않습니다.', 'Responses and audio are saved automatically to a folder on this PC, without external services or automatic transcription.'),
  consentNote: text('担当者から目的と保存期間の説明を受けてから、確認してください。', '진행자에게 목적과 보관 기간을 안내받은 뒤 확인해 주세요.', 'Confirm after the facilitator explains the purpose and retention period.'),
  prepare: text('お話を始める', '이야기 시작', 'Begin'),
  intro: text('これから、四つのボタンで答える質問を4問、そのあと暮らしや思い出のお話を5問伺います。8〜10分ほどです。思い出せないことや、話したくないことは飛ばせます。ご自分のペースでお答えください。', '먼저 네 버튼으로 답하는 질문 4개, 이어서 생활과 추억에 관한 이야기 5개를 여쭙겠습니다. 약 8~10분입니다. 기억이 나지 않거나 말하기 불편한 내용은 건너뛰셔도 됩니다. 편안한 속도로 답해 주세요.', 'First come four questions with four choices, then five questions about your life and memories. Allow about 8–10 minutes. Skip anything you cannot recall or prefer not to discuss. Take your time.'),
  begin: text('始めましょう', '시작해요', 'Let’s begin'),
  replay: text('もう一度聞く', '다시 듣기', 'Listen again'),
  record: text('話し始める', '말하기 시작', 'Start speaking'),
  stop: text('話し終わった', '말하기 마침', 'Finish speaking'),
  retry: text('録り直す', '다시 녹음', 'Record again'),
  next: text('次へ', '다음', 'Next'),
  check: text('これにする', '이것으로 선택', 'Confirm'),
  selected: text('選択中', '선택됨', 'Selected'),
  choose: text('一つ選んで、同じボタンでもう一度決めます。', '하나를 고른 뒤 같은 버튼을 한 번 더 누르세요.', 'Choose one, then press the same button again to confirm.'),
  voiceGuide: text('右のボタンで話し始めます。終わったら、もう一度右を押します。', '오른쪽 버튼으로 말하기를 시작하고, 마치면 오른쪽을 한 번 더 누르세요.', 'Press a right button to start speaking, then press it again when finished.'),
  followUp: text('もう少し聞かせてください', '조금 더 들려주세요', 'Tell us a little more'),
  requestFollowUp: text('追加で聞く（担当者）', '후속 질문하기 (진행자)', 'Ask a follow-up (facilitator)'),
  followUpNote: text('担当者へ：お答えが短いときだけ、追加の質問を一度使います。十分に話されたら「次へ」で進みます。', '진행자: 답변이 짧을 때만 후속 질문을 한 번 사용하세요. 충분히 이야기하셨으면 다음으로 진행합니다.', 'Facilitator: use the follow-up once only for a short answer. Otherwise, continue with Next.'),
  skipFollowUp: text('追加の質問を飛ばす', '후속 질문 건너뛰기', 'Skip the follow-up'),
  listening: text('お話を録音しています', '이야기를 녹음하고 있어요', 'Recording your story'),
  recordingEnded: text('録音が終わりました。右のボタンで保存してください。', '녹음이 끝났어요. 오른쪽 버튼으로 저장해 주세요.', 'Recording has ended. Press a right button to save.'),
  savedTake: text('音声を確認しました。次へ進めます。', '음성을 확인했어요. 다음으로 넘어갈 수 있어요.', 'Your audio is ready. You can continue.'),
  thanks: text('お話しくださって、ありがとうございます。', '이야기를 들려주셔서 고맙습니다.', 'Thank you for sharing your story.'),
  complete: text('今日のお話は ここまでです', '오늘 이야기는 여기까지예요', 'That is all for today'),
  skip: text('このお話を飛ばす', '이 이야기 건너뛰기', 'Skip this question'),
  notApplicable: text('当てはまらない', '해당 없음', 'Not applicable'),
  noResponse: text('答えが出てこない', '답이 떠오르지 않음', 'No answer comes to mind'),
  recordingFailed: text('録音できないまま進む', '녹음 실패로 넘어가기', 'Continue with recording failure'),
  skipReason: text('どれか選ぶと、このお話を飛ばします。', '이유를 고르면 이 문항을 건너뜁니다.', 'Choose a reason to skip this question.'),
  cancel: text('戻る', '돌아가기', 'Back'),
  saving: text('保存しています', '저장하고 있어요', 'Saving'),
  storageError: text('保存できませんでした。担当者は npm run dev:pilot で収集サーバーを起動し、再度保存してください。', '저장하지 못했습니다. 진행자는 npm run dev:pilot로 수집 서버를 실행하고 다시 저장해 주세요.', 'Saving failed. Start the collector with npm run dev:pilot, then try saving again.'),
  micError: text('音声を録音できません。マイクと許可を確認して、録り直してください。', '음성을 녹음하지 못했습니다. 마이크와 권한을 확인한 뒤 다시 녹음해 주세요.', 'Audio could not be recorded. Check the microphone and permission, then try again.'),
  narrationError: text('音声案内が使えません。画面を読むか、担当者に読んでもらってください。', '음성 안내를 사용할 수 없습니다. 화면을 읽거나 진행자에게 읽어 달라고 해 주세요.', 'Spoken guidance is unavailable. Read the screen or ask the facilitator to read it.'),
  exportAll: text('保存した回答をすべて書き出す', '저장된 답변 전체 내보내기', 'Export all saved responses'),
  exportCurrent: text('この方の回答を書き出す', '이 참가자 답변 내보내기', 'Export this participant’s responses'),
  exportError: text('書き出せませんでした。もう一度お試しください。', '내보내지 못했습니다. 다시 시도해 주세요.', 'Export failed. Please try again.'),
  nextParticipant: text('次の参加者を準備する', '다음 참가자 준비', 'Prepare the next participant'),
  reference: text('この形を見てください', '이 모양을 보세요', 'Look at this shape'),
  left: text('左 1・3', '왼쪽 1·3', 'Left 1 / 3'),
  right: text('右 2・4', '오른쪽 2·4', 'Right 2 / 4'),
  storageReady: text('回答はこの端末に保存されています。', '답변이 이 기기에 저장되어 있습니다.', 'Responses are saved on this device.'),
  saveAgain: text('もう一度保存する', '다시 저장', 'Try saving again'),
  deleteRecord: text('この回の記録を削除する', '이 회차 기록 삭제', 'Delete this attempt’s record'),
  deleteConfirm: text('この端末から回答と音声を削除します。よろしいですか。書き出したファイルは別に削除してください。', '이 기기에서 답변과 음성을 삭제할까요? 이미 내보낸 파일은 별도로 삭제해 주세요.', 'Delete the responses and audio from this device? Exported files must be deleted separately.'),
  end: text('お話を中断する', '이야기 중단', 'End this session'),
  completedCount: text('保存済みの回', '저장된 회차', 'Saved attempts'),
  partMain: text('最初の質問', '본질문', 'Main question'),
  partFollowUp: text('続きの質問', '후속 질문', 'Follow-up question'),
  recordingLimit: text('お話の目安は45〜90秒です。急がずお話しください。1回の録音は最長3分です。', '이야기는 45~90초를 목표로 하되 서두르지 않으셔도 됩니다. 한 번에 최대 3분 녹음합니다.', 'Aim for 45–90 seconds, and take your time. Each recording can last up to three minutes.'),
} satisfies Record<string, LocalizedText>;

export function getPilotLanguage(value: string | null): SupportedLanguage {
  return value === 'ko' || value === 'en' ? value : 'ja';
}
