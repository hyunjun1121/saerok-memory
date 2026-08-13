export type SupportedLanguage = "ko" | "ja" | "en";

export type LocalizedText = string | Partial<Record<SupportedLanguage, string>>;

export function normalizeLanguage(language?: string): SupportedLanguage {
  const baseLanguage = language?.split("-")[0];

  if (baseLanguage === "ja" || baseLanguage === "en") {
    return baseLanguage;
  }

  return "ko";
}

export function getLocalizedText(value: LocalizedText | undefined, language?: string): string {
  if (!value) return "";
  if (typeof value === "string") return value;

  const normalizedLanguage = normalizeLanguage(language);
  return value[normalizedLanguage] ?? value.ko ?? value.en ?? value.ja ?? "";
}

export function getSpeechLanguage(language?: string): string {
  const normalizedLanguage = normalizeLanguage(language);

  if (normalizedLanguage === "ja") return "ja-JP";
  if (normalizedLanguage === "en") return "en-US";
  return "ko-KR";
}
