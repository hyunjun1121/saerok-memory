import type { SupportedLanguage } from "@/utils/localizedText";

export type MarketCode = "kr" | "jp";

export interface MarketConfig {
  market: MarketCode;
  language: Extract<SupportedLanguage, "ko" | "ja">;
  locale: "ko-KR" | "ja-JP";
  timeZone: "Asia/Seoul" | "Asia/Tokyo";
  currency: "KRW" | "JPY";
  speechLanguage: "ko-KR" | "ja-JP";
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
};

export function normalizeMarket(value?: string | null): MarketCode {
  return value?.trim().toLowerCase() === "jp" ? "jp" : "kr";
}

export function getMarketConfig(market: MarketCode): MarketConfig {
  return MARKET_CONFIGS[market];
}

export function getRuntimeMarketConfig(): MarketConfig {
  return getMarketConfig(normalizeMarket(import.meta.env.VITE_HARU_MARKET));
}

export function hasConfiguredMarket(): boolean {
  return import.meta.env.VITE_HARU_MARKET === "kr" || import.meta.env.VITE_HARU_MARKET === "jp";
}

export function isDeploymentLanguageLocked(): boolean {
  return hasConfiguredMarket() && import.meta.env.VITE_ALLOW_LANGUAGE_SWITCH !== "1";
}

export function getMarketStorageKey(baseKey: string, market: MarketCode): string {
  return `haru:${market}:${baseKey}`;
}
