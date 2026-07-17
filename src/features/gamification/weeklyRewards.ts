import type { RoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import { readJson, writeJson, removeKey } from "@/utils/safeStorage";

// Weekly participation rewards (SP-07). Rewards are tied to *participation*
// (days completed), never to cognitive scores, and there is no public
// leaderboard. The catalog is a data structure only; actual physical reward
// fulfillment at welfare centers is out of MVP scope.

const STATE_KEY = "weeklyRewardState";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;

export type RewardMode = "personal" | "welfare";

export interface RewardCatalogItem {
  id: string;
  titleKey: string;
  descriptionKey: string;
  mode: RewardMode;
}

// MVP catalog. Welfare-mode items are decided/stocked by the operating
// organization; the app only surfaces the structure, never invents inventory.
export const REWARD_CATALOG: RewardCatalogItem[] = [
  {
    id: "garden_sticker",
    titleKey: "weekly.catalog.stickerTitle",
    descriptionKey: "weekly.catalog.stickerBody",
    mode: "personal",
  },
  {
    id: "welfare_coupon",
    titleKey: "weekly.catalog.couponTitle",
    descriptionKey: "weekly.catalog.couponBody",
    mode: "welfare",
  },
  {
    id: "praise_card",
    titleKey: "weekly.catalog.praiseTitle",
    descriptionKey: "weekly.catalog.praiseBody",
    mode: "personal",
  },
];

export interface WeeklyRewardState {
  weekStartDate: string;
  completedDays: string[];
  claimedRewardIds: string[];
}

function defaultState(now: Date): WeeklyRewardState {
  return {
    weekStartDate: now.toISOString(),
    completedDays: [],
    claimedRewardIds: [],
  };
}

export function getWeeklyRewardState(now: Date = new Date()): WeeklyRewardState {
  return readJson<WeeklyRewardState>(STATE_KEY, defaultState(now));
}

export function resetWeeklyRewardState(): void {
  removeKey(STATE_KEY);
}

// Distinct calendar days (YYYY-MM-DD) with at least one completed routine in
// the last 7 days. Participation-based, score-free.
export function getCompletedDaysThisWeek(
  results: RoutineResult[],
  now: Date = new Date(),
): string[] {
  const nowMs = now.getTime();
  const windowStart = nowMs - WINDOW_DAYS * ONE_DAY_MS;
  const days = new Set<string>();

  results.forEach((result) => {
    if (!result.completed) return;
    const ts = new Date(result.timestamp).getTime();
    if (Number.isNaN(ts) || ts > nowMs || ts < windowStart) return;
    days.add(result.timestamp.slice(0, 10));
  });

  return Array.from(days);
}

// Record today's completion (idempotent). Returns the updated state.
export function recordWeeklyCompletion(now: Date = new Date()): WeeklyRewardState {
  const state = getWeeklyRewardState(now);
  const today = now.toISOString().slice(0, 10);
  if (!state.completedDays.includes(today)) {
    state.completedDays = [...state.completedDays, today];
  }
  writeJson(STATE_KEY, state);
  return state;
}
