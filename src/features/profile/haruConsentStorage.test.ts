import { HARU_DEMO_PERSONA } from "@/data/haruDemoPersona";
import {
  HARU_CONSENT_STORAGE_KEY,
  clearHaruConsent,
  getHaruConsent,
  subscribeToHaruConsent,
  updateHaruConsent,
} from "@/features/profile/haruConsentStorage";

const DEFAULT_CONSENT = {
  usageAnalytics: true,
  voiceRecording: HARU_DEMO_PERSONA.consents.voiceRecording,
  sttProcessing: HARU_DEMO_PERSONA.consents.sttProcessing,
  transcriptStorage: true,
  audioStorage: true,
  longitudinalUsageStorage:
    HARU_DEMO_PERSONA.consents.longitudinalUsageStorage,
  personalizedQuestionUse:
    HARU_DEMO_PERSONA.consents.personalizedQuestionUse,
  familySharing: true,
  consentedAt: HARU_DEMO_PERSONA.consents.consentedAt,
  updatedAt: HARU_DEMO_PERSONA.consents.consentedAt,
};

const FAIL_CLOSED_CONSENT = {
  ...DEFAULT_CONSENT,
  usageAnalytics: false,
  voiceRecording: false,
  sttProcessing: false,
  transcriptStorage: false,
  audioStorage: false,
  longitudinalUsageStorage: false,
  personalizedQuestionUse: false,
  familySharing: false,
};

