import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCaregiverObservationRecords,
  getCaregiverObservationRecords,
  saveCaregiverObservationRecord,
} from "./caregiverObservationStorage";

describe("caregiverObservationStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves caregiver observation records with selected domains and notes", () => {
    const saved = saveCaregiverObservationRecord({
      domainResponses: {
        appointments: "occasionallyDifferent",
        conversation: "aboutSame",
        navigation: "oftenDifferent",
        sleepAppetite: "notSure",
      },
      note: "약속 확인이 조금 늘었습니다.",
    });

    const records = getCaregiverObservationRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(
      expect.objectContaining({
        id: saved.id,
        selectedDomains: ["appointments", "navigation", "sleepAppetite"],
        domainResponses: {
          appointments: "occasionallyDifferent",
          conversation: "aboutSame",
          navigation: "oftenDifferent",
          sleepAppetite: "notSure",
        },
        note: "약속 확인이 조금 늘었습니다.",
      }),
    );
  });

  it("keeps legacy selected domains when older records do not have response data", () => {
    localStorage.setItem(
      "caregiverObservationRecords",
      JSON.stringify([
        {
          id: "legacy",
          createdAt: "2026-01-01T00:00:00.000Z",
          selectedDomains: ["dailyRoutine", "bad"],
          note: "legacy note",
        },
      ]),
    );

    expect(getCaregiverObservationRecords()).toEqual([
      expect.objectContaining({
        id: "legacy",
        selectedDomains: ["dailyRoutine"],
        domainResponses: {},
      }),
    ]);
  });

  it("ignores malformed localStorage data instead of throwing", () => {
    localStorage.setItem("caregiverObservationRecords", "{bad json");

    expect(getCaregiverObservationRecords()).toEqual([]);
  });

  it("clears caregiver observation records", () => {
    saveCaregiverObservationRecord({
      domainResponses: {
        dailyRoutine: "notSure",
      },
      note: "",
    });

    clearCaregiverObservationRecords();

    expect(getCaregiverObservationRecords()).toEqual([]);
  });
});
