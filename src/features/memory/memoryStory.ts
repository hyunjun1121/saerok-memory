import type { MemoryStoryCues } from "./types";

const PEOPLE_CUES = ["딸", "아들", "배우자", "남편", "아내", "손자", "손녀", "친구", "동료", "가족", "어머니", "아버지"];
const PLACE_CUES = ["집", "병원", "공원", "시장", "식당", "학교", "회사", "고향", "교회", "성당", "절", "여행지", "국밥집", "카페"];
const OBJECT_CUES = ["우산", "사진", "편지", "꽃", "약", "지갑", "가방", "버스", "기차", "비행기", "자동차", "국밥", "커피"];
const EMOTION_CUES = ["고마움", "기쁨", "뿌듯함", "편안함", "걱정", "아쉬움", "슬픔", "놀라움", "미안함"];
const TIME_CUES = ["오늘", "어제", "지난주", "지난달", "작년", "봄", "여름", "가을", "겨울", "명절", "생일", "비 오는 날"];

function uniqueMatches(text: string, candidates: string[]) {
  return candidates.filter((cue, index) => text.includes(cue) && candidates.indexOf(cue) === index);
}

export function normalizeMemoryStory(rawText: string) {
  return rawText.replace(/\s+/g, " ").trim();
}

export function summarizeMemoryStory(rawText: string, maxLength = 72) {
  const text = normalizeMemoryStory(rawText);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export function extractMemoryStoryCues(rawText: string): MemoryStoryCues {
  const text = normalizeMemoryStory(rawText);

  return {
    people: uniqueMatches(text, PEOPLE_CUES),
    places: uniqueMatches(text, PLACE_CUES),
    objects: uniqueMatches(text, OBJECT_CUES),
    emotions: uniqueMatches(text, EMOTION_CUES),
    timeHints: uniqueMatches(text, TIME_CUES),
  };
}
