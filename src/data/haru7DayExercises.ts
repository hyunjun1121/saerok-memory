import type { AnswerOption, Exercise } from "@/data/mockExercises";
import type { LocalizedText } from "@/utils/localizedText";

export type HaruWeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface HaruWeekPlan {
  day: HaruWeekDay;
  dateISO: string;
  weekday: LocalizedText;
  title: LocalizedText;
  greeting: LocalizedText;
  completionMessage: LocalizedText;
  exerciseIds: readonly string[];
  recordedSummary: {
    durationSeconds: number;
    evaluatedActivities: number;
    expectedMatches: number;
  };
}

export type HaruQuestionResponseType = "single_choice" | "voice" | "button_sequence";

export type HaruScriptedSource =
  | {
      kind: "profile";
      field: "hometown" | "formerOccupation" | "daughterName" | "medicationTime";
    }
  | {
      kind: "prior_question";
      sourceDay: HaruWeekDay;
      sourceQuestionId: string;
    };

export interface HaruWeekQuestionMeta {
  exerciseId: string;
  day: HaruWeekDay;
  order: number;
  domain: string;
  responseType: HaruQuestionResponseType;
  scored: boolean;
  maxResponseSeconds?: number;
  personalizationSourceNote?: LocalizedText;
  recordedResponse: {
    selectedOptionId?: string;
    submittedSequence?: readonly string[];
    isCorrect: boolean | null;
    responseTimeMs: number;
    voiceDurationSeconds?: number;
    sttStatus?: "completed" | "failed";
    sttConfidence?: number;
    feedback: LocalizedText;
  };
  // Provenance for this locked synthetic demo week. It documents which
  // authored persona fact or prior scripted answer grounded the prompt; it is
  // not a runtime promise to regenerate later questions from live responses.
  scriptedSource?: HaruScriptedSource;
}

type HaruWeekQuestionBase = Omit<
  HaruWeekQuestionMeta,
  "personalizationSourceNote" | "recordedResponse"
>;

const localized = (ko: string, ja: string, en: string): LocalizedText => ({ ko, ja, en });

const option = (
  id: string,
  ko: string,
  ja: string,
  en: string,
  value?: string,
): AnswerOption => ({
  id,
  label: localized(ko, ja, en),
  ...(value === undefined ? {} : { value }),
});

const moodOptions = (): AnswerOption[] => [
  option("A", "매우 좋음", "とても良い", "Very good", "very_good"),
  option("B", "좋음", "良い", "Good", "good"),
  option("C", "그저 그럼", "まあまあ", "So-so", "neutral"),
  option("D", "좋지 않음", "あまり良くない", "Not good", "not_good"),
];

const MOOD_ACKNOWLEDGEMENT = localized(
  "오늘 기분을 알려주셔서 고마워요.",
  "今日の気分を教えてくださってありがとうございます。",
  "Thank you for sharing how you feel today.",
);

const STORY_ACKNOWLEDGEMENT = localized(
  "오늘 이야기를 남겨주셔서 고마워요.",
  "今日のお話を残してくださってありがとうございます。",
  "Thank you for sharing today's story.",
);

