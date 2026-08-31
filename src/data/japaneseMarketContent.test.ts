import { describe, expect, it } from "vitest";
import ja from "@/locales/ja.json";
import { HARU_DEMO_PERSONA } from "@/data/haruDemoPersona";
import {
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
  haru7DayExercises,
} from "@/data/haru7DayExercises";
import { mockExercises } from "@/data/mockExercises";
import { buildDemoMemoryCards } from "@/features/family/demoReportData";
import { getLocalizedText, type LocalizedText } from "@/utils/localizedText";

const JP_CONTEXT_BANS = [
  "ウォン",
  "儒城",
  "大田",
  "釜山",
  "影島",
  "全州",
  "鍾路",
  "ユンノリ",
  "キムチチヂミ",
  "韓国式",
  "韓国かぼちゃ",
  "テンジャンチゲ",
  "福祉館",
  "ヨンジャ",
  "ミンジ",
  "ジュノ",
  "スンジャ",
  "ジョンヒ",
  "ジヨン",
  "南山",
  "そぼろパン",
] as const;

function japanese(value: LocalizedText | undefined): string {
  return getLocalizedText(value, "ja");
}

function collectJapaneseStrings(value: unknown, result: string[] = []): string[] {
  if (typeof value === "string") return result;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJapaneseStrings(item, result));
    return result;
  }
  if (!value || typeof value !== "object") return result;

  const record = value as Record<string, unknown>;
  if (typeof record.ja === "string") result.push(record.ja);
  Object.values(record).forEach((item) => collectJapaneseStrings(item, result));
  return result;
}

function collectStringLeaves(value: unknown, result: string[] = []): string[] {
  if (typeof value === "string") {
    result.push(value);
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringLeaves(item, result));
    return result;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectStringLeaves(item, result),
    );
  }
  return result;
}

