import type { RoutineResult } from "../cognitive/cognitiveRoutineStorage";
import type { MemoryCard, MemoryTopic } from "../memory/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(now: Date, days: number, hour = 9): string {
  const date = new Date(now.getTime() - days * DAY_MS);
  date.setHours(hour, 20, 0, 0);
  return date.toISOString();
}

const demoMemories: Array<{
  topic: MemoryTopic;
  summary: string;
  people: string[];
  place: string;
  emotion: string;
  daysAgo: number;
  reviewDueInDays: number;
}> = [
  {
    topic: "family",
    summary: "일요일 점심에 딸과 된장찌개를 끓이며 예전 시장 이야기를 나눔",
    people: ["딸 지연"],
    place: "집 부엌",
    emotion: "따뜻함",
    daysAgo: 2,
    reviewDueInDays: -1,
  },
  {
    topic: "daily_life",
    summary: "아침 산책길에서 매화가 핀 것을 보고 봄 운동회가 떠올랐다고 말함",
    people: ["동네 친구"],
    place: "아파트 산책로",
    emotion: "상쾌함",
    daysAgo: 5,
    reviewDueInDays: 1,
  },
  {
    topic: "food",
    summary: "어머니가 해주시던 김치전 냄새와 비 오는 날의 마루 풍경을 회상함",
    people: ["어머니"],
    place: "옛집 마루",
    emotion: "그리움",
    daysAgo: 8,
    reviewDueInDays: -2,
  },
  {
    topic: "friends",
    summary: "고등학교 친구들과 버스를 타고 소풍 갔던 날을 또렷하게 설명함",
    people: ["순자 친구"],
    place: "남산 소풍길",
    emotion: "즐거움",
    daysAgo: 13,
    reviewDueInDays: 3,
  },
  {
    topic: "work",
    summary: "첫 월급으로 가족에게 귤 한 상자를 사 갔던 일을 이야기함",
    people: ["남편", "큰아들"],
    place: "예전 직장 앞 과일가게",
    emotion: "뿌듯함",
    daysAgo: 18,
    reviewDueInDays: -1,
  },
  {
    topic: "hobby",
    summary: "화분에 물을 주며 난초를 키우던 취미와 이웃에게 분갈이를 알려준 일을 회상함",
    people: ["이웃 아주머니"],
    place: "베란다",
    emotion: "차분함",
    daysAgo: 25,
    reviewDueInDays: 4,
  },
];

export function buildDemoMemoryCards(now = new Date()): MemoryCard[] {
  return demoMemories.map((memory, index) => ({
    id: `demo_memory_${index + 1}`,
    userId: "demo_haru_user",
    createdAt: daysAgo(now, memory.daysAgo, 10),
    updatedAt: daysAgo(now, Math.max(memory.daysAgo - 1, 0), 15),
    source: "voice_note",
    topic: memory.topic,
    peopleTags: memory.people,
    placeTag: memory.place,
    emotionTag: memory.emotion,
    textSummary: memory.summary,
    originalTranscript: memory.summary,
    storyCues: {
      people: memory.people,
      places: [memory.place],
      emotions: [memory.emotion],
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
          wordRecallCorrect: type === "delayed_word_recall" ? Math.max(1, 3 - (day % 3)) : undefined,
          attentionSteps: type === "attention_pattern" ? 4 + (i % 2) : undefined,
          drawingCompleted: type === "shape_copy_practice" ? completed : undefined,
        },
      });
    }
  }

  return results;
}
