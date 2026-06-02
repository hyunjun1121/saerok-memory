import type { RoutineResult } from "../cognitive/cognitiveRoutineStorage";
import type { CaregiverObservationRecord } from "./caregiverObservationStorage";
import type { MemoryCard, MemoryTopic } from "../memory/types";
import { normalizeLanguage, type SupportedLanguage } from "../../utils/localizedText";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(now: Date, days: number, hour = 9): string {
  const date = new Date(now.getTime() - days * DAY_MS);
  date.setHours(hour, 20, 0, 0);
  return date.toISOString();
}

type LocalizedValue = Record<SupportedLanguage, string>;
type LocalizedList = Record<SupportedLanguage, string[]>;

const demoMemories: Array<{
  topic: MemoryTopic;
  summary: LocalizedValue;
  people: LocalizedList;
  place: LocalizedValue;
  emotion: LocalizedValue;
  daysAgo: number;
  reviewDueInDays: number;
}> = [
  {
    topic: "family",
    summary: {
      ko: "일요일 점심에 딸과 된장찌개를 끓이며 예전 시장 이야기를 나눔",
      ja: "日曜日の昼に娘と味噌汁を作りながら、昔の市場の話をした",
      en: "Cooked soybean paste stew with my daughter on Sunday and talked about the old market",
    },
    people: {
      ko: ["딸 지연"],
      ja: ["娘のジヨン"],
      en: ["daughter Jiyeon"],
    },
    place: {
      ko: "집 부엌",
      ja: "家の台所",
      en: "home kitchen",
    },
    emotion: {
      ko: "따뜻함",
      ja: "あたたかさ",
      en: "warmth",
    },
    daysAgo: 2,
    reviewDueInDays: -1,
  },
  {
    topic: "daily_life",
    summary: {
      ko: "아침 산책길에서 매화가 핀 것을 보고 봄 운동회가 떠올랐다고 말함",
      ja: "朝の散歩道で梅の花を見て、春の運動会を思い出したと話した",
      en: "Saw plum blossoms during a morning walk and remembered a spring school sports day",
    },
    people: {
      ko: ["동네 친구"],
      ja: ["近所の友人"],
      en: ["neighborhood friend"],
    },
    place: {
      ko: "아파트 산책로",
      ja: "マンションの散歩道",
      en: "apartment walking path",
    },
    emotion: {
      ko: "상쾌함",
      ja: "すがすがしさ",
      en: "refreshment",
    },
    daysAgo: 5,
    reviewDueInDays: 1,
  },
  {
    topic: "food",
    summary: {
      ko: "어머니가 해주시던 김치전 냄새와 비 오는 날의 마루 풍경을 회상함",
      ja: "母が作ってくれたキムチチヂミの香りと雨の日の縁側を思い出した",
      en: "Remembered the smell of mother's kimchi pancakes and the porch on a rainy day",
    },
    people: {
      ko: ["어머니"],
      ja: ["母"],
      en: ["mother"],
    },
    place: {
      ko: "옛집 마루",
      ja: "昔の家の縁側",
      en: "old house porch",
    },
    emotion: {
      ko: "그리움",
      ja: "懐かしさ",
      en: "nostalgia",
    },
    daysAgo: 8,
    reviewDueInDays: -2,
  },
  {
    topic: "friends",
    summary: {
      ko: "고등학교 친구들과 버스를 타고 소풍 갔던 날을 또렷하게 설명함",
      ja: "高校の友人たちとバスで遠足に行った日をはっきり話した",
      en: "Clearly described a picnic day by bus with high school friends",
    },
    people: {
      ko: ["순자 친구"],
      ja: ["友人のスンジャ"],
      en: ["friend Sunja"],
    },
    place: {
      ko: "남산 소풍길",
      ja: "南山への遠足道",
      en: "Namsan picnic route",
    },
    emotion: {
      ko: "즐거움",
      ja: "楽しさ",
      en: "joy",
    },
    daysAgo: 13,
    reviewDueInDays: 3,
  },
  {
    topic: "work",
    summary: {
      ko: "첫 월급으로 가족에게 귤 한 상자를 사 갔던 일을 이야기함",
      ja: "初めての給料で家族にみかん一箱を買って帰った話をした",
      en: "Talked about buying a box of tangerines for the family with the first paycheck",
    },
    people: {
      ko: ["남편", "큰아들"],
      ja: ["夫", "長男"],
      en: ["husband", "older son"],
    },
    place: {
      ko: "예전 직장 앞 과일가게",
      ja: "昔の職場前の果物店",
      en: "fruit shop near the old workplace",
    },
    emotion: {
      ko: "뿌듯함",
      ja: "誇らしさ",
      en: "pride",
    },
    daysAgo: 18,
    reviewDueInDays: -1,
  },
  {
    topic: "hobby",
    summary: {
      ko: "화분에 물을 주며 난초를 키우던 취미와 이웃에게 분갈이를 알려준 일을 회상함",
      ja: "鉢に水をやりながら蘭を育てた趣味と、近所の人に植え替えを教えたことを思い出した",
      en: "Remembered growing orchids and teaching a neighbor how to repot plants",
    },
    people: {
      ko: ["이웃 아주머니"],
      ja: ["近所の女性"],
      en: ["neighbor"],
    },
    place: {
      ko: "베란다",
      ja: "ベランダ",
      en: "veranda",
    },
    emotion: {
      ko: "차분함",
      ja: "落ち着き",
      en: "calm",
    },
    daysAgo: 25,
    reviewDueInDays: 4,
  },
];

