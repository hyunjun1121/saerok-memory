export interface HaruDerivedAnnotation {
  entityType: string;
  value: string;
}

type SupportedVoiceQuestionId =
  | "D1_Q5"
  | "D2_Q6"
  | "D3_Q6"
  | "D4_Q5"
  | "D5_Q6"
  | "D6_Q6"
  | "D7_Q6";

interface FactRule {
  pattern: RegExp;
  annotation: HaruDerivedAnnotation;
}

const MAX_TRANSCRIPT_LENGTH = 2_000;
const MAX_ENTITY_TYPE_LENGTH = 32;
const MAX_VALUE_LENGTH = 64;
const MAX_FACT_COUNT = 24;

const rule = (
  pattern: RegExp,
  entityType: string,
  value: string,
): FactRule => ({ pattern, annotation: { entityType, value } });

const QUESTION_RULES: Record<SupportedVoiceQuestionId, readonly FactRule[]> = {
  D1_Q5: [
    rule(/유성\s*시장/, "장소", "유성시장"),
    rule(/애호박/, "구매물품", "애호박"),
    rule(/대파/, "구매물품", "대파"),
    rule(/딸\s*(?:김)?민지/, "인물", "딸 김민지"),
    rule(/된장찌개[^.!?]*(?:끓이|끓여|끓일)/, "계획", "된장찌개 끓이기"),
    rule(/(?:기분[^.!?]*)?(?:좋아요|좋았어요|좋습니다)/, "감정", "좋음"),
  ],
  D2_Q6: [
    rule(/복지관/, "장소", "복지관"),
    rule(/친구\s*(?:이)?순자(?:\s*씨)?/, "인물", "친구 이순자"),
    rule(/윷놀이/, "활동", "윷놀이"),
    rule(/잔치국수/, "음식", "잔치국수"),
    rule(/(?:아주|매우)\s*좋/, "감정", "매우 좋음"),
  ],
  D3_Q6: [
    rule(/유성구\s*보건소/, "장소", "유성구 보건소"),
    rule(/혈압[^.!?]*(?:재|측정)/, "활동", "혈압 측정"),
    rule(/약[^.!?]*(?:받아|수령)/, "활동", "약 수령"),
    rule(/약국/, "장소", "약국"),
    rule(/비타민/, "구매물품", "비타민"),
    rule(/조금\s*피곤/, "신체상태", "조금 피곤함"),
    rule(/(?:마음[^.!?]*)?(?:편해|편안)/, "감정", "편안함"),
  ],
  D4_Q5: [
    rule(/갑천\s*산책로/, "장소", "갑천 산책로"),
    rule(/30\s*분[^.!?]*(?:걸었|산책)/, "활동", "30분 산책"),
    rule(/이웃\s*(?:최)?정희(?:\s*씨)?/, "인물", "이웃 최정희"),
    rule(/보리차/, "음료", "보리차"),
    rule(/몸이\s*가벼워/, "신체상태", "몸이 가벼워짐"),
  ],
  D5_Q6: [
    rule(/딸\s*(?:김)?민지/, "인물", "딸 김민지"),
    rule(/손자\s*(?:김)?준호/, "인물", "손자 김준호"),
    rule(/(?:우리|저희)?\s*집에\s*(?:왔|방문)/, "장소", "사용자 집"),
    rule(/김치전/, "음식", "김치전"),
    rule(/준호(?:의)?\s*학교\s*이야기/, "대화주제", "준호의 학교 이야기"),
    rule(/반가/, "감정", "반가움"),
  ],
  D6_Q6: [
    rule(/동네\s*도서관/, "장소", "동네 도서관"),
    rule(/건강\s*강좌[^.!?]*(?:들었|수강)/, "활동", "건강 강좌 수강"),
    rule(/빵집/, "장소", "빵집"),
    rule(/단팥빵/, "구매물품", "단팥빵"),
    rule(/(?:두|2)\s*개/, "수량", "2개"),
    rule(/오후[^.!?]*집에서\s*(?:쉬|휴식)/, "활동", "오후에 집에서 휴식"),
  ],
  D7_Q6: [
    rule(/화분에\s*물을\s*주/, "오늘 활동", "화분에 물 주기"),
    rule(/손자\s*(?:김)?준호/, "오늘 인물", "손자 김준호"),
    rule(/(?:전화|통화)(?:했|를\s*했)/, "오늘 활동", "전화 통화"),
    rule(
      /금요일[^.!?]*(?:민지[^.!?]*준호|준호[^.!?]*민지)[^.!?]*(?:와서|왔|방문)/,
      "주간 핵심 기억",
      "딸과 손자의 금요일 방문",
    ),
    rule(/김치전/, "주간 핵심 음식", "김치전"),
    rule(/행복/, "감정", "행복함"),
  ],
};

