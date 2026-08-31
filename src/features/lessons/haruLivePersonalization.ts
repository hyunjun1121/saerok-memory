import {
  HARU_WEEK_QUESTION_META,
  haru7DayExercises,
  type HaruScriptedSource,
} from "@/data/haru7DayExercises";
import { getHaruConsent } from "@/features/profile/haruConsentStorage";
import type { AnswerOption, Exercise } from "@/data/mockExercises";
import type {
  HaruDemoResponse,
  HaruDemoSession,
  HaruPersonalizationRecord,
} from "@/features/lessons/haruDemoSessionStorage";
import type { HaruDerivedAnnotation } from "@/features/lessons/haruResponseFacts";
import {
  getLocalizedText,
  type LocalizedText,
  type SupportedLanguage,
} from "@/utils/localizedText";

export interface ResolvedHaruExercise {
  exercise: Exercise;
  personalization: HaruPersonalizationRecord;
}

type CompleteLocalizedText = Record<SupportedLanguage, string>;

const localized = (ko: string, ja: string, en: string): CompleteLocalizedText => ({
  ko,
  ja,
  en,
});

function koreanParticle(
  value: string,
  consonantForm: string,
  vowelForm: string,
): string {
  const lastCharacter = Array.from(value.trim()).at(-1);
  if (!lastCharacter) return vowelForm;

  const codePoint = lastCharacter.codePointAt(0) ?? 0;
  if (codePoint >= 0xac00 && codePoint <= 0xd7a3) {
    return (codePoint - 0xac00) % 28 === 0 ? vowelForm : consonantForm;
  }

  if (/\d/u.test(lastCharacter)) {
    return "013678".includes(lastCharacter) ? consonantForm : vowelForm;
  }

  return vowelForm;
}

const CANONICAL_FACT_LOCALIZATIONS = {
  유성시장: localized("유성시장", "儒城市場", "Yuseong Market"),
  애호박: localized("애호박", "韓国かぼちゃ", "Korean zucchini"),
  대파: localized("대파", "長ねぎ", "Green onions"),
  "딸 김민지": localized("딸 김민지", "娘のキム・ミンジ", "Daughter Kim Min-ji"),
  복지관: localized("복지관", "福祉館", "Community center"),
  "친구 이순자": localized(
    "친구 이순자",
    "友人のイ・スンジャ",
    "Friend Lee Soon-ja",
  ),
  윷놀이: localized("윷놀이", "ユンノリ", "Yut"),
  "유성구 보건소": localized(
    "유성구 보건소",
    "儒城区保健所",
    "Yuseong-gu Public Health Center",
  ),
  "혈압 측정": localized("혈압 측정", "血圧測定", "Blood pressure check"),
  "조금 피곤함": localized("조금 피곤함", "少し疲れている", "A little tired"),
  편안함: localized("편안함", "穏やか", "At ease"),
  보리차: localized("보리차", "麦茶", "Barley tea"),
  "몸이 가벼워짐": localized(
    "몸이 가벼워짐",
    "体が軽くなった",
    "Body felt lighter",
  ),
  "손자 김준호": localized(
    "손자 김준호",
    "孫のキム・ジュノ",
    "Grandson Kim Jun-ho",
  ),
  김치전: localized("김치전", "キムチチヂミ", "Kimchi pancakes"),
  반가움: localized("반가움", "うれしかった", "Happy to see them"),
  빵집: localized("빵집", "パン屋", "Bakery"),
  단팥빵: localized("단팥빵", "あんパン", "Red-bean buns"),
  "2개": localized("2개", "2個", "Two"),
  "오후에 집에서 휴식": localized(
    "오후에 집에서 휴식",
    "午後は家で休んだ",
    "Rested at home in the afternoon",
  ),
  가게: localized("가게", "店", "Shop"),
} satisfies Record<string, CompleteLocalizedText>;

type CanonicalFactValue = keyof typeof CANONICAL_FACT_LOCALIZATIONS;

function localizedFactValue(value: string): CompleteLocalizedText {
  const canonical =
    CANONICAL_FACT_LOCALIZATIONS[value as CanonicalFactValue];
  if (canonical) return canonical;

  const koreanQuantity = value.match(/^(\d+)개$/u)?.[1];
  if (koreanQuantity) {
    return localized(value, `${koreanQuantity}個`, koreanQuantity);
  }

  return localized(value, value, value);
}

