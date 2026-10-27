// Version 2 has literal Japanese/Korean translations in its own protocol.
// Do not apply the version 1 catalog's currency/proverb overrides to reused IDs.
export function pilotKoreanQuestionCopy(question, local, option) {
  return local(option ? option.label : question.prompt, 'ko');
}
