import type { MemoryCard } from "@/features/memory/types";
import type { Exercise } from "@/data/mockExercises";
import i18n from "@/i18n";
import { normalizeLanguage, type SupportedLanguage } from "@/utils/localizedText";
import { extractMemoryStoryCues, summarizeMemoryStory } from "@/features/memory/memoryStory";

type LabelMap = Record<SupportedLanguage, Record<string, string>>;
type OptionSource = Record<SupportedLanguage, string[]>;

const TOPIC_LABELS: LabelMap = {
  ko: {
    family: "가족",
    health: "건강",
    travel: "여행",
    work: "일",
    food: "음식",
    hobby: "취미",
    friends: "친구",
    daily_life: "일상",
  },
  ja: {
    family: "家族",
    health: "健康",
    travel: "旅行",
    work: "仕事",
    food: "食事",
    hobby: "趣味",
    friends: "友人",
    daily_life: "日常",
  },
  en: {
    family: "Family",
    health: "Health",
    travel: "Travel",
    work: "Work",
    food: "Food",
    hobby: "Hobby",
    friends: "Friends",
    daily_life: "Daily life",
  },
};

const EMOTION_LABELS: LabelMap = {
  ko: {
    proud: "뿌듯함",
    relieved: "마음이 놓임",
    thankful: "감사함",
    hard: "힘들었음",
    sad: "슬픔",
    happy: "기쁨",
    surprised: "놀라움",
    regretful: "아쉬움",
  },
  ja: {
    proud: "誇らしさ",
    relieved: "安心",
    thankful: "ありがたさ",
    hard: "大変だった",
    sad: "悲しさ",
    happy: "うれしさ",
    surprised: "驚き",
    regretful: "残念",
  },
  en: {
    proud: "Pride",
    relieved: "Relief",
    thankful: "Gratitude",
    hard: "Hard time",
    sad: "Sadness",
    happy: "Joy",
    surprised: "Surprise",
    regretful: "Regret",
  },
};

const PEOPLE_OPTIONS: OptionSource = {
  ko: ["가족", "배우자", "자녀", "딸", "아들", "친구", "동료", "혼자"],
  ja: ["家族", "配偶者", "子ども", "娘", "息子", "友人", "同僚", "一人"],
  en: ["Family", "Spouse", "Child", "Daughter", "Son", "Friend", "Colleague", "Alone"],
};

const PLACE_OPTIONS: OptionSource = {
  ko: ["집", "병원", "회사", "공원", "식당", "국밥집", "여행지", "고향"],
  ja: ["家", "病院", "会社", "公園", "食堂", "スープ店", "旅行先", "故郷"],
  en: ["Home", "Hospital", "Workplace", "Park", "Restaurant", "Soup restaurant", "Travel place", "Hometown"],
};

const OBJECT_OPTIONS: OptionSource = {
  ko: ["우산", "사진", "편지", "꽃", "약", "지갑", "가방", "버스", "기차", "비행기", "자동차", "국밥", "커피"],
  ja: ["傘", "写真", "手紙", "花", "薬", "財布", "かばん", "バス", "電車", "飛行機", "車", "コーヒー"],
  en: ["Umbrella", "Photo", "Letter", "Flower", "Medicine", "Wallet", "Bag", "Bus", "Train", "Airplane", "Car", "Coffee"],
};

const TIME_OPTIONS: OptionSource = {
  ko: ["오늘", "어제", "지난주", "지난달", "작년", "봄", "여름", "가을", "겨울", "명절", "생일", "비 오는 날"],
  ja: ["今日", "昨日", "先週", "先月", "去年", "春", "夏", "秋", "冬", "祝日", "誕生日", "雨の日"],
  en: ["Today", "Yesterday", "Last week", "Last month", "Last year", "Spring", "Summer", "Fall", "Winter", "Holiday", "Birthday", "Rainy day"],
};

const STORY_EMOTION_OPTIONS: OptionSource = {
  ko: ["고마움", "기쁨", "뿌듯함", "편안함", "걱정", "아쉬움", "슬픔", "놀라움"],
  ja: ["ありがたさ", "うれしさ", "誇らしさ", "安心", "心配", "残念", "悲しさ", "驚き"],
  en: ["Gratitude", "Joy", "Pride", "Relief", "Worry", "Regret", "Sadness", "Surprise"],
};

const STORY_DISTRACTORS: OptionSource = {
  ko: ["가족과 식사한 이야기", "공원에서 산책한 이야기", "병원에 다녀온 이야기", "친구와 통화한 이야기"],
  ja: ["家族と食事した話", "公園を散歩した話", "病院に行った話", "友人と電話した話"],
  en: ["A meal with family", "A walk in the park", "A visit to the hospital", "A call with a friend"],
};

function getLanguage(): SupportedLanguage {
  return normalizeLanguage(i18n.language);
}

function getMapKey(labels: LabelMap, value: string | undefined): string | undefined {
  if (!value) return undefined;

  for (const language of ["ko", "ja", "en"] as const) {
    if (Object.prototype.hasOwnProperty.call(labels[language], value)) {
      return value;
    }

    const matchedEntry = Object.entries(labels[language]).find(([, label]) => label === value);
    if (matchedEntry) return matchedEntry[0];
  }

  return undefined;
}

function getLocalizedMapLabel(labels: LabelMap, value: string | undefined): string | undefined {
  if (!value) return undefined;

  const key = getMapKey(labels, value);
  if (!key) return value;

  return labels[getLanguage()][key] ?? value;
}