function joinLocalizedFacts(values: readonly string[]): CompleteLocalizedText {
  const localizedValues = values.map(localizedFactValue);
  return localized(
    localizedValues.map((value) => value.ko).join(" · "),
    localizedValues.map((value) => value.ja).join("・"),
    localizedValues.map((value) => value.en).join(" · "),
  );
}

const baseExerciseById = new Map(
  haru7DayExercises.map((exercise) => [exercise.id, exercise] as const),
);
const questionById = new Map(
  HARU_WEEK_QUESTION_META.map((question) => [question.exerciseId, question] as const),
);

function sourceResponse(
  source: Extract<HaruScriptedSource, { kind: "prior_question" }>,
  sessions: readonly HaruDemoSession[],
): HaruDemoResponse | undefined {
  const session = sessions.find(
    (candidate) => candidate.day === source.sourceDay && candidate.status === "completed",
  );
  return session?.responses.find(
    (response) => response.questionId === source.sourceQuestionId,
  );
}

function optionLabel(questionId: string, optionId: string | undefined): LocalizedText | undefined {
  if (!optionId) return undefined;
  return baseExerciseById
    .get(questionId)
    ?.payload.options?.find((option) => option.id === optionId)?.label;
}

function factsOf(response: HaruDemoResponse): readonly HaruDerivedAnnotation[] {
  return response.derivedAnnotations ?? [];
}

function factValues(
  facts: readonly HaruDerivedAnnotation[],
  entityType: string,
): string[] {
  return facts
    .filter((fact) => fact.entityType === entityType)
    .map((fact) => fact.value);
}

function firstFact(
  facts: readonly HaruDerivedAnnotation[],
  entityType: string,
): string | undefined {
  return factValues(facts, entityType)[0];
}

function lastFact(
  facts: readonly HaruDerivedAnnotation[],
  entityType: string,
): string | undefined {
  return factValues(facts, entityType).at(-1);
}

function containsFacts(
  facts: readonly HaruDerivedAnnotation[],
  expected: readonly [entityType: string, value: string][],
): boolean {
  return expected.every(([entityType, value]) =>
    facts.some((fact) => fact.entityType === entityType && fact.value === value),
  );
}

function cloneWithPrompt(
  exercise: Exercise,
  prompt: LocalizedText,
  explanation: LocalizedText = exercise.explanation ?? localized("고마워요.", "ありがとうございます。", "Thank you."),
): Exercise {
  return {
    ...exercise,
    prompt,
    payload: { ...exercise.payload, audioText: prompt },
    explanation,
  };
}

function sameLocalized(left: LocalizedText, right: LocalizedText): boolean {
  return (["ko", "ja", "en"] as const).every(
    (language) => getLocalizedText(left, language) === getLocalizedText(right, language),
  );
}

function cloneChoice(
  exercise: Exercise,
  prompt: LocalizedText,
  correctLabel: LocalizedText,
  explanation: LocalizedText,
): Exercise {
  const correctId = typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : "A";
  const options = exercise.payload.options ?? [];
  const previousCorrect =
    options.find((option) => option.id === correctId)?.label ?? correctLabel;
  const nextOptions = options.map((option): AnswerOption => {
    if (option.id === correctId) return { ...option, label: correctLabel };
    if (sameLocalized(option.label, correctLabel)) {
      return { ...option, label: previousCorrect };
    }
    return option;
  });

  return {
    ...exercise,
    prompt,
    payload: { ...exercise.payload, audioText: prompt, options: nextOptions },
    correctAnswer: correctId,
    explanation,
  };
}

