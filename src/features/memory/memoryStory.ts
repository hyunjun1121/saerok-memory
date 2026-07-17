import type { MemoryStoryCues } from "@/features/memory/types";

const PEOPLE_CUES = [
  "딸", "아들", "배우자", "남편", "아내", "손자", "손녀", "친구", "동료", "가족", "어머니", "아버지",
  "娘", "息子", "配偶者", "夫", "妻", "孫", "友だち", "友達", "同僚", "家族", "母", "父",
  "daughter", "son", "spouse", "husband", "wife", "grandchild", "friend", "family", "mother", "father",
];
const PLACE_CUES = [
  "집", "병원", "공원", "시장", "식당", "학교", "회사", "고향", "교회", "성당", "절", "여행지", "국밥집", "카페",
  "家", "病院", "公園", "市場", "食堂", "学校", "会社", "故郷", "教会", "寺", "旅行先", "カフェ",
  "home", "hospital", "park", "market", "restaurant", "school", "office", "hometown", "cafe",
];
const OBJECT_CUES = [
  "우산", "사진", "편지", "꽃", "약", "지갑", "가방", "버스", "기차", "비행기", "자동차", "국밥", "커피",
  "傘", "写真", "手紙", "花", "薬", "財布", "かばん", "バッグ", "バス", "電車", "飛行機", "車", "コーヒー",
  "umbrella", "photo", "letter", "flower", "medicine", "wallet", "bag", "bus", "train", "airplane", "car", "coffee",
];
const EMOTION_CUES = [
  "고마움", "기쁨", "뿌듯함", "편안함", "걱정", "아쉬움", "슬픔", "놀라움", "미안함",
  "ありがたさ", "うれしさ", "誇らしさ", "安心", "心配", "残念", "悲しさ", "驚き", "申し訳なさ",
  "gratitude", "joy", "pride", "relief", "worry", "sadness", "surprise",
];
const TIME_CUES = [
  "오늘", "어제", "지난주", "지난달", "작년", "봄", "여름", "가을", "겨울", "명절", "생일", "비 오는 날",
  "今日", "昨日", "先週", "先月", "去年", "春", "夏", "秋", "冬", "祝日", "誕生日", "雨の日",
  "today", "yesterday", "last week", "last month", "last year", "spring", "summer", "fall", "winter", "birthday",
];

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
