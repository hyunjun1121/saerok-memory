import type { SupportedLanguage } from "@/utils/localizedText";

export type MarketCode = "kr" | "jp" | "en";

export interface MarketConfig {
  market: MarketCode;
  language: Extract<SupportedLanguage, "ko" | "ja" | "en">;
  locale: "ko-KR" | "ja-JP" | "en-US";
  timeZone: "Asia/Seoul" | "Asia/Tokyo" | "America/New_York";
  currency: "KRW" | "JPY" | "USD";
  speechLanguage: "ko-KR" | "ja-JP" | "en-US";
  contentPackVersion: string;
  lockedLanguage: true;
}

const MARKET_CONFIGS: Record<MarketCode, MarketConfig> = {
  kr: {
    market: "kr",
    language: "ko",
    locale: "ko-KR",
    timeZone: "Asia/Seoul",
    currency: "KRW",
    speechLanguage: "ko-KR",
    contentPackVersion: "kr-2026.08",
    lockedLanguage: true,
  },
  jp: {
    market: "jp",
    language: "ja",
    locale: "ja-JP",
    timeZone: "Asia/Tokyo",
    currency: "JPY",
    speechLanguage: "ja-JP",
    contentPackVersion: "jp-2026.08",
    lockedLanguage: true,
  },
  en: {
    market: "en",
    language: "en",
    locale: "en-US",
    timeZone: "America/New_York",
    currency: "USD",
    speechLanguage: "en-US",
    contentPackVersion: "en-2026.09",
    lockedLanguage: true,
  },
};

export function normalizeMarket(value?: string | null): MarketCode {
  const market = value?.trim().toLowerCase();
  if (market === "jp") return "jp";
  if (market === "en") return "en";
  return "kr";
}

export function getMarketConfig(market: MarketCode): MarketConfig {
  return MARKET_CONFIGS[market];
}

export function getRuntimeMarketConfig(): MarketConfig {
  return getMarketConfig(normalizeMarket(import.meta.env.VITE_HARU_MARKET));
}

export function hasConfiguredMarket(): boolean {
  return ["kr", "jp", "en"].includes(import.meta.env.VITE_HARU_MARKET ?? "");
}

export function isDeploymentLanguageLocked(): boolean {
  return hasConfiguredMarket() && import.meta.env.VITE_ALLOW_LANGUAGE_SWITCH !== "1";
}

export function getMarketStorageKey(baseKey: string, market: MarketCode): string {
  return `haru:${market}:${baseKey}`;
}