function fallbackExercise(exercise: Exercise): Exercise {
  if (exercise.id.endsWith("_Q1")) {
    return cloneWithPrompt(
      exercise,
      localized(
        "오늘 기분은 어떠세요?",
        "今日の気分はいかがですか。",
        "How do you feel today?",
      ),
      localized(
        "오늘 기분을 알려주셔서 고마워요.",
        "今日の気分を教えてくださってありがとうございます。",
        "Thank you for sharing how you feel today.",
      ),
    );
  }

  const prompt = localized(
    "지금 가장 편하게 떠오르는 시간은 언제인가요?",
    "今、いちばん自然に思い浮かぶ時間帯はいつですか。",
    "Which time of day comes to mind most easily right now?",
  );
  const options: AnswerOption[] = [
    { id: "A", label: localized("아침", "朝", "Morning") },
    { id: "B", label: localized("점심", "昼", "Afternoon") },
    { id: "C", label: localized("저녁", "夕方", "Evening") },
    { id: "D", label: localized("밤", "夜", "Night") },
  ];
  return {
    ...exercise,
    prompt,
    payload: {
      ...exercise.payload,
      audioText: prompt,
      options,
      items: undefined,
      requiredSelectionCount: undefined,
    },
    correctAnswer: null,
    explanation: localized(
      "편하게 골라 주셔서 고마워요.",
      "気楽に選んでくださってありがとうございます。",
      "Thank you for choosing comfortably.",
    ),
  };
}

function parseCount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const digit = value.match(/\d+/)?.[0];
  if (digit) return Number(digit);
  const normalized = value.replace(/\s+/g, "");
  const koreanCounts: Record<string, number> = {
    한개: 1,
    하나: 1,
    두개: 2,
    둘: 2,
    세개: 3,
    셋: 3,
    네개: 4,
    넷: 4,
  };
  return koreanCounts[normalized];
}

function countLabel(count: number): LocalizedText {
  return localized(`${count}개`, `${count}個`, String(count));
}

