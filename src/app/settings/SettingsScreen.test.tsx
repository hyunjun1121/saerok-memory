import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SettingsScreen from "@/app/settings/SettingsScreen";
import { HARU_ADMIN_USAGE_RECORD_STORAGE_KEY } from "@/features/lessons/haruAdminUsageRecordStorage";
import { HARU_DEMO_SESSION_STORAGE_KEY } from "@/features/lessons/haruDemoSessionStorage";
import { getHaruConsent } from "@/features/profile/haruConsentStorage";
import { STT_JOB_OUTBOX_STORAGE_KEY } from "@/features/speech/sttJobQueue";
import i18n from "@/i18n";

describe("SettingsScreen data deletion", () => {
  beforeEach(async () => {
    localStorage.clear();
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
});
