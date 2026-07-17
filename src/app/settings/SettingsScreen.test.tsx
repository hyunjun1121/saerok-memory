import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SettingsScreen from "@/app/settings/SettingsScreen";
import { HARU_ADMIN_USAGE_RECORD_STORAGE_KEY } from "@/features/lessons/haruAdminUsageRecordStorage";
import { HARU_DEMO_SESSION_STORAGE_KEY } from "@/features/lessons/haruDemoSessionStorage";
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
      <MemoryRouter>
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

  it("keeps every linked record when audio deletion is blocked", async () => {
    localStorage.setItem("cognitiveRoutineResults", "[]");
    localStorage.setItem(HARU_DEMO_SESSION_STORAGE_KEY, "[]");
    localStorage.setItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY, "{}");
    const request: Partial<IDBOpenDBRequest> = {};
    vi.stubGlobal("indexedDB", {
      deleteDatabase: () => request as IDBOpenDBRequest,
    } as Partial<IDBFactory>);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );
    const deleteButton = screen.getByRole("button", {
      name: i18n.t("settings.deleteCognitiveData"),
    });
    fireEvent.click(deleteButton);
    expect(deleteButton).toBeDisabled();
    request.onblocked?.call(
      request as IDBOpenDBRequest,
      new Event("blocked") as IDBVersionChangeEvent,
    );

    await waitFor(() => expect(deleteButton).toBeEnabled());
    expect(localStorage.getItem("cognitiveRoutineResults")).toBe("[]");
    expect(localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY)).toBe("[]");
    expect(localStorage.getItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY)).toBe("{}");
  });
});