function dynamicFromVoice(
  targetId: string,
  exercise: Exercise,
  facts: readonly HaruDerivedAnnotation[],
): Exercise | undefined {
  switch (targetId) {
    case "D2_Q3": {
      if (
        containsFacts(facts, [
          ["장소", "유성시장"],
          ["구매물품", "애호박"],
        ])
      ) return exercise;
      const place = firstFact(facts, "장소");
      const item = firstFact(facts, "구매물품");
      if (!place || !item) return undefined;
      const placeValue = localizedFactValue(place);
      const itemValue = localizedFactValue(item);
      return cloneChoice(
        exercise,
        localized(
          `어제 ${placeValue.ko}에서 샀다고 말씀하신 것 중 하나는 무엇인가요?`,
          `昨日、${placeValue.ja}で買ったと話したものの一つは何ですか。`,
          `What is one thing you said you bought at ${placeValue.en} yesterday?`,
        ),
        itemValue,
        localized(
          `맞아요. ${itemValue.ko}${koreanParticle(itemValue.ko, "이라고", "라고")} 말씀하셨어요.`,
          `そうです。${itemValue.ja}と話していました。`,
          `That's right. You mentioned ${itemValue.en}.`,
        ),
      );
    }
    case "D3_Q3": {
      if (
        containsFacts(facts, [
          ["장소", "복지관"],
          ["인물", "친구 이순자"],
          ["활동", "윷놀이"],
        ])
      ) return exercise;
      const place = firstFact(facts, "장소");
      const person = firstFact(facts, "인물");
      const activity = firstFact(facts, "활동");
      if (!place || !person || !activity) return undefined;
      const placeValue = localizedFactValue(place);
      const personValue = localizedFactValue(person);
      const activityValue = localizedFactValue(activity);
      return cloneChoice(
        exercise,
        localized(
          `어제 ${placeValue.ko}에서 ${activityValue.ko}${koreanParticle(activityValue.ko, "을", "를")} 함께한 사람은 누구인가요?`,
          `昨日、${placeValue.ja}で${activityValue.ja}を一緒にした人は誰ですか。`,
          `Who joined you for ${activityValue.en} at ${placeValue.en} yesterday?`,
        ),
        personValue,
        localized(
          `맞아요. ${personValue.ko}${koreanParticle(personValue.ko, "과", "와")} 함께했다고 말씀하셨어요.`,
          `そうです。${personValue.ja}と一緒だったと話していました。`,
          `That's right. You said you were with ${personValue.en}.`,
        ),
      );
    }
    case "D4_Q1": {
      if (
        containsFacts(facts, [
          ["신체상태", "조금 피곤함"],
          ["감정", "편안함"],
        ])
      ) return exercise;
      const body = firstFact(facts, "신체상태");
      const emotion = firstFact(facts, "감정");
      if (!body && !emotion) return undefined;
      const bodyValue = body ? localizedFactValue(body) : undefined;
      const emotionValue = emotion ? localizedFactValue(emotion) : undefined;
      const koContext = [
        bodyValue && `몸은 ${bodyValue.ko}`,
        emotionValue && `마음은 ${emotionValue.ko}`,
      ]
        .filter(Boolean)
        .join(", ");
      const contextValue = bodyValue ?? emotionValue ?? localized("", "", "");
      return cloneWithPrompt(
        exercise,
        localized(
          `어제 ${koContext}${koreanParticle(koContext, "이라고", "라고")} 말씀하셨어요. 오늘 기분은 어떠세요?`,
          `昨日は「${contextValue.ja}」と話していました。今日の気分はいかがですか。`,
          `Yesterday you described yourself as “${contextValue.en}.” How do you feel today?`,
        ),
      );
    }
    case "D4_Q3": {
      if (
        containsFacts(facts, [
          ["장소", "유성구 보건소"],
          ["활동", "혈압 측정"],
        ])
      ) return exercise;
      const place = firstFact(facts, "장소");
      const activity = firstFact(facts, "활동");
      if (!place || !activity) return undefined;
      const placeValue = localizedFactValue(place);
      const activityValue = localizedFactValue(activity);
      return cloneChoice(
        exercise,
        localized(
          `어제 ${activityValue.ko}${koreanParticle(activityValue.ko, "을", "를")} 한 곳은 어디인가요?`,
          `昨日、${activityValue.ja}をした場所はどこですか。`,
          `Where did you do “${activityValue.en}” yesterday?`,
        ),
        placeValue,
        localized(
          `맞아요. ${placeValue.ko}${koreanParticle(placeValue.ko, "이라고", "라고")} 말씀하셨어요.`,
          `そうです。${placeValue.ja}と話していました。`,
          `That's right. You mentioned ${placeValue.en}.`,
        ),
      );
    }
    case "D5_Q1": {
      if (containsFacts(facts, [["신체상태", "몸이 가벼워짐"]])) return exercise;
      const body = firstFact(facts, "신체상태");
      if (!body) return undefined;
      const bodyValue = localizedFactValue(body);
      return cloneWithPrompt(
        exercise,
        localized(
          `어제 몸 상태를 "${bodyValue.ko}"${koreanParticle(bodyValue.ko, "이라고", "라고")} 알려주셨어요. 오늘 기분은 어떠세요?`,
          `昨日の体調は「${bodyValue.ja}」と話していました。今日の気分はいかがですか。`,
          `Yesterday you described your body as “${bodyValue.en}.” How do you feel today?`,
        ),
      );
    }
    case "D5_Q3": {
      if (containsFacts(facts, [["음료", "보리차"]])) return exercise;
      const drink = firstFact(facts, "음료");
      if (!drink) return undefined;
      const drinkValue = localizedFactValue(drink);
      return cloneChoice(
        exercise,
        localized(
          "어제 활동을 마치고 마신 것은 무엇인가요?",
          "昨日、活動を終えてから飲んだものは何ですか。",
          "What did you drink after yesterday's activity?",
        ),
        drinkValue,
        localized(
          `맞아요. ${drinkValue.ko}${koreanParticle(drinkValue.ko, "을", "를")} 마셨다고 말씀하셨어요.`,
          `そうです。${drinkValue.ja}を飲んだと話していました。`,
          `That's right. You said you drank ${drinkValue.en}.`,
        ),
      );
    }
    case "D6_Q1": {
      if (containsFacts(facts, [["감정", "반가움"]])) return exercise;
      const emotion = firstFact(facts, "감정");
      if (!emotion) return undefined;
      const emotionValue = localizedFactValue(emotion);
      return cloneWithPrompt(
        exercise,
        localized(
          `어제 기분을 "${emotionValue.ko}"${koreanParticle(emotionValue.ko, "이라고", "라고")} 알려주셨어요. 오늘 기분은 어떠세요?`,
          `昨日の気分は「${emotionValue.ja}」と話していました。今日の気分はいかがですか。`,
          `Yesterday you described your mood as “${emotionValue.en}.” How do you feel today?`,
        ),
      );
    }
    case "D6_Q3": {
      if (
        containsFacts(facts, [
          ["인물", "딸 김민지"],
          ["인물", "손자 김준호"],
          ["음식", "김치전"],
        ])
      ) return exercise;
      const people = factValues(facts, "인물");
      const food = firstFact(facts, "음식");
      if (people.length === 0 || !food) return undefined;
      const peopleLabel = joinLocalizedFacts(people);
      const foodValue = localizedFactValue(food);
      return cloneChoice(
        exercise,
        localized(
          `어제 ${foodValue.ko}${koreanParticle(foodValue.ko, "을", "를")} 함께 먹은 사람은 누구였나요?`,
          `昨日、${foodValue.ja}を一緒に食べた人は誰ですか。`,
          `Who ate ${foodValue.en} with you yesterday?`,
        ),
        peopleLabel,
        localized(
          `맞아요. ${peopleLabel.ko}${koreanParticle(peopleLabel.ko, "과", "와")} 함께했다고 말씀하셨어요.`,
          `そうです。${peopleLabel.ja}と一緒だったと話していました。`,
          `That's right. You said you were with ${peopleLabel.en}.`,
        ),
      );
    }
    case "D7_Q1": {
      if (containsFacts(facts, [["활동", "오후에 집에서 휴식"]])) return exercise;
      const activity = lastFact(facts, "활동");
      if (!activity) return undefined;
      const activityValue = localizedFactValue(activity);
      return cloneWithPrompt(
        exercise,
        localized(
          `어제 "${activityValue.ko}"${koreanParticle(activityValue.ko, "을", "를")} 했다고 말씀하셨어요. 오늘 기분은 어떠세요?`,
          `昨日は「${activityValue.ja}」をしたと話していました。今日の気分はいかがですか。`,
          `Yesterday you said you did “${activityValue.en}.” How do you feel today?`,
        ),
      );
    }
    case "D7_Q3": {
      if (
        containsFacts(facts, [
          ["구매물품", "단팥빵"],
          ["수량", "2개"],
        ])
      ) return exercise;
      const item = firstFact(facts, "구매물품");
      const quantity = firstFact(facts, "수량");
      const place = factValues(facts, "장소").at(-1) ?? "가게";
      if (!item || !quantity) return undefined;
      const itemValue = localizedFactValue(item);
      const quantityValue = localizedFactValue(quantity);
      const placeValue = localizedFactValue(place);
      const answer = localized(
        `${itemValue.ko} ${quantityValue.ko}`,
        `${itemValue.ja}${quantityValue.ja}`,
        `${quantityValue.en} ${itemValue.en}`,
      );
      return cloneChoice(
        exercise,
        localized(
          `어제 ${placeValue.ko}에서 산 것은 무엇인가요?`,
          `昨日、${placeValue.ja}で買ったものは何ですか。`,
          `What did you buy at ${placeValue.en} yesterday?`,
        ),
        answer,
        localized(
          `맞아요. ${answer.ko}${koreanParticle(answer.ko, "이라고", "라고")} 말씀하셨어요.`,
          `そうです。${answer.ja}と話していました。`,
          `That's right. You mentioned ${answer.en}.`,
        ),
      );
    }
    case "D7_Q4": {
      if (
        containsFacts(facts, [
          ["인물", "딸 김민지"],
          ["인물", "손자 김준호"],
          ["음식", "김치전"],
        ])
      ) return exercise;
      const people = factValues(facts, "인물");
      const food = firstFact(facts, "음식");
      if (people.length === 0 || !food) return undefined;
      const peopleLabel = joinLocalizedFacts(people);
      const foodValue = localizedFactValue(food);
      return cloneChoice(
        exercise,
        localized(
          `이번 주에 ${peopleLabel.ko}${koreanParticle(peopleLabel.ko, "과", "와")} 함께 먹은 음식은 무엇인가요?`,
          `今週、${peopleLabel.ja}と一緒に食べたものは何ですか。`,
          `What did you eat with ${peopleLabel.en} this week?`,
        ),
        foodValue,
        localized(
          `맞아요. ${foodValue.ko}${koreanParticle(foodValue.ko, "을", "를")} 함께 먹었다고 말씀하셨어요.`,
          `そうです。${foodValue.ja}を一緒に食べたと話していました。`,
          `That's right. You said you ate ${foodValue.en} together.`,
        ),
      );
    }
    case "D7_Q5": {
      if (
        containsFacts(facts, [
          ["구매물품", "단팥빵"],
          ["수량", "2개"],
        ])
      ) return exercise;
      const item = firstFact(facts, "구매물품");
      const count = parseCount(firstFact(facts, "수량"));
      if (!item || count === undefined || count < 1) return undefined;
      const itemValue = localizedFactValue(item);
      const remaining = count - 1;
      const values = [Math.max(0, remaining - 1), remaining, remaining + 1, remaining + 2];
      const optionIds = ["A", "B", "C", "D"];
      const prompt = localized(
        `어제 산 ${itemValue.ko} ${count}개 중 오늘 1개를 먹으면 몇 개가 남을까요?`,
        `昨日買った${itemValue.ja}${count}個のうち、今日1個食べると何個残りますか。`,
        `If you eat one of the ${count} ${itemValue.en} you bought yesterday, how many remain?`,
      );
      return {
        ...exercise,
        prompt,
        payload: {
          ...exercise.payload,
          audioText: prompt,
          options: optionIds.map((id, index) => ({ id, label: countLabel(values[index]) })),
        },
        correctAnswer: "B",
        explanation: localized(
          `맞아요. ${remaining}개가 남아요.`,
          `そうです。${remaining}個残ります。`,
          `That's right. ${remaining} remain.`,
        ),
      };
    }
    default:
      return undefined;
  }
}