interface ChoiceExerciseInput {
  id: string;
  day: HaruWeekDay;
  prompt: LocalizedText;
  options: AnswerOption[];
  correctAnswer: string;
  explanation: LocalizedText;
  type?: "multiple_choice_meaning" | "attention_pattern";
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

function choiceExercise({
  id,
  day,
  prompt,
  options,
  correctAnswer,
  explanation,
  type = "multiple_choice_meaning",
  difficulty = 1,
}: ChoiceExerciseInput): Exercise {
  return {
    id,
    lessonId: `haru_week_day_${day}`,
    type,
    prompt,
    payload: {
      audioText: prompt,
      instructionText: localized(
        "하나를 골라 주세요.",
        "一つ選んでください。",
        "Choose one.",
      ),
      options,
    },
    correctAnswer,
    explanation,
    difficulty,
  };
}

function moodExercise(
  id: string,
  day: HaruWeekDay,
  prompt: LocalizedText,
  explanation: LocalizedText,
): Exercise {
  return {
    id,
    lessonId: `haru_week_day_${day}`,
    type: "personal_memory_recall",
    prompt,
    payload: {
      audioText: prompt,
      linkedConceptId: `haru_week_day_${day}`,
      memoryField: "emotionTag",
      options: moodOptions(),
    },
    correctAnswer: null,
    explanation,
    difficulty: 1,
  };
}

function voiceExercise(
  id: string,
  day: HaruWeekDay,
  prompt: LocalizedText,
  explanation: LocalizedText,
  durationSeconds: number,
): Exercise {
  return {
    id,
    lessonId: `haru_week_day_${day}`,
    type: "personal_memory_recall",
    prompt,
    payload: {
      audioText: prompt,
      linkedConceptId: `haru_week_day_${day}`,
      memoryField: "story",
      durationSeconds,
      options: [],
    },
    correctAnswer: null,
    explanation,
    difficulty: 1,
  };
}

function sequenceExercise(
  id: string,
  day: HaruWeekDay,
  prompt: LocalizedText,
  items: AnswerOption[],
  correctAnswer: string[],
  explanation: LocalizedText,
): Exercise {
  return {
    id,
    lessonId: `haru_week_day_${day}`,
    type: "sequence_order",
    prompt,
    payload: {
      audioText: prompt,
      // Preserve the canonical A-D button layout from the usage record.
      items,
      requiredSelectionCount: 3,
    },
    correctAnswer,
    explanation,
    difficulty: 2,
  };
}

export const HARU_DEMO_PERSONA = {
  name: localized("박영자", "パク・ヨンジャ", "Young-ja Park"),
  displayName: localized("박영자 어르신", "パク・ヨンジャさん", "Ms. Park Young-ja"),
  birthYear: 1952,
  age: 74,
  residence: localized(
    "대전광역시 유성구",
    "大田広域市 儒城区",
    "Yuseong-gu, Daejeon",
  ),
  livingArrangement: localized(
    "혼자 거주하며 딸이 가까이 살고 있음",
    "一人暮らしで、娘が近くに住んでいる",
    "Lives alone, with her daughter nearby",
  ),
  speechProfileNote: localized(
    "말속도가 비교적 느리고, 짧은 문장 사이에 쉼이 있음",
    "話す速度は比較的ゆっくりで、短い文の間に間がある",
    "Speaks relatively slowly, with pauses between short sentences",
  ),
  gender: localized("여성", "女性", "Woman"),
  registeredProfileFields: {
    hometown: localized("부산 영도", "釜山・影島", "Yeongdo, Busan"),
    elementarySchool: localized("청학초등학교", "青鶴小学校", "Cheonghak Elementary School"),
    formerOccupation: localized(
      "초등학교 급식 조리사",
      "小学校の給食調理員",
      "Elementary school cafeteria cook",
    ),
    daughterName: localized("김민지", "キム・ミンジ", "Kim Min-ji"),
    grandsonName: localized("김준호", "キム・ジュノ", "Kim Jun-ho"),
    closeFriendName: localized("이순자", "イ・スンジャ", "Lee Soon-ja"),
    neighborName: localized("최정희", "チェ・ジョンヒ", "Choi Jeong-hee"),
    favoriteFood: localized("된장찌개", "テンジャンチゲ", "Soybean paste stew"),
    medicationTime: localized("오전 8시", "午前8時", "8:00 a.m."),
  },
  consents: {
    voiceRecording: true,
    sttProcessing: true,
    longitudinalUsageStorage: true,
    personalizedQuestionUse: true,
    consentedAt: "2026-07-19T14:00:00+09:00",
  },
  isSynthetic: true,
  contentMode: "scripted_synthetic_week",
  hasFamilySharingConsent: false,
} as const satisfies {
  name: LocalizedText;
  displayName: LocalizedText;
  birthYear: number;
  age: number;
  residence: LocalizedText;
  livingArrangement: LocalizedText;
  speechProfileNote: LocalizedText;
  gender: LocalizedText;
  registeredProfileFields: {
    hometown: LocalizedText;
    elementarySchool: LocalizedText;
    formerOccupation: LocalizedText;
    daughterName: LocalizedText;
    grandsonName: LocalizedText;
    closeFriendName: LocalizedText;
    neighborName: LocalizedText;
    favoriteFood: LocalizedText;
    medicationTime: LocalizedText;
  };
  consents: {
    voiceRecording: true;
    sttProcessing: true;
    longitudinalUsageStorage: true;
    personalizedQuestionUse: true;
    consentedAt: string;
  };
  isSynthetic: true;
  contentMode: "scripted_synthetic_week";
  hasFamilySharingConsent: false;
};

export const HARU_WEEK_PLAN = [
  {
    day: 1,
    dateISO: "2026-07-20",
    weekday: localized("월요일", "月曜日", "Monday"),
    title: localized("1일차 · 나의 오늘", "1日目・今日の私", "Day 1 · My day"),
    greeting: localized(
      "영자 어르신, 월요일 활동을 시작해요.",
      "ヨンジャさん、月曜日の活動を始めましょう。",
      "Ms. Park, let's begin Monday's activities.",
    ),
    completionMessage: localized(
      "오늘 활동을 모두 마쳤어요. 내일 또 만나요.",
      "今日の活動をすべて終えました。また明日会いましょう。",
      "You finished all of today's activities. See you tomorrow.",
    ),
    exerciseIds: ["D1_Q1", "D1_Q2", "D1_Q3", "D1_Q4", "D1_Q5", "D1_Q6"],
    recordedSummary: { durationSeconds: 102, evaluatedActivities: 4, expectedMatches: 4 },
  },
  {
    day: 2,
    dateISO: "2026-07-21",
    weekday: localized("화요일", "火曜日", "Tuesday"),
    title: localized("2일차 · 어제와 오늘", "2日目・昨日と今日", "Day 2 · Yesterday and today"),
    greeting: localized(
      "영자 어르신, 어제 이야기를 이어가 볼까요?",
      "ヨンジャさん、昨日のお話を続けてみましょう。",
      "Ms. Park, shall we continue yesterday's story?",
    ),
    completionMessage: localized(
      "오늘 활동을 모두 마쳤어요. 내일도 편하게 들러 주세요.",
      "今日の活動をすべて終えました。明日も気軽に来てください。",
      "You finished today's activities. Please stop by again tomorrow.",
    ),
    exerciseIds: ["D2_Q1", "D2_Q2", "D2_Q3", "D2_Q4", "D2_Q5", "D2_Q6"],
    recordedSummary: { durationSeconds: 100, evaluatedActivities: 4, expectedMatches: 4 },
  },
  {
    day: 3,
    dateISO: "2026-07-22",
    weekday: localized("수요일", "水曜日", "Wednesday"),
    title: localized("3일차 · 생활 기억", "3日目・暮らしの記憶", "Day 3 · Everyday memories"),
    greeting: localized(
      "영자 어르신, 오늘도 천천히 시작해요.",
      "ヨンジャさん、今日もゆっくり始めましょう。",
      "Ms. Park, let's begin slowly again today.",
    ),
    completionMessage: localized(
      "오늘 활동을 모두 마쳤어요. 편안한 하루 보내세요.",
      "今日の活動をすべて終えました。穏やかな一日をお過ごしください。",
      "You finished today's activities. Have a comfortable day.",
    ),
    exerciseIds: ["D3_Q1", "D3_Q2", "D3_Q3", "D3_Q4", "D3_Q5", "D3_Q6"],
    recordedSummary: { durationSeconds: 102, evaluatedActivities: 4, expectedMatches: 4 },
  },
  {
    day: 4,
    dateISO: "2026-07-23",
    weekday: localized("목요일", "木曜日", "Thursday"),
    title: localized("4일차 · 몸과 마음", "4日目・心と体", "Day 4 · Body and mind"),
    greeting: localized(
      "영자 어르신, 오늘 몸과 마음은 어떠신가요?",
      "ヨンジャさん、今日の心と体はいかがですか。",
      "Ms. Park, how are your body and mind today?",
    ),
    completionMessage: localized(
      "오늘 활동을 모두 마쳤어요. 한 문제는 틀려도 괜찮아요. 내일 또 만나요.",
      "今日の活動をすべて終えました。一問まちがえても大丈夫です。また明日会いましょう。",
      "You finished today's activities. One different answer is okay. See you tomorrow.",
    ),
    exerciseIds: ["D4_Q1", "D4_Q2", "D4_Q3", "D4_Q4", "D4_Q5", "D4_Q6"],
    recordedSummary: { durationSeconds: 103, evaluatedActivities: 4, expectedMatches: 3 },
  },
  {
    day: 5,
    dateISO: "2026-07-24",
    weekday: localized("금요일", "金曜日", "Friday"),
    title: localized("5일차 · 함께한 시간", "5日目・一緒に過ごした時間", "Day 5 · Time together"),
    greeting: localized(
      "영자 어르신, 금요일 활동을 편하게 시작해요.",
      "ヨンジャさん、金曜日の活動を気楽に始めましょう。",
      "Ms. Park, let's ease into Friday's activities.",
    ),
    completionMessage: localized(
      "오늘 활동을 모두 마쳤어요. 가족과 편안한 시간 보내세요.",
      "今日の活動をすべて終えました。ご家族と穏やかな時間をお過ごしください。",
      "You finished today's activities. Enjoy a comfortable time with family.",
    ),
    exerciseIds: ["D5_Q1", "D5_Q2", "D5_Q3", "D5_Q4", "D5_Q5", "D5_Q6"],
    recordedSummary: { durationSeconds: 100, evaluatedActivities: 4, expectedMatches: 4 },
  },
  {
    day: 6,
    dateISO: "2026-07-25",
    weekday: localized("토요일", "土曜日", "Saturday"),
    title: localized("6일차 · 주말의 하루", "6日目・週末の一日", "Day 6 · A weekend day"),
    greeting: localized(
      "영자 어르신, 토요일 이야기를 들려주세요.",
      "ヨンジャさん、土曜日のお話を聞かせてください。",
      "Ms. Park, tell us about your Saturday.",
    ),
    completionMessage: localized(
      "오늘 활동을 모두 마쳤어요. 편안히 쉬세요.",
      "今日の活動をすべて終えました。ゆっくりお休みください。",
      "You finished today's activities. Rest comfortably.",
    ),
    exerciseIds: ["D6_Q1", "D6_Q2", "D6_Q3", "D6_Q4", "D6_Q5", "D6_Q6"],
    recordedSummary: { durationSeconds: 101, evaluatedActivities: 4, expectedMatches: 4 },
  },
  {
    day: 7,
    dateISO: "2026-07-26",
    weekday: localized("일요일", "日曜日", "Sunday"),
    title: localized("7일차 · 한 주 돌아보기", "7日目・一週間を振り返る", "Day 7 · Looking back on the week"),
    greeting: localized(
      "영자 어르신, 이번 주의 기억을 함께 돌아봐요.",
      "ヨンジャさん、今週の思い出を一緒に振り返りましょう。",
      "Ms. Park, let's look back on this week's memories together.",
    ),
    completionMessage: localized(
      "일주일 활동을 모두 마쳤어요. 다음 주에도 편하게 만나요.",
      "一週間の活動をすべて終えました。来週も気軽に会いましょう。",
      "You finished the full week. We'll meet comfortably again next week.",
    ),
    exerciseIds: ["D7_Q1", "D7_Q2", "D7_Q3", "D7_Q4", "D7_Q5", "D7_Q6"],
    recordedSummary: { durationSeconds: 105, evaluatedActivities: 4, expectedMatches: 4 },
  },
] as const satisfies readonly HaruWeekPlan[];

export function getHaruWeekPlan(day: HaruWeekDay): HaruWeekPlan {
  return HARU_WEEK_PLAN.find((plan) => plan.day === day) ?? HARU_WEEK_PLAN[0];
}

const HARU_WEEK_QUESTION_BASE: readonly HaruWeekQuestionBase[] = [
  { exerciseId: "D1_Q1", day: 1, order: 1, domain: "감정", responseType: "single_choice", scored: false },
  { exerciseId: "D1_Q2", day: 1, order: 2, domain: "시간 지남력", responseType: "single_choice", scored: true },
  {
    exerciseId: "D1_Q3",
    day: 1,
    order: 3,
    domain: "일반 개인 기억",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "profile", field: "hometown" },
  },
  { exerciseId: "D1_Q4", day: 1, order: 4, domain: "주의·계산", responseType: "single_choice", scored: true },
  {
    exerciseId: "D1_Q5",
    day: 1,
    order: 5,
    domain: "일상·개인화 정보 수집",
    responseType: "voice",
    scored: false,
    maxResponseSeconds: 25,
  },
  { exerciseId: "D1_Q6", day: 1, order: 6, domain: "단어·순서 기억", responseType: "button_sequence", scored: true },
  {
    exerciseId: "D2_Q1",
    day: 2,
    order: 1,
    domain: "감정",
    responseType: "single_choice",
    scored: false,
    scriptedSource: { kind: "prior_question", sourceDay: 1, sourceQuestionId: "D1_Q1" },
  },
  { exerciseId: "D2_Q2", day: 2, order: 2, domain: "시간 지남력", responseType: "single_choice", scored: true },
  {
    exerciseId: "D2_Q3",
    day: 2,
    order: 3,
    domain: "전날 활동 회상",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "prior_question", sourceDay: 1, sourceQuestionId: "D1_Q5" },
  },
  { exerciseId: "D2_Q4", day: 2, order: 4, domain: "언어 이해", responseType: "single_choice", scored: true },
  { exerciseId: "D2_Q5", day: 2, order: 5, domain: "시공간·주의", responseType: "single_choice", scored: true },
  {
    exerciseId: "D2_Q6",
    day: 2,
    order: 6,
    domain: "일상·개인화 정보 수집",
    responseType: "voice",
    scored: false,
    maxResponseSeconds: 25,
  },
  {
    exerciseId: "D3_Q1",
    day: 3,
    order: 1,
    domain: "감정",
    responseType: "single_choice",
    scored: false,
    scriptedSource: { kind: "prior_question", sourceDay: 2, sourceQuestionId: "D2_Q1" },
  },
  { exerciseId: "D3_Q2", day: 3, order: 2, domain: "시간 지남력", responseType: "single_choice", scored: true },
  {
    exerciseId: "D3_Q3",
    day: 3,
    order: 3,
    domain: "전날 활동 회상",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "prior_question", sourceDay: 2, sourceQuestionId: "D2_Q6" },
  },
  {
    exerciseId: "D3_Q4",
    day: 3,
    order: 4,
    domain: "주의·계산",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "profile", field: "medicationTime" },
  },
  {
    exerciseId: "D3_Q5",
    day: 3,
    order: 5,
    domain: "일반 개인 기억",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "profile", field: "formerOccupation" },
  },
  {
    exerciseId: "D3_Q6",
    day: 3,
    order: 6,
    domain: "일상·개인화 정보 수집",
    responseType: "voice",
    scored: false,
    maxResponseSeconds: 25,
  },
  {
    exerciseId: "D4_Q1",
    day: 4,
    order: 1,
    domain: "감정",
    responseType: "single_choice",
    scored: false,
    scriptedSource: { kind: "prior_question", sourceDay: 3, sourceQuestionId: "D3_Q6" },
  },
  { exerciseId: "D4_Q2", day: 4, order: 2, domain: "시간 지남력", responseType: "single_choice", scored: true },
  {
    exerciseId: "D4_Q3",
    day: 4,
    order: 3,
    domain: "전날 활동 회상",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "prior_question", sourceDay: 3, sourceQuestionId: "D3_Q6" },
  },
  { exerciseId: "D4_Q4", day: 4, order: 4, domain: "주의·계산", responseType: "single_choice", scored: true },
  {
    exerciseId: "D4_Q5",
    day: 4,
    order: 5,
    domain: "일상·개인화 정보 수집",
    responseType: "voice",
    scored: false,
    maxResponseSeconds: 25,
  },
  { exerciseId: "D4_Q6", day: 4, order: 6, domain: "단어·순서 기억", responseType: "button_sequence", scored: true },
  {
    exerciseId: "D5_Q1",
    day: 5,
    order: 1,
    domain: "감정",
    responseType: "single_choice",
    scored: false,
    scriptedSource: { kind: "prior_question", sourceDay: 4, sourceQuestionId: "D4_Q5" },
  },
  { exerciseId: "D5_Q2", day: 5, order: 2, domain: "시간 지남력", responseType: "single_choice", scored: true },
  {
    exerciseId: "D5_Q3",
    day: 5,
    order: 3,
    domain: "전날 활동 회상",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "prior_question", sourceDay: 4, sourceQuestionId: "D4_Q5" },
  },
  { exerciseId: "D5_Q4", day: 5, order: 4, domain: "언어 이해", responseType: "single_choice", scored: true },
  { exerciseId: "D5_Q5", day: 5, order: 5, domain: "시공간", responseType: "single_choice", scored: true },
  {
    exerciseId: "D5_Q6",
    day: 5,
    order: 6,
    domain: "일상·개인화 정보 수집",
    responseType: "voice",
    scored: false,
    maxResponseSeconds: 25,
  },
  {
    exerciseId: "D6_Q1",
    day: 6,
    order: 1,
    domain: "감정",
    responseType: "single_choice",
    scored: false,
    scriptedSource: { kind: "prior_question", sourceDay: 5, sourceQuestionId: "D5_Q6" },
  },
  { exerciseId: "D6_Q2", day: 6, order: 2, domain: "시간 지남력", responseType: "single_choice", scored: true },
  {
    exerciseId: "D6_Q3",
    day: 6,
    order: 3,
    domain: "전날 활동 회상",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "prior_question", sourceDay: 5, sourceQuestionId: "D5_Q6" },
  },
  { exerciseId: "D6_Q4", day: 6, order: 4, domain: "주의·계산", responseType: "single_choice", scored: true },
  {
    exerciseId: "D6_Q5",
    day: 6,
    order: 5,
    domain: "일반 개인 기억",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "profile", field: "daughterName" },
  },
  {
    exerciseId: "D6_Q6",
    day: 6,
    order: 6,
    domain: "일상·개인화 정보 수집",
    responseType: "voice",
    scored: false,
    maxResponseSeconds: 25,
  },
  {
    exerciseId: "D7_Q1",
    day: 7,
    order: 1,
    domain: "감정",
    responseType: "single_choice",
    scored: false,
    scriptedSource: { kind: "prior_question", sourceDay: 6, sourceQuestionId: "D6_Q6" },
  },
  { exerciseId: "D7_Q2", day: 7, order: 2, domain: "시간 지남력", responseType: "single_choice", scored: true },
  {
    exerciseId: "D7_Q3",
    day: 7,
    order: 3,
    domain: "전날 활동 회상",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "prior_question", sourceDay: 6, sourceQuestionId: "D6_Q6" },
  },
  {
    exerciseId: "D7_Q4",
    day: 7,
    order: 4,
    domain: "장기·주간 개인 기억",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "prior_question", sourceDay: 5, sourceQuestionId: "D5_Q6" },
  },
  {
    exerciseId: "D7_Q5",
    day: 7,
    order: 5,
    domain: "개인화 주의·계산",
    responseType: "single_choice",
    scored: true,
    scriptedSource: { kind: "prior_question", sourceDay: 6, sourceQuestionId: "D6_Q6" },
  },
  {
    exerciseId: "D7_Q6",
    day: 7,
    order: 6,
    domain: "주간 회고·개인화 정보 수집",
    responseType: "voice",
    scored: false,
    maxResponseSeconds: 30,
  },
] as const;