export function buildDemoMemoryCards(language?: string, now = new Date()): MemoryCard[] {
  const locale = normalizeLanguage(language);

  return demoMemories.map((memory, index) => ({
    id: `demo_memory_${index + 1}`,
    userId: "demo_haru_user",
    createdAt: daysAgo(now, memory.daysAgo, 10),
    updatedAt: daysAgo(now, Math.max(memory.daysAgo - 1, 0), 15),
    source: "voice_note",
    topic: memory.topic,
    peopleTags: memory.people[locale],
    placeTag: memory.place[locale],
    emotionTag: memory.emotion[locale],
    textSummary: memory.summary[locale],
    originalTranscript: memory.summary[locale],
    storyCues: {
      people: memory.people[locale],
      places: [memory.place[locale]],
      emotions: [memory.emotion[locale]],
    },
    sensitivity: "personal",
    shareWithFamily: true,
    reviewState: {
      dueAt: daysAgo(now, -memory.reviewDueInDays, 9),
      intervalDays: Math.max(2, 5 + index),
      ease: 2.4 + index * 0.1,
      lastResult: index % 3 === 0 ? "hint_used" : "remembered",
      reviewCount: 2 + index,
    },
  }));
}

export function buildDemoRoutineResults(now = new Date()): RoutineResult[] {
  const results: RoutineResult[] = [];
  const routineTypes: RoutineResult["type"][] = [
    "delayed_word_recall",
    "attention_pattern",
    "digit_span_practice",
    "verbal_fluency_practice",
    "trail_switching_practice",
    "stroop_touch_practice",
    "orientation_practice",
    "shape_copy_practice",
    "speech_repeat_practice",
  ];

  for (let day = 27; day >= 0; day -= 1) {
    const routinesToday = day % 6 === 0 ? 2 : day % 4 === 0 ? 3 : 4;

    for (let i = 0; i < routinesToday; i += 1) {
      const type = routineTypes[(day + i) % routineTypes.length];
      const completed = !(day % 9 === 0 && i === routinesToday - 1);
      results.push({
        id: `demo_routine_${day}_${i}`,
        type,
        timestamp: daysAgo(now, day, 9 + i),
        completed,
        metadata: {
          demo: true,
          wordRecallCorrect: type === "delayed_word_recall" ? Math.max(2, 5 - (day % 4)) : undefined,
          attentionSteps: type === "attention_pattern" ? 4 + (i % 2) : undefined,
          digitSpanLength: type === "digit_span_practice" ? 3 + (i % 2) : undefined,
          verbalFluencyUniqueCount: type === "verbal_fluency_practice" ? 8 + (day % 5) : undefined,
          trailSwitchingErrors: type === "trail_switching_practice" ? day % 3 : undefined,
          correctCount: type === "stroop_touch_practice" ? 2 + (day % 2) : undefined,
          errorCount: type === "stroop_touch_practice" ? day % 2 : undefined,
          averageResponseMs: type === "stroop_touch_practice" ? 1300 + day * 25 : undefined,
          orientationMatched: type === "orientation_practice" ? day % 5 !== 0 : undefined,
          drawingCompleted: type === "shape_copy_practice" ? completed : undefined,
          drawingStrokeCount: type === "shape_copy_practice" ? 2 + (day % 4) : undefined,
          drawingDurationMs: type === "shape_copy_practice" ? 18000 + day * 320 : undefined,
          drawingClearCount: type === "shape_copy_practice" ? day % 2 : undefined,
        },
      });
    }
  }

  return results;
}

export function buildDemoCaregiverObservationRecords(
  language?: string,
  now = new Date(),
): CaregiverObservationRecord[] {
  const locale = normalizeLanguage(language);
  const recentNote: LocalizedValue = {
    ko: "약속 시간은 한 번 더 확인하면 안정적으로 따라오고, 최근 산책과 식사 이야기는 구체적으로 잘 이어집니다.",
    ja: "約束の時間はもう一度確認すると落ち着いて進められ、最近の散歩や食事の話は具体的に続けられています。",
    en: "Appointment times go more smoothly with one extra reminder, and recent walking and meal stories remain specific.",
  };
  const previousNote: LocalizedValue = {
    ko: "모임 전에는 망설였지만, 다녀온 뒤에는 친구 이야기를 편안하게 나누었습니다.",
    ja: "集まりの前は迷っていましたが、帰宅後は友人の話を穏やかに共有しました。",
    en: "They hesitated before the gathering, but afterward talked comfortably about friends.",
  };

  return [
    {
      id: "demo_observation_recent",
      createdAt: daysAgo(now, 2, 19),
      selectedDomains: ["appointments", "conversation", "sleepAppetite"],
      domainResponses: {
        appointments: "occasionallyDifferent",
        conversation: "occasionallyDifferent",
        sleepAppetite: "notSure",
        dailyRoutine: "aboutSame",
      },
      note: recentNote[locale],
    },
    {
      id: "demo_observation_previous",
      createdAt: daysAgo(now, 11, 18),
      selectedDomains: ["moodSocial", "homeSafety"],
      domainResponses: {
        moodSocial: "notSure",
        homeSafety: "aboutSame",
      },
      note: previousNote[locale],
    },
  ];
}
