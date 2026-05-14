import { MemoryCard } from "./types";
import { Exercise } from "../../data/mockExercises";

const ALL_TOPICS = ["가족", "건강", "여행", "일", "음식", "취미", "친구", "일상"];
const ALL_EMOTIONS = ["뿌듯함", "마음이 놓임", "감사함", "힘들었음", "슬픔", "기쁨", "놀라움", "아쉬움"];

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

export function generateMemoryReviewExercise(card: MemoryCard, lessonId: string): Exercise | null {
  let choiceCount = 2;
  if (card.reviewState.reviewCount > 1) choiceCount = 3;
  if (card.reviewState.reviewCount > 2) choiceCount = 4;

  const exerciseId = `mem_review_${card.id}_${Date.now()}`;

  if (card.topic && card.topic !== "unknown") {
    const topicMap: Record<string, string> = {
      "family": "가족", "health": "건강", "travel": "여행",
      "work": "일", "food": "음식", "hobby": "취미",
      "friends": "친구", "daily_life": "일상"
    };

    const correctLabel = topicMap[card.topic] || card.topic;
    const distractors = getRandomDistractors(ALL_TOPICS, correctLabel, choiceCount - 1);

    const options = [
      { id: "correct", label: correctLabel },
      ...distractors.map((dist, idx) => ({ id: `dist_${idx}`, label: dist }))
    ];

    return {
      id: exerciseId,
      lessonId,
      type: "personal_memory_recall",
      prompt: "지난번, 어떤 주제와 관련된 이야기를 고르셨을까요?",
      payload: { memoryId: card.id, options: shuffleOptions(options) },
      correctAnswer: "correct",
      explanation: `맞아요. ${correctLabel}에 대한 이야기를 선택하셨어요.`,
      difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
    };
  }

  if (card.emotionTag) {
    const distractors = getRandomDistractors(ALL_EMOTIONS, card.emotionTag, choiceCount - 1);
    const options = [
      { id: "correct", label: card.emotionTag },
      ...distractors.map((dist, idx) => ({ id: `dist_${idx}`, label: dist }))
    ];

    return {
      id: exerciseId,
      lessonId,
      type: "personal_memory_recall",
      prompt: "그때 어떤 기분이 들었다고 하셨는지 기억나시나요?",
      payload: { memoryId: card.id, options: shuffleOptions(options) },
      correctAnswer: "correct",
      explanation: `네, 그때 ${card.emotionTag}을(를) 느끼셨다고 했어요.`,
      difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
    };
  }

  return null;
}