describe("Japanese market content contract", () => {
  it("uses a fully Japanese synthetic persona", () => {
    expect(japanese(HARU_DEMO_PERSONA.name)).toBe("佐藤春子");
    expect(japanese(HARU_DEMO_PERSONA.displayName)).toBe("佐藤春子さん");
    expect(japanese(HARU_DEMO_PERSONA.residence)).toBe("東京都練馬区");
    expect(japanese(HARU_DEMO_PERSONA.registeredProfileFields.hometown)).toBe(
      "長野県松本市",
    );
    expect(japanese(HARU_DEMO_PERSONA.registeredProfileFields.daughterName)).toBe(
      "佐藤由美",
    );
    expect(japanese(HARU_DEMO_PERSONA.registeredProfileFields.grandsonName)).toBe(
      "佐藤健太",
    );
    expect(japanese(HARU_DEMO_PERSONA.registeredProfileFields.closeFriendName)).toBe(
      "田中和子",
    );
    expect(japanese(HARU_DEMO_PERSONA.registeredProfileFields.neighborName)).toBe(
      "鈴木恵子",
    );
  });

  it("contains no Korean-market artifacts in Japanese authored data", () => {
    const japaneseCorpus = collectJapaneseStrings({
      persona: HARU_DEMO_PERSONA,
      plans: HARU_WEEK_PLAN,
      exercises: mockExercises,
      metadata: HARU_WEEK_QUESTION_META,
    }).join("\n");

    for (const banned of JP_CONTEXT_BANS) {
      expect(japaneseCorpus, `Japanese content contains ${banned}`).not.toContain(banned);
    }
    expect(japaneseCorpus).not.toContain("?");
  });

  it("uses Japanese money and nationwide daily-life contexts", () => {
    const catalogMoney = mockExercises.find((item) => item.id === "ex_market_money");
    expect(japanese(catalogMoney?.payload.scenarioBody)).toBe(
      "スーパーで果物を300円分買い、500円を払いました。おつりはいくらでしょうか。",
    );
    expect(catalogMoney?.payload.options?.map((item) => japanese(item.label))).toEqual([
      "100円",
      "200円",
      "300円",
      "400円",
    ]);

    const dayOneMoney = haru7DayExercises.find((item) => item.id === "D1_Q4");
    expect(japanese(dayOneMoney?.prompt)).toBe(
      "豆腐を150円、卵を250円で買い、500円を払いました。おつりはいくらですか。",
    );
    expect(dayOneMoney?.payload.options?.map((item) => japanese(item.label))).toEqual([
      "0円",
      "50円",
      "100円",
      "150円",
    ]);
    expect(dayOneMoney?.correctAnswer).toBe("C");
  });

  it("keeps the seven-day Japanese personalization chain internally consistent", () => {
    const expectations: Record<string, { prompt: string; answer: string }> = {
      D1_Q3: { prompt: "春子さんの故郷はどこですか。", answer: "長野県松本市" },
      D2_Q3: {
        prompt: "昨日、近所のスーパーで買ったと話した野菜はどれですか。",
        answer: "かぼちゃ",
      },
      D3_Q3: {
        prompt: "昨日、地域の交流センターで一緒に輪投げをした人は誰ですか。",
        answer: "田中和子さん",
      },
      D4_Q3: {
        prompt: "昨日、血圧を測った場所はどこですか。",
        answer: "地域の保健センター",
      },
      D6_Q3: {
        prompt: "昨日、一緒にお好み焼きを食べた人は誰ですか。",
        answer: "娘の由美さんと孫の健太さん",
      },
      D6_Q5: { prompt: "春子さんの娘の名前は何ですか。", answer: "佐藤由美" },
      D7_Q4: {
        prompt: "今週、娘の由美さんと孫の健太さんが家に来たとき、一緒に食べたものは何ですか。",
        answer: "お好み焼き",
      },
    };

    for (const [id, expected] of Object.entries(expectations)) {
      const exercise = haru7DayExercises.find((item) => item.id === id);
      expect(japanese(exercise?.prompt)).toBe(expected.prompt);
      const answer = exercise?.payload.options?.find(
        (item) => item.id === exercise.correctAnswer,
      );
      expect(japanese(answer?.label)).toBe(expected.answer);
    }
  });

  it("uses native Japanese proverbs rather than translated Korean sayings", () => {
    const dayTwo = haru7DayExercises.find((item) => item.id === "D2_Q4");
    const dayFive = haru7DayExercises.find((item) => item.id === "D5_Q4");

    expect(japanese(dayTwo?.prompt)).toContain("笑う門には");
    expect(japanese(dayTwo?.payload.options?.[0]?.label)).toBe("福来る");
    expect(japanese(dayFive?.prompt)).toContain("三人寄れば文殊の知恵");
    expect(japanese(dayFive?.payload.options?.[0]?.label)).toBe(
      "力を合わせると、よい考えが生まれる",
    );
  });

  it("uses natural Japanese UI copy and punctuation", () => {
    expect(ja.speech.transcriptLabel).toBe("お話の記録");
    expect(ja.caregiver.title).toBe("今週の様子を一緒に見る");
    expect(ja.exercise.cognitive.workingMemory).toBe("数字を覚える活動");
    expect(ja.exercise.cognitive.colors.yellow).toBe("黄色");
    expect(ja.lesson.start.profileBadge).toBe("登録済みプロフィール");

    const localeCorpus = collectStringLeaves(ja).join("\n");
    expect(localeCorpus).not.toContain("?");
    expect(localeCorpus).not.toContain("軽い話す活動");
    expect(localeCorpus).not.toContain("ゴミ袋");
  });

  it("does not persist Korean-only semantic values from localized emotion choices", () => {
    const emotionExercise = mockExercises.find((item) => item.id === "ex_7");

    expect(emotionExercise?.payload.memoryField).toBe("emotionTag");
    expect(emotionExercise?.payload.options?.every((option) => option.value === undefined)).toBe(
      true,
    );
  });

  it("builds Japanese demo report memories without Korean names or places", () => {
    const cards = buildDemoMemoryCards("ja", new Date("2026-08-03T00:00:00.000Z"));
    const corpus = JSON.stringify(cards);

    for (const banned of JP_CONTEXT_BANS) {
      expect(corpus, `Japanese report fixture contains ${banned}`).not.toContain(banned);
    }
    expect(corpus).toContain("和子さん");
    expect(corpus).toContain("川沿いの遊歩道");
  });
});