export const haru7DayExercises: Exercise[] = [
  moodExercise(
    "D1_Q1",
    1,
    localized(
      "영자 어르신, 오늘 기분은 어떠세요?",
      "ヨンジャさん、今日の気分はいかがですか。",
      "Ms. Park, how are you feeling today?",
    ),
    MOOD_ACKNOWLEDGEMENT,
  ),
  choiceExercise({
    id: "D1_Q2",
    day: 1,
    prompt: localized("오늘은 무슨 요일인가요?", "今日は何曜日ですか。", "What day of the week is it today?"),
    options: [
      option("A", "월요일", "月曜日", "Monday"),
      option("B", "화요일", "火曜日", "Tuesday"),
      option("C", "토요일", "土曜日", "Saturday"),
      option("D", "일요일", "日曜日", "Sunday"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 오늘은 월요일이에요.",
      "そうです。今日は月曜日です。",
      "That's right. Today is Monday.",
    ),
  }),
  choiceExercise({
    id: "D1_Q3",
    day: 1,
    prompt: localized(
      "영자 어르신이 태어나고 자란 고향은 어디인가요?",
      "ヨンジャさんが生まれ育った故郷はどこですか。",
      "Where is Ms. Park's hometown, where she was born and raised?",
    ),
    options: [
      option("A", "부산 영도", "釜山・影島", "Yeongdo, Busan"),
      option("B", "대전 유성", "大田・儒城", "Yuseong, Daejeon"),
      option("C", "전주 완산", "全州・完山", "Wansan, Jeonju"),
      option("D", "서울 종로", "ソウル・鍾路", "Jongno, Seoul"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 부산 영도라고 말씀해 주셨어요.",
      "そうです。釜山の影島だと教えてくださいました。",
      "That's right. You told us it was Yeongdo, Busan.",
    ),
  }),
  choiceExercise({
    id: "D1_Q4",
    day: 1,
    type: "attention_pattern",
    difficulty: 2,
    prompt: localized(
      "두부 2,000원과 달걀 4,000원을 사고 10,000원을 냈습니다. 거스름돈은 얼마일까요?",
      "豆腐を2,000ウォン、卵を4,000ウォンで買い、10,000ウォンを払いました。おつりはいくらですか。",
      "You bought tofu for 2,000 won and eggs for 4,000 won, then paid 10,000 won. How much change should you get?",
    ),
    options: [
      option("A", "2,000원", "2,000ウォン", "2,000 won"),
      option("B", "3,000원", "3,000ウォン", "3,000 won"),
      option("C", "4,000원", "4,000ウォン", "4,000 won"),
      option("D", "5,000원", "5,000ウォン", "5,000 won"),
    ],
    correctAnswer: "C",
    explanation: localized(
      "맞아요. 거스름돈은 4,000원이에요.",
      "そうです。おつりは4,000ウォンです。",
      "That's right. The change is 4,000 won.",
    ),
  }),
  voiceExercise(
    "D1_Q5",
    1,
    localized(
      "오늘 다녀온 곳과 한 일을 천천히 말씀해 주세요.",
      "今日行った場所と、したことをゆっくり話してください。",
      "Please slowly tell us where you went and what you did today.",
    ),
    STORY_ACKNOWLEDGEMENT,
    25,
  ),
  sequenceExercise(
    "D1_Q6",
    1,
    localized(
      "처음 들은 순서대로 버튼을 눌러 주세요.",
      "最初に聞いた順番どおりにボタンを押してください。",
      "Press the buttons in the order you first heard them.",
    ),
    [
      option("A", "사과", "りんご", "Apple"),
      option("B", "우산", "傘", "Umbrella"),
      option("C", "버스", "バス", "Bus"),
      option("D", "모자", "帽子", "Hat"),
    ],
    ["A", "B", "C"],
    localized(
      "세 단어를 순서대로 잘 기억하셨어요.",
      "三つの言葉を順番どおりによく覚えていました。",
      "You remembered the three words in order.",
    ),
  ),
  moodExercise(
    "D2_Q1",
    2,
    localized(
      "어제는 기분이 좋다고 하셨어요. 오늘 기분은 어떠세요?",
      "昨日は気分が良いとおっしゃいました。今日の気分はいかがですか。",
      "Yesterday you said you felt good. How do you feel today?",
    ),
    MOOD_ACKNOWLEDGEMENT,
  ),
  choiceExercise({
    id: "D2_Q2",
    day: 2,
    prompt: localized("내일은 무슨 요일인가요?", "明日は何曜日ですか。", "What day of the week is tomorrow?"),
    options: [
      option("A", "월요일", "月曜日", "Monday"),
      option("B", "수요일", "水曜日", "Wednesday"),
      option("C", "금요일", "金曜日", "Friday"),
      option("D", "일요일", "日曜日", "Sunday"),
    ],
    correctAnswer: "B",
    explanation: localized(
      "맞아요. 내일은 수요일이에요.",
      "そうです。明日は水曜日です。",
      "That's right. Tomorrow is Wednesday.",
    ),
  }),
  choiceExercise({
    id: "D2_Q3",
    day: 2,
    prompt: localized(
      "다음 중 어제 유성시장에서 샀다고 말씀하신 채소 하나는 무엇인가요?",
      "次のうち、昨日、儒城市場で買ったと話した野菜の一つはどれですか。",
      "Which vegetable did you say you bought at Yuseong Market yesterday?",
    ),
    options: [
      option("A", "애호박", "韓国かぼちゃ", "Korean zucchini"),
      option("B", "감자", "じゃがいも", "Potato"),
      option("C", "양파", "玉ねぎ", "Onion"),
      option("D", "무", "大根", "Radish"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 애호박을 샀다고 말씀하셨어요.",
      "そうです。韓国かぼちゃを買ったとおっしゃいました。",
      "That's right. You said you bought Korean zucchini.",
    ),
  }),
  choiceExercise({
    id: "D2_Q4",
    day: 2,
    difficulty: 2,
    prompt: localized(
      "속담 '가는 말이 고와야' 뒤에 이어지는 말은 무엇인가요?",
      "韓国のことわざ「こちらが美しい言葉をかければ」に続く言葉はどれですか。",
      "Which phrase completes the Korean saying, 'If the words going out are kind'?",
    ),
    options: [
      option("A", "오는 말이 곱다", "相手からも美しい言葉が返る", "The words coming back are kind"),
      option("B", "발이 편하다", "足が楽になる", "Your feet feel comfortable"),
      option("C", "밥이 맛있다", "ご飯がおいしい", "The meal tastes good"),
      option("D", "길이 보인다", "道が見える", "The road becomes visible"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. '오는 말이 곱다'예요.",
      "そうです。「相手からも美しい言葉が返る」です。",
      "That's right: 'the words coming back are kind.'",
    ),
  }),
  choiceExercise({
    id: "D2_Q5",
    day: 2,
    type: "attention_pattern",
    difficulty: 2,
    prompt: localized(
      "점이 왼쪽 위, 오른쪽 위, 오른쪽 아래 순서로 움직였습니다. 같은 방향으로 계속 움직이면 다음 위치는 어디일까요?",
      "点が左上、右上、右下の順に動きました。同じ向きに動き続けると、次はどこですか。",
      "A dot moved from upper left to upper right to lower right. If it keeps moving in the same direction, where is it next?",
    ),
    options: [
      option("A", "왼쪽 위", "左上", "Upper left"),
      option("B", "오른쪽 위", "右上", "Upper right"),
      option("C", "왼쪽 아래", "左下", "Lower left"),
      option("D", "오른쪽 아래", "右下", "Lower right"),
    ],
    correctAnswer: "C",
    explanation: localized(
      "맞아요. 다음은 왼쪽 아래예요.",
      "そうです。次は左下です。",
      "That's right. Next is the lower left.",
    ),
  }),
  voiceExercise(
    "D2_Q6",
    2,
    localized(
      "오늘 누구를 만나 무엇을 했고, 무엇을 드셨는지 말씀해 주세요.",
      "今日、誰に会って何をし、何を食べたか話してください。",
      "Please tell us whom you met, what you did, and what you ate today.",
    ),
    STORY_ACKNOWLEDGEMENT,
    25,
  ),
  moodExercise(
    "D3_Q1",
    3,
    localized(
      "어제는 기분이 매우 좋다고 하셨어요. 오늘 기분은 어떠세요?",
      "昨日はとても気分が良いとおっしゃいました。今日の気分はいかがですか。",
      "Yesterday you said you felt very good. How do you feel today?",
    ),
    MOOD_ACKNOWLEDGEMENT,
  ),
  choiceExercise({
    id: "D3_Q2",
    day: 3,
    prompt: localized("어제는 무슨 요일이었나요?", "昨日は何曜日でしたか。", "What day of the week was yesterday?"),
    options: [
      option("A", "월요일", "月曜日", "Monday"),
      option("B", "화요일", "火曜日", "Tuesday"),
      option("C", "수요일", "水曜日", "Wednesday"),
      option("D", "목요일", "木曜日", "Thursday"),
    ],
    correctAnswer: "B",
    explanation: localized(
      "맞아요. 어제는 화요일이었어요.",
      "そうです。昨日は火曜日でした。",
      "That's right. Yesterday was Tuesday.",
    ),
  }),
  choiceExercise({
    id: "D3_Q3",
    day: 3,
    prompt: localized(
      "어제 복지관에서 함께 윷놀이한 사람은 누구인가요?",
      "昨日、福祉館で一緒にユンノリをした人は誰ですか。",
      "Who played yut with you at the community center yesterday?",
    ),
    options: [
      option("A", "이순자", "イ・スンジャ", "Lee Soon-ja"),
      option("B", "김민지", "キム・ミンジ", "Kim Min-ji"),
      option("C", "김준호", "キム・ジュノ", "Kim Jun-ho"),
      option("D", "최정희", "チェ・ジョンヒ", "Choi Jeong-hee"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 순자 씨와 윷놀이를 하셨어요.",
      "そうです。スンジャさんとユンノリをしました。",
      "That's right. You played yut with Ms. Soon-ja.",
    ),
  }),
  choiceExercise({
    id: "D3_Q4",
    day: 3,
    type: "attention_pattern",
    difficulty: 2,
    prompt: localized(
      "혈압약을 오전 8시에 먹고 30분 뒤에 아침을 먹습니다. 아침은 몇 시에 먹을까요?",
      "血圧の薬を午前8時に飲み、30分後に朝食を取ります。朝食は何時ですか。",
      "You take your blood pressure medicine at 8:00 a.m. and eat breakfast 30 minutes later. What time is breakfast?",
    ),
    options: [
      option("A", "오전 8시 15분", "午前8時15分", "8:15 a.m."),
      option("B", "오전 8시 30분", "午前8時30分", "8:30 a.m."),
      option("C", "오전 9시", "午前9時", "9:00 a.m."),
      option("D", "오전 9시 30분", "午前9時30分", "9:30 a.m."),
    ],
    correctAnswer: "B",
    explanation: localized(
      "맞아요. 30분 뒤는 오전 8시 30분이에요.",
      "そうです。30分後は午前8時30分です。",
      "That's right. Thirty minutes later is 8:30 a.m.",
    ),
  }),
  choiceExercise({
    id: "D3_Q5",
    day: 3,
    prompt: localized(
      "영자 어르신이 예전에 하셨던 일은 무엇인가요?",
      "ヨンジャさんが以前していた仕事は何ですか。",
      "What work did Ms. Park do in the past?",
    ),
    options: [
      option("A", "초등학교 급식 조리사", "小学校の給食調理員", "Elementary school cafeteria cook"),
      option("B", "버스 기사", "バス運転手", "Bus driver"),
      option("C", "은행원", "銀行員", "Bank clerk"),
      option("D", "미용사", "美容師", "Hairdresser"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 학교 급식실에서 일하셨다고 말씀해 주셨어요.",
      "そうです。学校の給食室で働いていたと教えてくださいました。",
      "That's right. You told us you worked in a school cafeteria.",
    ),
  }),
  voiceExercise(
    "D3_Q6",
    3,
    localized(
      "오늘 다녀온 곳과 몸 상태를 말씀해 주세요.",
      "今日行った場所と体の調子を話してください。",
      "Please tell us where you went today and how your body feels.",
    ),
    STORY_ACKNOWLEDGEMENT,
    25,
  ),
  moodExercise(
    "D4_Q1",
    4,
    localized(
      "어제는 조금 피곤하지만 마음은 편하다고 하셨어요. 오늘 기분은 어떠세요?",
      "昨日は少し疲れたけれど気持ちは落ち着いているとおっしゃいました。今日の気分はいかがですか。",
      "Yesterday you said you were a little tired but felt at ease. How do you feel today?",
    ),
    MOOD_ACKNOWLEDGEMENT,
  ),
  choiceExercise({
    id: "D4_Q2",
    day: 4,
    prompt: localized("지금은 몇 월인가요?", "今は何月ですか。", "What month is it now?"),
    options: [
      option("A", "6월", "6月", "June"),
      option("B", "7월", "7月", "July"),
      option("C", "8월", "8月", "August"),
      option("D", "9월", "9月", "September"),
    ],
    correctAnswer: "B",
    explanation: localized(
      "맞아요. 지금은 7월이에요.",
      "そうです。今は7月です。",
      "That's right. It is July.",
    ),
  }),
  choiceExercise({
    id: "D4_Q3",
    day: 4,
    prompt: localized(
      "어제 혈압을 잰 곳은 어디인가요?",
      "昨日、血圧を測った場所はどこですか。",
      "Where did you have your blood pressure checked yesterday?",
    ),
    options: [
      option("A", "유성구 보건소", "儒城区保健所", "Yuseong-gu Public Health Center"),
      option("B", "복지관", "福祉館", "Community center"),
      option("C", "유성시장", "儒城市場", "Yuseong Market"),
      option("D", "은행", "銀行", "Bank"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 보건소에서 혈압을 재셨어요.",
      "そうです。保健所で血圧を測りました。",
      "That's right. You had it checked at the public health center.",
    ),
  }),
  choiceExercise({
    id: "D4_Q4",
    day: 4,
    type: "attention_pattern",
    difficulty: 2,
    prompt: localized(
      "지하철이 15분 간격으로 옵니다. 이전 지하철이 오후 1시 10분에 출발했다면 다음 지하철은 몇 시에 올까요?",
      "地下鉄は15分間隔で来ます。前の地下鉄が午後1時10分に出発したなら、次は何時に来ますか。",
      "The subway comes every 15 minutes. If the previous train left at 1:10 p.m., when will the next one arrive?",
    ),
    options: [
      option("A", "오후 1시 15분", "午後1時15分", "1:15 p.m."),
      option("B", "오후 1시 20분", "午後1時20分", "1:20 p.m."),
      option("C", "오후 1시 25분", "午後1時25分", "1:25 p.m."),
      option("D", "오후 1시 30분", "午後1時30分", "1:30 p.m."),
    ],
    correctAnswer: "C",
    explanation: localized(
      "맞아요. 15분 뒤인 오후 1시 25분이에요.",
      "そうです。15分後の午後1時25分です。",
      "That's right. Fifteen minutes later is 1:25 p.m.",
    ),
  }),
  voiceExercise(
    "D4_Q5",
    4,
    localized(
      "오늘 어디를 걸었고, 누구를 만났는지 말씀해 주세요.",
      "今日どこを歩き、誰に会ったか話してください。",
      "Please tell us where you walked and whom you met today.",
    ),
    STORY_ACKNOWLEDGEMENT,
    25,
  ),
  sequenceExercise(
    "D4_Q6",
    4,
    localized(
      "처음 들은 순서대로 버튼을 눌러 주세요.",
      "最初に聞いた順番どおりにボタンを押してください。",
      "Press the buttons in the order you first heard them.",
    ),
    [
      option("A", "열쇠", "鍵", "Key"),
      option("B", "포도", "ぶどう", "Grapes"),
      option("C", "기차", "汽車", "Train"),
      option("D", "우산", "傘", "Umbrella"),
    ],
    ["A", "B", "C"],
    localized(
      "순서를 잘 기억해 선택하셨어요.",
      "順番をよく覚えて選べました。",
      "You remembered the order and selected it well.",
    ),
  ),
  moodExercise(
    "D5_Q1",
    5,
    localized(
      "어제 산책 뒤 몸이 가벼워졌다고 하셨어요. 오늘 기분은 어떠세요?",
      "昨日、散歩のあと体が軽くなったとおっしゃいました。今日の気分はいかがですか。",
      "Yesterday you said your body felt lighter after your walk. How do you feel today?",
    ),
    MOOD_ACKNOWLEDGEMENT,
  ),
  choiceExercise({
    id: "D5_Q2",
    day: 5,
    prompt: localized("내일은 무슨 요일인가요?", "明日は何曜日ですか。", "What day of the week is tomorrow?"),
    options: [
      option("A", "금요일", "金曜日", "Friday"),
      option("B", "토요일", "土曜日", "Saturday"),
      option("C", "일요일", "日曜日", "Sunday"),
      option("D", "월요일", "月曜日", "Monday"),
    ],
    correctAnswer: "B",
    explanation: localized(
      "맞아요. 내일은 토요일이에요.",
      "そうです。明日は土曜日です。",
      "That's right. Tomorrow is Saturday.",
    ),
  }),
  choiceExercise({
    id: "D5_Q3",
    day: 5,
    prompt: localized(
      "어제 산책을 마치고 집에서 마신 것은 무엇인가요?",
      "昨日、散歩を終えて家で飲んだものは何ですか。",
      "What did you drink at home after yesterday's walk?",
    ),
    options: [
      option("A", "보리차", "麦茶", "Barley tea"),
      option("B", "커피", "コーヒー", "Coffee"),
      option("C", "우유", "牛乳", "Milk"),
      option("D", "오렌지주스", "オレンジジュース", "Orange juice"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 보리차를 마셨다고 하셨어요.",
      "そうです。麦茶を飲んだとおっしゃいました。",
      "That's right. You said you drank barley tea.",
    ),
  }),
  choiceExercise({
    id: "D5_Q4",
    day: 5,
    difficulty: 2,
    prompt: localized(
      "속담 '백지장도 맞들면 낫다'와 가장 가까운 뜻은 무엇인가요?",
      "韓国のことわざ「紙一枚でも二人で持てば楽だ」に最も近い意味はどれですか。",
      "Which meaning is closest to the Korean saying, 'Even a sheet of paper is easier to lift together'?",
    ),
    options: [
      option("A", "함께 하면 일이 쉬워진다", "一緒にすれば仕事が楽になる", "Working together makes a task easier"),
      option("B", "흰 종이는 깨끗하다", "白い紙はきれいだ", "White paper is clean"),
      option("C", "혼자 해야 일이 빠르다", "一人でする方が早い", "Working alone is faster"),
      option("D", "무거운 짐은 버려야 한다", "重い荷物は捨てるべきだ", "Heavy things should be discarded"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 힘을 합치면 일이 쉬워진다는 뜻이에요.",
      "そうです。力を合わせると仕事が楽になるという意味です。",
      "That's right. It means work becomes easier when people join forces.",
    ),
  }),
  choiceExercise({
    id: "D5_Q5",
    day: 5,
    type: "attention_pattern",
    prompt: localized(
      "위에 보이는 모양과 똑같은 것을 고르세요.",
      "上に見える形とまったく同じものを選んでください。",
      "Choose the option that exactly matches the shape shown above.",
    ),
    options: [
      option("A", "● ▲", "● ▲", "● ▲"),
      option("B", "▲ ●", "▲ ●", "▲ ●"),
      option("C", "● ●", "● ●", "● ●"),
      option("D", "▲ ▲", "▲ ▲", "▲ ▲"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 같은 모양을 잘 찾으셨어요.",
      "そうです。同じ形をよく見つけました。",
      "That's right. You found the matching shape.",
    ),
  }),
  voiceExercise(
    "D5_Q6",
    5,
    localized(
      "오늘 집에 온 사람과 함께 먹은 음식을 말씀해 주세요.",
      "今日、家に来た人と一緒に食べたものを話してください。",
      "Please tell us who came to your home and what you ate together today.",
    ),
    STORY_ACKNOWLEDGEMENT,
    25,
  ),
  moodExercise(
    "D6_Q1",
    6,
    localized(
      "어제 가족을 만나 반가웠다고 하셨어요. 오늘 기분은 어떠세요?",
      "昨日は家族に会えてうれしかったとおっしゃいました。今日の気分はいかがですか。",
      "Yesterday you said you were glad to see your family. How do you feel today?",
    ),
    MOOD_ACKNOWLEDGEMENT,
  ),
  choiceExercise({
    id: "D6_Q2",
    day: 6,
    prompt: localized("어제는 무슨 요일이었나요?", "昨日は何曜日でしたか。", "What day of the week was yesterday?"),
    options: [
      option("A", "목요일", "木曜日", "Thursday"),
      option("B", "금요일", "金曜日", "Friday"),
      option("C", "토요일", "土曜日", "Saturday"),
      option("D", "일요일", "日曜日", "Sunday"),
    ],
    correctAnswer: "B",
    explanation: localized(
      "맞아요. 어제는 금요일이었어요.",
      "そうです。昨日は金曜日でした。",
      "That's right. Yesterday was Friday.",
    ),
  }),
  choiceExercise({
    id: "D6_Q3",
    day: 6,
    prompt: localized(
      "어제 함께 김치전을 먹은 사람은 누구였나요?",
      "昨日、一緒にキムチチヂミを食べた人は誰ですか。",
      "Who ate kimchi pancakes with you yesterday?",
    ),
    options: [
      option("A", "딸 민지와 손자 준호", "娘のミンジと孫のジュノ", "Daughter Min-ji and grandson Jun-ho"),
      option("B", "친구 순자와 이웃 정희", "友人のスンジャと隣人のジョンヒ", "Friend Soon-ja and neighbor Jeong-hee"),
      option("C", "보건소 직원", "保健所の職員", "A public health center worker"),
      option("D", "혼자", "一人", "No one; I ate alone"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 민지 씨와 준호가 함께 왔어요.",
      "そうです。ミンジさんとジュノさんが一緒に来ました。",
      "That's right. Min-ji and Jun-ho came together.",
    ),
  }),
  choiceExercise({
    id: "D6_Q4",
    day: 6,
    type: "attention_pattern",
    difficulty: 2,
    prompt: localized(
      "버스가 20분 간격으로 옵니다. 이전 버스가 오전 10시 10분에 출발했다면 다음 버스는 몇 시에 올까요?",
      "バスは20分間隔で来ます。前のバスが午前10時10分に出発したなら、次は何時に来ますか。",
      "The bus comes every 20 minutes. If the previous bus left at 10:10 a.m., when will the next one arrive?",
    ),
    options: [
      option("A", "오전 10시 20분", "午前10時20分", "10:20 a.m."),
      option("B", "오전 10시 30분", "午前10時30分", "10:30 a.m."),
      option("C", "오전 10시 40분", "午前10時40分", "10:40 a.m."),
      option("D", "오전 11시 10분", "午前11時10分", "11:10 a.m."),
    ],
    correctAnswer: "B",
    explanation: localized(
      "맞아요. 20분 뒤인 오전 10시 30분이에요.",
      "そうです。20分後の午前10時30分です。",
      "That's right. Twenty minutes later is 10:30 a.m.",
    ),
  }),
  choiceExercise({
    id: "D6_Q5",
    day: 6,
    prompt: localized(
      "영자 어르신의 딸 이름은 무엇인가요?",
      "ヨンジャさんの娘の名前は何ですか。",
      "What is Ms. Park's daughter's name?",
    ),
    options: [
      option("A", "김민지", "キム・ミンジ", "Kim Min-ji"),
      option("B", "이순자", "イ・スンジャ", "Lee Soon-ja"),
      option("C", "최정희", "チェ・ジョンヒ", "Choi Jeong-hee"),
      option("D", "김미영", "キム・ミヨン", "Kim Mi-young"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 딸 이름은 민지예요.",
      "そうです。娘の名前はミンジです。",
      "That's right. Her daughter's name is Min-ji.",
    ),
  }),
  voiceExercise(
    "D6_Q6",
    6,
    localized(
      "오늘 다녀온 곳과 돌아오는 길에 산 것을 말씀해 주세요.",
      "今日行った場所と、帰り道に買ったものを話してください。",
      "Please tell us where you went today and what you bought on the way home.",
    ),
    STORY_ACKNOWLEDGEMENT,
    25,
  ),
  moodExercise(
    "D7_Q1",
    7,
    localized(
      "어제 오후에는 집에서 쉬었다고 하셨어요. 오늘 기분은 어떠세요?",
      "昨日の午後は家で休んだとおっしゃいました。今日の気分はいかがですか。",
      "You said you rested at home yesterday afternoon. How do you feel today?",
    ),
    MOOD_ACKNOWLEDGEMENT,
  ),
  choiceExercise({
    id: "D7_Q2",
    day: 7,
    prompt: localized(
      "오늘은 일요일입니다. 모레는 무슨 요일인가요?",
      "今日は日曜日です。あさっては何曜日ですか。",
      "Today is Sunday. What day of the week is the day after tomorrow?",
    ),
    options: [
      option("A", "월요일", "月曜日", "Monday"),
      option("B", "화요일", "火曜日", "Tuesday"),
      option("C", "수요일", "水曜日", "Wednesday"),
      option("D", "목요일", "木曜日", "Thursday"),
    ],
    correctAnswer: "B",
    explanation: localized(
      "맞아요. 모레는 화요일이에요.",
      "そうです。あさっては火曜日です。",
      "That's right. The day after tomorrow is Tuesday.",
    ),
  }),
  choiceExercise({
    id: "D7_Q3",
    day: 7,
    prompt: localized(
      "어제 빵집에서 산 것은 무엇인가요?",
      "昨日、パン屋で買ったものは何ですか。",
      "What did you buy at the bakery yesterday?",
    ),
    options: [
      option("A", "단팥빵 2개", "あんパン2個", "Two red-bean buns"),
      option("B", "식빵 1개", "食パン1斤", "One loaf of bread"),
      option("C", "소보로빵 3개", "そぼろパン3個", "Three streusel buns"),
      option("D", "케이크 1개", "ケーキ1個", "One cake"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 단팥빵 두 개를 샀다고 하셨어요.",
      "そうです。あんパンを二つ買ったとおっしゃいました。",
      "That's right. You said you bought two red-bean buns.",
    ),
  }),
  choiceExercise({
    id: "D7_Q4",
    day: 7,
    prompt: localized(
      "이번 주에 딸 민지와 손자 준호가 집에 왔을 때 함께 먹은 음식은 무엇인가요?",
      "今週、娘のミンジさんと孫のジュノさんが家に来たとき、一緒に食べたものは何ですか。",
      "What did you eat together when your daughter Min-ji and grandson Jun-ho visited this week?",
    ),
    options: [
      option("A", "김치전", "キムチチヂミ", "Kimchi pancakes"),
      option("B", "잔치국수", "韓国式にゅうめん", "Banquet noodles"),
      option("C", "된장찌개", "テンジャンチゲ", "Soybean paste stew"),
      option("D", "단팥빵", "あんパン", "Red-bean buns"),
    ],
    correctAnswer: "A",
    explanation: localized(
      "맞아요. 함께 김치전을 드셨어요.",
      "そうです。一緒にキムチチヂミを食べました。",
      "That's right. You ate kimchi pancakes together.",
    ),
  }),
  choiceExercise({
    id: "D7_Q5",
    day: 7,
    type: "attention_pattern",
    difficulty: 2,
    prompt: localized(
      "어제 산 단팥빵 2개 중 오늘 1개를 먹으면 몇 개가 남을까요?",
      "昨日買ったあんパン2個のうち、今日1個食べると何個残りますか。",
      "If you eat one of the two red-bean buns you bought yesterday, how many remain?",
    ),
    options: [
      option("A", "0개", "0個", "0"),
      option("B", "1개", "1個", "1"),
      option("C", "2개", "2個", "2"),
      option("D", "3개", "3個", "3"),
    ],
    correctAnswer: "B",
    explanation: localized(
      "맞아요. 한 개가 남아요.",
      "そうです。一つ残ります。",
      "That's right. One remains.",
    ),
  }),
  voiceExercise(
    "D7_Q6",
    7,
    localized(
      "오늘 한 일과 이번 주에 가장 기억에 남는 일을 함께 말씀해 주세요.",
      "今日したことと、今週いちばん心に残ったことを一緒に話してください。",
      "Please tell us what you did today and what you remember most from this week.",
    ),
    STORY_ACKNOWLEDGEMENT,
    30,
  ),
];

type RecordedResponseWithoutFeedback = Omit<
  HaruWeekQuestionMeta["recordedResponse"],
  "feedback"
>;

const PERSONALIZATION_SOURCE_NOTES: Partial<Record<string, LocalizedText>> = {
  D1_Q3: localized(
    "초기 등록된 장기 개인 정보",
    "初回登録された長期プロフィール情報",
    "Long-term profile information provided at registration",
  ),
  D2_Q1: localized("1일차 감정 응답", "1日目の気分の回答", "Day 1 mood response"),
  D2_Q3: localized(
    "1일차 음성 답변: 유성시장에서 애호박과 대파 구매",
    "1日目の音声回答：儒城市場で韓国かぼちゃと長ねぎを購入",
    "Day 1 voice response: bought zucchini and green onions at Yuseong Market",
  ),
  D3_Q1: localized("2일차 감정 응답", "2日目の気分の回答", "Day 2 mood response"),
  D3_Q3: localized(
    "2일차 음성 답변: 복지관에서 친구 이순자와 윷놀이",
    "2日目の音声回答：福祉館で友人のイ・スンジャさんとユンノリ",
    "Day 2 voice response: played yut with friend Lee Soon-ja at the community center",
  ),
  D3_Q4: localized(
    "초기 등록 정보: 복약 시간 오전 8시",
    "初回登録情報：服薬時刻は午前8時",
    "Registration information: medication time at 8:00 a.m.",
  ),
  D3_Q5: localized(
    "초기 등록된 장기 개인 정보",
    "初回登録された長期プロフィール情報",
    "Long-term profile information provided at registration",
  ),
  D4_Q1: localized(
    "3일차 음성 답변의 신체·감정 정보",
    "3日目の音声回答に含まれる体調・気分情報",
    "Body and mood information from the Day 3 voice response",
  ),
  D4_Q3: localized(
    "3일차 음성 답변: 유성구 보건소에서 혈압 측정",
    "3日目の音声回答：儒城区保健所で血圧を測定",
    "Day 3 voice response: blood pressure measured at the Yuseong health center",
  ),
  D5_Q1: localized(
    "4일차 음성 답변의 신체 상태",
    "4日目の音声回答に含まれる体調情報",
    "Body condition from the Day 4 voice response",
  ),
  D5_Q3: localized(
    "4일차 음성 답변: 산책 후 보리차를 마심",
    "4日目の音声回答：散歩のあと麦茶を飲んだ",
    "Day 4 voice response: drank barley tea after a walk",
  ),
  D6_Q1: localized(
    "5일차 음성 답변의 감정 정보",
    "5日目の音声回答に含まれる気分情報",
    "Mood information from the Day 5 voice response",
  ),
  D6_Q3: localized(
    "5일차 음성 답변: 딸 김민지와 손자 김준호가 방문",
    "5日目の音声回答：娘のキム・ミンジさんと孫のキム・ジュノさんが訪問",
    "Day 5 voice response: daughter Kim Min-ji and grandson Kim Jun-ho visited",
  ),
  D6_Q5: localized(
    "초기 등록 정보 및 1·5일차 음성 답변",
    "初回登録情報と1・5日目の音声回答",
    "Registration information and Day 1 and Day 5 voice responses",
  ),
  D7_Q1: localized(
    "6일차 음성 답변의 활동 정보",
    "6日目の音声回答に含まれる活動情報",
    "Activity information from the Day 6 voice response",
  ),
  D7_Q3: localized(
    "6일차 음성 답변: 빵집에서 단팥빵 2개 구매",
    "6日目の音声回答：パン屋であんパンを2個購入",
    "Day 6 voice response: bought two red-bean buns at a bakery",
  ),
  D7_Q4: localized(
    "5일차 음성 답변을 2일 뒤 재활용",
    "5日目の音声回答を2日後に再利用",
    "Day 5 voice response reused two days later",
  ),
  D7_Q5: localized(
    "6일차 음성 답변의 물품과 수량을 계산 문항으로 변환",
    "6日目の音声回答にある品物と数量を計算問題に変換",
    "Item and quantity from the Day 6 voice response converted into a calculation question",
  ),
};

const RECORDED_RESPONSE_DATA: Record<string, RecordedResponseWithoutFeedback> = {
  D1_Q1: { selectedOptionId: "B", isCorrect: null, responseTimeMs: 6000 },
  D1_Q2: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 7000 },
  D1_Q3: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 5000 },
  D1_Q4: { selectedOptionId: "C", isCorrect: true, responseTimeMs: 6000 },
  D1_Q5: {
    isCorrect: null,
    responseTimeMs: 16300,
    voiceDurationSeconds: 13.3,
    sttStatus: "completed",
    sttConfidence: 0.91,
  },
  D1_Q6: { submittedSequence: ["A", "B", "C"], isCorrect: true, responseTimeMs: 8200 },
  D2_Q1: { selectedOptionId: "A", isCorrect: null, responseTimeMs: 6000 },
  D2_Q2: { selectedOptionId: "B", isCorrect: true, responseTimeMs: 7000 },
  D2_Q3: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 5000 },
  D2_Q4: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 6000 },
  D2_Q5: { selectedOptionId: "C", isCorrect: true, responseTimeMs: 7000 },
  D2_Q6: {
    isCorrect: null,
    responseTimeMs: 15700,
    voiceDurationSeconds: 12.7,
    sttStatus: "completed",
    sttConfidence: 0.91,
  },
  D3_Q1: { selectedOptionId: "B", isCorrect: null, responseTimeMs: 6000 },
  D3_Q2: { selectedOptionId: "B", isCorrect: true, responseTimeMs: 7000 },
  D3_Q3: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 5000 },
  D3_Q4: { selectedOptionId: "B", isCorrect: true, responseTimeMs: 6000 },
  D3_Q5: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 7000 },
  D3_Q6: {
    isCorrect: null,
    responseTimeMs: 17200,
    voiceDurationSeconds: 14.2,
    sttStatus: "completed",
    sttConfidence: 0.91,
  },
  D4_Q1: { selectedOptionId: "B", isCorrect: null, responseTimeMs: 6000 },
  D4_Q2: { selectedOptionId: "B", isCorrect: true, responseTimeMs: 7000 },
  D4_Q3: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 5000 },
  D4_Q4: { selectedOptionId: "C", isCorrect: true, responseTimeMs: 6000 },
  D4_Q5: {
    isCorrect: null,
    responseTimeMs: 17200,
    voiceDurationSeconds: 14.2,
    sttStatus: "completed",
    sttConfidence: 0.91,
  },
  D4_Q6: { submittedSequence: ["A", "B", "D"], isCorrect: false, responseTimeMs: 8200 },
  D5_Q1: { selectedOptionId: "A", isCorrect: null, responseTimeMs: 6000 },
  D5_Q2: { selectedOptionId: "B", isCorrect: true, responseTimeMs: 7000 },
  D5_Q3: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 5000 },
  D5_Q4: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 6000 },
  D5_Q5: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 7000 },
  D5_Q6: {
    isCorrect: null,
    responseTimeMs: 15100,
    voiceDurationSeconds: 12.1,
    sttStatus: "completed",
    sttConfidence: 0.91,
  },
  D6_Q1: { selectedOptionId: "B", isCorrect: null, responseTimeMs: 6000 },
  D6_Q2: { selectedOptionId: "B", isCorrect: true, responseTimeMs: 7000 },
  D6_Q3: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 5000 },
  D6_Q4: { selectedOptionId: "B", isCorrect: true, responseTimeMs: 6000 },
  D6_Q5: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 7000 },
  D6_Q6: {
    isCorrect: null,
    responseTimeMs: 16300,
    voiceDurationSeconds: 13.3,
    sttStatus: "completed",
    sttConfidence: 0.91,
  },
  D7_Q1: { selectedOptionId: "A", isCorrect: null, responseTimeMs: 6000 },
  D7_Q2: { selectedOptionId: "B", isCorrect: true, responseTimeMs: 7000 },
  D7_Q3: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 5000 },
  D7_Q4: { selectedOptionId: "A", isCorrect: true, responseTimeMs: 6000 },
  D7_Q5: { selectedOptionId: "B", isCorrect: true, responseTimeMs: 7000 },
  D7_Q6: {
    isCorrect: null,
    responseTimeMs: 20700,
    voiceDurationSeconds: 17.7,
    sttStatus: "completed",
    sttConfidence: 0.91,
  },
};

