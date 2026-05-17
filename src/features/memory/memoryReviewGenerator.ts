import type { MemoryCard } from "./types";
import type { Exercise } from "../../data/mockExercises";
import i18n from "../../i18n";
import { extractMemoryStoryCues, summarizeMemoryStory } from "./memoryStory";

const ALL_TOPICS = ["가족", "건강", "여행", "일", "음식", "취미", "친구", "일상"];
const ALL_EMOTIONS = ["뿌듯함", "마음이 놓임", "감사함", "힘들었음", "슬픔", "기쁨", "놀라움", "아쉬움"];
const ALL_PEOPLE = ["가족", "배우자", "자녀", "친구", "동료", "혼자"];
const ALL_PLACES = ["집", "회사", "공원", "식당", "여행지", "고향"];
const ALL_OBJECTS = ["우산", "사진", "편지", "꽃", "약", "지갑", "가방", "버스", "기차", "비행기", "자동차", "국밥", "커피"];
const ALL_TIMES = ["오늘", "어제", "지난주", "지난달", "작년", "봄", "여름", "가을", "겨울", "명절", "생일"];
const STORY_DISTRACTORS = ["가족과 식사한 이야기", "공원에서 산책한 이야기", "병원에 다녀온 이야기", "친구와 통화한 이야기"];

function getRandomDistractors(sourceArray: string[], correctAnswer: string, count: number): string[] {
  const distractors = sourceArray.filter(item => item !== correctAnswer);
  for (let i = distractors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
  }
  return distractors.slice(0, count);
}