const NAME_ALIASES: Readonly<Record<string, string>> = {
  민지: "김민지",
  김민지: "김민지",
  준호: "김준호",
  김준호: "김준호",
  순자: "이순자",
  이순자: "이순자",
  정희: "최정희",
  최정희: "최정희",
};

const QUANTITY_ALIASES: Readonly<Record<string, string>> = {
  한: "1",
  두: "2",
  세: "3",
  네: "4",
};

function normalizeText(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 ? " " : character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function addAnnotation(
  annotations: HaruDerivedAnnotation[],
  seen: Set<string>,
  annotation: HaruDerivedAnnotation,
): void {
  if (annotations.length >= MAX_FACT_COUNT) return;

  const entityType = normalizeText(annotation.entityType);
  const value = normalizeText(annotation.value);
  if (
    !entityType ||
    !value ||
    entityType.length > MAX_ENTITY_TYPE_LENGTH ||
    value.length > MAX_VALUE_LENGTH
  ) {
    return;
  }

  const key = `${entityType}\u0000${value}`;
  if (seen.has(key)) return;
  seen.add(key);
  annotations.push({ entityType, value });
}

function hasEntityType(
  annotations: readonly HaruDerivedAnnotation[],
  ...entityTypes: string[]
): boolean {
  return annotations.some((annotation) => entityTypes.includes(annotation.entityType));
}

function addGenericPlace(
  transcript: string,
  annotations: HaruDerivedAnnotation[],
  seen: Set<string>,
): void {
  if (hasEntityType(annotations, "장소")) return;
  const match = transcript.match(
    /([가-힣A-Za-z0-9·-]*(?:시장|복지관|보건소|약국|산책로|도서관|빵집))(?:에서|에)/,
  );
  if (match?.[1]) addAnnotation(annotations, seen, { entityType: "장소", value: match[1] });
}

function addGenericPurchase(
  transcript: string,
  annotations: HaruDerivedAnnotation[],
  seen: Set<string>,
): void {
  if (hasEntityType(annotations, "구매물품")) return;
  const match = transcript.match(
    /([가-힣A-Za-z0-9·-]{1,20})[을를]\s*(?:샀|사왔|구입했)/,
  );
  if (match?.[1]) {
    addAnnotation(annotations, seen, { entityType: "구매물품", value: match[1] });
  }
}

function addGenericPerson(
  questionId: SupportedVoiceQuestionId,
  transcript: string,
  annotations: HaruDerivedAnnotation[],
  seen: Set<string>,
): void {
  if (hasEntityType(annotations, "인물", "오늘 인물")) return;
  const match = transcript.match(
    /(딸|손자|친구|이웃)\s*(김민지|김준호|이순자|최정희|민지|준호|순자|정희)(?=\s*(?:씨|와|과|가|이|을|를|에게|$))/,
  );
  if (!match?.[1] || !match[2]) return;

  const normalizedName = NAME_ALIASES[match[2]] ?? match[2];
  addAnnotation(annotations, seen, {
    entityType: questionId === "D7_Q6" ? "오늘 인물" : "인물",
    value: `${match[1]} ${normalizedName}`,
  });
}

function addGenericFoodAndDrink(
  transcript: string,
  annotations: HaruDerivedAnnotation[],
  seen: Set<string>,
): void {
  if (!hasEntityType(annotations, "음식", "주간 핵심 음식")) {
    const food = transcript.match(
      /([가-힣A-Za-z0-9·-]{1,20})[을를]\s*(?:부쳐\s*)?(?:먹|드셨)/,
    );
    if (food?.[1]) addAnnotation(annotations, seen, { entityType: "음식", value: food[1] });
  }

  if (!hasEntityType(annotations, "음료")) {
    const drink = transcript.match(/([가-힣A-Za-z0-9·-]{1,20})[을를]\s*(?:마셨|마셔|마십)/);
    if (drink?.[1]) addAnnotation(annotations, seen, { entityType: "음료", value: drink[1] });
  }
}

function addGenericQuantity(
  transcript: string,
  annotations: HaruDerivedAnnotation[],
  seen: Set<string>,
): void {
  if (hasEntityType(annotations, "수량")) return;
  const match = transcript.match(/(한|두|세|네|\d+)\s*개/);
  if (!match?.[1]) return;

  const count = QUANTITY_ALIASES[match[1]] ?? match[1];
  addAnnotation(annotations, seen, { entityType: "수량", value: `${count}개` });
}

function addGenericConditionAndEmotion(
  transcript: string,
  annotations: HaruDerivedAnnotation[],
  seen: Set<string>,
): void {
  if (!hasEntityType(annotations, "신체상태")) {
    if (/몸이\s*가벼워/.test(transcript)) {
      addAnnotation(annotations, seen, { entityType: "신체상태", value: "몸이 가벼워짐" });
    } else if (/조금\s*피곤/.test(transcript)) {
      addAnnotation(annotations, seen, { entityType: "신체상태", value: "조금 피곤함" });
    }
  }

  if (hasEntityType(annotations, "감정")) return;
  const emotion = /행복/.test(transcript)
    ? "행복함"
    : /반가/.test(transcript)
      ? "반가움"
      : /(?:마음[^.!?]*)?(?:편해|편안)/.test(transcript)
        ? "편안함"
        : /(?:아주|매우)\s*좋/.test(transcript)
          ? "매우 좋음"
          : /(?:기분[^.!?]*)?(?:좋아요|좋았어요|좋습니다)/.test(transcript)
            ? "좋음"
            : null;
  if (emotion) addAnnotation(annotations, seen, { entityType: "감정", value: emotion });
}

export function extractHaruResponseFacts(
  questionId: string,
  transcript: string,
): HaruDerivedAnnotation[] {
  if (typeof transcript !== "string") return [];
  const normalizedTranscript = normalizeText(transcript);
  if (
    !normalizedTranscript ||
    normalizedTranscript.length > MAX_TRANSCRIPT_LENGTH ||
    !Object.prototype.hasOwnProperty.call(QUESTION_RULES, questionId)
  ) {
    return [];
  }

  const supportedQuestionId = questionId as SupportedVoiceQuestionId;
  const annotations: HaruDerivedAnnotation[] = [];
  const seen = new Set<string>();

  for (const factRule of QUESTION_RULES[supportedQuestionId]) {
    if (factRule.pattern.test(normalizedTranscript)) {
      addAnnotation(annotations, seen, factRule.annotation);
    }
  }

  addGenericPlace(normalizedTranscript, annotations, seen);
  addGenericPurchase(normalizedTranscript, annotations, seen);
  addGenericPerson(supportedQuestionId, normalizedTranscript, annotations, seen);
  addGenericFoodAndDrink(normalizedTranscript, annotations, seen);
  addGenericQuantity(normalizedTranscript, annotations, seen);
  addGenericConditionAndEmotion(normalizedTranscript, annotations, seen);

  return annotations;
}