const RECORDED_FEEDBACK_OVERRIDES: Partial<Record<string, LocalizedText>> = {
  D1_Q5: localized(
    "시장에 다녀오셨군요. 말씀해 주셔서 고마워요.",
    "市場に行ってこられたのですね。話してくださってありがとうございます。",
    "You went to the market. Thank you for telling us.",
  ),
  D2_Q1: localized(
    "오늘은 기분이 매우 좋으시군요.",
    "今日はとても気分が良いのですね。",
    "You are feeling very good today.",
  ),
  D2_Q6: localized(
    "순자 씨와 즐거운 시간을 보내셨군요.",
    "スンジャさんと楽しい時間を過ごされたのですね。",
    "You had an enjoyable time with Soon-ja.",
  ),
  D3_Q1: localized(
    "오늘도 기분이 좋으시군요.",
    "今日も気分が良いのですね。",
    "You are feeling good again today.",
  ),
  D3_Q6: localized(
    "보건소에 다녀오셨군요. 오늘은 천천히 쉬세요.",
    "保健所に行ってこられたのですね。今日はゆっくり休んでください。",
    "You visited the health center. Take it easy today.",
  ),
  D4_Q1: localized(
    "오늘은 기분이 좋으시군요.",
    "今日は気分が良いのですね。",
    "You are feeling good today.",
  ),
  D4_Q5: localized(
    "산책하고 정희 씨도 만나셨군요.",
    "散歩をして、ジョンヒさんにも会ったのですね。",
    "You took a walk and met Jeong-hee too.",
  ),
  D4_Q6: localized(
    "괜찮아요. 오늘 활동을 끝까지 잘 해주셨어요.",
    "大丈夫です。今日の活動を最後までよく続けました。",
    "That's okay. You stayed with today's activities to the end.",
  ),
  D5_Q1: localized(
    "오늘은 기분이 매우 좋으시군요.",
    "今日はとても気分が良いのですね。",
    "You are feeling very good today.",
  ),
  D5_Q6: localized(
    "민지 씨와 준호가 와서 즐거우셨겠어요.",
    "ミンジさんとジュノさんが来て、楽しかったでしょうね。",
    "It must have been lovely to have Min-ji and Jun-ho visit.",
  ),
  D6_Q1: localized(
    "오늘도 기분이 좋으시군요.",
    "今日も気分が良いのですね。",
    "You are feeling good again today.",
  ),
  D6_Q6: localized(
    "도서관에 다녀오고 단팥빵도 사셨군요.",
    "図書館に行き、あんパンも買ったのですね。",
    "You went to the library and bought red-bean buns too.",
  ),
  D7_Q1: localized(
    "오늘은 기분이 매우 좋으시군요.",
    "今日はとても気分が良いのですね。",
    "You are feeling very good today.",
  ),
  D7_Q6: localized(
    "가족과 함께한 시간이 가장 기억에 남으셨군요.",
    "ご家族と過ごした時間がいちばん心に残ったのですね。",
    "The time with family stayed with you most.",
  ),
};

const exerciseById = new Map(
  haru7DayExercises.map((exercise) => [exercise.id, exercise] as const),
);

export const HARU_WEEK_QUESTION_META: readonly HaruWeekQuestionMeta[] =
  HARU_WEEK_QUESTION_BASE.map((question) => {
    const exercise = exerciseById.get(question.exerciseId);
    const recordedResponse = RECORDED_RESPONSE_DATA[question.exerciseId];

    if (!exercise || !recordedResponse) {
      throw new Error(`Incomplete Haru scenario data for ${question.exerciseId}`);
    }

    return {
      ...question,
      personalizationSourceNote: PERSONALIZATION_SOURCE_NOTES[question.exerciseId],
      recordedResponse: {
        ...recordedResponse,
        feedback:
          RECORDED_FEEDBACK_OVERRIDES[question.exerciseId] ??
          exercise.explanation ??
          localized(
            "응답해 주셔서 고마워요.",
            "答えてくださってありがとうございます。",
            "Thank you for your response.",
          ),
      },
    };
  });