function getMapValues(labels: LabelMap, fallbackLanguage?: SupportedLanguage): string[] {
  return Object.values(labels[fallbackLanguage ?? getLanguage()]);
}

function getOptions(source: OptionSource, fallbackLanguage?: SupportedLanguage): string[] {
  return source[fallbackLanguage ?? getLanguage()];
}

function getLocalizedOptionLabel(source: OptionSource, value: string | undefined): string | undefined {
  if (!value) return undefined;

  for (const language of ["ko", "ja", "en"] as const) {
    const index = source[language].indexOf(value);
    if (index >= 0) return source[getLanguage()][index] ?? value;
  }

  return value;
}

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
      label: getLocalizedOptionLabel(PEOPLE_OPTIONS, cues.people?.[0]),
      field: "people",
      prompt: i18n.t("exercise.memory.review.story.people", "지난번 이야기에서 함께 있었던 사람은 누구였나요?"),
      distractors: getOptions(PEOPLE_OPTIONS),
    },
    {
      value: cues.places?.[0],
      label: getLocalizedOptionLabel(PLACE_OPTIONS, cues.places?.[0]),
      field: "place",
      prompt: i18n.t("exercise.memory.review.story.place", "지난번 이야기에서 장소로 나온 곳은 어디였나요?"),
      distractors: getOptions(PLACE_OPTIONS),
    },
    {
      value: cues.objects?.[0],
      label: getLocalizedOptionLabel(OBJECT_OPTIONS, cues.objects?.[0]),
      field: "object",
      prompt: i18n.t("exercise.memory.review.story.object", "지난번 이야기에서 기억 단서로 나온 물건은 무엇이었나요?"),
      distractors: getOptions(OBJECT_OPTIONS),
    },
    {
      value: cues.emotions?.[0],
      label: getLocalizedOptionLabel(STORY_EMOTION_OPTIONS, cues.emotions?.[0]),
      field: "emotion",
      prompt: i18n.t("exercise.memory.review.story.emotion", "지난번 이야기에서 가까운 감정은 무엇이었나요?"),
      distractors: getOptions(STORY_EMOTION_OPTIONS),
    },
    {
      value: cues.timeHints?.[0],
      label: getLocalizedOptionLabel(TIME_OPTIONS, cues.timeHints?.[0]),
      field: "time",
      prompt: i18n.t("exercise.memory.review.story.time", "지난번 이야기에서 시간 단서로 나온 것은 무엇이었나요?"),
      distractors: getOptions(TIME_OPTIONS),
    },
  ];

  const selectedCue = candidates.find((candidate) => !!candidate.value);

  if (!selectedCue) {
    const options = [
      { id: "correct", label: summary },
      ...getRandomDistractors(getOptions(STORY_DISTRACTORS), summary, choiceCount - 1).map((dist, idx) => ({
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

  const correctLabel = selectedCue.label ?? selectedCue.value!;
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
  const legacyEmotionTag = storedTopic && getMapKey(EMOTION_LABELS, storedTopic) ? storedTopic : undefined;

  if (storedTopic && storedTopic !== "unknown" && !legacyEmotionTag) {
    const correctLabel = getLocalizedMapLabel(TOPIC_LABELS, storedTopic) ?? storedTopic;
    const distractors = getRandomDistractors(getMapValues(TOPIC_LABELS), correctLabel, choiceCount - 1);

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
    const correctLabel = getLocalizedMapLabel(EMOTION_LABELS, emotionTag) ?? emotionTag;
    const distractors = getRandomDistractors(getMapValues(EMOTION_LABELS), correctLabel, choiceCount - 1);
    const options = [
      { id: "correct", label: correctLabel },
      ...distractors.map((dist, idx) => ({ id: `dist_${idx}`, label: dist }))
    ];

    return {
      id: exerciseId,
      lessonId,
      type: "personal_memory_recall",
      prompt: i18n.t("exercise.memory.review.emotion", "그때 어떤 기분이 들었다고 하셨는지 기억나시나요?"),
      payload: { memoryId: card.id, memoryField: "emotionTag", options: shuffleOptions(options) },
      correctAnswer: "correct",
      explanation: i18n.t("exercise.memory.review.emotionExplanation", { emotion: correctLabel, defaultValue: `네, 그때 ${correctLabel}을(를) 느끼셨다고 했어요.` }),
      difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
    };
  }

  if (card.peopleTags && card.peopleTags.length > 0) {
    const person = getLocalizedOptionLabel(PEOPLE_OPTIONS, card.peopleTags[0]) ?? card.peopleTags[0];
    const distractors = getRandomDistractors(getOptions(PEOPLE_OPTIONS), person, choiceCount - 1);
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
    const place = getLocalizedOptionLabel(PLACE_OPTIONS, card.placeTag) ?? card.placeTag;
    const distractors = getRandomDistractors(getOptions(PLACE_OPTIONS), place, choiceCount - 1);
    const options = [
      { id: "correct", label: place },
      ...distractors.map((dist, idx) => ({ id: `dist_${idx}`, label: dist }))
    ];

    return {
      id: exerciseId,
      lessonId,
      type: "personal_memory_recall",
      prompt: i18n.t("exercise.memory.review.place", "그 기억이 있던 장소가 어디였는지 기억나시나요?"),
      payload: { memoryId: card.id, memoryField: "placeTag", options: shuffleOptions(options) },
      correctAnswer: "correct",
      explanation: i18n.t("exercise.memory.review.placeExplanation", { place, defaultValue: `네, 장소는 ${place}이었어요.` }),
      difficulty: choiceCount as 1 | 2 | 3 | 4 | 5,
    };
  }

  return null;
}
