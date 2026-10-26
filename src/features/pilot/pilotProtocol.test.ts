import { describe, expect, it } from 'vitest';
import { haru7DayExercises } from '@/data/haru7DayExercises';
import { PILOT_COPY, PILOT_QUESTIONS, getPilotLanguage } from '@/features/pilot/pilotProtocol';
import { getLocalizedText } from '@/utils/localizedText';

describe('Japan first-meeting protocol', () => {
  it('keeps the approved 12-item sequence, eight fixed follow-ups, and 580-second budget', () => {
    expect(PILOT_QUESTIONS.map((item) => item.kind)).toEqual([
      'choice', 'voice', 'voice', 'choice', 'voice', 'voice',
      'choice', 'voice', 'voice', 'choice', 'voice', 'voice',
    ]);
    expect(new Set(PILOT_QUESTIONS.map((item) => item.id)).size).toBe(12);
    expect(PILOT_QUESTIONS.reduce((total, item) => total + item.targetSeconds, 50)).toBe(580);
    expect(PILOT_QUESTIONS.filter((item) => item.kind === 'choice').map((item) => item.sourceExerciseId))
      .toEqual(['D1_Q1', 'D1_Q4', 'D2_Q4', 'D5_Q5']);
  });

  it('retains the original four-choice order and does not introduce fictional personal facts', () => {
    for (const question of PILOT_QUESTIONS) {
      expect(getLocalizedText(question.prompt, 'ja')).not.toMatch(/春子|昨日.*おっしゃ/);
      if (question.kind === 'choice') {
        expect(question.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
        const source = haru7DayExercises.find((item) => item.id === question.sourceExerciseId);
        expect(question.options).toEqual(source?.payload.options?.map(({ id, label }) => ({ id, label })));
      } else {
        expect(question.informationFields.length).toBeGreaterThan(0);
        expect(getLocalizedText(question.followUp, 'ja')).toBeTruthy();
      }
    }
  });

  it('provides Japanese, Korean, and English text without fallback in all new copy', () => {
    const texts = [...Object.values(PILOT_COPY), ...PILOT_QUESTIONS.flatMap((item) => [
      item.title, item.prompt, item.purpose,
      ...(item.kind === 'voice' ? [item.followUp, ...(item.hint ? [item.hint] : [])] : item.options.map((option) => option.label)),
    ])];
    for (const value of texts) {
      expect(typeof value).toBe('object');
      for (const language of ['ja', 'ko', 'en'] as const) {
        expect(typeof value === 'object' && value[language]?.trim().length).toBeGreaterThan(0);
      }
    }
    expect(getPilotLanguage(null)).toBe('ja');
    expect(getPilotLanguage('ko')).toBe('ko');
  });
});
