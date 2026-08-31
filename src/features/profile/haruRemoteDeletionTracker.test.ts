import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingHaruRemoteDeletion,
  getPendingHaruRemoteDeletion,
  savePendingHaruRemoteDeletion,
} from "@/features/profile/haruRemoteDeletionTracker";

describe("Haru remote deletion tracker", () => {
  beforeEach(() => localStorage.clear());

  it("persists a market-scoped deletion request until completion is confirmed", () => {
    const pending = {
      requestId: "018f0f65-4f93-7cc0-9d41-4e63c8412869",
      market: "jp" as const,
      requestedAt: "2026-08-06T00:00:00.000Z",
    };

    expect(savePendingHaruRemoteDeletion(pending)).toBe(true);
    expect(getPendingHaruRemoteDeletion("jp")).toEqual(pending);
    expect(getPendingHaruRemoteDeletion("kr")).toBeNull();
    expect(clearPendingHaruRemoteDeletion("jp")).toBe(true);
    expect(getPendingHaruRemoteDeletion("jp")).toBeNull();
  });

  it("fails closed for malformed or cross-market stored state", () => {
    localStorage.setItem(
      "haru:jp:privacy:deletion-request",
      JSON.stringify({
        requestId: "not-a-request-id",
        market: "kr",
        requestedAt: "not-a-date",
      }),
    );

    expect(getPendingHaruRemoteDeletion("jp")).toBeNull();
  });
});
