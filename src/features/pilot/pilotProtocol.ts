import { haru7DayExercises } from '@/data/haru7DayExercises';
import type { LocalizedText, SupportedLanguage } from '@/utils/localizedText';

export const PILOT_PROTOCOL_VERSION = 'jp-first-meeting-1.0';
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
  sourceExerciseId: string;
  options: { id: string; label: LocalizedText }[];
  correctOptionId: string | null;
  reference?: string;
}

export interface PilotVoiceQuestion extends QuestionBase {
  kind: 'voice';
  followUp: LocalizedText;
  hint?: LocalizedText;
  informationFields: string[];
}

export type PilotQuestion = PilotChoiceQuestion | PilotVoiceQuestion;

function choice(
  number: number, sourceExerciseId: string, title: LocalizedText,
  targetSeconds: number, prompt?: LocalizedText, reference?: string,
): PilotChoiceQuestion {
  const source = haru7DayExercises.find((exercise) => exercise.id === sourceExerciseId);
  if (!source?.payload.options?.length) throw new Error(`Missing pilot source: ${sourceExerciseId}`);
  return {
    id: `JP_PILOT_Q${String(number).padStart(2, '0')}`,
    kind: 'choice', title, sourceExerciseId, targetSeconds,
    prompt: prompt ?? source.prompt,
    options: source.payload.options.map(({ id, label }) => ({ id, label })),
    correctOptionId: typeof source.correctAnswer === 'string' ? source.correctAnswer : null,
    reference,
    purpose: text('ボタン操作に慣れ、会話の合間に短い活動を行います。', '버튼 조작에 익숙해지고 대화 사이에 짧은 활동을 합니다.', 'Practice the buttons and take a short activity break between conversations.'),
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
  };
}

