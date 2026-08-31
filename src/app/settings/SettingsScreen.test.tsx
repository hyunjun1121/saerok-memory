import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SettingsScreen from "@/app/settings/SettingsScreen";
import { HARU_ADMIN_USAGE_RECORD_STORAGE_KEY } from "@/features/lessons/haruAdminUsageRecordStorage";
import { HARU_DEMO_SESSION_STORAGE_KEY } from "@/features/lessons/haruDemoSessionStorage";
import { getHaruConsent } from "@/features/profile/haruConsentStorage";
import { getLearnerProfile } from "@/features/profile/learnerProfileStorage";
import { STT_JOB_OUTBOX_STORAGE_KEY } from "@/features/speech/sttJobQueue";
import i18n from "@/i18n";

const feedbackMocks = vi.hoisted(() => ({
  playInteractionCue: vi.fn(() => Promise.resolve()),
  stopInteractionCue: vi.fn(),
  playSoftTapTone: vi.fn(),
  playSoftSuccessTone: vi.fn(),
  vibrateLightly: vi.fn(),
  speakCalmly: vi.fn(),
}));

vi.mock("@/hooks/interactionFeedback", () => feedbackMocks);

describe("SettingsScreen data deletion", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    await i18n.changeLanguage("ko");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("deletes routine, safe session, and raw admin records together", async () => {
    localStorage.setItem("cognitiveRoutineResults", "[]");
    localStorage.setItem(HARU_DEMO_SESSION_STORAGE_KEY, "[]");
    localStorage.setItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY, "{}");

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("settings.deleteCognitiveData") }),
    );

    await waitFor(() => {
      expect(localStorage.getItem("cognitiveRoutineResults")).toBeNull();
      expect(localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY)).toBeNull();
    });
  });

  it("removes local metadata and reports retry when audio deletion is blocked", async () => {
    localStorage.setItem("cognitiveRoutineResults", "[]");
    localStorage.setItem(HARU_DEMO_SESSION_STORAGE_KEY, "[]");
    localStorage.setItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY, "{}");
    const request: Partial<IDBOpenDBRequest> = {};
    vi.stubGlobal("indexedDB", {
      deleteDatabase: () => request as IDBOpenDBRequest,
    } as Partial<IDBFactory>);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );
    const deleteButton = screen.getByRole("button", {
      name: i18n.t("settings.deleteCognitiveData"),
    });
    fireEvent.click(deleteButton);
    expect(deleteButton).toBeDisabled();
    await waitFor(() => expect(request.onblocked).toBeTypeOf("function"));
    request.onblocked?.call(
      request as IDBOpenDBRequest,
      new Event("blocked") as IDBVersionChangeEvent,
    );

    await waitFor(() => expect(deleteButton).toBeEnabled());
    expect(localStorage.getItem("cognitiveRoutineResults")).toBeNull();
    expect(localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY)).toBeNull();
    expect(
      screen.getByText(i18n.t("settings.deleteCognitiveDataError")),
    ).toBeInTheDocument();
  });

  it("deletes only pending memory-story work before deleting memory cards", async () => {
    localStorage.setItem("memoryCards", "[]");
    const timestamp = "2026-07-18T00:00:00.000Z";
    localStorage.setItem(
      STT_JOB_OUTBOX_STORAGE_KEY,
      JSON.stringify([
        {
          id: "memory-job",
          objectKey: "haru-stt-job/memory-job",
          target: { kind: "memory-story", memoryCardId: "memory-card" },
          phase: "transcribe",
          attempts: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          nextAttemptAt: 0,
        },
        {
          id: "fluency-job",
          objectKey: "haru-stt-job/fluency-job",
          target: { kind: "verbal-fluency", routineResultId: "routine-one" },
          phase: "transcribe",
          attempts: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          nextAttemptAt: 0,
        },
        {
          id: "repeat-job",
          objectKey: "haru-stt-job/repeat-job",
          target: { kind: "speech-repeat", routineResultId: "routine-two" },
          phase: "transcribe",
          attempts: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          nextAttemptAt: 0,
        },
      ]),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("settings.deleteMemoryCards") }),
    );

    await waitFor(() => {
      expect(localStorage.getItem("memoryCards")).toBeNull();
    });
    expect(
      JSON.parse(localStorage.getItem(STT_JOB_OUTBOX_STORAGE_KEY) ?? "[]"),
    ).toEqual([
      expect.objectContaining({
        target: expect.objectContaining({ kind: "verbal-fluency" }),
      }),
      expect.objectContaining({
        target: expect.objectContaining({ kind: "speech-repeat" }),
      }),
    ]);
    expect(
      screen.getByText(i18n.t("settings.deleteMemoryCardsSuccess")),
    ).toBeInTheDocument();
  });

  it("updates runtime STT consent from an accessible switch", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );
    const sttSwitch = screen.getByRole("switch", {
      name: i18n.t("settings.sttProcessingConsent"),
    });
    expect(sttSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(sttSwitch);

    await waitFor(() => expect(sttSwitch).toHaveAttribute("aria-checked", "false"));
    expect(getHaruConsent().sttProcessing).toBe(false);
    expect(
      screen.getByText(i18n.t("settings.privacyUpdateSuccess")),
    ).toBeInTheDocument();
  });

  it("shows independent controls for every optional data use", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );

    const labels = [
      "settings.usageAnalyticsConsent",
      "settings.voiceRecordingConsent",
      "settings.sttProcessingConsent",
      "settings.transcriptStorageConsent",
      "settings.audioStorageConsent",
      "settings.longitudinalConsent",
      "settings.personalizationConsent",
      "settings.familySharingConsent",
    ] as const;
    for (const label of labels) {
      expect(
        screen.getByRole("switch", { name: i18n.t(label) }),
      ).toBeInTheDocument();
    }
  });

  it("redeems an eight-character participant code and sends current consent", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            participantId: "123e4567-e89b-42d3-a456-426614174000",
            market: "kr",
            locale: "ko-KR",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: i18n.t("settings.enrollmentCodeLabel") }),
      { target: { value: "abcd2345" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("settings.enrollmentConnect") }),
    );

    expect(
      await screen.findByText(i18n.t("settings.enrollmentConnected")),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/enrollment/v1/redeem",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/privacy/v1/consents",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("requires a second explicit press before deleting all local data", async () => {
    localStorage.setItem("memoryCards", "[]");
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("settings.deleteAllData") }),
    );
    expect(localStorage.getItem("memoryCards")).toBe("[]");

    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("settings.deleteAllDataConfirm"),
      }),
    );
    await waitFor(() => expect(localStorage.getItem("memoryCards")).toBeNull());
    expect(
      await screen.findByText(i18n.t("settings.deleteAllDataLocalSuccess")),
    ).toBeInTheDocument();
  });

  it("keeps deletion credentials until the server confirms completion", async () => {
    const requestId = "018f0f65-4f93-7cc0-9d41-4e63c8412869";
    localStorage.setItem(
      "haru:kr:enrollment",
      JSON.stringify({
        participantId: "123e4567-e89b-42d3-a456-426614174000",
        market: "kr",
        locale: "ko-KR",
        enrolledAt: "2026-08-06T00:00:00.000Z",
      }),
    );
    localStorage.setItem(
      "haru:kr:privacy:deletion-request",
      JSON.stringify({
        requestId,
        market: "kr",
        requestedAt: "2026-08-06T00:00:00.000Z",
      }),
    );
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId,
          status: "completed",
          requestedAt: "2026-08-06T00:00:00.000Z",
          completedAt: "2026-08-06T00:00:02.000Z",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(i18n.t("settings.deleteAllDataCompleted")),
    ).toBeInTheDocument();
    expect(localStorage.getItem("haru:kr:privacy:deletion-request")).toBeNull();
    expect(localStorage.getItem("haru:kr:enrollment")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/privacy/v1/deletions/${requestId}`,
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
  });
});

describe("SettingsScreen sound feedback", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    await i18n.changeLanguage("ko");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists sound feedback from a large accessible switch", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );
    const soundSwitch = screen.getByRole("switch", {
      name: i18n.t("settings.soundFeedback"),
    });

    expect(soundSwitch).toHaveAttribute("aria-checked", "true");
    expect(soundSwitch.className).toContain("min-h-[56px]");

    fireEvent.click(soundSwitch);

    expect(soundSwitch).toHaveAttribute("aria-checked", "false");
    expect(getLearnerProfile().soundFeedbackEnabled).toBe(false);
    expect(feedbackMocks.stopInteractionCue).toHaveBeenCalledTimes(1);
    expect(feedbackMocks.playInteractionCue).not.toHaveBeenCalled();
  });

  it("plays one preview after sound feedback is enabled again", () => {
    localStorage.setItem(
      "learnerProfile",
      JSON.stringify({ soundFeedbackEnabled: false }),
    );
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );
    const soundSwitch = screen.getByRole("switch", {
      name: i18n.t("settings.soundFeedback"),
    });

    fireEvent.click(soundSwitch);

    expect(soundSwitch).toHaveAttribute("aria-checked", "true");
    expect(getLearnerProfile().soundFeedbackEnabled).toBe(true);
    expect(feedbackMocks.playInteractionCue).toHaveBeenCalledWith("select");
  });

  it("keeps the displayed and effective setting unchanged when persistence fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    });
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsScreen />
      </MemoryRouter>,
    );
    const soundSwitch = screen.getByRole("switch", {
      name: i18n.t("settings.soundFeedback"),
    });

    fireEvent.click(soundSwitch);

    expect(soundSwitch).toHaveAttribute("aria-checked", "true");
    expect(getLearnerProfile().soundFeedbackEnabled).toBe(true);
    expect(feedbackMocks.stopInteractionCue).not.toHaveBeenCalled();
    expect(feedbackMocks.playInteractionCue).not.toHaveBeenCalled();
  });
});
