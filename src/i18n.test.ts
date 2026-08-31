import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("i18n deployment default", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("starts a fresh Japanese deployment in Japanese", async () => {
    vi.stubEnv("VITE_DEFAULT_LOCALE", "ja");

    const { default: i18n } = await import("@/i18n");

    await vi.waitFor(() => {
      expect(i18n.resolvedLanguage).toBe("ja");
      expect(document.documentElement.lang).toBe("ja");
    });
  });

  it("keeps an explicit saved language preference", async () => {
    vi.stubEnv("VITE_DEFAULT_LOCALE", "ja");
    localStorage.setItem("memoryGardenLang", "en");

    const { default: i18n } = await import("@/i18n");

    await vi.waitFor(() => {
      expect(i18n.resolvedLanguage).toBe("en");
      expect(document.documentElement.lang).toBe("en");
    });
  });

  it("does not let a saved Korean preference override the Japanese market", async () => {
    vi.stubEnv("VITE_HARU_MARKET", "jp");
    vi.stubEnv("VITE_DEFAULT_LOCALE", "ko");
    localStorage.setItem("memoryGardenLang", "ko");

    const { default: i18n } = await import("@/i18n");

    await vi.waitFor(() => {
      expect(i18n.resolvedLanguage).toBe("ja");
      expect(document.documentElement.lang).toBe("ja");
    });
  });
});
