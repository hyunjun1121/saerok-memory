import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearHaruEnrollment,
  getHaruEnrollment,
  redeemHaruParticipantCode,
} from "@/features/profile/haruEnrollment";

describe("Haru participant enrollment", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("redeems an uppercase pseudonymous code and stores only returned credentials", async () => {
    const fetchImplementation = vi.fn(async () =>
      new Response(
        JSON.stringify({
          participantId: "018f0f65-4f93-7cc0-9d41-4e63c8412863",
          market: "jp",
          locale: "ja-JP",
        }),
        { status: 200 },
      ),
    );

    const result = await redeemHaruParticipantCode(" abcd2345 ", {
      market: "jp",
      installationId: "inst_jp_00112233445566778899aabbccddeeff",
      consentRevision: "consent-1785974400000",
      fetchImplementation: fetchImplementation as typeof fetch,
      now: new Date("2026-08-06T00:00:00.000Z"),
    });

    expect(result).toMatchObject({ status: "enrolled", market: "jp" });
    expect(getHaruEnrollment("jp")).toMatchObject({
      participantId: "018f0f65-4f93-7cc0-9d41-4e63c8412863",
      market: "jp",
    });
    expect(JSON.stringify(localStorage)).not.toContain("ABCD2345");
    expect(JSON.stringify(localStorage)).not.toContain("deviceToken");
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/enrollment/v1/redeem",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });

  it("rejects malformed codes before network access", async () => {
    const fetchImplementation = vi.fn();
    await expect(
      redeemHaruParticipantCode("ABC-123", {
        market: "kr",
        installationId: "inst_kr_00112233445566778899aabbccddeeff",
        consentRevision: "consent-1",
        fetchImplementation: fetchImplementation as typeof fetch,
      }),
    ).resolves.toEqual({ status: "invalid_code" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("fails closed when the server market does not match deployment", async () => {
    const fetchImplementation = vi.fn(async () =>
      new Response(
        JSON.stringify({
          participantId: "018f0f65-4f93-7cc0-9d41-4e63c8412863",
          market: "kr",
          locale: "ko-KR",
        }),
        { status: 200 },
      ),
    );

    await expect(
      redeemHaruParticipantCode("ABCD2345", {
        market: "jp",
        installationId: "inst_jp_00112233445566778899aabbccddeeff",
        consentRevision: "consent-1",
        fetchImplementation: fetchImplementation as typeof fetch,
      }),
    ).resolves.toEqual({ status: "market_mismatch" });
    expect(getHaruEnrollment("jp")).toBeNull();
  });

  it("clears the market-specific token without touching another market", () => {
    localStorage.setItem(
      "haru:kr:enrollment",
      JSON.stringify({
        participantId: "018f0f65-4f93-7cc0-9d41-4e63c8412863",
        market: "kr",
        locale: "ko-KR",
        enrolledAt: "2026-08-06T00:00:00.000Z",
      }),
    );
    localStorage.setItem("haru:jp:enrollment", "keep-jp-separate");

    expect(clearHaruEnrollment("kr")).toBe(true);
    expect(localStorage.getItem("haru:jp:enrollment")).toBe("keep-jp-separate");
  });
});
