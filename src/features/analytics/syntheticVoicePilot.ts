import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
  haru7DayExercises,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import type { Exercise } from "@/data/mockExercises";
import type {
  HaruAdminQuestionRecord,
  HaruAdminUsageRecord,
  HaruAdminUsageSession,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import {
  resolveHaruExercise,
  type ResolvedHaruExercise,
} from "@/features/lessons/haruLivePersonalization";
import type {
  HaruDemoResponse,
  HaruDemoSession,
  HaruPersonalizationKind,
} from "@/features/lessons/haruDemoSessionStorage";
import type { HaruDerivedAnnotation } from "@/features/lessons/haruResponseFacts";
import type {
  TelemetryEnvelope,
  TelemetryEventName,
  TelemetryPayloadMap,
} from "@/features/analytics/types";
import { getLocalizedText } from "@/utils/localizedText";

export const SYNTHETIC_VOICE_PILOT_SEED = "haru-voice-pilot-2026-08-06-v1";

const GENERATED_AT = "2026-08-06T09:00:00+09:00";
const CONTENT_PACK_VERSION = "haru-kr-2026.08-pilot";
const APP_VERSION = "haru-voice-pilot-sample-1.0.0";
const ADMIN_SCHEMA_VERSION = "1.0.0" as const;
const PILOT_SCHEMA_VERSION = "1.0.0" as const;
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly HaruWeekDay[];
const BUTTONS = ["A", "B", "C", "D"] as const;
const BUTTON_LAYOUT = {
  A: { position: "왼쪽 위", color: "빨강" },
  B: { position: "오른쪽 위", color: "노랑" },
  C: { position: "왼쪽 아래", color: "초록" },
  D: { position: "오른쪽 아래", color: "파랑" },
} as const;

export type VoiceExperienceVariant = "baseline_v1" | "assist_v2";

export interface MatchedPilotProfile {
  ageAtStart: number;
  nonVoicePaceMs: number;
  nonVoiceAccuracyRate: number;
  selectionChangeRate: number;
  voiceChallengeBand: "low" | "medium" | "high";
  routineStartHour: number;
}

export interface SyntheticPilotParticipant {
  participantId: string;
  pairId: string;
  voiceExperienceVariant: VoiceExperienceVariant;
  displayName: string;
  birthYear: number;
  ageAtStart: number;
  gender: "여성" | "남성";
  residence: string;
  livingArrangementCode: "alone_family_nearby" | "with_spouse" | "with_family";
  matchedProfile: MatchedPilotProfile;
}

export interface SyntheticConsentReceipt {
  receiptId: string;
  participantId: string;
  revision: string;
  recordedAt: string;
  source: "sample_dataset_setup";
  grants: {
    usageAnalytics: true;
    longitudinalActivity: true;
    voiceCapture: true;
    sttProcessing: true;
    transcriptStorage: true;
    audioStorage: false;
    personalization: true;
    familySharing: false;
  };
}

export interface SyntheticRoutineSession {
  sessionId: string;
  participantId: string;
  pairId: string;
  voiceExperienceVariant: VoiceExperienceVariant;
  day: HaruWeekDay;
  sessionDate: string;
  state: "completed" | "abandoned";
  startedAt: string;
  endedAt: string;
  progressPercent: number;
  activeDurationMs: number;
  wallDurationMs: number;
  plannedQuestionCount: 6;
  presentedQuestionCount: number;
  completedQuestionCount: number;
  lastQuestionInstanceId: string;
  dropoutCause: "voice_step" | null;
  returnedNextDay: boolean;
}

export interface SyntheticAttemptResponse {
  selectedOptionIds?: string[];
  sequenceIds?: string[];
  isCorrect?: boolean;
  isValid: boolean;
  retryCount: number;
  hintCount: number;
  skipReason?: "voice_step_exit";
}

export interface SyntheticQuestionAttempt {
  participantId: string;
  pairId: string;
  voiceExperienceVariant: VoiceExperienceVariant;
  sessionId: string;
  questionInstanceId: string;
  questionId: string;
  questionType: "single_choice" | "button_sequence" | "voice";
  domain: string;
  day: HaruWeekDay;
  ordinal: number;
  status: "completed" | "abandoned";
  contentPackVersion: string;
  questionContentHash: string;
  presentedAt: string;
  firstInteractionAt: string;
  completedAt?: string;
  activeDurationMs: number;
  wallDurationMs: number;
  firstInteractionMs: number;
  confirmationLatencyMs?: number;
  feedbackDurationMs: number;
  selectionChangeCount: number;
  personalizationKind: HaruPersonalizationKind;
  personalizationSourceQuestionIds: string[];
  response?: SyntheticAttemptResponse;
}

export type SyntheticTelemetryEvent = TelemetryEnvelope;

export interface SyntheticSemanticSlot {
  slotId: string;
  expectedValues: string[];
  preserved: boolean;
}

export interface SyntheticSttReviewRow {
  reviewRowId: string;
  participantId: string;
  pairId: string;
  voiceExperienceVariant: VoiceExperienceVariant;
  day: HaruWeekDay;
  questionId: string;
  sessionId: string;
  status: "completed" | "failed" | "no_speech" | "abandoned";
  noSpeech: boolean;
  retryCount: number;
  latencyMs: number;
  audioDurationMs: number;
  referenceTranscript: string;
  hypothesisTranscript: string;
  usableTranscript: boolean;
  wordErrorRate: number;
  engine: string;
  model: string;
  modelRevision: string;
  preprocessingVersion: "decode-resample-only-v1" | "haru-dc-hp80-rms-v2";
  semanticSlots: SyntheticSemanticSlot[];
  droppedAtVoiceStep: boolean;
}

export interface SyntheticOperationalExport {
  schemaVersion: typeof PILOT_SCHEMA_VERSION;
  generatedAt: typeof GENERATED_AT;
  dataKind: "sample";
  seed: string;
  participants: SyntheticPilotParticipant[];
  consentReceipts: SyntheticConsentReceipt[];
  routineSessions: SyntheticRoutineSession[];
  questionAttempts: SyntheticQuestionAttempt[];
  telemetryEvents: SyntheticTelemetryEvent[];
}

export interface SyntheticPilotManifest {
  schemaVersion: typeof PILOT_SCHEMA_VERSION;
  generatedAt: typeof GENERATED_AT;
  dataKind: "sample";
  seed: string;
  title: string;
  purpose: string;
  market: "kr";
  locale: "ko-KR";
  period: { start: string; end: string };
  participantCount: 20;
  matchedPairCount: 10;
  scheduledParticipantDays: 140;
  fileInventoryScope: "generated_data_outputs_only";
  analysisArtifactIndex: "analysis/artifact-index.json";
  voiceExperienceVariants: Record<
    VoiceExperienceVariant,
    { participantCount: 10; preprocessingVersion: string }
  >;
  privacy: {
    containsDirectIdentifiers: false;
    containsAudioFiles: false;
    normalizedCsvContainsTranscript: false;
    operationalExportContainsTranscript: false;
    adminRecordsContainTranscript: true;
    restrictedReviewContainsTranscript: true;
  };
  files: string[];
}

type SyntheticAdminUsageRecord = Omit<HaruAdminUsageRecord, "dataset"> & {
  dataset: HaruAdminUsageRecord["dataset"] & { generated_at: string };
};

export interface SyntheticNormalizedTables {
  participants: Array<Record<string, string | number | boolean | null>>;
  consentReceipts: Array<Record<string, string | number | boolean | null>>;
  dailySessions: Array<Record<string, string | number | boolean | null>>;
  questionAttempts: Array<Record<string, string | number | boolean | null>>;
  voiceSteps: Array<Record<string, string | number | boolean | null>>;
  telemetryEvents: Array<Record<string, string | number | boolean | null>>;
}

export interface SyntheticVoicePilotBundle {
  manifest: SyntheticPilotManifest;
  adminRecords: SyntheticAdminUsageRecord[];
  sttReviewRows: SyntheticSttReviewRow[];
  operationalExport: SyntheticOperationalExport;
  normalized: SyntheticNormalizedTables;
  dataDictionary: Record<string, unknown>;
}

interface PersonaSeed {
  name: string;
  gender: "여성" | "남성";
  residence: string;
  livingArrangementCode: SyntheticPilotParticipant["livingArrangementCode"];
  hometown: string;
  elementarySchool: string;
  formerOccupation: string;
  daughterName: string;
  grandsonName: string;
  closeFriendName: string;
  neighborName: string;
  favoriteFood: string;
  medicationTime: string;
  speechProfileNote: string;
}

interface VoiceNarrative {
  referenceTranscript: string;
  annotations: HaruDerivedAnnotation[];
}

interface VoiceOutcome {
  usableTranscript: boolean;
  noSpeech: boolean;
  retryCount: number;
  droppedAtVoiceStep: boolean;
  latencyMs: number;
}

const PERSONAS: readonly PersonaSeed[] = [
  { name: "김영희", gender: "여성", residence: "대전광역시 유성구", livingArrangementCode: "alone_family_nearby", hometown: "충남 공주", elementarySchool: "공주중동초등학교", formerOccupation: "학교 급식 조리사", daughterName: "김수진", grandsonName: "박도윤", closeFriendName: "이정자", neighborName: "최미숙", favoriteFood: "된장찌개", medicationTime: "오전 8시", speechProfileNote: "말속도가 느리고 문장 사이 쉼이 있음" },
  { name: "박정숙", gender: "여성", residence: "대전광역시 서구", livingArrangementCode: "alone_family_nearby", hometown: "전북 익산", elementarySchool: "이리초등학교", formerOccupation: "의류 판매원", daughterName: "박은경", grandsonName: "이준서", closeFriendName: "김옥자", neighborName: "한명숙", favoriteFood: "김치찌개", medicationTime: "오전 8시", speechProfileNote: "작은 목소리로 또박또박 말함" },
  { name: "이순자", gender: "여성", residence: "세종특별자치시", livingArrangementCode: "with_spouse", hometown: "충북 청주", elementarySchool: "청주중앙초등학교", formerOccupation: "재봉사", daughterName: "이현주", grandsonName: "최민준", closeFriendName: "박정희", neighborName: "오영자", favoriteFood: "청국장", medicationTime: "오전 7시 30분", speechProfileNote: "말끝이 부드럽고 간헐적으로 반복함" },
  { name: "최명자", gender: "여성", residence: "충청북도 청주시", livingArrangementCode: "with_spouse", hometown: "충남 논산", elementarySchool: "논산동성초등학교", formerOccupation: "농산물 가게 운영", daughterName: "최지영", grandsonName: "김하준", closeFriendName: "윤순덕", neighborName: "정복자", favoriteFood: "비빔밥", medicationTime: "오전 7시 30분", speechProfileNote: "억양이 뚜렷하고 말속도가 일정함" },
  { name: "정옥분", gender: "여성", residence: "경기도 수원시", livingArrangementCode: "with_family", hometown: "강원 원주", elementarySchool: "원주중앙초등학교", formerOccupation: "식당 운영", daughterName: "정미선", grandsonName: "이시우", closeFriendName: "강정자", neighborName: "조순희", favoriteFood: "미역국", medicationTime: "오전 9시", speechProfileNote: "짧은 문장으로 천천히 답함" },
  { name: "강복순", gender: "여성", residence: "경기도 성남시", livingArrangementCode: "with_family", hometown: "경북 안동", elementarySchool: "안동서부초등학교", formerOccupation: "우체국 직원", daughterName: "강혜진", grandsonName: "박지후", closeFriendName: "이금자", neighborName: "문정숙", favoriteFood: "소고기무국", medicationTime: "오전 9시", speechProfileNote: "마찰음이 약하고 쉼이 잦음" },
  { name: "윤길수", gender: "남성", residence: "서울특별시 강북구", livingArrangementCode: "with_spouse", hometown: "전남 순천", elementarySchool: "순천남초등학교", formerOccupation: "시내버스 기사", daughterName: "윤서연", grandsonName: "김예준", closeFriendName: "박동수", neighborName: "이상철", favoriteFood: "갈비탕", medicationTime: "오전 8시 30분", speechProfileNote: "낮은 목소리로 빠르게 시작한 뒤 느려짐" },
  { name: "한종호", gender: "남성", residence: "서울특별시 노원구", livingArrangementCode: "with_spouse", hometown: "경남 진주", elementarySchool: "진주봉래초등학교", formerOccupation: "철도 정비사", daughterName: "한지은", grandsonName: "최우진", closeFriendName: "김태식", neighborName: "장영수", favoriteFood: "곰탕", medicationTime: "오전 8시 30분", speechProfileNote: "저음이며 단어 사이 간격이 김" },
  { name: "오영자", gender: "여성", residence: "부산광역시 북구", livingArrangementCode: "alone_family_nearby", hometown: "경남 밀양", elementarySchool: "밀양초등학교", formerOccupation: "시장 반찬가게 운영", daughterName: "오민정", grandsonName: "정서준", closeFriendName: "백순자", neighborName: "김영숙", favoriteFood: "동태찌개", medicationTime: "오전 7시", speechProfileNote: "지역 억양이 있고 말속도가 빠른 편임" },
  { name: "서미자", gender: "여성", residence: "부산광역시 동래구", livingArrangementCode: "alone_family_nearby", hometown: "경남 통영", elementarySchool: "통영초등학교", formerOccupation: "수산물 판매원", daughterName: "서유진", grandsonName: "강도현", closeFriendName: "정말순", neighborName: "임옥희", favoriteFood: "매운탕", medicationTime: "오전 7시", speechProfileNote: "지역 억양과 짧은 추임새가 있음" },
  { name: "임춘식", gender: "남성", residence: "광주광역시 북구", livingArrangementCode: "with_spouse", hometown: "전남 나주", elementarySchool: "나주중앙초등학교", formerOccupation: "공무원", daughterName: "임소영", grandsonName: "박건우", closeFriendName: "조병호", neighborName: "김상수", favoriteFood: "추어탕", medicationTime: "오전 8시", speechProfileNote: "발화가 안정적이고 긴 문장을 선호함" },
  { name: "조상호", gender: "남성", residence: "광주광역시 서구", livingArrangementCode: "with_spouse", hometown: "전북 남원", elementarySchool: "남원용성초등학교", formerOccupation: "전기 기술자", daughterName: "조은지", grandsonName: "이도윤", closeFriendName: "서정태", neighborName: "박기수", favoriteFood: "콩나물국", medicationTime: "오전 8시", speechProfileNote: "목소리가 크고 어미를 길게 발음함" },
  { name: "신정희", gender: "여성", residence: "대구광역시 달서구", livingArrangementCode: "with_family", hometown: "경북 영주", elementarySchool: "영주초등학교", formerOccupation: "유치원 조리원", daughterName: "신나영", grandsonName: "김지호", closeFriendName: "박말자", neighborName: "권미자", favoriteFood: "시래기국", medicationTime: "오전 9시 30분", speechProfileNote: "모음이 길고 문장 사이 생각하는 시간이 있음" },
  { name: "권영숙", gender: "여성", residence: "대구광역시 수성구", livingArrangementCode: "with_family", hometown: "경북 상주", elementarySchool: "상주초등학교", formerOccupation: "서점 직원", daughterName: "권수현", grandsonName: "윤주원", closeFriendName: "남정자", neighborName: "류복희", favoriteFood: "들깨수제비", medicationTime: "오전 9시 30분", speechProfileNote: "조용한 목소리로 정확하게 답함" },
  { name: "배동철", gender: "남성", residence: "인천광역시 부평구", livingArrangementCode: "alone_family_nearby", hometown: "충남 서산", elementarySchool: "서산초등학교", formerOccupation: "기계 공장 반장", daughterName: "배지혜", grandsonName: "송현우", closeFriendName: "노재호", neighborName: "이문식", favoriteFood: "육개장", medicationTime: "오전 7시 30분", speechProfileNote: "쉰 목소리이며 짧게 끊어 말함" },
  { name: "문재호", gender: "남성", residence: "인천광역시 남동구", livingArrangementCode: "alone_family_nearby", hometown: "충남 보령", elementarySchool: "대천초등학교", formerOccupation: "건축 목수", daughterName: "문예진", grandsonName: "김민재", closeFriendName: "최성수", neighborName: "안기철", favoriteFood: "순두부찌개", medicationTime: "오전 7시 30분", speechProfileNote: "쉰 음색과 긴 호흡 소리가 있음" },
  { name: "유말순", gender: "여성", residence: "울산광역시 남구", livingArrangementCode: "with_spouse", hometown: "경북 경주", elementarySchool: "경주계림초등학교", formerOccupation: "미용사", daughterName: "유정은", grandsonName: "박선우", closeFriendName: "김춘자", neighborName: "하명희", favoriteFood: "잡채", medicationTime: "오전 8시 30분", speechProfileNote: "말속도가 빠르고 웃음 섞인 발화가 잦음" },
  { name: "하경자", gender: "여성", residence: "울산광역시 중구", livingArrangementCode: "with_spouse", hometown: "경북 포항", elementarySchool: "포항초등학교", formerOccupation: "보험 사무원", daughterName: "하은영", grandsonName: "이정우", closeFriendName: "송옥자", neighborName: "박영희", favoriteFood: "잔치국수", medicationTime: "오전 8시 30분", speechProfileNote: "말속도가 빠르나 발음은 또렷함" },
  { name: "남기환", gender: "남성", residence: "강원특별자치도 춘천시", livingArrangementCode: "with_family", hometown: "강원 홍천", elementarySchool: "홍천초등학교", formerOccupation: "농협 직원", daughterName: "남주희", grandsonName: "최지안", closeFriendName: "이광호", neighborName: "박문수", favoriteFood: "감자옹심이", medicationTime: "오전 9시", speechProfileNote: "느린 억양과 긴 무음 구간이 있음" },
  { name: "장원석", gender: "남성", residence: "강원특별자치도 원주시", livingArrangementCode: "with_family", hometown: "강원 횡성", elementarySchool: "횡성초등학교", formerOccupation: "축산업 종사자", daughterName: "장미래", grandsonName: "김유준", closeFriendName: "신덕호", neighborName: "우창식", favoriteFood: "감자전", medicationTime: "오전 9시", speechProfileNote: "느린 억양이나 핵심 단어를 강조함" },
] as const;

const MATCHED_PROFILES: readonly MatchedPilotProfile[] = [
  { ageAtStart: 70, nonVoicePaceMs: 5_400, nonVoiceAccuracyRate: 0.9, selectionChangeRate: 0.08, voiceChallengeBand: "low", routineStartHour: 9 },
  { ageAtStart: 71, nonVoicePaceMs: 5_900, nonVoiceAccuracyRate: 0.86, selectionChangeRate: 0.12, voiceChallengeBand: "medium", routineStartHour: 10 },
  { ageAtStart: 72, nonVoicePaceMs: 6_300, nonVoiceAccuracyRate: 0.84, selectionChangeRate: 0.14, voiceChallengeBand: "medium", routineStartHour: 9 },
  { ageAtStart: 73, nonVoicePaceMs: 6_700, nonVoiceAccuracyRate: 0.82, selectionChangeRate: 0.16, voiceChallengeBand: "high", routineStartHour: 11 },
  { ageAtStart: 74, nonVoicePaceMs: 5_700, nonVoiceAccuracyRate: 0.88, selectionChangeRate: 0.1, voiceChallengeBand: "low", routineStartHour: 10 },
  { ageAtStart: 75, nonVoicePaceMs: 6_900, nonVoiceAccuracyRate: 0.8, selectionChangeRate: 0.18, voiceChallengeBand: "high", routineStartHour: 9 },
  { ageAtStart: 76, nonVoicePaceMs: 6_100, nonVoiceAccuracyRate: 0.84, selectionChangeRate: 0.13, voiceChallengeBand: "medium", routineStartHour: 10 },
  { ageAtStart: 77, nonVoicePaceMs: 7_200, nonVoiceAccuracyRate: 0.78, selectionChangeRate: 0.2, voiceChallengeBand: "high", routineStartHour: 11 },
  { ageAtStart: 78, nonVoicePaceMs: 6_500, nonVoiceAccuracyRate: 0.82, selectionChangeRate: 0.15, voiceChallengeBand: "medium", routineStartHour: 9 },
  { ageAtStart: 79, nonVoicePaceMs: 7_500, nonVoiceAccuracyRate: 0.76, selectionChangeRate: 0.22, voiceChallengeBand: "high", routineStartHour: 10 },
] as const;

const TARGETS = {
  baseline_v1: {
    usableTranscriptRate: 0.78,
    noSpeechRate: 0.12,
    retryRate: 0.22,
    voiceStepDropoutRate: 0.15,
    sttLatencyP50Ms: 5_500,
    usableCount: 55,
    noSpeechCount: 8,
    retryCount: 15,
    dropoutCount: 10,
  },
  assist_v2: {
    usableTranscriptRate: 0.92,
    noSpeechRate: 0.04,
    retryRate: 0.07,
    voiceStepDropoutRate: 0.05,
    sttLatencyP50Ms: 3_200,
    usableCount: 64,
    noSpeechCount: 3,
    retryCount: 5,
    dropoutCount: 4,
  },
} as const;

const PURPOSE = "음성 UX 참여·이탈·STT 흐름 분석용 샘플 기록";
const RECORDING_PRINCIPLES = [
  "제품 검토용 샘플 데이터",
  "사용자에게 제시된 문항 스냅샷과 응답 시각을 저장",
  "음성 파일은 저장하지 않음",
  "전사문은 제한된 STT 검토 자료와 관리자 기록에만 제공",
  "결과는 제품 흐름 분석용이며 의료적 판단에 사용하지 않음",
];

function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function opaqueHex32(seed: string, scope: string): string {
  return [0, 1, 2, 3]
    .map((part) => hash32(`${seed}|${scope}|${part}`).toString(16).padStart(8, "0"))
    .join("");
}

function installationIdFor(seed: string, participant: SyntheticPilotParticipant): string {
  return `inst_kr_${opaqueHex32(seed, `installation|${participant.participantId}`)}`;
}

function score(seed: string, scope: string): number {
  return hash32(`${seed}|${scope}`) / 0x1_0000_0000;
}

function stableSort<T>(items: readonly T[], seed: string, key: (item: T) => string): T[] {
  return [...items].sort((left, right) => {
    const delta = hash32(`${seed}|${key(left)}`) - hash32(`${seed}|${key(right)}`);
    return delta || key(left).localeCompare(key(right));
  });
}

function addMs(timestamp: string, milliseconds: number): string {
  return toKoreanIso(Date.parse(timestamp) + milliseconds);
}

function toKoreanIso(epochMs: number): string {
  const shifted = new Date(epochMs + 9 * 60 * 60 * 1_000).toISOString();
  return `${shifted.slice(0, -1)}+09:00`;
}

function dateForDay(day: HaruWeekDay): string {
  return HARU_WEEK_PLAN[day - 1].dateISOByMarket.kr;
}

function sessionStartFor(
  participantIndex: number,
  matchedProfile: MatchedPilotProfile,
  day: HaruWeekDay,
): string {
  const date = dateForDay(day);
  const pairOffsetMinutes = Math.floor(participantIndex / 2) * 3;
  const armOffsetMinutes = (participantIndex % 2) * 5;
  return `${date}T${String(matchedProfile.routineStartHour).padStart(2, "0")}:${String(
    5 + pairOffsetMinutes + armOffsetMinutes,
  ).padStart(2, "0")}:00+09:00`;
}

function participantId(index: number): string {
  return `HARU-P${String(index + 1).padStart(3, "0")}`;
}

function pairId(index: number): string {
  return `PAIR-${String(Math.floor(index / 2) + 1).padStart(2, "0")}`;
}

function variantFor(index: number): VoiceExperienceVariant {
  return index % 2 === 0 ? "baseline_v1" : "assist_v2";
}

function createParticipants(): SyntheticPilotParticipant[] {
  return PERSONAS.map((persona, index) => {
    const matchedProfile = MATCHED_PROFILES[Math.floor(index / 2)];
    return {
      participantId: participantId(index),
      pairId: pairId(index),
      voiceExperienceVariant: variantFor(index),
      displayName: persona.name,
      birthYear: 2026 - matchedProfile.ageAtStart,
      ageAtStart: matchedProfile.ageAtStart,
      gender: persona.gender,
      residence: persona.residence,
      livingArrangementCode: persona.livingArrangementCode,
      matchedProfile: { ...matchedProfile },
    };
  });
}

function voiceSlotKey(participant: SyntheticPilotParticipant, day: HaruWeekDay): string {
  return `${participant.pairId}|${participant.voiceExperienceVariant}|D${day}`;
}

function matchedDayKey(participant: SyntheticPilotParticipant, day: HaruWeekDay): string {
  return `${participant.pairId}|D${day}`;
}

function createVoiceOutcomes(
  participants: readonly SyntheticPilotParticipant[],
  seed: string,
): Map<string, VoiceOutcome> {
  const outcomes = new Map<string, VoiceOutcome>();
  const orderedPairIds = stableSort(
    [...new Set(participants.map((participant) => participant.pairId))],
    `${seed}|dropout-pairs`,
    (candidatePairId) => candidatePairId,
  );
  const sharedDropoutKeys = new Set(
    orderedPairIds
      .slice(0, TARGETS.assist_v2.dropoutCount)
      .map((candidatePairId, index) => `${candidatePairId}|D${index % 2 === 0 ? 1 : 4}`),
  );
  const baselineExtraDays = [2, 3, 5, 6, 2, 5] as const;
  const baselineExtraDropouts = new Set(
    orderedPairIds
      .slice(TARGETS.assist_v2.dropoutCount)
      .map((candidatePairId, index) => `${candidatePairId}|D${baselineExtraDays[index]}`),
  );

  for (const variant of ["baseline_v1", "assist_v2"] as const) {
    const target = TARGETS[variant];
    const slots = participants
      .filter((participant) => participant.voiceExperienceVariant === variant)
      .flatMap((participant) => DAYS.map((day) => ({ participant, day })));
    const forcedDropoutKeys = new Set(
      slots
        .filter(({ participant, day }) => {
          const sharedDropout = sharedDropoutKeys.has(matchedDayKey(participant, day));
          const baselineOnlyDropout =
            variant === "baseline_v1" &&
            baselineExtraDropouts.has(matchedDayKey(participant, day));
          return sharedDropout || baselineOnlyDropout;
        })
        .map(({ participant, day }) => voiceSlotKey(participant, day)),
    );
    const qualityOrder = stableSort(
      slots.filter(
        ({ participant, day }) => !forcedDropoutKeys.has(voiceSlotKey(participant, day)),
      ),
      `${seed}|${variant}|quality`,
      ({ participant, day }) => voiceSlotKey(participant, day),
    );
    const unusable = new Set(forcedDropoutKeys);
    qualityOrder
      .slice(0, 70 - target.usableCount - forcedDropoutKeys.size)
      .forEach(({ participant, day }) => unusable.add(voiceSlotKey(participant, day)));
    const noSpeech = new Set(
      stableSort(
        slots.filter(({ participant, day }) =>
          unusable.has(voiceSlotKey(participant, day)),
        ),
        `${seed}|${variant}|no-speech`,
        ({ participant, day }) => voiceSlotKey(participant, day),
      )
        .slice(0, target.noSpeechCount)
        .map(({ participant, day }) => voiceSlotKey(participant, day)),
    );
    const retries = new Set(
      stableSort(slots, `${seed}|${variant}|retry`, ({ participant, day }) =>
        voiceSlotKey(participant, day),
      )
        .slice(0, target.retryCount)
        .map(({ participant, day }) => voiceSlotKey(participant, day)),
    );
    const latencyOrder = stableSort(slots, `${seed}|${variant}|latency`, ({ participant, day }) =>
      voiceSlotKey(participant, day),
    );
    const latencyByKey = new Map<string, number>();
    latencyOrder.forEach(({ participant, day }, rank) => {
      const offset = rank < 34 ? (rank - 34) * 85 : rank > 35 ? (rank - 35) * 85 : 0;
      latencyByKey.set(
        voiceSlotKey(participant, day),
        Math.max(500, target.sttLatencyP50Ms + offset),
      );
    });

    for (const { participant, day } of slots) {
      const key = voiceSlotKey(participant, day);
      const sharedDropout = sharedDropoutKeys.has(matchedDayKey(participant, day));
      const baselineOnlyDropout =
        variant === "baseline_v1" && baselineExtraDropouts.has(matchedDayKey(participant, day));
      const droppedAtVoiceStep = sharedDropout || baselineOnlyDropout;
      outcomes.set(key, {
        usableTranscript: !unusable.has(key),
        noSpeech: noSpeech.has(key),
        retryCount: retries.has(key) ? 1 : 0,
        droppedAtVoiceStep,
        latencyMs: latencyByKey.get(key) ?? target.sttLatencyP50Ms,
      });
    }
  }
  return outcomes;
}

const PLACES = [
  "중앙시장",
  "한빛시장",
  "새봄시장",
  "행복시장",
  "푸른시장",
  "온누리시장",
  "정다운시장",
  "우리시장",
  "소담시장",
  "마을시장",
] as const;
const PURCHASES = [
  ["애호박", "대파"],
  ["두부", "양파"],
  ["감자", "당근"],
  ["시금치", "달걀"],
  ["버섯", "부추"],
  ["오이", "토마토"],
  ["무", "쪽파"],
  ["배추", "고추"],
  ["콩나물", "어묵"],
  ["가지", "상추"],
] as const;
const CENTERS = [
  "늘봄복지관",
  "한마음복지관",
  "새롬복지관",
  "행복복지관",
  "푸른복지관",
  "온누리복지관",
  "정다운복지관",
  "우리복지관",
  "소담복지관",
  "마을복지관",
] as const;
const ACTIVITIES = [
  "윷놀이",
  "종이접기",
  "노래교실",
  "장기 두기",
  "건강 체조",
  "그림 그리기",
  "화분 가꾸기",
  "바둑 두기",
  "손뜨개",
  "책 읽기",
] as const;
const DRINKS = [
  "보리차",
  "옥수수차",
  "둥굴레차",
  "유자차",
  "생강차",
  "결명자차",
  "매실차",
  "대추차",
  "현미차",
  "오미자차",
] as const;
const BAKERY_ITEMS = [
  "단팥빵",
  "소보로빵",
  "크림빵",
  "찹쌀도넛",
  "카스텔라",
  "모닝빵",
  "식빵",
  "밤빵",
  "옥수수빵",
  "고구마빵",
] as const;

function annotation(entityType: string, value: string): HaruDerivedAnnotation {
  return { entityType, value };
}

function withKoreanParticle(
  value: string,
  consonantForm: string,
  vowelForm: string,
): string {
  return `${value}${hasKoreanFinalConsonant(value) ? consonantForm : vowelForm}`;
}

function voiceNarrative(persona: PersonaSeed, pairIndex: number, day: HaruWeekDay): VoiceNarrative {
  const place = PLACES[pairIndex];
  const [firstPurchase, secondPurchase] = PURCHASES[pairIndex];
  const center = CENTERS[pairIndex];
  const activity = ACTIVITIES[pairIndex];
  const drink = DRINKS[pairIndex];
  const bakeryItem = BAKERY_ITEMS[pairIndex];
  const friend = `친구 ${persona.closeFriendName}`;
  const daughter = `딸 ${persona.daughterName}`;
  const grandson = `손자 ${persona.grandsonName}`;

  switch (day) {
    case 1:
      return {
        referenceTranscript: `오늘 오전에 ${place}에 가서 ${firstPurchase}, ${secondPurchase} 두 가지를 샀어요. ${withKoreanParticle(daughter, "이", "가")} 저녁에 온다고 해서 ${persona.favoriteFood}도 준비하려고요. 기분은 좋아요.`,
        annotations: [
          annotation("장소", place),
          annotation("구매물품", firstPurchase),
          annotation("구매물품", secondPurchase),
          annotation("인물", daughter),
          annotation("계획", `${persona.favoriteFood} 준비하기`),
          annotation("감정", "좋음"),
        ],
      };
    case 2:
      return {
        referenceTranscript: `오늘 ${center}에서 ${withKoreanParticle(friend, "을", "를")} 만나 ${activity} 활동을 했어요. 점심을 함께 먹고 많이 웃어서 기분이 아주 좋았어요.`,
        annotations: [
          annotation("장소", center),
          annotation("인물", friend),
          annotation("활동", activity),
          annotation("음식", "점심 식사"),
          annotation("감정", "매우 좋음"),
        ],
      };
    case 3:
      return {
        referenceTranscript: "오늘 동네 건강센터에서 상담을 받고 집에 오는 길에 약국 옆 공원에 들렀어요. 조금 피곤했지만 마음은 편안했어요.",
        annotations: [
          annotation("장소", "동네 건강센터"),
          annotation("활동", "건강 상담"),
          annotation("장소", "동네 공원"),
          annotation("신체상태", "조금 피곤함"),
          annotation("감정", "편안함"),
        ],
      };
    case 4:
      return {
        referenceTranscript: `오늘 오후에 동네 산책로를 삼십 분 걸었어요. 벤치에서 이웃 ${persona.neighborName} 씨와 이야기했고 집에 와서 ${withKoreanParticle(drink, "을", "를")} 마셨어요. 몸이 가벼워졌어요.`,
        annotations: [
          annotation("장소", "동네 산책로"),
          annotation("활동", "30분 산책"),
          annotation("인물", `이웃 ${persona.neighborName}`),
          annotation("음료", drink),
          annotation("신체상태", "몸이 가벼워짐"),
        ],
      };
    case 5:
      return {
        referenceTranscript: `오늘 ${daughter}, ${grandson} 두 사람이 집에 왔어요. 같이 ${persona.favoriteFood}도 먹고 학교 이야기를 들었어요. 만나서 반가웠어요.`,
        annotations: [
          annotation("인물", daughter),
          annotation("인물", grandson),
          annotation("장소", "사용자 집"),
          annotation("음식", persona.favoriteFood),
          annotation("대화주제", "손자의 학교 이야기"),
          annotation("감정", "반가움"),
        ],
      };
    case 6:
      return {
        referenceTranscript: `오늘 오전에 동네 도서관에서 생활 강좌를 들었어요. 돌아오는 길에 빵집에서 ${bakeryItem} 두 개를 샀고 오후에는 집에서 쉬었어요.`,
        annotations: [
          annotation("장소", "동네 도서관"),
          annotation("활동", "생활 강좌 수강"),
          annotation("장소", "동네 빵집"),
          annotation("구매물품", bakeryItem),
          annotation("수량", "2개"),
          annotation("활동", "오후에 집에서 휴식"),
        ],
      };
    case 7:
      return {
        referenceTranscript: `오늘은 집에서 화분에 물을 주고 ${grandson}에게 전화했어요. 이번 주에는 ${daughter}, ${grandson} 두 사람이 와서 ${persona.favoriteFood}도 함께 먹은 일이 가장 기억에 남아요. 행복했어요.`,
        annotations: [
          annotation("오늘 활동", "화분에 물 주기"),
          annotation("오늘 인물", grandson),
          annotation("오늘 활동", "전화 통화"),
          annotation("주간 핵심 기억", "딸과 손자의 방문"),
          annotation("주간 핵심 음식", persona.favoriteFood),
          annotation("감정", "행복함"),
        ],
      };
  }
}

function personaReplacements(persona: PersonaSeed): Array<readonly [string, string]> {
  const demo = HARU_DEMO_PERSONA.registeredProfileFields;
  const givenName = persona.name.slice(1);
  const demoDaughter = getLocalizedText(demo.daughterName, "ko");
  const demoGrandson = getLocalizedText(demo.grandsonName, "ko");
  const demoFriend = getLocalizedText(demo.closeFriendName, "ko");
  const replacements: Array<readonly [string, string]> = [
    [getLocalizedText(demo.elementarySchool, "ko"), persona.elementarySchool],
    [getLocalizedText(demo.formerOccupation, "ko"), persona.formerOccupation],
    [getLocalizedText(demo.favoriteFood, "ko"), persona.favoriteFood],
    [getLocalizedText(demo.hometown, "ko"), persona.hometown],
    [getLocalizedText(demo.neighborName, "ko"), persona.neighborName],
    [demoDaughter, persona.daughterName],
    [demoGrandson, persona.grandsonName],
    [demoFriend, persona.closeFriendName],
    [demoDaughter.slice(1), persona.daughterName.slice(1)],
    [demoGrandson.slice(1), persona.grandsonName.slice(1)],
    [demoFriend.slice(1), persona.closeFriendName.slice(1)],
    ["박영자", persona.name],
    ["영자 어르신", `${givenName} 어르신`],
    ["영자", givenName],
  ];
  return replacements.sort((left, right) => right[0].length - left[0].length);
}

function hasKoreanFinalConsonant(value: string): boolean {
  const last = [...value.normalize("NFC")].at(-1);
  if (!last) return false;
  const codePoint = last.codePointAt(0) ?? 0;
  return codePoint >= 0xac00 && codePoint <= 0xd7a3 && (codePoint - 0xac00) % 28 !== 0;
}

const PARTICLE_FACT_CACHE = new Map<PersonaSeed, string[]>();

function correctKnownKoreanParticles(value: string, persona: PersonaSeed): string {
  let facts = PARTICLE_FACT_CACHE.get(persona);
  if (!facts) {
    const pairIndex = Math.floor(PERSONAS.findIndex((candidate) => candidate === persona) / 2);
    const narrativeFacts = DAYS.flatMap((day) =>
      voiceNarrative(persona, Math.max(0, pairIndex), day).annotations.map((item) => item.value),
    );
    facts = [
      persona.name.slice(1),
      persona.hometown,
      persona.elementarySchool,
      persona.formerOccupation,
      persona.daughterName,
      persona.daughterName.slice(1),
      persona.grandsonName,
      persona.grandsonName.slice(1),
      persona.closeFriendName,
      persona.closeFriendName.slice(1),
      persona.neighborName,
      persona.neighborName.slice(1),
      persona.favoriteFood,
      ...narrativeFacts,
    ]
      .filter((fact, index, all) => fact.length > 0 && all.indexOf(fact) === index)
      .sort((left, right) => right.length - left.length);
    PARTICLE_FACT_CACHE.set(persona, facts);
  }
  const pairs = [
    ["이에요", "예요"],
    ["이라고", "라고"],
    ["을", "를"],
    ["이", "가"],
    ["과", "와"],
  ] as const;

  return facts.reduce((current, fact) => {
    const withFinal = hasKoreanFinalConsonant(fact);
    return [fact, `"${fact}"`].reduce(
      (text, token) =>
        pairs.reduce((particleText, [consonantForm, vowelForm]) => {
          const correct = withFinal ? consonantForm : vowelForm;
          return particleText
            .replaceAll(`${token}${consonantForm}`, `${token}${correct}`)
            .replaceAll(`${token}${vowelForm}`, `${token}${correct}`);
        }, text),
      current,
    );
  }, value);
}

function replacePersonaText(value: string, persona: PersonaSeed): string {
  const replaced = personaReplacements(persona).reduce(
    (current, [from, to]) => current.replaceAll(from, to),
    value,
  );
  return correctKnownKoreanParticles(replaced, persona);
}

function koreanText(value: Exercise["prompt"], persona: PersonaSeed): string {
  return replacePersonaText(getLocalizedText(value, "ko"), persona);
}

function morningMinutes(value: string): number {
  const match = value.match(/^오전\s+(\d{1,2})시(?:\s+(\d{1,2})분)?$/u);
  if (!match) throw new Error(`Unsupported synthetic medication time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2] ?? 0);
}

function koreanMorningTime(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return minute === 0 ? `오전 ${hour}시` : `오전 ${hour}시 ${minute}분`;
}

function medicationQuestionChoices(
  persona: PersonaSeed,
): NonNullable<HaruAdminQuestionRecord["question"]["choices"]> {
  const breakfastMinutes = morningMinutes(persona.medicationTime) + 30;
  return [-15, 0, 30, 60].map((offset, index) => {
    const button = BUTTONS[index];
    return {
      button,
      position: BUTTON_LAYOUT[button].position,
      color: BUTTON_LAYOUT[button].color,
      label: koreanMorningTime(breakfastMinutes + offset),
    };
  });
}

function exerciseChoices(
  exercise: Exercise,
  persona: PersonaSeed,
): HaruAdminQuestionRecord["question"]["choices"] {
  const source = exercise.payload.options ?? exercise.payload.items;
  if (!source || source.length === 0) return null;
  return source.slice(0, 4).map((item, index) => {
    const button = BUTTONS.includes(item.id as (typeof BUTTONS)[number])
      ? (item.id as (typeof BUTTONS)[number])
      : BUTTONS[index];
    return {
      button,
      position: BUTTON_LAYOUT[button].position,
      color: BUTTON_LAYOUT[button].color,
      label: replacePersonaText(getLocalizedText(item.label, "ko"), persona),
    };
  });
}

function correctAnswer(
  exercise: Exercise,
  choices: NonNullable<HaruAdminQuestionRecord["question"]["choices"]>,
): HaruAdminQuestionRecord["question"]["correct_answer"] {
  if (exercise.correctAnswer === null) return null;
  const ids = Array.isArray(exercise.correctAnswer)
    ? exercise.correctAnswer
    : [exercise.correctAnswer];
  const matching = ids
    .map((id) => choices.find((choice) => choice.button === id))
    .filter((choice): choice is (typeof choices)[number] => choice !== undefined);
  if (matching.length === 0) return null;
  if (Array.isArray(exercise.correctAnswer)) {
    return {
      sequence: matching.map((choice) => choice.button),
      labels: matching.map((choice) => choice.label),
    };
  }
  return { button: matching[0].button, label: matching[0].label };
}

function feedbackFor(exercise: Exercise, persona: PersonaSeed): string {
  if (exercise.id === "D3_Q4") {
    return `맞아요. 30분 뒤는 ${koreanMorningTime(
      morningMinutes(persona.medicationTime) + 30,
    )}입니다.`;
  }
  return exercise.explanation
    ? koreanText(exercise.explanation, persona)
    : "응답을 남겨 주셔서 고마워요.";
}

function contentHash(questionId: string, prompt: string, choices: readonly string[]): string {
  return `fnv1a32-${hash32(`${questionId}|${prompt}|${choices.join("|")}`)
    .toString(16)
    .padStart(8, "0")}`;
}

function nonVoiceResponseTime(
  seed: string,
  participant: SyntheticPilotParticipant,
  day: HaruWeekDay,
  questionId: string,
): number {
  const jitter = Math.round(
    (score(seed, `${participant.pairId}|D${day}|${questionId}|pace`) - 0.5) * 1_800,
  );
  return Math.max(2_800, participant.matchedProfile.nonVoicePaceMs + jitter);
}

function chooseSingleOption(
  seed: string,
  participant: SyntheticPilotParticipant,
  day: HaruWeekDay,
  questionId: string,
  choices: NonNullable<HaruAdminQuestionRecord["question"]["choices"]>,
  correct: HaruAdminQuestionRecord["question"]["correct_answer"],
  scored: boolean,
): { selected: (typeof choices)[number]; isCorrect: boolean | null } {
  if (!scored || !correct || !("button" in correct)) {
    const index = Math.floor(score(seed, `${participant.pairId}|D${day}|${questionId}|mood`) * 4);
    return { selected: choices[Math.min(index, choices.length - 1)], isCorrect: null };
  }
  const answerCorrect =
    score(seed, `${participant.pairId}|D${day}|${questionId}|accuracy`) <
    participant.matchedProfile.nonVoiceAccuracyRate;
  const selected = answerCorrect
    ? choices.find((choice) => choice.button === correct.button) ?? choices[0]
    : choices.find((choice) => choice.button !== correct.button) ?? choices[0];
  return { selected, isCorrect: selected.button === correct.button };
}

function chooseSequence(
  seed: string,
  participant: SyntheticPilotParticipant,
  day: HaruWeekDay,
  questionId: string,
  correct: Extract<
    NonNullable<HaruAdminQuestionRecord["question"]["correct_answer"]>,
    { sequence: unknown }
  >,
): { sequence: Array<(typeof BUTTONS)[number]>; isCorrect: boolean } {
  const answerCorrect =
    score(seed, `${participant.pairId}|D${day}|${questionId}|accuracy`) <
    participant.matchedProfile.nonVoiceAccuracyRate;
  const sequence = [...correct.sequence];
  if (!answerCorrect && sequence.length > 1) {
    const last = sequence.length - 1;
    [sequence[last - 1], sequence[last]] = [sequence[last], sequence[last - 1]];
  }
  return { sequence, isCorrect: answerCorrect };
}

function semanticSlots(
  narrative: VoiceNarrative,
  usableTranscript: boolean,
): SyntheticSemanticSlot[] {
  return narrative.annotations.map((item, index) => ({
    slotId: `${item.entityType}:${index + 1}`,
    expectedValues: [item.value],
    preserved: usableTranscript,
  }));
}

function hypothesisFor(
  narrative: VoiceNarrative,
  outcome: VoiceOutcome,
  seed: string,
  key: string,
): string {
  if (outcome.noSpeech) return "";
  if (!outcome.usableTranscript) {
    const degraded = [
      "오늘 동네에 다녀왔어요.",
      "오전에 잠깐 나갔어요.",
      "집에서 쉬었다고 했어요.",
      "잘 기억나지 않아요.",
      "오늘 볼일을 보고 왔어요.",
    ];
    return degraded[Math.floor(score(seed, `${key}|degraded-hypothesis`) * degraded.length)];
  }

  const reference = narrative.referenceTranscript;
  const variants = [
    reference.replace(/^오늘은?\s*/u, ""),
    reference.replace(/^오늘 오전에\s*/u, "오전에 "),
    reference.replace("했어요.", "했어 요."),
    reference.replace("기분은 ", "기분 "),
  ].filter((candidate) => candidate !== reference);
  return variants[Math.floor(score(seed, `${key}|usable-hypothesis`) * variants.length)] ?? reference;
}

function transcriptTokens(value: string): string[] {
  return value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function wordErrorRate(reference: string, hypothesis: string): number {
  const expected = transcriptTokens(reference);
  const observed = transcriptTokens(hypothesis);
  const row = Array.from({ length: observed.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= expected.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= observed.length; rightIndex += 1) {
      const above = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (expected[leftIndex - 1] === observed[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  const distance = row[observed.length];
  return expected.length === 0
    ? Number(observed.length > 0)
    : Math.round((distance / expected.length) * 1_000) / 1_000;
}

function voiceAudioDurationMs(
  seed: string,
  participant: SyntheticPilotParticipant,
  day: HaruWeekDay,
): number {
  const base = participant.matchedProfile.voiceChallengeBand === "high" ? 16_000 : 13_000;
  return Math.round(base + score(seed, `${participant.pairId}|D${day}|audio-duration`) * 5_000);
}

function questionById(questionId: string): Exercise {
  const exercise = haru7DayExercises.find((candidate) => candidate.id === questionId);
  if (!exercise) throw new Error(`Missing canonical exercise ${questionId}`);
  return exercise;
}

function questionMeta(questionId: string) {
  const meta = HARU_WEEK_QUESTION_META.find((candidate) => candidate.exerciseId === questionId);
  if (!meta) throw new Error(`Missing canonical metadata ${questionId}`);
  return meta;
}

function personalizationNote(
  personalization: ResolvedHaruExercise["personalization"],
): string | null {
  if (personalization.kind === "profile") return "초기 등록 정보 기반 개인화";
  if (personalization.kind !== "prior_response") return null;
  const sourceId = personalization.sourceQuestionIds?.[0];
  if (!sourceId) return "이전 응답 기반 개인화";
  const source = questionMeta(sourceId);
  return `${source.day}일차 ${source.responseType === "voice" ? "음성 " : ""}응답 기반 개인화`;
}

function adminQuestionRecord(
  resolved: ResolvedHaruExercise,
  persona: PersonaSeed,
  presentedAt: string,
): HaruAdminQuestionRecord {
  const exercise = resolved.exercise;
  const meta = questionMeta(exercise.id);
  const medicationQuestion = exercise.id === "D3_Q4";
  const choices = medicationQuestion
    ? medicationQuestionChoices(persona)
    : exerciseChoices(exercise, persona);
  const prompt = medicationQuestion
    ? `혈압약을 ${persona.medicationTime}에 먹고 30분 뒤에 아침을 먹습니다. 아침은 몇 시에 먹을까요?`
    : koreanText(exercise.prompt, persona);
  return {
    presentation: {
      presented_at: presentedAt,
      screen_state: "question",
      character_message: null,
    },
    question: {
      question_id: exercise.id,
      order: meta.order,
      domain: meta.domain,
      response_type: meta.responseType,
      prompt_text: prompt,
      prompt_audio_text: prompt,
      scored: meta.scored,
      choices,
      correct_answer: choices ? correctAnswer(exercise, choices) : null,
      personalization_source_note: personalizationNote(resolved.personalization),
      max_response_seconds: meta.maxResponseSeconds ?? null,
    },
    response: null,
    system_feedback: null,
  };
}

interface ParticipantGeneration {
  adminRecord: SyntheticAdminUsageRecord;
  consentReceipt: SyntheticConsentReceipt;
  sessions: SyntheticRoutineSession[];
  attempts: SyntheticQuestionAttempt[];
  events: SyntheticTelemetryEvent[];
  reviewRows: SyntheticSttReviewRow[];
}

function generateParticipant(
  participant: SyntheticPilotParticipant,
  participantIndex: number,
  persona: PersonaSeed,
  seed: string,
  outcomes: ReadonlyMap<string, VoiceOutcome>,
): ParticipantGeneration {
  const pairIndex = Math.floor(participantIndex / 2);
  const consentRevision = `consent-${participant.participantId}-v1`;
  const consentReceipt: SyntheticConsentReceipt = {
    receiptId: `CONSENT-${participant.participantId}-001`,
    participantId: participant.participantId,
    revision: consentRevision,
    recordedAt: "2026-07-19T14:00:00+09:00",
    source: "sample_dataset_setup",
    grants: {
      usageAnalytics: true,
      longitudinalActivity: true,
      voiceCapture: true,
      sttProcessing: true,
      transcriptStorage: true,
      audioStorage: false,
      personalization: true,
      familySharing: false,
    },
  };
  const adminRecord: SyntheticAdminUsageRecord = {
    schema: {
      name: "haru_kiosk_usage_record",
      version: ADMIN_SCHEMA_VERSION,
      purpose: PURPOSE,
      recording_principle: [...RECORDING_PRINCIPLES],
    },
    dataset: {
      dataset_id: `HARU-VOICE-PILOT-SAMPLE-${participant.participantId}`,
      generated_at: GENERATED_AT,
      market: "kr",
      ui_locale: "ko-KR",
      content_pack_version: CONTENT_PACK_VERSION,
      currency: "KRW",
      data_classification: "restricted_sample_admin_record",
      is_synthetic: true,
      period: { start: dateForDay(1), end: dateForDay(7) },
    },
    user: {
      user_id: participant.participantId,
      card_token_id: `CARD-${participant.participantId}`,
      market: "kr",
      ui_locale: "ko-KR",
      display_name: participant.displayName,
      birth_year: participant.birthYear,
      age_at_period_start: participant.ageAtStart,
      gender: participant.gender,
      residence: participant.residence,
      living_arrangement:
        participant.livingArrangementCode === "alone_family_nearby"
          ? "혼자 거주하며 가족이 가까이 살고 있음"
          : participant.livingArrangementCode === "with_spouse"
            ? "배우자와 함께 거주"
            : "가족과 함께 거주",
      speech_profile_note: persona.speechProfileNote,
      registered_profile_fields: {
        고향: persona.hometown,
        졸업학교: persona.elementarySchool,
        과거직업: persona.formerOccupation,
        딸: persona.daughterName,
        손자: persona.grandsonName,
        가까운친구: persona.closeFriendName,
        이웃: persona.neighborName,
        좋아하는음식: persona.favoriteFood,
        복약시간: persona.medicationTime,
      },
      consents: {
        voice_recording: true,
        stt_processing: true,
        transcript_storage: true,
        audio_storage: false,
        longitudinal_usage_storage: true,
        personalized_question_use: true,
        consented_at: consentReceipt.recordedAt,
      },
    },
    device: {
      device_id: `TABLET-${String(participantIndex + 1).padStart(2, "0")}`,
      site_id: `SITE-SAMPLE-${String((pairIndex % 3) + 1).padStart(2, "0")}`,
      site_name: `샘플 운영 그룹 ${(pairIndex % 3) + 1}`,
      input_devices: ["microphone", "physical_button_2x2", "touchscreen"],
      button_layout: {
        A: { ...BUTTON_LAYOUT.A },
        B: { ...BUTTON_LAYOUT.B },
        C: { ...BUTTON_LAYOUT.C },
        D: { ...BUTTON_LAYOUT.D },
      },
      software_version: APP_VERSION,
      timezone: "Asia/Seoul",
    },
    sessions: [],
  };
  const operationalSessions: SyntheticRoutineSession[] = [];
  const attempts: SyntheticQuestionAttempt[] = [];
  const events: SyntheticTelemetryEvent[] = [];
  const reviewRows: SyntheticSttReviewRow[] = [];
  const demoSessions: HaruDemoSession[] = [];
  let eventSequence = 0;

  const addEvent = <Name extends TelemetryEventName>(
    eventName: Name,
    occurredAt: string,
    payload: TelemetryPayloadMap[Name],
    sessionId?: string,
    questionInstanceId?: string,
  ) => {
    eventSequence += 1;
    events.push({
      schemaVersion: "1.0",
      eventId: `evt_kr_${opaqueHex32(
        seed,
        `event|${participant.participantId}|${eventSequence}`,
      )}`,
      eventName,
      occurredAt,
      sequence: eventSequence,
      market: "kr",
      locale: "ko-KR",
      appVersion: APP_VERSION,
      contentPackVersion: CONTENT_PACK_VERSION,
      installationId: installationIdFor(seed, participant),
      visitId: `visit_${opaqueHex32(
        seed,
        `visit|${participant.participantId}|${sessionId ?? "app"}`,
      )}`,
      ...(sessionId ? { routineSessionId: sessionId } : {}),
      ...(questionInstanceId ? { questionInstanceId } : {}),
      routeId: "/lesson",
      consentRevision,
      payload,
    } as SyntheticTelemetryEvent);
  };

  for (const day of DAYS) {
    const plan = HARU_WEEK_PLAN[day - 1];
    const sessionId = `routine_${opaqueHex32(
      seed,
      `session|${participant.participantId}|D${day}`,
    )}`;
    const startedAt = sessionStartFor(participantIndex, participant.matchedProfile, day);
    let cursor = addMs(startedAt, 8_000);
    let sessionAbandoned = false;
    const questionRecords: HaruAdminQuestionRecord[] = [];
    const demoResponses: HaruDemoResponse[] = [];
    const sessionAttempts: SyntheticQuestionAttempt[] = [];
    addEvent("routine_started", startedAt, { routineId: "haru-7day", dayIndex: day }, sessionId);

    for (const questionId of plan.exerciseIds) {
      const canonicalExercise = questionById(questionId);
      const resolved = resolveHaruExercise(canonicalExercise, demoSessions, true);
      const meta = questionMeta(questionId);
      const questionInstanceId = `question_${opaqueHex32(
        seed,
        `question|${participant.participantId}|D${day}|Q${meta.order}|${questionId}`,
      )}`;
      const presentedAt = cursor;
      const record = adminQuestionRecord(resolved, persona, presentedAt);
      const promptHash = contentHash(
        questionId,
        record.question.prompt_text,
        record.question.choices?.map((choice) => choice.label) ?? [],
      );
      questionRecords.push(record);
      addEvent(
        "question_presented",
        presentedAt,
        {
          questionId,
          exerciseType: meta.responseType,
          domain: resolved.exercise.payload.domain ?? "uncategorized",
          ordinal: meta.order,
          difficulty: String(resolved.exercise.difficulty),
          questionContentVersion: CONTENT_PACK_VERSION,
          questionContentHash: promptHash,
          ...(meta.responseType === "voice"
            ? {
                voiceExperienceVariant: participant.voiceExperienceVariant,
                waveformMode:
                  participant.voiceExperienceVariant === "assist_v2" ? "reactive_red" : "none",
                guidanceCopyVersion:
                  participant.voiceExperienceVariant === "assist_v2"
                    ? "voice-guidance-2026-08-v2"
                    : "voice-guidance-2026-08-v1",
                sttPipelineVersion:
                  participant.voiceExperienceVariant === "assist_v2"
                    ? "haru-dc-hp80-rms-v2"
                    : "decode-resample-only-v1",
              }
            : {}),
        },
        sessionId,
        questionInstanceId,
      );

      if (meta.responseType === "voice") {
        const outcome = outcomes.get(voiceSlotKey(participant, day));
        if (!outcome) throw new Error(`Missing voice outcome ${participant.participantId} day ${day}`);
        const narrative = voiceNarrative(persona, pairIndex, day);
        const audioDurationMs = voiceAudioDurationMs(seed, participant, day);
        const firstInteractionMs = Math.round(
          1_200 + score(seed, `${participant.pairId}|D${day}|voice-first`) * 2_400,
        );
        const firstInteractionAt = addMs(presentedAt, firstInteractionMs);
        const recordingStartedAt = firstInteractionAt;
        const recordingEndedAt = addMs(recordingStartedAt, audioDurationMs);
        const processedAt = addMs(recordingEndedAt, outcome.latencyMs);
        const completedAt = addMs(processedAt, 600);
        const hypothesisTranscript = hypothesisFor(
          narrative,
          outcome,
          seed,
          voiceSlotKey(participant, day),
        );
        const preprocessingVersion =
          participant.voiceExperienceVariant === "assist_v2"
            ? "haru-dc-hp80-rms-v2"
            : "decode-resample-only-v1";
        const reviewStatus: SyntheticSttReviewRow["status"] = outcome.droppedAtVoiceStep
          ? "abandoned"
          : outcome.noSpeech
            ? "no_speech"
            : "completed";
        const reviewRow: SyntheticSttReviewRow = {
          reviewRowId: `STT-${participant.participantId}-D${day}`,
          participantId: participant.participantId,
          pairId: participant.pairId,
          voiceExperienceVariant: participant.voiceExperienceVariant,
          day,
          questionId,
          sessionId,
          status: reviewStatus,
          noSpeech: outcome.noSpeech,
          retryCount: outcome.retryCount,
          latencyMs: outcome.latencyMs,
          audioDurationMs,
          referenceTranscript: narrative.referenceTranscript,
          hypothesisTranscript,
          usableTranscript: outcome.usableTranscript,
          wordErrorRate: wordErrorRate(narrative.referenceTranscript, hypothesisTranscript),
          engine: "qwen3-asr",
          model: "Qwen/Qwen3-ASR-1.7B",
          modelRevision: "qwen3-asr-evaluation-v1",
          preprocessingVersion,
          semanticSlots: semanticSlots(narrative, outcome.usableTranscript),
          droppedAtVoiceStep: outcome.droppedAtVoiceStep,
        };
        reviewRows.push(reviewRow);
        addEvent(
          "question_first_interaction",
          firstInteractionAt,
          { inputMode: "voice", latencyMs: firstInteractionMs },
          sessionId,
          questionInstanceId,
        );
        addEvent(
          "voice_capture_status",
          recordingStartedAt,
          {
            phase: "started",
            permission: "granted",
            voiceExperienceVariant: participant.voiceExperienceVariant,
            waveformMode:
              participant.voiceExperienceVariant === "assist_v2" ? "reactive_red" : "none",
            guidanceCopyVersion:
              participant.voiceExperienceVariant === "assist_v2"
                ? "voice-guidance-2026-08-v2"
                : "voice-guidance-2026-08-v1",
            sttPipelineVersion: preprocessingVersion,
          },
          sessionId,
          questionInstanceId,
        );
        if (outcome.retryCount > 0) {
          addEvent(
            "retry_started",
            addMs(recordingEndedAt, 200),
            { attempt: 2 },
            sessionId,
            questionInstanceId,
          );
        }

        if (outcome.droppedAtVoiceStep) {
          sessionAbandoned = true;
          const attempt: SyntheticQuestionAttempt = {
            participantId: participant.participantId,
            pairId: participant.pairId,
            voiceExperienceVariant: participant.voiceExperienceVariant,
            sessionId,
            questionInstanceId,
            questionId,
            questionType: "voice",
            domain: meta.domain,
            day,
            ordinal: meta.order,
            status: "abandoned",
            contentPackVersion: CONTENT_PACK_VERSION,
            questionContentHash: promptHash,
            presentedAt,
            firstInteractionAt,
            activeDurationMs: Date.parse(completedAt) - Date.parse(presentedAt),
            wallDurationMs: Date.parse(completedAt) - Date.parse(presentedAt),
            firstInteractionMs,
            feedbackDurationMs: 0,
            selectionChangeCount: 0,
            personalizationKind: resolved.personalization.kind,
            personalizationSourceQuestionIds: resolved.personalization.sourceQuestionIds ?? [],
            response: {
              isValid: false,
              retryCount: outcome.retryCount,
              hintCount: 0,
              skipReason: "voice_step_exit",
            },
          };
          sessionAttempts.push(attempt);
          attempts.push(attempt);
          addEvent(
            "voice_capture_status",
            processedAt,
            {
              phase: "cancelled",
              durationMs: audioDurationMs,
              sttStatus: "failed",
              sttLatencyMs: outcome.latencyMs,
              noSpeech: outcome.noSpeech,
              voiceExperienceVariant: participant.voiceExperienceVariant,
              waveformMode:
                participant.voiceExperienceVariant === "assist_v2" ? "reactive_red" : "none",
              guidanceCopyVersion:
                participant.voiceExperienceVariant === "assist_v2"
                  ? "voice-guidance-2026-08-v2"
                  : "voice-guidance-2026-08-v1",
              sttPipelineVersion: preprocessingVersion,
              outcomeReason: "cancelled",
            },
            sessionId,
            questionInstanceId,
          );
          addEvent(
            "session_exit_observed",
            completedAt,
            { reason: "close" },
            sessionId,
            questionInstanceId,
          );
          cursor = completedAt;
          break;
        }

        const storedAnnotations = outcome.usableTranscript ? narrative.annotations : [];
        const responseTimeMs = Date.parse(completedAt) - Date.parse(presentedAt);
        record.response = {
          response_id: `RES-${participant.participantId}-${questionId}`,
          input_mode: "voice",
          recording_started_at: recordingStartedAt,
          recording_ended_at: recordingEndedAt,
          audio_duration_seconds: audioDurationMs / 1_000,
          audio_storage: {
            object_key: "",
            mime_type: null,
            sample_rate_hz: null,
            channels: null,
            retention_status: "not_stored",
          },
          raw_user_utterance_transcript: hypothesisTranscript || null,
          stt: {
            engine: "qwen3-asr:Qwen/Qwen3-ASR-1.7B@evaluation-v1",
            status: outcome.noSpeech ? "failed" : "completed",
            no_speech: outcome.noSpeech,
            transcript: hypothesisTranscript || null,
            language: "ko-KR",
            confidence: null,
            processed_at: processedAt,
            model: "Qwen/Qwen3-ASR-1.7B",
            model_revision: "qwen3-asr-evaluation-v1",
            aligner_model: "Qwen/Qwen3-ForcedAligner-0.6B",
            aligner_revision: "qwen3-aligner-evaluation-v1",
            preprocessing_version: preprocessingVersion,
            segments:
              hypothesisTranscript.length > 0
                ? [
                    {
                      id: 0,
                      start: 0,
                      end: audioDurationMs / 1_000,
                      text: hypothesisTranscript,
                    },
                  ]
                : [],
          },
          user_correction: { was_corrected: false, corrected_transcript: null },
          derived_annotations: {
            status: storedAnnotations.length > 0 ? "completed" : "empty",
            items: storedAnnotations.map((item) => ({
              entity_type: item.entityType,
              value: item.value,
            })),
            note: "전사에서 명시적으로 확인된 개인화 후보 정보",
          },
          response_time_ms: responseTimeMs,
          is_valid: true,
        };
        const feedback = feedbackFor(resolved.exercise, persona);
        record.presentation.character_message = feedback;
        record.system_feedback = { feedback_text: feedback, shown_at: addMs(completedAt, 250) };
        const demoResponse: HaruDemoResponse = {
          questionId,
          responseType: "voice",
          responseTimeMs,
          isCorrect: null,
          voiceDurationSeconds: audioDurationMs / 1_000,
          sttStatus: outcome.noSpeech ? "failed" : "completed",
          sttLanguage: "ko-KR",
          sttEngine: "qwen3-asr",
          sttModel: "Qwen/Qwen3-ASR-1.7B",
          sttModelRevision: "qwen3-asr-evaluation-v1",
          sttPreprocessingVersion: preprocessingVersion,
          derivedAnnotations: storedAnnotations,
          personalization: resolved.personalization,
        };
        demoResponses.push(demoResponse);
        const attempt: SyntheticQuestionAttempt = {
          participantId: participant.participantId,
          pairId: participant.pairId,
          voiceExperienceVariant: participant.voiceExperienceVariant,
          sessionId,
          questionInstanceId,
          questionId,
          questionType: "voice",
          domain: meta.domain,
          day,
          ordinal: meta.order,
          status: "completed",
          contentPackVersion: CONTENT_PACK_VERSION,
          questionContentHash: promptHash,
          presentedAt,
          firstInteractionAt,
          completedAt,
          activeDurationMs: responseTimeMs,
          wallDurationMs: responseTimeMs,
          firstInteractionMs,
          confirmationLatencyMs: responseTimeMs,
          feedbackDurationMs: 1_400,
          selectionChangeCount: 0,
          personalizationKind: resolved.personalization.kind,
          personalizationSourceQuestionIds: resolved.personalization.sourceQuestionIds ?? [],
          response: {
            isValid: true,
            retryCount: outcome.retryCount,
            hintCount: 0,
          },
        };
        sessionAttempts.push(attempt);
        attempts.push(attempt);
        addEvent(
          "voice_capture_status",
          processedAt,
          {
            phase: "completed",
            durationMs: audioDurationMs,
            sttStatus: outcome.noSpeech ? "no_speech" : "completed",
            sttLatencyMs: outcome.latencyMs,
            noSpeech: outcome.noSpeech,
            voiceExperienceVariant: participant.voiceExperienceVariant,
            waveformMode:
              participant.voiceExperienceVariant === "assist_v2" ? "reactive_red" : "none",
            guidanceCopyVersion:
              participant.voiceExperienceVariant === "assist_v2"
                ? "voice-guidance-2026-08-v2"
                : "voice-guidance-2026-08-v1",
            sttPipelineVersion: preprocessingVersion,
            outcomeReason: outcome.noSpeech ? "no_speech" : "completed",
          },
          sessionId,
          questionInstanceId,
        );
        addEvent(
          "answer_confirmed",
          completedAt,
          {
            inputMode: "voice",
            responseIds: [],
            result: "unscored",
            responseTimeMs,
            activeResponseTimeMs: responseTimeMs,
            selectionChangeCount: 0,
          },
          sessionId,
          questionInstanceId,
        );
        addEvent(
          "question_completed",
          addMs(completedAt, 1_400),
          {
            attemptCount: outcome.retryCount + 1,
            activeDurationMs: responseTimeMs,
            wallDurationMs: responseTimeMs,
            feedbackDurationMs: 1_400,
          },
          sessionId,
          questionInstanceId,
        );
        cursor = addMs(completedAt, 3_000);
        continue;
      }

      const choices = record.question.choices;
      if (!choices) throw new Error(`Non-voice question ${questionId} has no choices`);
      const responseTimeMs = nonVoiceResponseTime(seed, participant, day, questionId);
      const firstInteractionMs = Math.max(500, Math.round(responseTimeMs * 0.52));
      const firstInteractionAt = addMs(presentedAt, firstInteractionMs);
      const completedAt = addMs(presentedAt, responseTimeMs);
      const inputMode =
        score(seed, `${participant.pairId}|D${day}|${questionId}|input`) < 0.55
          ? "physical_button"
          : "touch";
      const selectionChangeCount =
        score(seed, `${participant.pairId}|D${day}|${questionId}|change`) <
        participant.matchedProfile.selectionChangeRate
          ? 1
          : 0;
      let attemptResponse: SyntheticAttemptResponse;

      if (meta.responseType === "single_choice") {
        const selected = chooseSingleOption(
          seed,
          participant,
          day,
          questionId,
          choices,
          record.question.correct_answer,
          meta.scored,
        );
        record.response = {
          response_id: `RES-${participant.participantId}-${questionId}`,
          input_mode: inputMode,
          button_event: {
            button: selected.selected.button,
            position: selected.selected.position,
            color: selected.selected.color,
            pressed_at: completedAt,
          },
          selected_choice: {
            button: selected.selected.button,
            label: selected.selected.label,
          },
          response_time_ms: responseTimeMs,
          evaluation: {
            is_correct: selected.isCorrect,
            score: selected.isCorrect === null ? null : selected.isCorrect ? 1 : 0,
          },
          is_valid: true,
        };
        attemptResponse = {
          selectedOptionIds: [selected.selected.button],
          ...(selected.isCorrect === null ? {} : { isCorrect: selected.isCorrect }),
          isValid: true,
          retryCount: 0,
          hintCount: 0,
        };
        demoResponses.push({
          questionId,
          responseType: "single_choice",
          selectedOptionId: selected.selected.button,
          responseTimeMs,
          isCorrect: selected.isCorrect,
          personalization: resolved.personalization,
        });
        addEvent(
          "choice_changed",
          firstInteractionAt,
          {
            actionId: selected.selected.button,
            selectionState: "selected",
            selectionCount: 1,
            changeIndex: selectionChangeCount + 1,
          },
          sessionId,
          questionInstanceId,
        );
      } else {
        const correct = record.question.correct_answer;
        if (!correct || !("sequence" in correct)) {
          throw new Error(`Sequence question ${questionId} lacks sequence answer`);
        }
        const selected = chooseSequence(seed, participant, day, questionId, correct);
        const labelByButton = new Map(choices.map((choice) => [choice.button, choice.label]));
        const spacing = Math.max(250, Math.floor(responseTimeMs / (selected.sequence.length + 1)));
        record.response = {
          response_id: `RES-${participant.participantId}-${questionId}`,
          input_mode:
            inputMode === "touch" ? "touch_sequence" : "physical_button_sequence",
          button_events: selected.sequence.map((button, index) => ({
            sequence_index: index,
            button,
            choice_label: labelByButton.get(button) ?? button,
            pressed_at: addMs(presentedAt, spacing * (index + 1)),
            elapsed_ms_from_question: spacing * (index + 1),
          })),
          submitted_sequence: selected.sequence,
          submitted_labels: selected.sequence.map((button) => labelByButton.get(button) ?? button),
          submitted_at: completedAt,
          response_time_ms: responseTimeMs,
          evaluation: { is_correct: selected.isCorrect, score: selected.isCorrect ? 1 : 0 },
          is_valid: true,
        };
        attemptResponse = {
          sequenceIds: [...selected.sequence],
          isCorrect: selected.isCorrect,
          isValid: true,
          retryCount: 0,
          hintCount: 0,
        };
        demoResponses.push({
          questionId,
          responseType: "button_sequence",
          submittedSequence: [...selected.sequence],
          responseTimeMs,
          isCorrect: selected.isCorrect,
          personalization: resolved.personalization,
        });
        selected.sequence.forEach((button, index) =>
          addEvent(
            "sequence_changed",
            addMs(presentedAt, spacing * (index + 1)),
            { action: "add", itemId: button, position: index, itemCount: index + 1 },
            sessionId,
            questionInstanceId,
          ),
        );
      }

      const feedback = feedbackFor(resolved.exercise, persona);
      record.presentation.character_message = feedback;
      record.system_feedback = { feedback_text: feedback, shown_at: addMs(completedAt, 250) };
      const attempt: SyntheticQuestionAttempt = {
        participantId: participant.participantId,
        pairId: participant.pairId,
        voiceExperienceVariant: participant.voiceExperienceVariant,
        sessionId,
        questionInstanceId,
        questionId,
        questionType: meta.responseType,
        domain: meta.domain,
        day,
        ordinal: meta.order,
        status: "completed",
        contentPackVersion: CONTENT_PACK_VERSION,
        questionContentHash: promptHash,
        presentedAt,
        firstInteractionAt,
        completedAt,
        activeDurationMs: responseTimeMs,
        wallDurationMs: responseTimeMs,
        firstInteractionMs,
        confirmationLatencyMs: responseTimeMs,
        feedbackDurationMs: 1_200,
        selectionChangeCount,
        personalizationKind: resolved.personalization.kind,
        personalizationSourceQuestionIds: resolved.personalization.sourceQuestionIds ?? [],
        response: attemptResponse,
      };
      sessionAttempts.push(attempt);
      attempts.push(attempt);
      addEvent(
        "question_first_interaction",
        firstInteractionAt,
        { inputMode: inputMode === "touch" ? "touch" : "key_action", latencyMs: firstInteractionMs },
        sessionId,
        questionInstanceId,
      );
      addEvent(
        "answer_confirmed",
        completedAt,
        {
          inputMode: inputMode === "touch" ? "touch" : "key_action",
          responseIds: attemptResponse.selectedOptionIds ?? attemptResponse.sequenceIds ?? [],
          result:
            attemptResponse.isCorrect === undefined
              ? "unscored"
              : attemptResponse.isCorrect
                ? "correct"
                : "incorrect",
          responseTimeMs,
          activeResponseTimeMs: responseTimeMs,
          selectionChangeCount,
        },
        sessionId,
        questionInstanceId,
      );
      addEvent(
        "feedback_shown",
        addMs(completedAt, 250),
        {
          kind:
            attemptResponse.isCorrect === undefined
              ? "neutral"
              : attemptResponse.isCorrect
                ? "success"
                : "retry",
        },
        sessionId,
        questionInstanceId,
      );
      addEvent(
        "question_completed",
        addMs(completedAt, 1_200),
        {
          attemptCount: 1,
          activeDurationMs: responseTimeMs,
          wallDurationMs: responseTimeMs,
          feedbackDurationMs: 1_200,
        },
        sessionId,
        questionInstanceId,
      );
      cursor = addMs(completedAt, 2_800);
    }

    const endedAt = cursor;
    const completionStatus = sessionAbandoned ? "abandoned" : "completed";
    const scoredRecords = questionRecords.filter((record) => record.question.scored);
    const correctCount = scoredRecords.filter(
      (record) =>
        record.response &&
        "evaluation" in record.response &&
        record.response.evaluation.is_correct === true,
    ).length;
    const incorrectCount = scoredRecords.filter(
      (record) =>
        record.response &&
        "evaluation" in record.response &&
        record.response.evaluation.is_correct === false,
    ).length;
    const adminSession: HaruAdminUsageSession = {
      session_id: sessionId,
      user_id: participant.participantId,
      device_id: adminRecord.device.device_id,
      session_date: dateForDay(day),
      weekday: getLocalizedText(plan.weekday, "ko"),
      authentication: {
        method: "registered_card",
        card_token_id: adminRecord.user.card_token_id,
        authenticated_at: startedAt,
        result: "success",
      },
      session_started_at: startedAt,
      session_completed_at: endedAt,
      completion_status: completionStatus,
      question_count: 6,
      question_records: questionRecords,
      session_summary: sessionAbandoned
        ? null
        : {
            duration_seconds: Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1_000),
            scored_question_count: scoredRecords.length,
            correct_count: correctCount,
            incorrect_count: incorrectCount,
            completion_message: getLocalizedText(plan.completionMessage, "ko"),
            clinical_interpretation: null,
            risk_classification: null,
            admin_note: "활동 완료 기록이며 의료적 판정이 아님",
          },
    };
    adminRecord.sessions.push(adminSession);
    const completedQuestionCount = sessionAttempts.filter(
      (attempt) => attempt.status === "completed",
    ).length;
    const activeDurationMs = sessionAttempts.reduce(
      (total, attempt) => total + attempt.activeDurationMs,
      0,
    );
    operationalSessions.push({
      sessionId,
      participantId: participant.participantId,
      pairId: participant.pairId,
      voiceExperienceVariant: participant.voiceExperienceVariant,
      day,
      sessionDate: dateForDay(day),
      state: completionStatus,
      startedAt,
      endedAt,
      progressPercent: Math.round((completedQuestionCount / 6) * 10_000) / 100,
      activeDurationMs,
      wallDurationMs: Date.parse(endedAt) - Date.parse(startedAt),
      plannedQuestionCount: 6,
      presentedQuestionCount: sessionAttempts.length,
      completedQuestionCount,
      lastQuestionInstanceId: sessionAttempts.at(-1)?.questionInstanceId ?? "",
      dropoutCause: sessionAbandoned ? "voice_step" : null,
      returnedNextDay: sessionAbandoned && day < 7,
    });
    if (!sessionAbandoned) {
      addEvent(
        "routine_completed",
        endedAt,
        {
          questionCount: 6,
          activeDurationMs,
          wallDurationMs: Date.parse(endedAt) - Date.parse(startedAt),
        },
        sessionId,
      );
    }
    demoSessions.push({
      day,
      status: completionStatus,
      questionIds: questionRecords.map((record) => record.question.question_id),
      questionCount: 6,
      startedAt,
      endedAt,
      durationSeconds: Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1_000),
      completionMessage: sessionAbandoned ? null : getLocalizedText(plan.completionMessage, "ko"),
      responses: demoResponses,
    });
  }

  const chronologicalEvents = [...events]
    .sort(
      (left, right) =>
        Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.sequence - right.sequence,
    )
    .map(
      (event, index): SyntheticTelemetryEvent => ({
        ...event,
        sequence: index + 1,
        eventId: `evt_kr_${opaqueHex32(
          seed,
          `event|${participant.participantId}|${index + 1}`,
        )}`,
      }),
    );

  return {
    adminRecord,
    consentReceipt,
    sessions: operationalSessions,
    attempts,
    events: chronologicalEvents,
    reviewRows,
  };
}

function normalizeTables(
  participants: readonly SyntheticPilotParticipant[],
  consentReceipts: readonly SyntheticConsentReceipt[],
  sessions: readonly SyntheticRoutineSession[],
  attempts: readonly SyntheticQuestionAttempt[],
  reviewRows: readonly SyntheticSttReviewRow[],
  telemetryEvents: readonly SyntheticTelemetryEvent[],
  seed: string,
): SyntheticNormalizedTables {
  const reviewBySession = new Map(reviewRows.map((row) => [row.sessionId, row]));
  const participantByInstallation = new Map(
    participants.map((participant) => [installationIdFor(seed, participant), participant.participantId]),
  );
  return {
    participants: participants.map((participant) => ({
      participant_id: participant.participantId,
      pair_id: participant.pairId,
      voice_experience_variant: participant.voiceExperienceVariant,
      age_band: `${Math.floor(participant.ageAtStart / 5) * 5}-${
        Math.floor(participant.ageAtStart / 5) * 5 + 4
      }`,
      gender_code: participant.gender === "여성" ? "F" : "M",
      living_arrangement_code: participant.livingArrangementCode,
      non_voice_pace_ms: participant.matchedProfile.nonVoicePaceMs,
      voice_challenge_band: participant.matchedProfile.voiceChallengeBand,
      data_kind: "sample",
    })),
    consentReceipts: consentReceipts.map((receipt) => ({
      receipt_id: receipt.receiptId,
      participant_id: receipt.participantId,
      revision: receipt.revision,
      recorded_at: receipt.recordedAt,
      usage_analytics: receipt.grants.usageAnalytics,
      longitudinal_activity: receipt.grants.longitudinalActivity,
      voice_capture: receipt.grants.voiceCapture,
      stt_processing: receipt.grants.sttProcessing,
      transcript_storage: receipt.grants.transcriptStorage,
      audio_storage: receipt.grants.audioStorage,
      personalization: receipt.grants.personalization,
      family_sharing: receipt.grants.familySharing,
      data_kind: "sample",
    })),
    dailySessions: sessions.map((session) => ({
      participant_id: session.participantId,
      pair_id: session.pairId,
      voice_experience_variant: session.voiceExperienceVariant,
      day: session.day,
      session_date: session.sessionDate,
      session_state: session.state,
      progress_percent: session.progressPercent,
      active_duration_ms: session.activeDurationMs,
      wall_duration_ms: session.wallDurationMs,
      planned_question_count: session.plannedQuestionCount,
      presented_question_count: session.presentedQuestionCount,
      completed_question_count: session.completedQuestionCount,
      dropout_cause: session.dropoutCause,
      returned_next_day: session.returnedNextDay,
      voice_status: reviewBySession.get(session.sessionId)?.status ?? "missing",
    })),
    questionAttempts: attempts.map((attempt) => ({
      participant_id: attempt.participantId,
      pair_id: attempt.pairId,
      voice_experience_variant: attempt.voiceExperienceVariant,
      session_id: attempt.sessionId,
      question_instance_id: attempt.questionInstanceId,
      question_id: attempt.questionId,
      question_type: attempt.questionType,
      domain_code: attempt.domain,
      day: attempt.day,
      ordinal: attempt.ordinal,
      status: attempt.status,
      first_interaction_ms: attempt.firstInteractionMs,
      active_duration_ms: attempt.activeDurationMs,
      wall_duration_ms: attempt.wallDurationMs,
      feedback_duration_ms: attempt.feedbackDurationMs,
      selection_change_count: attempt.selectionChangeCount,
      is_correct: attempt.response?.isCorrect ?? null,
      is_valid: attempt.response?.isValid ?? false,
      retry_count: attempt.response?.retryCount ?? 0,
      hint_count: attempt.response?.hintCount ?? 0,
      skip_reason: attempt.response?.skipReason ?? null,
      personalization_kind: attempt.personalizationKind,
      personalization_source_count: attempt.personalizationSourceQuestionIds.length,
      question_content_hash: attempt.questionContentHash,
    })),
    voiceSteps: reviewRows.map((row) => {
      const preservedCount = row.semanticSlots.filter((slot) => slot.preserved).length;
      return {
        participant_id: row.participantId,
        pair_id: row.pairId,
        voice_experience_variant: row.voiceExperienceVariant,
        day: row.day,
        question_id: row.questionId,
        session_id: row.sessionId,
        status: row.status,
        no_speech: row.noSpeech,
        retry_count: row.retryCount,
        latency_ms: row.latencyMs,
        audio_duration_ms: row.audioDurationMs,
        usable_transcript: row.usableTranscript,
        word_error_rate: row.wordErrorRate,
        preprocessing_version: row.preprocessingVersion,
        semantic_slot_count: row.semanticSlots.length,
        preserved_slot_count: preservedCount,
        semantic_preservation_rate:
          row.semanticSlots.length === 0
            ? 0
            : Math.round((preservedCount / row.semanticSlots.length) * 1_000) / 1_000,
        dropped_at_voice_step: row.droppedAtVoiceStep,
      };
    }),
    telemetryEvents: telemetryEvents.map((event) => ({
      event_id: event.eventId,
      participant_id: participantByInstallation.get(event.installationId) ?? "unlinked",
      event_name: event.eventName,
      occurred_at: event.occurredAt,
      sequence: event.sequence,
      routine_session_id: event.routineSessionId ?? null,
      question_instance_id: event.questionInstanceId ?? null,
      route_id: event.routeId,
      consent_revision: event.consentRevision,
      payload_json: JSON.stringify(event.payload),
    })),
  };
}

function dataDictionary(): Record<string, unknown> {
  return {
    schemaVersion: PILOT_SCHEMA_VERSION,
    generatedAt: GENERATED_AT,
    dataKind: "sample",
    privacyClasses: {
      general_analytics:
        "직접 식별자와 전사문을 제외한 분석 자료. normalized CSV 전체가 해당됨.",
      restricted_stt_review:
        "reference/hypothesis transcript와 semantic slot을 포함한 제한 자료.",
      restricted_sample_admin_record:
        "사용자별 haru_kiosk_usage_record. 전사 포함, 음성 object 없음.",
    },
    tables: {
      participants: {
        grain: "participant",
        primaryKey: ["participant_id"],
        description: "20명 참여자의 익명화 분석 특성 및 A/B 배정",
      },
      daily_sessions: {
        grain: "participant-day",
        primaryKey: ["participant_id", "day"],
        description: "7일 일정별 완료·음성 단계 이탈·다음 날 복귀 상태",
      },
      consent_receipts: {
        grain: "participant consent revision",
        primaryKey: ["receipt_id"],
        description: "데이터 시작 시점의 독립 동의 snapshot",
      },
      question_attempts: {
        grain: "question instance",
        primaryKey: ["question_instance_id"],
        description: "문항별 반응·완료·개인화 provenance의 내용 비식별 분석 자료",
      },
      voice_steps: {
        grain: "scheduled voice step",
        primaryKey: ["participant_id", "day"],
        description: "음성 UX 결과·STT 지연·semantic 보존 집계. 전사문 미포함.",
      },
      stt_review_rows: {
        grain: "scheduled voice step",
        primaryKey: ["reviewRowId"],
        description: "전사 평가용 제한 자료. 운영 일반 분석 export와 분리.",
      },
      telemetry_events: {
        grain: "telemetry event",
        primaryKey: ["event_id"],
        description: "내용·전사·음성 없이 ID·상태·시간만 담은 분석 이벤트",
      },
    },
    controlledValues: {
      voiceExperienceVariant: ["baseline_v1", "assist_v2"],
      sessionState: ["completed", "abandoned"],
      dropoutCause: ["voice_step", null],
      sttStatus: ["completed", "failed", "no_speech", "abandoned"],
      personalizationKind: ["none", "profile", "prior_response", "fallback"],
    },
    metricDefinitions: {
      usableTranscriptRate:
        "usable_transcript=true인 voice step / variant별 70개 scheduled voice step",
      noSpeechRate: "no_speech=true인 voice step / variant별 70개 scheduled voice step",
      retryRate: "retry_count>0인 voice step / variant별 70개 scheduled voice step",
      voiceStepDropoutRate:
        "dropped_at_voice_step=true인 voice step / variant별 70개 scheduled voice step",
      sttLatencyP50Ms: "variant별 latency_ms의 중앙값",
      activeDurationMs: "문항 상호작용으로 기록된 활성 시간 합계",
      wallDurationMs: "세션 시작부터 종료 관찰까지 실제 경과 시간",
    },
    analysisScope: "참여·이탈·문항 시간·음성 UX 비교",
  };
}

function manifestFiles(participants: readonly SyntheticPilotParticipant[]): string[] {
  return [
    "manifest.json",
    "operational_export.json",
    "data_dictionary.json",
    "restricted/stt_review_rows.json",
    "normalized/participants.csv",
    "normalized/consent_receipts.csv",
    "normalized/daily_sessions.csv",
    "normalized/question_attempts.csv",
    "normalized/voice_steps.csv",
    "normalized/telemetry_events.csv",
    "admin_records/index.json",
    ...participants.map((participant) => `admin_records/${participant.participantId}.json`),
  ];
}

export function generateSyntheticVoicePilot(
  seed = SYNTHETIC_VOICE_PILOT_SEED,
): SyntheticVoicePilotBundle {
  const participants = createParticipants();
  const outcomes = createVoiceOutcomes(participants, seed);
  const generated = participants.map((participant, index) =>
    generateParticipant(participant, index, PERSONAS[index], seed, outcomes),
  );
  const adminRecords = generated.map((item) => item.adminRecord);
  const consentReceipts = generated.map((item) => item.consentReceipt);
  const routineSessions = generated.flatMap((item) => item.sessions);
  const questionAttempts = generated.flatMap((item) => item.attempts);
  const telemetryEvents = generated.flatMap((item) => item.events);
  const sttReviewRows = generated.flatMap((item) => item.reviewRows);
  const operationalExport: SyntheticOperationalExport = {
    schemaVersion: PILOT_SCHEMA_VERSION,
    generatedAt: GENERATED_AT,
    dataKind: "sample",
    seed,
    participants,
    consentReceipts,
    routineSessions,
    questionAttempts,
    telemetryEvents,
  };
  const manifest: SyntheticPilotManifest = {
    schemaVersion: PILOT_SCHEMA_VERSION,
    generatedAt: GENERATED_AT,
    dataKind: "sample",
    seed,
    title: "Haru 음성 UX 20명 × 7일 샘플 데이터",
    purpose: PURPOSE,
    market: "kr",
    locale: "ko-KR",
    period: { start: dateForDay(1), end: dateForDay(7) },
    participantCount: 20,
    matchedPairCount: 10,
    scheduledParticipantDays: 140,
    fileInventoryScope: "generated_data_outputs_only",
    analysisArtifactIndex: "analysis/artifact-index.json",
    voiceExperienceVariants: {
      baseline_v1: {
        participantCount: 10,
        preprocessingVersion: "decode-resample-only-v1",
      },
      assist_v2: {
        participantCount: 10,
        preprocessingVersion: "haru-dc-hp80-rms-v2",
      },
    },
    privacy: {
      containsDirectIdentifiers: false,
      containsAudioFiles: false,
      normalizedCsvContainsTranscript: false,
      operationalExportContainsTranscript: false,
      adminRecordsContainTranscript: true,
      restrictedReviewContainsTranscript: true,
    },
    files: manifestFiles(participants),
  };
  return {
    manifest,
    adminRecords,
    sttReviewRows,
    operationalExport,
    normalized: normalizeTables(
      participants,
      consentReceipts,
      routineSessions,
      questionAttempts,
      sttReviewRows,
      telemetryEvents,
      seed,
    ),
    dataDictionary: dataDictionary(),
  };
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: readonly Record<string, string | number | boolean | null>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header] ?? null)).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializeSyntheticVoicePilotFiles(
  bundle: SyntheticVoicePilotBundle,
): Record<string, string> {
  const files: Record<string, string> = {
    "manifest.json": prettyJson(bundle.manifest),
    "operational_export.json": prettyJson(bundle.operationalExport),
    "data_dictionary.json": prettyJson(bundle.dataDictionary),
    "restricted/stt_review_rows.json": prettyJson({
      schemaVersion: PILOT_SCHEMA_VERSION,
      generatedAt: GENERATED_AT,
      dataKind: "sample",
      classification: "restricted_stt_review",
      rows: bundle.sttReviewRows,
    }),
    "normalized/participants.csv": toCsv(bundle.normalized.participants),
    "normalized/consent_receipts.csv": toCsv(bundle.normalized.consentReceipts),
    "normalized/daily_sessions.csv": toCsv(bundle.normalized.dailySessions),
    "normalized/question_attempts.csv": toCsv(bundle.normalized.questionAttempts),
    "normalized/voice_steps.csv": toCsv(bundle.normalized.voiceSteps),
    "normalized/telemetry_events.csv": toCsv(bundle.normalized.telemetryEvents),
    "admin_records/index.json": prettyJson(
      bundle.adminRecords.map((record) => ({
        participantId: record.user.user_id,
        datasetId: record.dataset.dataset_id,
        path: `${record.user.user_id}.json`,
        sessionCount: record.sessions.length,
      })),
    ),
  };
  for (const record of bundle.adminRecords) {
    files[`admin_records/${record.user.user_id}.json`] = prettyJson(record);
  }
  return files;
}