function shuffleOptions(options: {id: string, label: string}[]) {
  const result = [...options];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildStoryCueReview(
  card: MemoryCard,
  lessonId: string,
  exerciseId: string,
  choiceCount: number
): Exercise | null {
  if (!card.originalTranscript && !card.textSummary) return null;

  const summary = card.textSummary ?? summarizeMemoryStory(card.originalTranscript ?? "");
  const cues = card.storyCues ?? extractMemoryStoryCues(card.originalTranscript ?? "");

  const candidates = [
    {
      value: cues.people?.[0],
      field: "people",
      prompt: i18n.t("exercise.memory.review.story.people", "지난번 이야기에서 함께 있었던 사람은 누구였나요?"),
      distractors: ALL_PEOPLE,
    },
    {
      value: cues.places?.[0],
      field: "place",
      prompt: i18n.t("exercise.memory.review.story.place", "지난번 이야기에서 장소로 나온 곳은 어디였나요?"),
      distractors: ALL_PLACES,
    },
    {
      value: cues.objects?.[0],
      field: "object",
      prompt: i18n.t("exercise.memory.review.story.object", "지난번 이야기에서 기억 단서로 나온 물건은 무엇이었나요?"),
      distractors: ALL_OBJECTS,
    },
    {
      value: cues.emotions?.[0],
      field: "emotion",
      prompt: i18n.t("exercise.memory.review.story.emotion", "지난번 이야기에서 가까운 감정은 무엇이었나요?"),
      distractors: ALL_EMOTIONS,
    },
    {
      value: cues.timeHints?.[0],
      field: "time",
      prompt: i18n.t("exercise.memory.review.story.time", "지난번 이야기에서 시간 단서로 나온 것은 무엇이었나요?"),
      distractors: ALL_TIMES,
    },
  ];

  const selectedCue = candidates.find((candidate) => !!candidate.value);

  if (!selectedCue) {
    const options = [
      { id: "correct", label: summary },
      ...getRandomDistractors(STORY_DISTRACTORS, summary, choiceCount - 1).map((dist, idx) => ({
        id: `dist_${idx}`,
        label: dist,
      })),
    ];

    return {
      id: exerciseId,
      lessonId,
      type: "personal_memory_recall",
      prompt: i18n.t("exercise.memory.review.story.summary", "지난번에 말씀하신 기억에 가까운 이야기는 무엇인가요?"),
      payload: { memoryId: card.id, memoryField: "story", options: shuffleOptions(options) },
      correctAnswer: "correct",
      explanation: i18n.t("exercise.memory.review.storyExplanation", { summary, defaultValue: `지난번 이야기는 “${summary}”였어요.` }),
      difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
    };
  }

  const correctLabel = selectedCue.value!;
  const options = [
    { id: "correct", label: correctLabel },
    ...getRandomDistractors(selectedCue.distractors, correctLabel, choiceCount - 1).map((dist, idx) => ({
      id: `dist_${idx}`,
      label: dist,
    })),
  ];

  return {
    id: exerciseId,
    lessonId,
    type: "personal_memory_recall",
    prompt: selectedCue.prompt,
    payload: { memoryId: card.id, memoryField: "story", options: shuffleOptions(options) },
    correctAnswer: "correct",
    explanation: i18n.t("exercise.memory.review.storyExplanation", { summary, defaultValue: `지난번 이야기는 “${summary}”였어요.` }),
    difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
  };
}

export function generateMemoryReviewExercise(card: MemoryCard, lessonId: string): Exercise | null {
  let choiceCount = 2;
  if (card.reviewState.reviewCount > 1) choiceCount = 3;
  if (card.reviewState.reviewCount > 2) choiceCount = 4;

  const exerciseId = `mem_review_${card.id}_${Date.now()}`;

  const storyExercise = buildStoryCueReview(card, lessonId, exerciseId, choiceCount);
  if (storyExercise) return storyExercise;

  const storedTopic = card.topic as string | undefined;
  const legacyEmotionTag = storedTopic && ALL_EMOTIONS.includes(storedTopic) ? storedTopic : undefined;

  if (storedTopic && storedTopic !== "unknown" && !legacyEmotionTag) {
    const topicMap: Record<string, string> = {
      "family": "가족", "health": "건강", "travel": "여행",
      "work": "일", "food": "음식", "hobby": "취미",
      "friends": "친구", "daily_life": "일상"
    };

    const correctLabel = topicMap[storedTopic] || storedTopic;
    const distractors = getRandomDistractors(ALL_TOPICS, correctLabel, choiceCount - 1);

    const options = [
      { id: "correct", label: correctLabel },
      ...distractors.map((dist, idx) => ({ id: `dist_${idx}`, label: dist }))
    ];

    return {
      id: exerciseId,
      lessonId,
      type: "personal_memory_recall",
      prompt: i18n.t("exercise.memory.review.topic", "지난번, 어떤 주제와 관련된 이야기를 고르셨을까요?"),
      payload: { memoryId: card.id, memoryField: "topic", options: shuffleOptions(options) },
      correctAnswer: "correct",
      explanation: i18n.t("exercise.memory.review.topicExplanation", { topic: correctLabel, defaultValue: `맞아요. ${correctLabel}에 대한 이야기를 선택하셨어요.` }),
      difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
    };
  }

  const emotionTag = card.emotionTag ?? legacyEmotionTag;

  if (emotionTag) {
    const distractors = getRandomDistractors(ALL_EMOTIONS, emotionTag, choiceCount - 1);
    const options = [
      { id: "correct", label: emotionTag },
      ...distractors.map((dist, idx) => ({ id: `dist_${idx}`, label: dist }))
    ];

    return {
      id: exerciseId,
      lessonId,
      type: "personal_memory_recall",
      prompt: i18n.t("exercise.memory.review.emotion", "그때 어떤 기분이 들었다고 하셨는지 기억나시나요?"),
      payload: { memoryId: card.id, memoryField: "emotionTag", options: shuffleOptions(options) },
      correctAnswer: "correct",
      explanation: i18n.t("exercise.memory.review.emotionExplanation", { emotion: emotionTag, defaultValue: `네, 그때 ${emotionTag}을(를) 느끼셨다고 했어요.` }),
      difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
    };
  }

  if (card.peopleTags && card.peopleTags.length > 0) {
    const person = card.peopleTags[0];
    const distractors = getRandomDistractors(ALL_PEOPLE, person, choiceCount - 1);
    const options = [
      { id: "correct", label: person },
      ...distractors.map((dist, idx) => ({ id: `dist_${idx}`, label: dist }))
    ];

    return {
      id: exerciseId,
      lessonId,
      type: "personal_memory_recall",
      prompt: i18n.t("exercise.memory.review.people", "지난번에 저장하신 기억에서, 누구와 함께 있었는지 기억나시나요?"),
      payload: { memoryId: card.id, memoryField: "peopleTags", options: shuffleOptions(options) },
      correctAnswer: "correct",
      explanation: i18n.t("exercise.memory.review.peopleExplanation", { person, defaultValue: `네, ${person}와(과) 함께 있었어요.` }),
      difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
    };
  }

  if (card.placeTag) {
    const distractors = getRandomDistractors(ALL_PLACES, card.placeTag, choiceCount - 1);
    const options = [
      { id: "correct", label: card.placeTag },
      ...distractors.map((dist, idx) => ({ id: `dist_${idx}`, label: dist }))
    ];

    return {
      id: exerciseId,
      lessonId,
      type: "personal_memory_recall",
      prompt: i18n.t("exercise.memory.review.place", "그 기억이 있던 장소가 어디였는지 기억나시나요?"),
      payload: { memoryId: card.id, memoryField: "placeTag", options: shuffleOptions(options) },
      correctAnswer: "correct",
      explanation: i18n.t("exercise.memory.review.placeExplanation", { place: card.placeTag, defaultValue: `네, 장소는 ${card.placeTag}이었어요.` }),
      difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
    };
  }

  return null;
}
