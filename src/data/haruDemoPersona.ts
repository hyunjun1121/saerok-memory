import type { LocalizedText } from "@/utils/localizedText";

const localized = (ko: string, ja: string, en: string): LocalizedText => ({ ko, ja, en });

export const HARU_DEMO_PERSONA = {
  name: localized("박영자", "佐藤春子", "Young-ja Park"),
  displayName: localized("박영자 어르신", "佐藤春子さん", "Ms. Park Young-ja"),
  birthYear: 1952,
  age: 74,
  residence: localized(
    "대전광역시 유성구",
    "東京都練馬区",
    "Yuseong-gu, Daejeon",
  ),
  livingArrangement: localized(
    "혼자 거주하며 딸이 가까이 살고 있음",
    "一人暮らしで、娘が近くに住んでいる",
    "Lives alone, with her daughter nearby",
  ),
  speechProfileNote: localized(
    "말속도가 비교적 느리고, 짧은 문장 사이에 쉼이 있음",
    "話す速度は比較的ゆっくりで、短い文の間に間がある",
    "Speaks relatively slowly, with pauses between short sentences",
  ),
  gender: localized("여성", "女性", "Woman"),
  registeredProfileFields: {
    hometown: localized("부산 영도", "長野県松本市", "Yeongdo, Busan"),
    elementarySchool: localized("청학초등학교", "松本市立開智小学校", "Cheonghak Elementary School"),
    formerOccupation: localized(
      "초등학교 급식 조리사",
      "小学校の給食調理員",
      "Elementary school cafeteria cook",
    ),
    daughterName: localized("김민지", "佐藤由美", "Kim Min-ji"),
    grandsonName: localized("김준호", "佐藤健太", "Kim Jun-ho"),
    closeFriendName: localized("이순자", "田中和子", "Lee Soon-ja"),
    neighborName: localized("최정희", "鈴木恵子", "Choi Jeong-hee"),
    favoriteFood: localized("된장찌개", "肉じゃが", "Soybean paste stew"),
    medicationTime: localized("오전 8시", "午前8時", "8:00 a.m."),
  },
  consents: {
    voiceRecording: true,
    sttProcessing: true,
    longitudinalUsageStorage: true,
    personalizedQuestionUse: true,
    consentedAt: "2026-07-19T14:00:00+09:00",
  },
  isSynthetic: true,
  contentMode: "scripted_synthetic_week",
  hasFamilySharingConsent: false,
} as const satisfies {
  name: LocalizedText;
  displayName: LocalizedText;
  birthYear: number;
  age: number;
  residence: LocalizedText;
  livingArrangement: LocalizedText;
  speechProfileNote: LocalizedText;
  gender: LocalizedText;
  registeredProfileFields: Record<string, LocalizedText>;
  consents: {
    voiceRecording: true;
    sttProcessing: true;
    longitudinalUsageStorage: true;
    personalizedQuestionUse: true;
    consentedAt: string;
  };
  isSynthetic: true;
  contentMode: "scripted_synthetic_week";
  hasFamilySharingConsent: false;
};
