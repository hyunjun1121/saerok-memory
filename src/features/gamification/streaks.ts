export interface StreakState {
  currentStreak: number;
  lastSessionDate: string | null;
  longestStreak: number;
}

function normalizeDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calculateDaysDifference(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);

  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function updateStreak(currentState: StreakState, todayDateInput: string | Date = new Date()): StreakState {
  const today = normalizeDate(todayDateInput);

  if (!currentState.lastSessionDate) {
    return {
      currentStreak: 1,
      lastSessionDate: today,
      longestStreak: 1
    };
  }

  const lastSession = normalizeDate(currentState.lastSessionDate);
  const diffDays = calculateDaysDifference(lastSession, today);

  let newStreak = currentState.currentStreak;

  if (diffDays === 0) {
    return currentState;
  } else if (diffDays === 1) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  return {
    currentStreak: newStreak,
    lastSessionDate: today,
    longestStreak: Math.max(currentState.longestStreak, newStreak)
  };
}
