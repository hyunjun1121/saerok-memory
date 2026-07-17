// Weekday routine theme (SP-06). Gives each day a gentle, non-clinical focus so
// the learner sees "today's routine" instead of a long menu. Domains are broad
// inspirations only — never official test categories or scores.
export type RoutineDayDomain =
  | "attention"
  | "memory"
  | "language"
  | "dailyFlow"
  | "moodSocial"
  | "review";

export interface DailyRoutinePlan {
  domain: RoutineDayDomain;
  nameKey: string;
}

// 0 = Sunday ... 6 = Saturday
const WEEKDAY_PLAN: Record<number, DailyRoutinePlan> = {
  0: { domain: "review", nameKey: "routine.reviewDay" },
  1: { domain: "attention", nameKey: "routine.attentionDay" },
  2: { domain: "memory", nameKey: "routine.memoryDay" },
  3: { domain: "language", nameKey: "routine.languageDay" },
  4: { domain: "dailyFlow", nameKey: "routine.dailyFlowDay" },
  5: { domain: "moodSocial", nameKey: "routine.moodDay" },
  6: { domain: "review", nameKey: "routine.reviewDay" },
};

export function getDailyRoutinePlan(date: Date = new Date()): DailyRoutinePlan {
  return WEEKDAY_PLAN[date.getDay()] ?? { domain: "review", nameKey: "routine.fallback" };
}
