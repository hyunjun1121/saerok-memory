import { describe, expect, it } from "vitest";
import {
  extractHaruResponseFacts,
  type HaruDerivedAnnotation,
} from "@/features/lessons/haruResponseFacts";

interface CanonicalVoiceRecord {
  questionId: string;
  transcript: string;
  expected: HaruDerivedAnnotation[];
}

const CANONICAL_VOICE_RECORDS: CanonicalVoiceRecord[] = [
  {
    questionId: "D1_Q5",
    transcript:
      "오늘 오전에 유성시장에 가서 애호박하고 대파를 샀어요. 딸 민지가 저녁에 온다고 해서 된장찌개를 끓이려고요. 기분은 좋아요.",
    expected: [
      { entityType: "장소", value: "유성시장" },
      { entityType: "구매물품", value: "애호박" },
      { entityType: "구매물품", value: "대파" },
      { entityType: "인물", value: "딸 김민지" },
      { entityType: "계획", value: "된장찌개 끓이기" },
      { entityType: "감정", value: "좋음" },
    ],
  },
  {
    questionId: "D2_Q6",
    transcript:
      "오늘 복지관에서 친구 순자 씨를 만나 윷놀이를 했어요. 점심으로 잔치국수를 먹었고, 많이 웃어서 기분이 아주 좋았어요.",
    expected: [
      { entityType: "장소", value: "복지관" },
      { entityType: "인물", value: "친구 이순자" },
      { entityType: "활동", value: "윷놀이" },
      { entityType: "음식", value: "잔치국수" },
      { entityType: "감정", value: "매우 좋음" },
    ],
  },
  {
    questionId: "D3_Q6",
    transcript:
      "오늘은 유성구 보건소에 가서 혈압을 재고 약을 받아왔어요. 집에 오는 길에 약국에서 비타민도 샀어요. 조금 피곤하지만 마음은 편해요.",
    expected: [
      { entityType: "장소", value: "유성구 보건소" },
      { entityType: "활동", value: "혈압 측정" },
      { entityType: "활동", value: "약 수령" },
      { entityType: "장소", value: "약국" },
      { entityType: "구매물품", value: "비타민" },
      { entityType: "신체상태", value: "조금 피곤함" },
      { entityType: "감정", value: "편안함" },
    ],
  },
  {
    questionId: "D4_Q5",
    transcript:
      "오늘 오후에 갑천 산책로를 30분 걸었어요. 벤치에서 이웃 최정희 씨와 이야기했고, 집에 와서 보리차를 마셨어요. 몸이 가벼워졌어요.",
    expected: [
      { entityType: "장소", value: "갑천 산책로" },
      { entityType: "활동", value: "30분 산책" },
      { entityType: "인물", value: "이웃 최정희" },
      { entityType: "음료", value: "보리차" },
      { entityType: "신체상태", value: "몸이 가벼워짐" },
    ],
  },
  {
    questionId: "D5_Q6",
    transcript:
      "오늘 딸 민지와 손자 준호가 집에 왔어요. 같이 김치전을 부쳐 먹고, 준호의 학교 이야기를 들었어요. 반가웠어요.",
    expected: [
      { entityType: "인물", value: "딸 김민지" },
      { entityType: "인물", value: "손자 김준호" },
      { entityType: "장소", value: "사용자 집" },
      { entityType: "음식", value: "김치전" },
      { entityType: "대화주제", value: "준호의 학교 이야기" },
      { entityType: "감정", value: "반가움" },
    ],
  },
  {
    questionId: "D6_Q6",
    transcript:
      "오늘 오전에 동네 도서관에서 건강 강좌를 들었어요. 돌아오는 길에 빵집에서 단팥빵 두 개를 샀고, 오후에는 집에서 쉬었어요.",
    expected: [
      { entityType: "장소", value: "동네 도서관" },
      { entityType: "활동", value: "건강 강좌 수강" },
      { entityType: "장소", value: "빵집" },
      { entityType: "구매물품", value: "단팥빵" },
      { entityType: "수량", value: "2개" },
      { entityType: "활동", value: "오후에 집에서 휴식" },
    ],
  },
  {
    questionId: "D7_Q6",
    transcript:
      "오늘은 집에서 화분에 물을 주고 손자 준호와 전화했어요. 이번 주에는 금요일에 민지와 준호가 와서 김치전을 먹은 일이 가장 기억에 남아요. 집이 북적여서 행복했어요.",
    expected: [
      { entityType: "오늘 활동", value: "화분에 물 주기" },
      { entityType: "오늘 인물", value: "손자 김준호" },
      { entityType: "오늘 활동", value: "전화 통화" },
      { entityType: "주간 핵심 기억", value: "딸과 손자의 금요일 방문" },
      { entityType: "주간 핵심 음식", value: "김치전" },
      { entityType: "감정", value: "행복함" },
    ],
  },
];

describe("extractHaruResponseFacts", () => {
  it.each(CANONICAL_VOICE_RECORDS)(
    "matches the canonical JSON annotations for $questionId",
    ({ questionId, transcript, expected }) => {
      expect(extractHaruResponseFacts(questionId, transcript)).toEqual(expected);
    },
  );

  it("generalizes a place suffix and a newly purchased item", () => {
    expect(
      extractHaruResponseFacts("D1_Q5", "유성시장에서 가지를 샀어요"),
    ).toEqual([
      { entityType: "장소", value: "유성시장" },
      { entityType: "구매물품", value: "가지" },
    ]);
  });

  it("rejects unsupported, blank, and excessive input", () => {
    expect(extractHaruResponseFacts("unknown", "유성시장에서 가지를 샀어요")).toEqual([]);
    expect(extractHaruResponseFacts("D1_Q5", " \n\t ")).toEqual([]);
    expect(extractHaruResponseFacts("D1_Q5", "가".repeat(2_001))).toEqual([]);
  });

  it("returns deduplicated facts without transcript or audio fields", () => {
    const result = extractHaruResponseFacts(
      "D1_Q5",
      "유성시장에 갔다가 유성시장에서 애호박을 샀어요. 애호박도 샀어요.",
    );

    expect(result).toEqual([
      { entityType: "장소", value: "유성시장" },
      { entityType: "구매물품", value: "애호박" },
    ]);
    expect(Object.keys(result[0] ?? {}).sort()).toEqual(["entityType", "value"]);
    expect(JSON.stringify(result)).not.toMatch(/transcript|audio/i);
  });
});
