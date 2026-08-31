import type { SupportedLanguage } from "@/utils/localizedText";
import { getMarketConfig, type MarketCode } from "@/config/market";

const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>(["ko", "ja", "en"]);

function toSupportedLanguage(value?: string | null): SupportedLanguage | null {
  const normalized = value?.trim().toLowerCase().split(/[-_]/)[0];

  return normalized && SUPPORTED_LANGUAGES.has(normalized as SupportedLanguage)
    ? (normalized as SupportedLanguage)
    : null;
}

export function resolveInitialLanguage(
  savedLanguage?: string | null,
  configuredDefault?: string | null,
  deploymentMarket?: MarketCode | null,
): SupportedLanguage {
  if (deploymentMarket) return getMarketConfig(deploymentMarket).language;
  return (
    toSupportedLanguage(savedLanguage) ??
    toSupportedLanguage(configuredDefault) ??
    "ko"
  );
}

export function syncDocumentLanguage(language?: string | null): void {
  if (typeof document === "undefined") return;

  document.documentElement.lang = toSupportedLanguage(language) ?? "ko";
}
