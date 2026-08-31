import { describe, expect, it } from "vitest";
import {
  resolveInitialLanguage,
  syncDocumentLanguage,
} from "@/i18nLanguage";

describe("resolveInitialLanguage", () => {
  it("uses the configured Japanese default when the new origin has no saved language", () => {
    expect(resolveInitialLanguage(null, "ja")).toBe("ja");
  });

  it("preserves an explicit saved preference before the configured default", () => {
    expect(resolveInitialLanguage("en-US", "ja")).toBe("en");
  });

  it("ignores unsupported saved values and uses the configured default", () => {
    expect(resolveInitialLanguage("unsupported", "ja-JP")).toBe("ja");
  });

  it("keeps Korean as the normal multilingual default", () => {
    expect(resolveInitialLanguage(null, undefined)).toBe("ko");
  });

  it("ignores saved preferences when a deployment market is locked", () => {
    expect(resolveInitialLanguage("ko", "ko", "jp")).toBe("ja");
    expect(resolveInitialLanguage("ja", "ja", "kr")).toBe("ko");
  });
});

describe("syncDocumentLanguage", () => {
  it("updates the document language for assistive technology", () => {
    syncDocumentLanguage("ja-JP");

    expect(document.documentElement.lang).toBe("ja");
  });
});