describe("haruConsentStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("starts every real-user permission denied until explicit consent", () => {
    vi.stubEnv("VITE_DEMO_MODE", "0");

    expect(getHaruConsent()).toEqual(
      expect.objectContaining({
        usageAnalytics: false,
        voiceRecording: false,
        sttProcessing: false,
        transcriptStorage: false,
        audioStorage: false,
        longitudinalUsageStorage: false,
        personalizedQuestionUse: false,
        familySharing: false,
      }),
    );
  });

  it("migrates a valid legacy consent record with new permissions denied", () => {
    window.localStorage.setItem(
      HARU_CONSENT_STORAGE_KEY,
      JSON.stringify({
        voiceRecording: true,
        sttProcessing: true,
        longitudinalUsageStorage: true,
        personalizedQuestionUse: true,
        consentedAt: "2026-07-19T05:00:00.000Z",
        updatedAt: "2026-07-19T05:00:00.000Z",
      }),
    );

    expect(getHaruConsent()).toEqual(
      expect.objectContaining({
        usageAnalytics: false,
        transcriptStorage: false,
        audioStorage: false,
        familySharing: false,
      }),
    );
  });

  it("uses persona consent as runtime defaults without persisting a read", () => {
    expect(getHaruConsent()).toEqual(DEFAULT_CONSENT);
    expect(window.localStorage.getItem(HARU_CONSENT_STORAGE_KEY)).toBeNull();
  });

  it("persists a validated full record from a partial permission update", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T01:02:03.000Z"));

    const consent = updateHaruConsent({
      voiceRecording: false,
      personalizedQuestionUse: false,
    });

    expect(consent).toEqual({
      ...DEFAULT_CONSENT,
      voiceRecording: false,
      personalizedQuestionUse: false,
      updatedAt: "2026-07-20T01:02:03.000Z",
    });
    expect(JSON.parse(window.localStorage.getItem(HARU_CONSENT_STORAGE_KEY)!)).toEqual(
      consent,
    );
    expect(getHaruConsent()).toEqual(consent);
  });

  it("advances the consent revision when two updates share one clock tick", () => {
    const now = new Date("2026-07-20T01:02:03.000Z");

    const first = updateHaruConsent({ voiceRecording: false }, now);
    const second = updateHaruConsent({ voiceRecording: true }, now);

    expect(Date.parse(second.updatedAt)).toBeGreaterThan(
      Date.parse(first.updatedAt),
    );
  });

  it("ignores prototype and timestamp fields in partial permission updates", () => {
    const update = JSON.parse(
      '{"voiceRecording":false,"consentedAt":"forged","updatedAt":"forged","__proto__":{"sttProcessing":false}}',
    ) as Record<string, unknown>;

    const consent = updateHaruConsent(update);

    expect(consent.voiceRecording).toBe(false);
    expect(consent.sttProcessing).toBe(true);
    expect(consent.consentedAt).toBe(DEFAULT_CONSENT.consentedAt);
    expect(consent.updatedAt).not.toBe("forged");
    expect(Object.getPrototypeOf(consent)).toBe(Object.prototype);
  });

  it.each([
    "not-json",
    "null",
    "[]",
    '{"voiceRecording":"yes","sttProcessing":true,"longitudinalUsageStorage":true,"personalizedQuestionUse":true,"consentedAt":"2026-07-19T05:00:00.000Z","updatedAt":"2026-07-19T05:00:00.000Z"}',
    '{"voiceRecording":true,"sttProcessing":true,"longitudinalUsageStorage":true,"personalizedQuestionUse":true,"consentedAt":"not-a-date","updatedAt":"2026-07-19T05:00:00.000Z"}',
    '{"voiceRecording":true,"sttProcessing":true,"longitudinalUsageStorage":true,"personalizedQuestionUse":true,"consentedAt":"2026-07-19T05:00:00.000Z"}',
  ])("fails closed for malformed persisted state: %s", (raw) => {
    window.localStorage.setItem(HARU_CONSENT_STORAGE_KEY, raw);

    expect(getHaruConsent()).toEqual(FAIL_CLOSED_CONSENT);
  });

  it("fails closed when consent storage cannot be read", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(getHaruConsent()).toEqual(FAIL_CLOSED_CONSENT);
  });

  it("throws and does not notify subscribers when persistence fails", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToHaruConsent(listener);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    expect(() => updateHaruConsent({ voiceRecording: false })).toThrow(
      "Unable to persist Haru consent",
    );
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("notifies same-tab subscribers after updates and reset", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToHaruConsent(listener);

    updateHaruConsent({ sttProcessing: false });
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ sttProcessing: false }),
    );

    expect(clearHaruConsent()).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(DEFAULT_CONSENT);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(HARU_CONSENT_STORAGE_KEY)).toBeNull();

    unsubscribe();
    updateHaruConsent({ sttProcessing: false });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("returns false and does not emit reset success when clear cannot be verified", () => {
    updateHaruConsent({ voiceRecording: false });
    const listener = vi.fn();
    const unsubscribe = subscribeToHaruConsent(listener);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(clearHaruConsent()).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("refreshes subscribers when another tab changes the consent key", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToHaruConsent(listener);
    const stored = { ...DEFAULT_CONSENT, voiceRecording: false };
    window.localStorage.setItem(HARU_CONSENT_STORAGE_KEY, JSON.stringify(stored));

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: HARU_CONSENT_STORAGE_KEY,
        newValue: JSON.stringify(stored),
      }),
    );

    expect(listener).toHaveBeenCalledWith(stored);
    unsubscribe();
  });

  it("delivers each cross-tab consent revision from the storage event payload", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToHaruConsent(listener);
    const denied = {
      ...DEFAULT_CONSENT,
      voiceRecording: false,
      updatedAt: "2026-07-20T01:00:00.001Z",
    };
    const restored = {
      ...DEFAULT_CONSENT,
      updatedAt: "2026-07-20T01:00:00.002Z",
    };

    // Simulate the receiving tab already exposing the newest persisted value
    // before its queued storage events are delivered.
    window.localStorage.setItem(
      HARU_CONSENT_STORAGE_KEY,
      JSON.stringify(restored),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: HARU_CONSENT_STORAGE_KEY,
        newValue: JSON.stringify(denied),
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: HARU_CONSENT_STORAGE_KEY,
        newValue: JSON.stringify(restored),
      }),
    );

    expect(listener.mock.calls.map(([state]) => state)).toEqual([
      denied,
      restored,
    ]);
    unsubscribe();
  });

  it("fails closed for a malformed cross-tab consent event", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToHaruConsent(listener);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: HARU_CONSENT_STORAGE_KEY,
        newValue: "not-json",
      }),
    );

    expect(listener).toHaveBeenCalledWith(FAIL_CLOSED_CONSENT);
    unsubscribe();
  });
});