function resolvePriorResponse(
  exercise: Exercise,
  source: Extract<HaruScriptedSource, { kind: "prior_question" }>,
  sessions: readonly HaruDemoSession[],
  personalizedQuestionUse: boolean,
): ResolvedHaruExercise {
  const sourceQuestionIds = [source.sourceQuestionId];
  const response = sourceResponse(source, sessions);
  if (!response || !personalizedQuestionUse) {
    return {
      exercise: fallbackExercise(exercise),
      personalization: { kind: "fallback", sourceQuestionIds },
    };
  }

  if (response.responseType === "single_choice") {
    const label = optionLabel(source.sourceQuestionId, response.selectedOptionId);
    if (!label) {
      return {
        exercise: fallbackExercise(exercise),
        personalization: { kind: "fallback", sourceQuestionIds },
      };
    }
    const sourceQuestion = questionById.get(source.sourceQuestionId);
    if (sourceQuestion?.recordedResponse.selectedOptionId === response.selectedOptionId) {
      return {
        exercise,
        personalization: { kind: "prior_response", sourceQuestionIds },
      };
    }
    const prompt = localized(
      `어제 기분을 "${getLocalizedText(label, "ko")}"이라고 알려주셨어요. 오늘 기분은 어떠세요?`,
      `昨日の気分は「${getLocalizedText(label, "ja")}」と話していました。今日の気分はいかがですか。`,
      `Yesterday you described your mood as “${getLocalizedText(label, "en")}.” How do you feel today?`,
    );
    return {
      exercise: cloneWithPrompt(exercise, prompt),
      personalization: { kind: "prior_response", sourceQuestionIds },
    };
  }

  const personalized = dynamicFromVoice(exercise.id, exercise, factsOf(response));
  return personalized
    ? {
        exercise: personalized,
        personalization: { kind: "prior_response", sourceQuestionIds },
      }
    : {
        exercise: fallbackExercise(exercise),
        personalization: { kind: "fallback", sourceQuestionIds },
      };
}

export function resolveHaruExercise(
  exercise: Exercise,
  sessions: readonly HaruDemoSession[],
  personalizedQuestionUse = getHaruConsent().personalizedQuestionUse,
): ResolvedHaruExercise {
  const question = questionById.get(exercise.id);
  const source = question?.scriptedSource;
  if (!question || !source) {
    return { exercise, personalization: { kind: "none" } };
  }
  if (source.kind === "profile") {
    if (!personalizedQuestionUse) {
      return {
        exercise: fallbackExercise(exercise),
        personalization: { kind: "fallback" },
      };
    }
    return { exercise, personalization: { kind: "profile" } };
  }
  return resolvePriorResponse(
    exercise,
    source,
    sessions,
    personalizedQuestionUse,
  );
}

export function resolveHaruExercises(
  exercises: readonly Exercise[],
  sessions: readonly HaruDemoSession[],
  personalizedQuestionUse = getHaruConsent().personalizedQuestionUse,
): ResolvedHaruExercise[] {
  return exercises.map((exercise) =>
    resolveHaruExercise(exercise, sessions, personalizedQuestionUse),
  );
}
