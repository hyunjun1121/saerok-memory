import { describe, expect, it } from "vitest";
import type {
  CaregiverObservationDomain,
  CaregiverObservationRecord,
} from "./caregiverObservationStorage";
import { generateFamilySupportSummary } from "./familySupportSummary";

const now = new Date("2026-01-15T12:00:00.000Z");

function observation(
  id: string,
  daysAgo: number,
  responses: Record<string, string>,
): CaregiverObservationRecord {
  return {
    id,
    createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    selectedDomains: Object.keys(responses) as CaregiverObservationDomain[],
    domainResponses: responses as CaregiverObservationRecord["domainResponses"],
    note: "",
  };
}

describe("generateFamilySupportSummary support-resource gate (SP-09)", () => {
  it("does not offer the support card for a single often-different observation", () => {
    const summary = generateFamilySupportSummary(
      [],
      [],
      [observation("o1", 1, { appointments: "oftenDifferent" })],
      now,
    );
    expect(summary.showSupportResource).toBe(false);
  });

  it("offers the support card only for repeated (>=2) often-different records", () => {
    const summary = generateFamilySupportSummary(
      [],
      [],
      [
        observation("o1", 1, { appointments: "oftenDifferent" }),
        observation("o2", 3, { navigation: "oftenDifferent" }),
      ],
      now,
    );
    expect(summary.showSupportResource).toBe(true);
  });
});
