// Documents explain the Japanese field protocol in Korean. The normal Korean
// catalog uses different currency/proverbs, so it is not a literal translation.
const japaneseChoiceTranslations = {
  JP_PILOT_Q04: {
    prompt: '두부 150엔과 달걀 250엔을 사고 500엔을 냈습니다. 거스름돈은 얼마인가요?',
    options: { A: '0엔', B: '50엔', C: '100엔', D: '150엔' },
  },
  JP_PILOT_Q07: {
    prompt: "속담 ‘웃는 집에는’ 뒤에 이어지는 말은 무엇인가요?",
    options: { A: '복이 온다', B: '발걸음이 가벼워진다', C: '밥이 맛있어진다', D: '길이 열린다' },
  },
};

export function pilotKoreanQuestionCopy(question, local, option) {
  const translation = japaneseChoiceTranslations[question.id];
  return option ? translation?.options[option.id] ?? local(option.label, 'ko')
    : translation?.prompt ?? local(question.prompt, 'ko');
}
