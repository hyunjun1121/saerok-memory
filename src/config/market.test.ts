import { describe, expect, it } from "vitest";
import {
  getMarketConfig,
  getMarketStorageKey,
  normalizeMarket,
} from "@/config/market";

describe("market configuration", () => {
  it("locks the Japanese deployment to Japanese market semantics", () => {
    expect(getMarketConfig("jp")).toEqual(
      expect.objectContaining({
        market: "jp",
        language: "ja",
        locale: "ja-JP",
        timeZone: "Asia/Tokyo",
        currency: "JPY",
        speechLanguage: "ja-JP",
        lockedLanguage: true,
      }),
    );
  });

  it("locks the Korean deployment to Korean market semantics", () => {
    expect(getMarketConfig("kr")).toEqual(
      expect.objectContaining({
        market: "kr",
        language: "ko",
        locale: "ko-KR",
        timeZone: "Asia/Seoul",
        currency: "KRW",
        speechLanguage: "ko-KR",
        lockedLanguage: true,
      }),
    );
  });

  it("fails unknown market values closed to Korea", () => {
    expect(normalizeMarket(" JP ")).toBe("jp");
    expect(normalizeMarket("unknown")).toBe("kr");
    expect(normalizeMarket(undefined)).toBe("kr");
  });

  it("namespaces persisted data by market", () => {
    expect(getMarketStorageKey("haruTelemetry", "jp")).toBe(
      "haru:jp:haruTelemetry",
    );
  });
});
