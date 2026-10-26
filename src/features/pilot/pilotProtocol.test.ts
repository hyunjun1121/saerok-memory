import { describe, expect, it } from 'vitest';
import { PILOT_COPY, PILOT_QUESTIONS, PILOT_PROTOCOL_VERSION, buildPilotQuestions, getPilotLanguage } from '@/features/pilot/pilotProtocol';
import { getLocalizedText } from '@/utils/localizedText';

describe('Japan first-meeting protocol', () => {
  it('uses the final nine-question sequence and an approximately ten-minute budget', () => {
    expect(PILOT_QUESTIONS.map((item) => item.kind)).toEqual([
      'choice', 'choice', 'choice', 'choice', 'voice', 'voice', 'voice', 'voice', 'voice',
    ]);
    expect(new Set(PILOT_QUESTIONS.map((item) => item.id)).size).toBe(9);
    expect(PILOT_QUESTIONS.reduce((total, item) => total + item.targetSeconds, 50)).toBe(590);
    expect(PILOT_PROTOCOL_VERSION).toBe('jp-first-meeting-2.0');
    expect(PILOT_QUESTIONS.slice(1, 4).map(item => item.kind === 'choice' && item.correctOptionId)).toEqual(['B', 'C', 'C']);
  });

  it('preserves the supplied wording and fixed choices, with optional short-answer follow-ups', () => {
    for (const question of PILOT_QUESTIONS) {
      expect(getLocalizedText(question.prompt, 'ja')).not.toMatch(/春子|昨日.*おっしゃ/);
      if (question.kind === 'choice') {
        expect(question.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
      } else {
        expect(question.informationFields.length).toBeGreaterThan(0);
        expect(getLocalizedText(question.followUp, 'ja')).toBeTruthy();
        expect(question.followUpPolicy).toBe('short-answer-only');
      }
    }
    expect(getLocalizedText(PILOT_QUESTIONS[0].prompt, 'ja')).toBe('今日は何曜日ですか？');
    expect(getLocalizedText(PILOT_QUESTIONS[4].prompt, 'ja')).toBe('子どものころは、どんなところに住んでいましたか？ その町での思い出を聞かせてください。');
    expect(getLocalizedText(PILOT_QUESTIONS[6].prompt, 'ja')).toBe('ご家族と過ごした時間の中で、一番幸せだった思い出を聞かせてください。');
    const apples = PILOT_QUESTIONS[1];
    expect(apples.kind === 'choice' && apples.options.map(option => getLocalizedText(option.label, 'ja'))).toEqual(['440円', '480円', '520円', '400円']);
  });

  it('includes the actual Japan weekday exactly once on all seven days and randomizes positions', () => {
    let seed = 12345;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 0x100000000);
    const positions = new Set();
    for (let day = 0; day < 7; day++) {
      for (let trial = 0; trial < 20; trial++) {
        const questions = buildPilotQuestions(new Date(`2026-10-${25 + day}T12:00:00+09:00`), random);
        const first = questions[0];
        if (first.kind !== 'choice') throw new Error('Q1 must be a choice');
        expect(new Set(first.options.map(option => option.weekday)).size).toBe(4);
        expect(first.options.filter(option => option.weekday === day)).toHaveLength(1);
        expect(first.options.find(option => option.id === first.correctOptionId)?.weekday).toBe(day);
        expect(first.dateContext?.correctWeekday).toBe(day);
        expect(questions.slice(1)).toEqual(PILOT_QUESTIONS.slice(1));
        positions.add(first.correctOptionId);
      }
    }
    expect(positions.size).toBe(4);
  });

  it('uses Tokyo midnight even when the computer is on another date', () => {
    const before = buildPilotQuestions(new Date('2026-10-25T14:59:59Z'))[0];
    const after = buildPilotQuestions(new Date('2026-10-25T15:00:00Z'))[0];
    expect(before.kind === 'choice' && before.dateContext).toMatchObject({ localDate: '2026-10-25', correctWeekday: 0, timeZone: 'Asia/Tokyo' });
    expect(after.kind === 'choice' && after.dateContext).toMatchObject({ localDate: '2026-10-26', correctWeekday: 1 });
    expect(PILOT_QUESTIONS[0].kind === 'choice' && PILOT_QUESTIONS[0].correctOptionId).toBeNull();
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
