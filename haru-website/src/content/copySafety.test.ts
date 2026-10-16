import { describe, expect, it } from "vitest";
import { siteCopy, DEMO_URL } from "./copy";

/**
 * 사실성 경계 자동 검증.
 * 규칙의 원천: 피우다프로젝트/발표자료/AGENTS.md (2026-08-17).
 * 카피를 수정할 때 이 테스트가 깨면 금지 표현이 들어온 것이다.
 */

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

/** 진단·판정 주장 금지. 단, 부정형 면책 문구와 팀 승인 헤드라인은 허용한다. */
const FORBIDDEN = [
  "치매 진단",
  "진단",
  "치료",
  "예방",
  "효과 입증",
  "특허 등록",
  "IRB 승인",
  "논문 게재",
  "게재 확정",
  "검증 완료",
  "실시간 개인화",
  "Haru만",
  "유일",
  "위험도",
  "점수 통보",
  "MMSE 점수",
  "CIST 점수",
];

const ALLOWED_EXACT = new Set([
  // 팀 승인 문제 정의 헤드라인 (왕중왕전·E5 발표자료 표지 문구)
  "변화는 진단 이전에 시작되는데, 매일을 남기는 수단이 없습니다.",
  // 필수 면책 문구 (전단지 승인)
  "Haru의 기록은 일상 지원을 위한 참고 정보이며 의료적 판단을 대신하지 않습니다.",
  "Haru는 의료적 진단 기기가 아닌, 생활 기반의 일상 인지돌봄 솔루션입니다.",
]);

describe("copySafety — 사실성 경계", () => {
  const all = collectStrings(siteCopy);

  it("금지 표현이 카피에 없다 (허용 문구 제외)", () => {
    const violations = all.filter(
      (text) => !ALLOWED_EXACT.has(text) && FORBIDDEN.some((bad) => text.includes(bad)),
    );
    expect(violations).toEqual([]);
  });

  it("필수 표현이 들어 있다", () => {
    for (const required of ["형성평가", "특허 출원 진행", "IRB 심의 신청", "접촉", "자문"]) {
      expect(
        all.some((text) => text.includes(required)),
        `카피에 '${required}' 표현이 있어야 한다`,
      ).toBe(true);
    }
    expect(all).toContain(DEMO_URL);
  });

  it("통계 3건이 모두 출처 라벨을 동반한다", () => {
    expect(siteCopy.problem.stats).toHaveLength(3);
    for (const stat of siteCopy.problem.stats) {
      expect(stat.source).toContain("출처");
    }
  });

  it("외부 STT 벤치마크 수치를 사이트 카피에 사용하지 않는다", () => {
    const joined = all.join(" ");
    for (const token of ["CER", "WER", "2.96", "3.01", "5.28", "5.56"]) {
      expect(joined.includes(token), `벤치마크 수치 '${token}' 사용 금지`).toBe(false);
    }
  });
});