export const PILOT_QUESTIONS: readonly PilotQuestion[] = [
  choice(1, 'D1_Q1', text('今日の気分', '오늘 기분', 'How you feel'), 20,
    text('今日の気分はいかがですか。', '오늘 기분은 어떠세요?', 'How are you feeling today?')),
  voice(2, text('子どものころ', '어린 시절', 'Childhood'), 50,
    text('子どものころは、どのあたりで暮らしていましたか。', '어릴 때는 어느 지역에서 사셨나요?', 'Where did you live when you were a child?'),
    text('そのころ、よくしていた遊びや楽しみを一つ教えてください。', '그때 자주 하던 놀이나 즐기던 일을 하나 알려 주세요.', 'Tell us one thing you enjoyed doing then.'),
    text('育った地域と、当時の暮らしや楽しみを知ります。', '성장한 지역과 당시의 생활·즐거움을 파악합니다.', 'Learn about the place you grew up and activities you enjoyed.'),
    ['childhood_place', 'childhood_activity']),
  voice(3, text('続けてきたこと', '오래 해 온 일', 'Work and roles'), 60,
    text('これまで、長く続けてきた仕事や役割を一つ教えてください。', '지금까지 오래 해 오신 일이나 역할을 하나 알려 주세요.', 'Tell us about one job or role you have had for a long time.'),
    text('ふだん、どんなことをしていましたか。', '평소에 구체적으로 어떤 일을 하셨나요?', 'What did you usually do in that role?'),
    text('仕事や家庭、地域での役割と具体的な経験を知ります。', '직장·가정·지역에서의 역할과 구체적인 경험을 파악합니다.', 'Learn about roles and concrete experience at work, home, or in the community.'),
    ['past_role', 'role_activity'],
    text('お仕事のほか、家事や地域での活動でもかまいません。', '직장 일 외에 집안일이나 지역 활동도 괜찮습니다.', 'Housework and community activities are welcome too.')),
  choice(4, 'D1_Q4', text('お買い物', '장보기', 'Shopping'), 30),
  voice(5, text('身近な方', '가족과 주변 사람', 'People in your life'), 35,
    text('今は、どなたと一緒に暮らしていますか。', '지금은 누구와 함께 살고 계신가요?', 'Who do you live with now?'),
    text('離れて暮らしているご家族や、よく連絡を取る方についても、話せる範囲で教えてください。', '따로 사는 가족이나 자주 연락하는 분에 대해서도 편한 만큼 알려 주세요.', 'If you wish, tell us about family living elsewhere or people you often contact.'),
    text('同居と別居を分け、本人が話した範囲の人間関係を記録します。', '동거·별거를 구분하고 본인이 말한 범위의 관계를 기록합니다.', 'Record relationships while distinguishing living together from living apart.'),
    ['living_arrangement', 'relationships', 'contact_pattern'],
    text('一人暮らしや施設での暮らしも、そのまま教えてください。お名前は言わなくてもかまいません。', '혼자 살거나 시설에서 생활하시는 경우도 그대로 알려 주세요. 이름은 말하지 않으셔도 됩니다.', 'Living alone or in a care home is fine. Names are optional.')),
  voice(6, text('一緒に過ごした思い出', '함께한 즐거운 경험', 'A shared memory'), 65,
    text('ご家族やご友人とのことで、うれしかった出来事を一つ教えてください。', '가족이나 친구와 있었던 일 중 기뻤던 일을 하나 들려주세요.', 'Tell us about a happy experience with family or a friend.'),
    text('そのときの様子を、もう少し聞かせてください。', '그때의 모습을 조금 더 들려주세요.', 'Tell us a little more about what it was like.'),
    text('人物と活動、場所がつながる具体的な出来事を集めます。', '사람·활동·장소가 연결된 구체적인 사건을 수집합니다.', 'Collect an event connecting people, activities, and places.'),
    ['event_people', 'event_activity', 'event_place', 'event_emotion']),
  choice(7, 'D2_Q4', text('ことわざ', '속담', 'A proverb'), 25),
  voice(8, text('このごろの楽しみ', '요즘의 즐거움', 'Things you enjoy'), 60,
    text('このごろ、楽しみにしていることを一つ教えてください。', '요즘 즐기거나 기대하는 일을 하나 알려 주세요.', 'Tell us one thing you enjoy or look forward to these days.'),
    text('どんなところが好きですか。', '어떤 점이 좋으세요?', 'What do you like about it?'),
    text('現在の関心と、本人が好きだと感じる理由を知ります。', '현재 관심사와 본인이 좋아하는 이유를 파악합니다.', 'Learn about current interests and what makes them enjoyable.'),
    ['interest', 'interest_reason'],
    text('毎日の小さな楽しみでもかまいません。', '일상의 작은 즐거움도 괜찮습니다.', 'Small everyday pleasures are welcome.')),
  voice(9, text('好きな食べ物', '좋아하는 음식', 'A food you like'), 55,
    text('好きな食べ物を一つ教えてください。', '좋아하는 음식을 하나 알려 주세요.', 'Tell us one food you like.'),
    text('その食べ物にまつわる思い出があれば、聞かせてください。', '그 음식과 관련된 추억이 있다면 들려주세요.', 'If you have a memory connected to that food, please share it.'),
    text('食の好みと、食べ物につながる人や場所、経験を集めます。', '음식 취향과 그 음식에 연결된 사람·장소·경험을 수집합니다.', 'Collect a food preference and any related people, places, or experiences.'),
    ['food_preference', 'food_memory']),
  choice(10, 'D5_Q5', text('同じ形', '같은 모양', 'Matching shapes'), 25, undefined, '● ▲'),
  voice(11, text('最近の出来事', '최근의 경험', 'A recent experience'), 60,
    text('最近あったことで、誰かに話したいことを一つ教えてください。', '최근 있었던 일 중 누군가에게 이야기하고 싶은 일을 하나 들려주세요.', 'Tell us about one recent experience you would like to share.'),
    text('そのときの様子を、もう少し聞かせてください。', '그때의 모습을 조금 더 들려주세요.', 'Tell us a little more about what it was like.'),
    text('最近の生活から、後の会話に使える具体的な出来事を集めます。', '최근 생활에서 이후 대화에 사용할 구체적인 사건을 수집합니다.', 'Collect a recent event for future conversations.'),
    ['recent_event', 'event_time_expression', 'event_people', 'event_place'],
    text('今日のことでも、少し前のことでもかまいません。', '오늘 일도, 조금 전의 일도 괜찮습니다.', 'It can be from today or a little while ago.')),
  voice(12, text('これからの楽しみ', '앞으로의 즐거움', 'Something to look forward to'), 45,
    text('これから、やってみたいことを一つ教えてください。', '앞으로 해 보고 싶은 일을 하나 알려 주세요.', 'Tell us one thing you would like to do.'),
    text('そのことの、どんなところを楽しみにしていますか。', '그 일의 어떤 점이 기대되세요?', 'What do you look forward to about it?'),
    text('本人の希望と、次の会話のきっかけを知ります。', '본인의 희망과 다음 대화 소재를 파악합니다.', 'Learn about wishes and ideas for future conversations.'),
    ['future_wish', 'wish_reason'],
    text('以前していて、またやりたいことでもかまいません。', '예전에 하셨다가 다시 하고 싶은 일도 괜찮습니다.', 'It can be something you used to do and would like to do again.')),
];

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
  personalizationConsent: text('今後の個別の問いかけづくりに、回答を使うことに同意します。', '이후 개인화 질문을 만드는 데 답변을 활용하는 데 동의합니다.', 'I agree to using my responses to prepare future personalized questions.'),
  localOnly: text('回答と音声はこのPCのフォルダーに自動保存します。外部サービスへの送信や自動の文字起こしは行いません。', '답변과 음성은 이 PC의 폴더에 자동 저장합니다. 외부 서비스 전송이나 자동 전사는 하지 않습니다.', 'Responses and audio are saved automatically to a folder on this PC, without external services or automatic transcription.'),
  consentNote: text('担当者から目的と保存期間の説明を受けてから、確認してください。', '진행자에게 목적과 보관 기간을 안내받은 뒤 확인해 주세요.', 'Confirm after the facilitator explains the purpose and retention period.'),
  prepare: text('お話を始める', '이야기 시작', 'Begin'),
  intro: text('これから、あなたの暮らしや好きなことを伺います。約10分です。話したくないことは飛ばせます。ご自分のペースでお話しください。', '지금부터 생활과 좋아하는 것에 대해 여쭙겠습니다. 약 10분입니다. 말하고 싶지 않은 내용은 건너뛰셔도 됩니다. 편안한 속도로 말씀해 주세요.', 'We will ask about your life and things you enjoy. It takes about ten minutes. You can skip anything you prefer not to discuss. Take your time.'),
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
  recordingLimit: text('1回の録音は最大60秒です。短いお答えでもかまいません。', '한 번에 최대 60초 녹음합니다. 짧게 답하셔도 괜찮습니다.', 'Each recording can last up to 60 seconds. A short answer is fine.'),
} satisfies Record<string, LocalizedText>;

export function getPilotLanguage(value: string | null): SupportedLanguage {
  return value === 'ko' || value === 'en' ? value : 'ja';
}
