import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_QUESTION_META,
  getHaruWeekPlan,
  type HaruQuestionResponseType,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import {
  getMarketConfig,
  getRuntimeMarketConfig,
  type MarketCode,
  type MarketConfig,
} from "@/config/market";
import type { Exercise } from "@/data/mockExercises";
import {
  clearHaruAdminAudioStorage,
  deleteHaruAdminAudio,
  storeHaruAdminAudio,
  type HaruAdminAudioRetentionStatus,
} from "@/features/lessons/haruAdminAudioStorage";
import {
  HARU_ADMIN_DELETION_FENCE_STORAGE_KEY,
  hasHaruAdminDeletionFence,
} from "@/features/lessons/haruAdminDeletionFenceStorage";
import { parseHaruAdminUsageRecord } from "@/features/lessons/haruAdminUsageRecordParser";
import {
  patchHaruDemoVoiceResponse,
  type HaruPersonalizationRecord,
} from "@/features/lessons/haruDemoSessionStorage";
import {
  clearHaruRagOutbox,
  enqueueHaruRagRecord,
  enqueueHaruRagUserDeletion,
} from "@/features/lessons/haruRagSync";
import type { HaruDerivedAnnotation } from "@/features/lessons/haruResponseFacts";
import {
  getHaruConsent,
  type HaruConsentState,
} from "@/features/profile/haruConsentStorage";
import { clearSttJobQueue } from "@/features/speech/sttJobQueue";
import {
  clearHaruSttRetryOutbox,
  reconcileHaruSttRetryOutbox,
  type HaruSttRetryPatchResult,
  type HaruSttRetrySuccess,
} from "@/features/lessons/haruSttRetry";
import { getLocalizedText } from "@/utils/localizedText";
import { readJson, removeKey, writeJson } from "@/utils/safeStorage";

export const HARU_ADMIN_USAGE_RECORD_STORAGE_KEY = "haruAdminUsageRecord";
export const HARU_ADMIN_USAGE_RECORD_UPDATED_EVENT = "haru:admin-usage-record-updated";
export const HARU_ADMIN_WRITE_EPOCH_STORAGE_KEY = "haruAdminWriteEpoch";
export { HARU_ADMIN_DELETION_FENCE_STORAGE_KEY };
export const HARU_ADMIN_WRITE_INTENT_STORAGE_PREFIX = "haruAdminWriteIntent:";

export type HaruAdminButton = "A" | "B" | "C" | "D";
export type HaruAdminInputMode = "physical_button" | "touch" | "voice";

export const HARU_ADMIN_USER_ID = "USR-000001";
const USER_ID = HARU_ADMIN_USER_ID;
const CARD_TOKEN_ID = "CARD-DEMO-000001";
const DEVICE_ID = "KIOSK-DEMO-001";
const DATASET_ID = "HARU-DEMO-USER-001-WEEK-01";
const BUTTONS: readonly HaruAdminButton[] = ["A", "B", "C", "D"];
const ADMIN_REALM_ID_STORAGE_KEY = "haruAdminRealmId";
const ADMIN_WRITE_INTENT_STALE_MS = 2 * 60 * 1_000;
const ADMIN_WRITE_INTENT_WAIT_MS = 10_000;
const ADMIN_WRITE_INTENT_POLL_MS = 5;
let volatileAdminWriteEpoch = 0;
let volatileAudioResponseSequence = 0;
let volatileAdminRealmId: string | null = null;
let activeAdminRecordClearOperations = 0;
let activeAdminTranscriptDeletionOperations = 0;
let activeAdminAudioDeletionOperations = 0;
const pendingAdminAudioStores = new Set<
  Promise<HaruAdminAudioRetentionStatus>
>();
const pendingAdminAudioDeletes = new Set<Promise<void>>();
const activeAdminDeletionFenceTokens = new Set<string>();

interface HaruAdminWriteGuard {
  consentRevision: string;
  writeEpoch: string;
}

type HaruAdminDeletionKind =
  | "clear"
  | "voice_scrub"
  | "transcript_scrub"
  | "audio_scrub";
type HaruAdminWriteIntentKind = "record" | "audio";

interface HaruAdminDeletionFence {
  version: 1;
  token: string;
  ownerRealmId: string;
  kind: HaruAdminDeletionKind;
  createdAt: string;
}

interface HaruAdminWriteIntent {
  version: 1;
  intentId: string;
  ownerRealmId: string;
  kind: HaruAdminWriteIntentKind;
  writeEpoch: string;
  createdAt: string;
}

interface PersistedAdminWriteIntent {
  key: string;
  intent: HaruAdminWriteIntent;
}

type HaruAdminButtonLayout = Record<
  HaruAdminButton,
  { position: string; color: string }
>;

const BUTTON_LAYOUT_BY_MARKET: Record<MarketCode, HaruAdminButtonLayout> = {
  kr: {
    A: { position: "왼쪽 위", color: "빨강" },
    B: { position: "오른쪽 위", color: "노랑" },
    C: { position: "왼쪽 아래", color: "초록" },
    D: { position: "오른쪽 아래", color: "파랑" },
  },
  jp: {
    A: { position: "左上", color: "赤" },
    B: { position: "右上", color: "黄" },
    C: { position: "左下", color: "緑" },
    D: { position: "右下", color: "青" },
  },
};

const ADMIN_MARKET_CONTENT = {
  kr: {
    purpose:
      "시스템 관리자가 실제 사용 세션에서 저장되는 사용자·문항·응답·처리 결과를 확인하기 위한 데모 데이터",
    recordingPrinciples: [
      "Knowledge Graph 자체는 포함하지 않음",
      "사용자에게 실제 제시된 문항 스냅샷을 저장",
      "버튼 입력은 물리 버튼, 선택지, 입력 시각, 반응시간을 저장",
      "음성 입력은 음성 파일 참조, 원문 전사, STT 결과와 처리 상태를 저장",
      "정답 여부와 점수는 내부 운영 데이터이며 사용자 화면의 진단 판정과 분리",
    ],
    dataClassification: "발표·개발용 가상 개인정보",
    siteId: "SITE-DEMO-YUSEONG-01",
    siteName: "유성구 복지관 데모존",
    derivedAnnotationNote:
      "향후 개인화 문항 생성에 사용할 수 있는 파생 정보. 원문 응답과 분리 저장.",
    scrubbedVoiceNote: "동의 철회 후 음성 원문과 파생 정보를 삭제함.",
    completionAdminNote:
      "사용자 화면에는 진단·위험도 판정 없이 완료와 격려 중심으로 표시",
  },
  jp: {
    purpose:
      "システム管理者が利用セッションで保存される利用者・設問・回答・処理結果を確認するためのデモデータ",
    recordingPrinciples: [
      "Knowledge Graph自体は含めない",
      "利用者に実際に提示した設問のスナップショットを保存する",
      "ボタン入力はボタン、選択肢、入力時刻、回答時間を保存する",
      "音声入力は音声ファイル参照、文字起こし、音声認識結果、処理状態を保存する",
      "回答結果は運用記録として扱い、利用者向けの医療的な判定とは分ける",
    ],
    dataClassification: "発表・開発用の架空個人情報",
    siteId: "SITE-DEMO-TOKYO-01",
    siteName: "東京都内 地域交流センター（デモ会場）",
    derivedAnnotationNote:
      "今後の個別化設問に利用できる派生情報。回答原文とは分けて保存する。",
    scrubbedVoiceNote: "同意の撤回後、音声の原文と派生情報を削除した。",
    completionAdminNote:
      "利用者画面では医療的な判定を示さず、完了と励ましを中心に表示する",
  },
} as const;

const DOMAIN_BY_MARKET: Record<MarketCode, Record<string, string>> = {
  kr: {},
  jp: {
    감정: "感情",
    "시간 지남력": "時間の見当識",
    "일반 개인 기억": "一般的な個人の記憶",
    "주의·계산": "注意・計算",
    "일상·개인화 정보 수집": "日常・個別化情報の収集",
    "단어·순서 기억": "単語・順序の記憶",
    "전날 활동 회상": "前日の活動の振り返り",
    "언어 이해": "言語理解",
    "시공간·주의": "視空間・注意",
    시공간: "視空間",
    "장기·주간 개인 기억": "長期・週間の個人記憶",
    "개인화 주의·계산": "個別化した注意・計算",
    "주간 회고·개인화 정보 수집": "週間の振り返り・個別化情報の収集",
  },
};

interface HaruAdminChoice {
  button: HaruAdminButton;
  position: string;
  color: string;
  label: string;
}

interface HaruAdminEvaluation {
  is_correct: boolean | null;
  score: number | null;
}

interface HaruAdminSingleChoiceResponse {
  response_id: string;
  input_mode: Exclude<HaruAdminInputMode, "voice">;
  button_event: {
    button: HaruAdminButton;
    position: string;
    color: string;
    pressed_at: string;
  };
  selected_choice: { button: HaruAdminButton; label: string };
  response_time_ms: number;
  evaluation: HaruAdminEvaluation;
  is_valid: boolean;
}

interface HaruAdminSequenceResponse {
  response_id: string;
  input_mode: "physical_button_sequence" | "touch_sequence";
  button_events: Array<{
    sequence_index: number;
    button: HaruAdminButton;
    choice_label: string;
    pressed_at: string;
    elapsed_ms_from_question: number;
  }>;
  submitted_sequence: HaruAdminButton[];
  submitted_labels: string[];
  submitted_at: string;
  response_time_ms: number;
  evaluation: HaruAdminEvaluation;
  is_valid: boolean;
}

interface HaruAdminVoiceResponse {
  response_id: string;
  input_mode: "voice";
  recording_started_at: string | null;
  recording_ended_at: string | null;
  audio_duration_seconds: number;
  audio_storage: {
    object_key: string;
    mime_type: string | null;
    sample_rate_hz: number | null;
    channels: number | null;
    retention_status: HaruAdminAudioRetentionStatus;
  };
  raw_user_utterance_transcript: string | null;
  stt: {
    engine: string;
    status: "completed" | "failed";
    no_speech: boolean;
    transcript: string | null;
    language: string | null;
    confidence: number | null;
    processed_at: string | null;
    model: string | null;
    model_revision: string | null;
    aligner_model: string | null;
    aligner_revision: string | null;
    preprocessing_version: string | null;
    segments: Array<{
      id: number;
      start: number;
      end: number;
      text: string;
    }>;
  };
  user_correction: {
    was_corrected: false;
    corrected_transcript: null;
  };
  derived_annotations: {
    status: "completed" | "empty";
    items: Array<{ entity_type: string; value: string }>;
    note: string;
  };
  response_time_ms: number;
  is_valid: boolean;
}

type HaruAdminResponse =
  | HaruAdminSingleChoiceResponse
  | HaruAdminSequenceResponse
  | HaruAdminVoiceResponse;

export interface HaruAdminQuestionRecord {
  presentation: {
    presented_at: string;
    screen_state: "question";
    character_message: string | null;
  };
  question: {
    question_id: string;
    order: number;
    domain: string;
    response_type: HaruQuestionResponseType;
    prompt_text: string;
    prompt_audio_text: string;
    scored: boolean;
    choices: HaruAdminChoice[] | null;
    correct_answer:
      | { button: HaruAdminButton; label: string }
      | { sequence: HaruAdminButton[]; labels: string[] }
      | null;
    personalization_source_note: string | null;
    max_response_seconds: number | null;
  };
  response: HaruAdminResponse | null;
  system_feedback: {
    feedback_text: string;
    shown_at: string;
  } | null;
}

export interface HaruAdminUsageSession {
  session_id: string;
  user_id: string;
  device_id: string;
  session_date: string;
  weekday: string;
  authentication: {
    method: "registered_card";
    card_token_id: string;
    authenticated_at: string;
    result: "success";
  };
  session_started_at: string;
  session_completed_at: string | null;
  completion_status: "in_progress" | "completed" | "abandoned";
  question_count: number;
  question_records: HaruAdminQuestionRecord[];
  session_summary: {
    duration_seconds: number;
    scored_question_count: number;
    correct_count: number;
    incorrect_count: number;
    completion_message: string;
    clinical_interpretation: null;
    risk_classification: null;
    admin_note: string;
  } | null;
}

export interface HaruAdminUsageRecord {
  schema: {
    name: "haru_kiosk_usage_record";
    version: "1.0.0";
    purpose: string;
    recording_principle: string[];
  };
  dataset: {
    dataset_id: string;
    generated_at: string;
    market: MarketCode;
    ui_locale: MarketConfig["locale"];
    content_pack_version: string;
    currency: MarketConfig["currency"];
    data_classification: string;
    is_synthetic: true;
    period: { start: string; end: string };
  };
  user: {
    user_id: string;
    card_token_id: string;
    market: MarketCode;
    ui_locale: MarketConfig["locale"];
    display_name: string;
    birth_year: number;
    age_at_period_start: number;
    gender: string;
    residence: string;
    living_arrangement: string;
    speech_profile_note: string;
    registered_profile_fields: Record<string, string>;
    consents: {
      voice_recording: boolean;
      stt_processing: boolean;
      transcript_storage: boolean;
      audio_storage: boolean;
      longitudinal_usage_storage: boolean;
      personalized_question_use: boolean;
      consented_at: string;
    };
  };
  device: {
    device_id: string;
    site_id: string;
    site_name: string;
    input_devices: string[];
    button_layout: HaruAdminButtonLayout;
    software_version: string;
    timezone: MarketConfig["timeZone"];
  };
  sessions: HaruAdminUsageSession[];
}

export interface HaruAdminSequenceButtonEventInput {
  optionId: string;
  pressedAt: string;
  elapsedMsFromQuestion: number;
  inputMode?: Exclude<HaruAdminInputMode, "voice">;
}

export interface HaruAdminLiveResponseInput {
  questionId: string;
  responseType: HaruQuestionResponseType;
  selectedOptionId?: string;
  submittedSequence?: string[];
  responseTimeMs: number;
  isCorrect: boolean | null;
  feedback: string;
  respondedAt?: string;
  inputMode?: Exclude<HaruAdminInputMode, "voice">;
  buttonPressedAt?: string;
  sequenceButtonEvents?: HaruAdminSequenceButtonEventInput[];
  voiceDurationSeconds?: number;
  recordingStartedAt?: string;
  recordingEndedAt?: string;
  audioBlob?: Blob;
  audioSampleRateHz?: number;
  audioChannelCount?: number;
  sttStatus?: "completed" | "failed";
  sttNoSpeech?: boolean;
  sttLanguage?: string;
  sttConfidence?: number;
  sttProcessedAt?: string;
  sttEngine?: string;
  sttModel?: string;
  sttModelRevision?: string;
  sttAlignerModel?: string;
  sttAlignerRevision?: string;
  sttPreprocessingVersion?: string;
  sttSegments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  rawUserUtteranceTranscript?: string;
  derivedAnnotations?: HaruDerivedAnnotation[];
}

const MARKET_UTC_OFFSET_MINUTES: Record<MarketCode, number> = {
  kr: 9 * 60,
  jp: 9 * 60,
};

function toMarketIsoString(
  date: Date,
  market: MarketCode = getRuntimeMarketConfig().market,
): string {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const offsetMinutes = MARKET_UTC_OFFSET_MINUTES[market];
  const offsetHours = String(Math.floor(offsetMinutes / 60)).padStart(2, "0");
  const offsetRemainder = String(offsetMinutes % 60).padStart(2, "0");
  return new Date(safeDate.getTime() + offsetMinutes * 60 * 1000)
    .toISOString()
    .replace("Z", `+${offsetHours}:${offsetRemainder}`);
}

function normalizeTimestamp(value: string | undefined, fallback: Date): string {
  if (!value) return toMarketIsoString(fallback);
  const parsed = new Date(value);
  return toMarketIsoString(Number.isNaN(parsed.getTime()) ? fallback : parsed);
}

function normalizeOptionalTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : toMarketIsoString(parsed);
}

function createEmptyRecord(now: Date): HaruAdminUsageRecord {
  const marketConfig = getRuntimeMarketConfig();
  const marketContent = ADMIN_MARKET_CONTENT[marketConfig.market];
  const language = marketConfig.language;
  const firstPlan = getHaruWeekPlan(1, marketConfig.market);
  const lastPlan = getHaruWeekPlan(7, marketConfig.market);
  const profile = HARU_DEMO_PERSONA.registeredProfileFields;
  const consent = getHaruConsent();
  const registeredProfileFields: Record<string, string> =
    marketConfig.market === "jp"
      ? {
          出身地: getLocalizedText(profile.hometown, language),
          出身小学校: getLocalizedText(profile.elementarySchool, language),
          以前の仕事: getLocalizedText(profile.formerOccupation, language),
          娘: getLocalizedText(profile.daughterName, language),
          孫: getLocalizedText(profile.grandsonName, language),
          親しい友人: getLocalizedText(profile.closeFriendName, language),
          近所の知人: getLocalizedText(profile.neighborName, language),
          好きな食べ物: getLocalizedText(profile.favoriteFood, language),
          服薬時間: getLocalizedText(profile.medicationTime, language),
        }
      : {
          고향: getLocalizedText(profile.hometown, language),
          졸업학교: getLocalizedText(profile.elementarySchool, language),
          과거직업: getLocalizedText(profile.formerOccupation, language),
          딸: getLocalizedText(profile.daughterName, language),
          손자: getLocalizedText(profile.grandsonName, language),
          가까운친구: getLocalizedText(profile.closeFriendName, language),
          이웃: getLocalizedText(profile.neighborName, language),
          좋아하는음식: getLocalizedText(profile.favoriteFood, language),
          복약시간: getLocalizedText(profile.medicationTime, language),
        };
  return {
    schema: {
      name: "haru_kiosk_usage_record",
      version: "1.0.0",
      purpose: marketContent.purpose,
      recording_principle: [...marketContent.recordingPrinciples],
    },
    dataset: {
      dataset_id: DATASET_ID,
      generated_at: toMarketIsoString(now, marketConfig.market),
      market: marketConfig.market,
      ui_locale: marketConfig.locale,
      content_pack_version: marketConfig.contentPackVersion,
      currency: marketConfig.currency,
      data_classification: marketContent.dataClassification,
      is_synthetic: true,
      period: { start: firstPlan.dateISO, end: lastPlan.dateISO },
    },
    user: {
      user_id: USER_ID,
      card_token_id: CARD_TOKEN_ID,
      market: marketConfig.market,
      ui_locale: marketConfig.locale,
      display_name: getLocalizedText(HARU_DEMO_PERSONA.name, language),
      birth_year: HARU_DEMO_PERSONA.birthYear,
      age_at_period_start: HARU_DEMO_PERSONA.age,
      gender: getLocalizedText(HARU_DEMO_PERSONA.gender, language),
      residence: getLocalizedText(HARU_DEMO_PERSONA.residence, language),
      living_arrangement: getLocalizedText(HARU_DEMO_PERSONA.livingArrangement, language),
      speech_profile_note: getLocalizedText(HARU_DEMO_PERSONA.speechProfileNote, language),
      registered_profile_fields: registeredProfileFields,
      consents: {
        voice_recording: consent.voiceRecording,
        stt_processing: consent.sttProcessing,
        transcript_storage: consent.transcriptStorage,
        audio_storage: consent.audioStorage,
        longitudinal_usage_storage: consent.longitudinalUsageStorage,
        personalized_question_use: consent.personalizedQuestionUse,
        consented_at: consent.consentedAt,
      },
    },
    device: {
      device_id: DEVICE_ID,
      site_id: marketContent.siteId,
      site_name: marketContent.siteName,
      input_devices: ["microphone", "physical_button_2x2", "card_reader"],
      button_layout: BUTTON_LAYOUT_BY_MARKET[marketConfig.market],
      software_version: "haru-demo-0.3.0",
      timezone: marketConfig.timeZone,
    },
    sessions: [],
  };
}

function dispatchUpdate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HARU_ADMIN_USAGE_RECORD_UPDATED_EVENT));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readRawStorageValue(key: string): string | null | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    return window.localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

function parseDeletionFence(value: unknown): HaruAdminDeletionFence | null {
  if (!isObject(value)) return null;
  if (
    value.version !== 1 ||
    typeof value.token !== "string" ||
    value.token.trim().length === 0 ||
    typeof value.ownerRealmId !== "string" ||
    value.ownerRealmId.trim().length === 0 ||
    (value.kind !== "clear" &&
      value.kind !== "voice_scrub" &&
      value.kind !== "transcript_scrub" &&
      value.kind !== "audio_scrub") ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    return null;
  }
  return value as unknown as HaruAdminDeletionFence;
}

function readDeletionFence(): HaruAdminDeletionFence | null {
  const raw = readRawStorageValue(HARU_ADMIN_DELETION_FENCE_STORAGE_KEY);
  if (raw === null || raw === undefined) return null;
  try {
    return parseDeletionFence(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function durableDeletionFenceExists(): boolean {
  return hasHaruAdminDeletionFence();
}

function ownsDeletionFence(fence: HaruAdminDeletionFence): boolean {
  const persisted = readDeletionFence();
  return (
    persisted?.token === fence.token &&
    persisted.ownerRealmId === fence.ownerRealmId &&
    persisted.kind === fence.kind
  );
}

function getAdminRealmId(): string {
  if (volatileAdminRealmId) return volatileAdminRealmId;
  try {
    const existing = window.sessionStorage.getItem(ADMIN_REALM_ID_STORAGE_KEY);
    if (existing?.trim()) {
      volatileAdminRealmId = existing.trim();
      return volatileAdminRealmId;
    }
    const created = createAudioResponseInstanceId();
    window.sessionStorage.setItem(ADMIN_REALM_ID_STORAGE_KEY, created);
    const verified = window.sessionStorage.getItem(ADMIN_REALM_ID_STORAGE_KEY);
    if (verified === created) {
      volatileAdminRealmId = created;
      return created;
    }
  } catch {
    // Restricted browsers retain a realm-local opaque owner id.
  }
  volatileAdminRealmId = createAudioResponseInstanceId();
  return volatileAdminRealmId;
}

function parseAdminWriteIntent(value: unknown): HaruAdminWriteIntent | null {
  if (!isObject(value)) return null;
  if (
    value.version !== 1 ||
    typeof value.intentId !== "string" ||
    value.intentId.trim().length === 0 ||
    typeof value.ownerRealmId !== "string" ||
    value.ownerRealmId.trim().length === 0 ||
    (value.kind !== "record" && value.kind !== "audio") ||
    typeof value.writeEpoch !== "string" ||
    value.writeEpoch.trim().length === 0 ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    return null;
  }
  return value as unknown as HaruAdminWriteIntent;
}

function readAdminWriteIntents(): {
  intents: PersistedAdminWriteIntent[];
  malformed: string[];
} | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const intents: PersistedAdminWriteIntent[] = [];
    const malformed: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(HARU_ADMIN_WRITE_INTENT_STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      try {
        const intent = raw === null
          ? null
          : parseAdminWriteIntent(JSON.parse(raw) as unknown);
        if (intent) intents.push({ key, intent });
        else malformed.push(key);
      } catch {
        malformed.push(key);
      }
    }
    return { intents, malformed };
  } catch {
    return null;
  }
}

function adminWriteIntentIsCurrent(
  marker: PersistedAdminWriteIntent,
  writeGuard: HaruAdminWriteGuard,
): boolean {
  const raw = readRawStorageValue(marker.key);
  if (raw === null || raw === undefined || durableDeletionFenceExists()) return false;
  try {
    const persisted = parseAdminWriteIntent(JSON.parse(raw) as unknown);
    return (
      persisted?.intentId === marker.intent.intentId &&
      persisted.ownerRealmId === marker.intent.ownerRealmId &&
      persisted.writeEpoch === marker.intent.writeEpoch &&
      adminWriteGuardCoreMatches(writeGuard)
    );
  } catch {
    return false;
  }
}

function beginAdminWriteIntent(
  kind: HaruAdminWriteIntentKind,
  writeGuard: HaruAdminWriteGuard,
): PersistedAdminWriteIntent | null {
  if (durableDeletionFenceExists() || !adminWriteGuardCoreMatches(writeGuard)) {
    return null;
  }
  const intent: HaruAdminWriteIntent = {
    version: 1,
    intentId: createAudioResponseInstanceId(),
    ownerRealmId: getAdminRealmId(),
    kind,
    writeEpoch: writeGuard.writeEpoch,
    createdAt: new Date().toISOString(),
  };
  const key = `${HARU_ADMIN_WRITE_INTENT_STORAGE_PREFIX}${intent.intentId}`;
  const marker = { key, intent };
  if (!writeJson(key, intent) || !adminWriteIntentIsCurrent(marker, writeGuard)) {
    finishAdminWriteIntent(marker);
    return null;
  }
  return marker;
}

function finishAdminWriteIntent(marker: PersistedAdminWriteIntent): boolean {
  const raw = readRawStorageValue(marker.key);
  if (raw === null) return true;
  if (raw === undefined) return false;
  try {
    const persisted = parseAdminWriteIntent(JSON.parse(raw) as unknown);
    if (
      persisted?.intentId !== marker.intent.intentId ||
      persisted.ownerRealmId !== marker.intent.ownerRealmId
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return removeKey(marker.key);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function acquireAdminDeletionFence(
  kind: HaruAdminDeletionKind,
): Promise<HaruAdminDeletionFence> {
  const ownerRealmId = getAdminRealmId();
  const rawExisting = readRawStorageValue(HARU_ADMIN_DELETION_FENCE_STORAGE_KEY);
  if (rawExisting === undefined) {
    throw new Error("haru-admin-deletion-fence-storage-unavailable");
  }
  if (rawExisting !== null) {
    const existing = readDeletionFence();
    if (
      !existing ||
      existing.ownerRealmId !== ownerRealmId ||
      activeAdminDeletionFenceTokens.has(existing.token)
    ) {
      throw new Error("haru-admin-deletion-in-progress");
    }
    activeAdminDeletionFenceTokens.add(existing.token);
    return existing;
  }

  const fence: HaruAdminDeletionFence = {
    version: 1,
    token: createAudioResponseInstanceId(),
    ownerRealmId,
    kind,
    createdAt: new Date().toISOString(),
  };
  if (!writeJson(HARU_ADMIN_DELETION_FENCE_STORAGE_KEY, fence)) {
    throw new Error("haru-admin-deletion-fence-write-failed");
  }
  await delay(0);
  if (!ownsDeletionFence(fence)) {
    throw new Error("haru-admin-deletion-fence-lost");
  }
  activeAdminDeletionFenceTokens.add(fence.token);
  return fence;
}

async function waitForDurableAdminWriteIntents(
  fence: HaruAdminDeletionFence,
): Promise<void> {
  const startedAt = Date.now();
  while (true) {
    if (!ownsDeletionFence(fence)) {
      throw new Error("haru-admin-deletion-fence-lost");
    }
    const pending = readAdminWriteIntents();
    if (!pending) throw new Error("haru-admin-write-intent-read-failed");
    if (pending.malformed.length > 0) {
      throw new Error("haru-admin-write-intent-stale");
    }
    const now = Date.now();
    if (
      pending.intents.some(
        ({ intent }) => now - Date.parse(intent.createdAt) > ADMIN_WRITE_INTENT_STALE_MS,
      )
    ) {
      throw new Error("haru-admin-write-intent-stale");
    }
    if (pending.intents.length === 0) return;
    if (now - startedAt > ADMIN_WRITE_INTENT_WAIT_MS) {
      throw new Error("haru-admin-write-intent-timeout");
    }
    await delay(ADMIN_WRITE_INTENT_POLL_MS);
  }
}

function releaseAdminDeletionFence(fence: HaruAdminDeletionFence): boolean {
  if (!ownsDeletionFence(fence)) return false;
  return (
    removeKey(HARU_ADMIN_DELETION_FENCE_STORAGE_KEY) &&
    readRawStorageValue(HARU_ADMIN_DELETION_FENCE_STORAGE_KEY) === null
  );
}

function consentRevision(consent: HaruConsentState): string {
  return JSON.stringify([
    consent.voiceRecording,
    consent.sttProcessing,
    consent.transcriptStorage,
    consent.audioStorage,
    consent.longitudinalUsageStorage,
  ]);
}

function persistedAdminWriteEpoch(): number {
  const value = readJson<unknown>(HARU_ADMIN_WRITE_EPOCH_STORAGE_KEY, 0);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function currentAdminWriteEpoch(): string {
  return `${persistedAdminWriteEpoch()}:${volatileAdminWriteEpoch}`;
}

function captureAdminWriteGuard(): HaruAdminWriteGuard {
  return {
    consentRevision: consentRevision(getHaruConsent()),
    writeEpoch: currentAdminWriteEpoch(),
  };
}

function adminWriteGuardCoreMatches(guard: HaruAdminWriteGuard): boolean {
  return (
    guard.consentRevision === consentRevision(getHaruConsent()) &&
    guard.writeEpoch === currentAdminWriteEpoch()
  );
}

function adminWriteGuardMatches(guard: HaruAdminWriteGuard): boolean {
  return !durableDeletionFenceExists() && adminWriteGuardCoreMatches(guard);
}

function advanceAdminWriteEpoch(): boolean {
  const next = persistedAdminWriteEpoch() + 1;
  volatileAdminWriteEpoch += 1;
  return (
    writeJson(HARU_ADMIN_WRITE_EPOCH_STORAGE_KEY, next) &&
    persistedAdminWriteEpoch() === next
  );
}

function safeAudioObjectKeySegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function createAudioResponseInstanceId(): string {
  try {
    const randomUuid = globalThis.crypto?.randomUUID?.();
    if (randomUuid) return randomUuid;
  } catch {
    // Continue with the local collision-resistant fallback below.
  }

  volatileAudioResponseSequence += 1;
  return [
    Date.now().toString(36),
    volatileAudioResponseSequence.toString(36),
    Math.random().toString(36).slice(2, 12),
  ].join("-");
}

function createVoiceAudioObjectKey(
  questionId: string,
  sessionDate: string,
  writeGuard: HaruAdminWriteGuard,
  mimeType: string | undefined,
): string {
  const extension = mimeType?.includes("ogg") ? "ogg" : "webm";
  const generation = safeAudioObjectKeySegment(writeGuard.writeEpoch);
  const responseInstanceId = safeAudioObjectKeySegment(
    createAudioResponseInstanceId(),
  );
  return `voice/${USER_ID}/${sessionDate}/g-${generation}/${safeAudioObjectKeySegment(
    questionId,
  )}-${responseInstanceId}.${extension}`;
}

function storeTrackedHaruAdminAudio(
  objectKey: string,
  blob: Blob,
  storedAt: string,
  writeGuard: HaruAdminWriteGuard,
): Promise<HaruAdminAudioRetentionStatus> {
  const writeIntent = beginAdminWriteIntent("audio", writeGuard);
  if (!writeIntent) return Promise.resolve("not_stored");
  const pendingStore = (async (): Promise<HaruAdminAudioRetentionStatus> => {
    let retentionStatus: HaruAdminAudioRetentionStatus = "not_stored";
    try {
      if (adminWriteIntentIsCurrent(writeIntent, writeGuard)) {
        retentionStatus = await storeHaruAdminAudio(objectKey, blob, storedAt);
      }
      if (
        retentionStatus === "stored" &&
        !adminWriteIntentIsCurrent(writeIntent, writeGuard)
      ) {
        await deleteHaruAdminAudio(objectKey);
        retentionStatus = "not_stored";
      }
    } finally {
      if (!finishAdminWriteIntent(writeIntent) && retentionStatus === "stored") {
        await deleteHaruAdminAudio(objectKey);
        retentionStatus = "not_stored";
      }
    }
    return retentionStatus;
  })();
  pendingAdminAudioStores.add(pendingStore);
  const forgetStore = () => {
    pendingAdminAudioStores.delete(pendingStore);
  };
  void pendingStore.then(forgetStore, forgetStore);
  return pendingStore;
}

async function waitForPendingAdminAudioStores(): Promise<void> {
  while (
    pendingAdminAudioStores.size > 0 ||
    pendingAdminAudioDeletes.size > 0
  ) {
    await Promise.allSettled([
      ...pendingAdminAudioStores,
      ...pendingAdminAudioDeletes,
    ]);
  }
}

function purgeStaleAdminRecord(): void {
  removeKey(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY);
  clearHaruSttRetryOutbox();
  enqueueHaruRagUserDeletion(HARU_ADMIN_USER_ID);
  dispatchUpdate();
}

function consentSnapshot(consent: HaruConsentState) {
  return {
    voice_recording: consent.voiceRecording,
    stt_processing: consent.sttProcessing,
    transcript_storage: consent.transcriptStorage,
    audio_storage: consent.audioStorage,
    longitudinal_usage_storage: consent.longitudinalUsageStorage,
    personalized_question_use: consent.personalizedQuestionUse,
    consented_at: consent.consentedAt,
  };
}

function consentSafeAdminRecord(
  record: HaruAdminUsageRecord,
  consent: HaruConsentState,
): { record: HaruAdminUsageRecord; removedAudioObjectKeys: string[] } | null {
  let clone: HaruAdminUsageRecord;
  try {
    clone = JSON.parse(JSON.stringify(record)) as HaruAdminUsageRecord;
  } catch {
    return null;
  }
  const removedAudioObjectKeys: string[] = [];
  const mayRetainTranscript =
    consent.voiceRecording &&
    consent.sttProcessing &&
    consent.transcriptStorage;
  const mayRetainAudio = consent.voiceRecording && consent.audioStorage;
  for (const session of clone.sessions) {
    for (const questionRecord of session.question_records) {
      const response = questionRecord.response;
      if (response?.input_mode !== "voice") continue;
      if (!mayRetainTranscript) scrubVoiceResponseTranscript(response);
      if (!mayRetainAudio) {
        if (response.audio_storage.object_key) {
          removedAudioObjectKeys.push(response.audio_storage.object_key);
        }
        scrubVoiceResponseAudio(response);
      }
    }
  }
  clone.user.consents = consentSnapshot(consent);
  return { record: clone, removedAudioObjectKeys };
}

function trackAdminAudioDelete(objectKey: string): void {
  const pending = deleteHaruAdminAudio(objectKey).catch(() => undefined);
  pendingAdminAudioDeletes.add(pending);
  const forget = () => pendingAdminAudioDeletes.delete(pending);
  void pending.then(forget, forget);
}

function replaceWithConsentSafeAdminRecord(
  record: HaruAdminUsageRecord,
): void {
  const consent = getHaruConsent();
  if (!consent.longitudinalUsageStorage) {
    purgeStaleAdminRecord();
    return;
  }
  const sanitized = consentSafeAdminRecord(record, consent);
  if (!sanitized) {
    purgeStaleAdminRecord();
    return;
  }
  if (!writeJson(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY, sanitized.record)) {
    purgeStaleAdminRecord();
    return;
  }
  sanitized.removedAudioObjectKeys.forEach(trackAdminAudioDelete);
  if (
    sanitized.record.user.consents.voice_recording &&
    sanitized.record.user.consents.stt_processing &&
    sanitized.record.user.consents.transcript_storage &&
    sanitized.record.user.consents.audio_storage
  ) {
    reconcileHaruSttRetryOutbox(sanitized.record);
  } else {
    clearHaruSttRetryOutbox();
  }
  enqueueHaruRagRecord(sanitized.record);
  dispatchUpdate();
}

function saveRecord(
  record: HaruAdminUsageRecord,
  options: {
    requireBackgroundPersistence?: boolean;
    expectedGuard?: HaruAdminWriteGuard;
    deletionFence?: HaruAdminDeletionFence;
  } = {},
): boolean {
  const writeGuard = options.expectedGuard ?? captureAdminWriteGuard();
  const deletionFence = options.deletionFence;
  if (deletionFence) {
    if (!ownsDeletionFence(deletionFence)) return false;
  } else if (
    activeAdminRecordClearOperations > 0 ||
    durableDeletionFenceExists()
  ) {
    return false;
  }
  const consent = getHaruConsent();
  if (!consent.longitudinalUsageStorage) {
    purgeStaleAdminRecord();
    return false;
  }
  const writeIntent = deletionFence
    ? null
    : beginAdminWriteIntent("record", writeGuard);
  if (!deletionFence && !writeIntent) return false;
  const writeIsAuthorized = () =>
    deletionFence
      ? ownsDeletionFence(deletionFence)
      : Boolean(writeIntent && adminWriteIntentIsCurrent(writeIntent, writeGuard));
  let saved: boolean;
  let backgroundSaved = true;
  let intentRemoved = true;
  try {
    if (!writeIsAuthorized()) return false;
    record.user.consents = consentSnapshot(consent);
    saved = writeJson(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY, record);
    if (saved) {
      if (!writeIsAuthorized()) {
        if (!durableDeletionFenceExists()) {
          replaceWithConsentSafeAdminRecord(record);
        }
        return false;
      }
      const retryOutboxSaved =
        record.user.consents.voice_recording &&
        record.user.consents.stt_processing &&
        record.user.consents.transcript_storage &&
        record.user.consents.audio_storage
          ? reconcileHaruSttRetryOutbox(record)
          : clearHaruSttRetryOutbox();
      const ragOutboxSaved = enqueueHaruRagRecord(record);
      if (!writeIsAuthorized()) {
        if (!durableDeletionFenceExists()) {
          replaceWithConsentSafeAdminRecord(record);
        }
        return false;
      }
      dispatchUpdate();
      backgroundSaved =
        !options.requireBackgroundPersistence ||
        (retryOutboxSaved && ragOutboxSaved);
    }
  } finally {
    if (writeIntent) intentRemoved = finishAdminWriteIntent(writeIntent);
  }
  return saved && backgroundSaved && intentRemoved;
}

function buttonForOption(
  optionId: string,
  exercise: Exercise,
): HaruAdminButton | null {
  if (BUTTONS.includes(optionId as HaruAdminButton)) {
    return optionId as HaruAdminButton;
  }
  const choices = exercise.payload.options ?? exercise.payload.items ?? [];
  const index = choices.findIndex((choice) => choice.id === optionId);
  return index >= 0 && index < BUTTONS.length ? BUTTONS[index] : null;
}

function choicesFor(
  exercise: Exercise,
  language: string,
  market: MarketCode,
): HaruAdminChoice[] | null {
  const source = exercise.payload.options ?? exercise.payload.items;
  if (!source || source.length === 0) return null;
  return source.slice(0, 4).map((choice, index) => {
    const button = BUTTONS[index];
    return {
      button,
      ...BUTTON_LAYOUT_BY_MARKET[market][button],
      label: getLocalizedText(choice.label, language),
    };
  });
}

function adminDomainFor(domain: string, market: MarketCode): string {
  return DOMAIN_BY_MARKET[market][domain] ?? domain;
}

function correctAnswerFor(
  exercise: Exercise,
  choices: HaruAdminChoice[] | null,
): HaruAdminQuestionRecord["question"]["correct_answer"] {
  if (!choices || exercise.correctAnswer === null) return null;
  if (typeof exercise.correctAnswer === "string") {
    const button = buttonForOption(exercise.correctAnswer, exercise);
    const choice = choices.find((candidate) => candidate.button === button);
    return button && choice ? { button, label: choice.label } : null;
  }
  const sequence = exercise.correctAnswer
    .map((id) => buttonForOption(id, exercise))
    .filter((button): button is HaruAdminButton => button !== null);
  return sequence.length === exercise.correctAnswer.length
    ? {
        sequence,
        labels: sequence.map(
          (button) => choices.find((choice) => choice.button === button)?.label ?? "",
        ),
      }
    : null;
}

function expectedQuestionIds(day: HaruWeekDay): readonly string[] {
  return getHaruWeekPlan(day, getRuntimeMarketConfig().market).exerciseIds;
}

function hasCompleteValidResponses(
  session: HaruAdminUsageSession,
  day: HaruWeekDay,
): boolean {
  const expected = expectedQuestionIds(day);
  if (expected.length === 0 || session.question_records.length !== expected.length) {
    return false;
  }
  const ids = session.question_records.map((record) => record.question.question_id);
  return (
    new Set(ids).size === expected.length &&
    expected.every((id) => {
      const record = session.question_records.find(
        (candidate) => candidate.question.question_id === id,
      );
      return record?.response?.is_valid === true && record.system_feedback !== null;
    })
  );
}

export function getHaruAdminUsageRecord(): HaruAdminUsageRecord | null {
  const stored = readJson<unknown>(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY, null);
  const record = parseHaruAdminUsageRecord(stored, {
    expectedUserId: USER_ID,
    expectedDeviceId: DEVICE_ID,
  });
  if (!record || !isObject(record.dataset)) return null;

  const runtimeConfig = getRuntimeMarketConfig();
  const storedMarket = record.dataset.market ?? record.user.market ?? "kr";
  if (storedMarket !== "kr" && storedMarket !== "jp") return null;
  const storedConfig = getMarketConfig(storedMarket);
  const datasetLocale = record.dataset.ui_locale ?? storedConfig.locale;
  const userMarket = record.user.market ?? storedMarket;
  const userLocale = record.user.ui_locale ?? datasetLocale;
  if (
    storedMarket !== runtimeConfig.market ||
    datasetLocale !== runtimeConfig.locale ||
    userMarket !== runtimeConfig.market ||
    userLocale !== runtimeConfig.locale
  ) {
    return null;
  }

  record.dataset.market = runtimeConfig.market;
  record.dataset.ui_locale = runtimeConfig.locale;
  record.dataset.content_pack_version ??= runtimeConfig.contentPackVersion;
  record.dataset.currency ??= runtimeConfig.currency;
  record.user.market = runtimeConfig.market;
  record.user.ui_locale = runtimeConfig.locale;
  return record;
}

export function startHaruAdminUsageSession(
  day: HaruWeekDay,
  now: Date = new Date(),
): HaruAdminUsageSession | null {
  if (
    activeAdminRecordClearOperations > 0 ||
    durableDeletionFenceExists()
  ) {
    return null;
  }
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearHaruSttRetryOutbox();
    clearHaruRagOutbox();
    return null;
  }

  const marketConfig = getRuntimeMarketConfig();
  const plan = getHaruWeekPlan(day, marketConfig.market);
  const record = getHaruAdminUsageRecord() ?? createEmptyRecord(now);
  const existingIndex = record.sessions.findIndex(
    (session) => session.session_date === plan.dateISO,
  );
  const existing = record.sessions[existingIndex];
  if (
    existing?.completion_status === "completed" ||
    existing?.completion_status === "in_progress"
  ) {
    return existing;
  }

  const timestamp = toMarketIsoString(now, marketConfig.market);
  const session: HaruAdminUsageSession = existing
    ? {
        ...existing,
        authentication: {
          ...existing.authentication,
          authenticated_at: timestamp,
          result: "success",
        },
        session_started_at: timestamp,
        session_completed_at: null,
        completion_status: "in_progress",
        session_summary: null,
      }
    : {
        session_id: `SES-${plan.dateISO.replaceAll("-", "")}-USR000001`,
        user_id: USER_ID,
        device_id: DEVICE_ID,
        session_date: plan.dateISO,
        weekday: getLocalizedText(plan.weekday, marketConfig.language),
        authentication: {
          method: "registered_card",
          card_token_id: CARD_TOKEN_ID,
          authenticated_at: timestamp,
          result: "success",
        },
        session_started_at: timestamp,
        session_completed_at: null,
        completion_status: "in_progress",
        question_count: plan.exerciseIds.length,
        question_records: [],
        session_summary: null,
      };

  if (existingIndex >= 0) record.sessions[existingIndex] = session;
  else record.sessions.push(session);
  record.sessions.sort((left, right) => left.session_date.localeCompare(right.session_date));
  saveRecord(record);
  return session;
}

export function presentHaruAdminQuestion(
  day: HaruWeekDay,
  exercise: Exercise,
  language: string,
  personalization?: HaruPersonalizationRecord,
  now: Date = new Date(),
): HaruAdminQuestionRecord | null {
  const session = startHaruAdminUsageSession(day, now);
  if (!session || session.completion_status !== "in_progress") return null;
  const record = getHaruAdminUsageRecord();
  if (!record) return null;
  const storedSession = record.sessions.find((candidate) => candidate.session_id === session.session_id);
  if (!storedSession) return null;
  const existing = storedSession.question_records.find(
    (candidate) => candidate.question.question_id === exercise.id,
  );
  if (existing) return existing;

  const meta = HARU_WEEK_QUESTION_META.find(
    (candidate) => candidate.day === day && candidate.exerciseId === exercise.id,
  );
  if (!meta || !expectedQuestionIds(day).includes(exercise.id)) return null;
  const marketConfig = getRuntimeMarketConfig();
  const recordLanguage = language === marketConfig.language
    ? language
    : marketConfig.language;
  const choices = choicesFor(exercise, recordLanguage, marketConfig.market);
  const usePersonalizationNote =
    personalization?.kind === "profile" || personalization?.kind === "prior_response";
  const questionRecord: HaruAdminQuestionRecord = {
    presentation: {
      presented_at: toMarketIsoString(now, marketConfig.market),
      screen_state: "question",
      character_message: null,
    },
    question: {
      question_id: exercise.id,
      order: meta.order,
      domain: adminDomainFor(meta.domain, marketConfig.market),
      response_type: meta.responseType,
      prompt_text: getLocalizedText(exercise.prompt, recordLanguage),
      prompt_audio_text: getLocalizedText(
        exercise.payload.audioText ?? exercise.prompt,
        recordLanguage,
      ),
      scored: meta.scored,
      choices,
      correct_answer: correctAnswerFor(exercise, choices),
      personalization_source_note:
        usePersonalizationNote && meta.personalizationSourceNote
          ? getLocalizedText(meta.personalizationSourceNote, recordLanguage)
          : null,
      max_response_seconds: meta.maxResponseSeconds ?? null,
    },
    response: null,
    system_feedback: null,
  };
  storedSession.question_records.push(questionRecord);
  storedSession.question_records.sort((left, right) => left.question.order - right.question.order);
  saveRecord(record);
  return questionRecord;
}

function evaluationFor(isCorrect: boolean | null, scored: boolean): HaruAdminEvaluation {
  return {
    is_correct: scored ? isCorrect : null,
    score: scored && typeof isCorrect === "boolean" ? (isCorrect ? 1 : 0) : null,
  };
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function singleChoiceResponse(
  input: HaruAdminLiveResponseInput,
  exercise: Exercise,
  questionRecord: HaruAdminQuestionRecord,
  respondedAt: string,
): HaruAdminSingleChoiceResponse | null {
  if (!input.selectedOptionId) return null;
  const button = buttonForOption(input.selectedOptionId, exercise);
  const choice = questionRecord.question.choices?.find(
    (candidate) => candidate.button === button,
  );
  if (!button || !choice) return null;
  const computedCorrect = questionRecord.question.scored
    ? typeof exercise.correctAnswer === "string" &&
      input.selectedOptionId === exercise.correctAnswer
    : null;
  return {
    response_id: `RES-${input.questionId}`,
    input_mode: input.inputMode ?? "touch",
    button_event: {
      button,
      position: choice.position,
      color: choice.color,
      pressed_at: normalizeTimestamp(input.buttonPressedAt, new Date(respondedAt)),
    },
    selected_choice: { button, label: choice.label },
    response_time_ms: Math.max(0, Math.round(input.responseTimeMs)),
    evaluation: evaluationFor(computedCorrect, questionRecord.question.scored),
    is_valid: true,
  };
}

function sequenceResponse(
  input: HaruAdminLiveResponseInput,
  exercise: Exercise,
  questionRecord: HaruAdminQuestionRecord,
  respondedAt: string,
): HaruAdminSequenceResponse | null {
  const submitted = input.submittedSequence ?? [];
  const expectedCount = exercise.payload.requiredSelectionCount ?? 0;
  if (submitted.length !== expectedCount || new Set(submitted).size !== submitted.length) {
    return null;
  }
  const sequence = submitted
    .map((id) => buttonForOption(id, exercise))
    .filter((button): button is HaruAdminButton => button !== null);
  if (sequence.length !== submitted.length) return null;
  const correctSequence = Array.isArray(exercise.correctAnswer)
    ? exercise.correctAnswer
    : [];
  const computedCorrect = questionRecord.question.scored
    ? submitted.length === correctSequence.length &&
      submitted.every((id, index) => id === correctSequence[index])
    : null;
  const labels = sequence.map(
    (button) =>
      questionRecord.question.choices?.find((choice) => choice.button === button)?.label ?? "",
  );
  const inputMode = input.sequenceButtonEvents?.some(
    (event) => event.inputMode === "physical_button",
  )
    ? "physical_button_sequence"
    : "touch_sequence";
  const eventByOption = new Map(
    input.sequenceButtonEvents?.map((event) => [event.optionId, event]) ?? [],
  );
  return {
    response_id: `RES-${input.questionId}`,
    input_mode: inputMode,
    button_events: submitted.map((optionId, index) => {
      const button = sequence[index];
      const event = eventByOption.get(optionId);
      return {
        sequence_index: index + 1,
        button,
        choice_label: labels[index],
        pressed_at: normalizeTimestamp(event?.pressedAt, new Date(respondedAt)),
        elapsed_ms_from_question:
          event?.elapsedMsFromQuestion ?? Math.max(0, Math.round(input.responseTimeMs)),
      };
    }),
    submitted_sequence: sequence,
    submitted_labels: labels,
    submitted_at: respondedAt,
    response_time_ms: Math.max(0, Math.round(input.responseTimeMs)),
    evaluation: evaluationFor(computedCorrect, questionRecord.question.scored),
    is_valid: true,
  };
}

async function voiceResponse(
  input: HaruAdminLiveResponseInput,
  sessionDate: string,
  respondedAt: string,
  writeGuard: HaruAdminWriteGuard,
): Promise<HaruAdminVoiceResponse | null> {
  const consent = getHaruConsent();
  const mayStoreAudio =
    activeAdminAudioDeletionOperations === 0 &&
    adminWriteGuardMatches(writeGuard) &&
    consent.voiceRecording &&
    consent.audioStorage &&
    consent.longitudinalUsageStorage &&
    input.audioBlob !== undefined &&
    input.audioBlob.size > 0;
  const objectKey = mayStoreAudio
    ? createVoiceAudioObjectKey(
        input.questionId,
        sessionDate,
        writeGuard,
        input.audioBlob?.type,
      )
    : "";
  let retentionStatus = mayStoreAudio
    ? await storeTrackedHaruAdminAudio(
        objectKey,
        input.audioBlob!,
        respondedAt,
        writeGuard,
      )
    : "not_stored";
  const currentConsent = getHaruConsent();
  const writeStillAuthorized = adminWriteGuardMatches(writeGuard);
  const mayRetainAudio =
    activeAdminAudioDeletionOperations === 0 &&
    writeStillAuthorized &&
    currentConsent.voiceRecording &&
    currentConsent.audioStorage &&
    currentConsent.longitudinalUsageStorage;
  if (retentionStatus === "stored" && !mayRetainAudio) {
    await deleteHaruAdminAudio(objectKey);
    retentionStatus = "not_stored";
  }
  if (!writeStillAuthorized) return null;
  const mayStoreTranscript =
    activeAdminTranscriptDeletionOperations === 0 &&
    currentConsent.voiceRecording &&
    currentConsent.sttProcessing &&
    currentConsent.transcriptStorage &&
    currentConsent.longitudinalUsageStorage;
  const noSpeech = mayStoreTranscript && input.sttNoSpeech === true;
  const transcript = mayStoreTranscript && !noSpeech
    ? (input.rawUserUtteranceTranscript?.trim().slice(0, 10_000) || null)
    : null;
  const annotations = mayStoreTranscript && !noSpeech
    ? (input.derivedAnnotations ?? [])
        .filter(
          (annotation) =>
            annotation.entityType.trim().length > 0 && annotation.value.trim().length > 0,
        )
        .slice(0, 24)
    : [];
  return {
    response_id: `RES-${input.questionId}`,
    input_mode: "voice",
    recording_started_at: normalizeOptionalTimestamp(input.recordingStartedAt),
    recording_ended_at: normalizeOptionalTimestamp(input.recordingEndedAt),
    audio_duration_seconds: Math.max(0, input.voiceDurationSeconds ?? 0),
    audio_storage: {
      object_key: retentionStatus === "stored" ? objectKey : "",
      mime_type: retentionStatus === "stored" ? (input.audioBlob?.type || null) : null,
      sample_rate_hz:
        retentionStatus === "stored" &&
        input.audioSampleRateHz !== undefined &&
        Number.isFinite(input.audioSampleRateHz) &&
        input.audioSampleRateHz > 0
          ? Math.round(input.audioSampleRateHz)
          : null,
      channels:
        retentionStatus === "stored" &&
        input.audioChannelCount !== undefined &&
        Number.isFinite(input.audioChannelCount) &&
        input.audioChannelCount > 0
          ? Math.round(input.audioChannelCount)
          : null,
      retention_status: retentionStatus,
    },
    raw_user_utterance_transcript: transcript,
    stt: {
      engine: mayStoreTranscript
        ? (input.sttEngine?.trim().slice(0, 240) || "haru-local-stt")
        : "haru-local-stt",
      status:
        mayStoreTranscript && !noSpeech ? (input.sttStatus ?? "failed") : "failed",
      no_speech: noSpeech,
      transcript,
      language: mayStoreTranscript ? (input.sttLanguage ?? null) : null,
      confidence:
        mayStoreTranscript &&
        input.sttConfidence !== undefined &&
        Number.isFinite(input.sttConfidence) &&
        input.sttConfidence >= 0 &&
        input.sttConfidence <= 1
          ? input.sttConfidence
          : null,
      processed_at: mayStoreTranscript
        ? normalizeOptionalTimestamp(input.sttProcessedAt)
        : null,
      model: mayStoreTranscript
        ? (input.sttModel?.trim().slice(0, 240) || null)
        : null,
      model_revision: mayStoreTranscript
        ? (input.sttModelRevision?.trim().slice(0, 160) || null)
        : null,
      aligner_model: mayStoreTranscript
        ? (input.sttAlignerModel?.trim().slice(0, 240) || null)
        : null,
      aligner_revision: mayStoreTranscript
        ? (input.sttAlignerRevision?.trim().slice(0, 160) || null)
        : null,
      preprocessing_version: mayStoreTranscript
        ? (input.sttPreprocessingVersion?.trim().slice(0, 160) || null)
        : null,
      segments:
        mayStoreTranscript && !noSpeech
          ? (input.sttSegments ?? [])
              .filter(
                (segment) =>
                  Number.isInteger(segment.id) &&
                  segment.id >= 0 &&
                  Number.isFinite(segment.start) &&
                  segment.start >= 0 &&
                  Number.isFinite(segment.end) &&
                  segment.end >= segment.start &&
                  segment.text.trim().length > 0,
              )
              .slice(0, 2_000)
              .map((segment) => ({
                id: segment.id,
                start: Math.round(segment.start * 1_000) / 1_000,
                end: Math.round(segment.end * 1_000) / 1_000,
                text: segment.text.trim().slice(0, 500),
              }))
          : [],
    },
    user_correction: { was_corrected: false, corrected_transcript: null },
    derived_annotations: {
      status: annotations.length > 0 ? "completed" : "empty",
      items: annotations.map((annotation) => ({
        entity_type: annotation.entityType.trim().slice(0, 40),
        value: annotation.value.trim().slice(0, 120),
      })),
      note: ADMIN_MARKET_CONTENT[getRuntimeMarketConfig().market].derivedAnnotationNote,
    },
    response_time_ms: Math.max(0, Math.round(input.responseTimeMs)),
    is_valid: true,
  };
}

export async function recordHaruAdminResponse(
  day: HaruWeekDay,
  exercise: Exercise,
  language: string,
  input: HaruAdminLiveResponseInput,
  personalization?: HaruPersonalizationRecord,
  now: Date = new Date(),
): Promise<HaruAdminQuestionRecord | null> {
  if (
    activeAdminRecordClearOperations > 0 ||
    durableDeletionFenceExists()
  ) {
    return null;
  }
  const writeGuard = captureAdminWriteGuard();
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearHaruSttRetryOutbox();
    clearHaruRagOutbox();
    return null;
  }
  if (!isNonNegativeFinite(input.responseTimeMs)) return null;
  if (
    input.voiceDurationSeconds !== undefined &&
    !isNonNegativeFinite(input.voiceDurationSeconds)
  ) {
    return null;
  }
  const fallbackPresentedAt = new Date(now.getTime() - Math.max(0, input.responseTimeMs));
  presentHaruAdminQuestion(day, exercise, language, personalization, fallbackPresentedAt);
  const record = getHaruAdminUsageRecord();
  if (!record) return null;
  const plan = getHaruWeekPlan(day, getRuntimeMarketConfig().market);
  const session = record.sessions.find((candidate) => candidate.session_date === plan.dateISO);
  const questionRecord = session?.question_records.find(
    (candidate) => candidate.question.question_id === input.questionId,
  );
  if (
    !session ||
    !questionRecord ||
    session.completion_status !== "in_progress" ||
    questionRecord.response !== null ||
    input.questionId !== exercise.id ||
    input.responseType !== questionRecord.question.response_type
  ) {
    return questionRecord ?? null;
  }

  const respondedAt = normalizeTimestamp(input.respondedAt, now);
  const response: HaruAdminResponse | null =
    input.responseType === "single_choice"
      ? singleChoiceResponse(input, exercise, questionRecord, respondedAt)
      : input.responseType === "button_sequence"
        ? sequenceResponse(input, exercise, questionRecord, respondedAt)
        : await voiceResponse(input, plan.dateISO, respondedAt, writeGuard);
  if (!response) return null;

  if (!adminWriteGuardMatches(writeGuard)) {
    if (
      response.input_mode === "voice" &&
      response.audio_storage.retention_status === "stored"
    ) {
      await deleteHaruAdminAudio(response.audio_storage.object_key);
    }
    return null;
  }

  const latestRecord = getHaruAdminUsageRecord();
  const latestSession = latestRecord?.sessions.find(
    (candidate) => candidate.session_date === plan.dateISO,
  );
  const latestQuestionRecord = latestSession?.question_records.find(
    (candidate) => candidate.question.question_id === input.questionId,
  );
  if (
    !latestRecord ||
    !latestSession ||
    !latestQuestionRecord ||
    latestSession.completion_status !== "in_progress"
  ) {
    if (
      response.input_mode === "voice" &&
      response.audio_storage.retention_status === "stored"
    ) {
      await deleteHaruAdminAudio(response.audio_storage.object_key);
    }
    return null;
  }
  if (latestQuestionRecord.response !== null) {
    if (
      response.input_mode === "voice" &&
      response.audio_storage.retention_status === "stored"
    ) {
      await deleteHaruAdminAudio(response.audio_storage.object_key);
    }
    return latestQuestionRecord;
  }

  latestQuestionRecord.response = response;
  latestQuestionRecord.presentation.character_message = input.feedback;
  latestQuestionRecord.system_feedback = {
    feedback_text: input.feedback,
    shown_at: respondedAt,
  };
  if (!saveRecord(latestRecord, { expectedGuard: writeGuard })) {
    if (
      response.input_mode === "voice" &&
      response.audio_storage.retention_status === "stored"
    ) {
      await deleteHaruAdminAudio(response.audio_storage.object_key);
    }
    return null;
  }
  return latestQuestionRecord;
}

export function patchHaruAdminVoiceSttSuccess(
  success: HaruSttRetrySuccess,
): HaruSttRetryPatchResult {
  const record = getHaruAdminUsageRecord();
  const consent = getHaruConsent();
  if (
    !record ||
    record.user.user_id !== success.userId ||
    !consent.voiceRecording ||
    !consent.sttProcessing ||
    !consent.transcriptStorage ||
    !consent.audioStorage ||
    !consent.longitudinalUsageStorage ||
    !record.user.consents.voice_recording ||
    !record.user.consents.stt_processing ||
    !record.user.consents.transcript_storage ||
    !record.user.consents.audio_storage ||
    !record.user.consents.longitudinal_usage_storage
  ) {
    return "stale";
  }

  const session = record.sessions.find(
    (candidate) => candidate.session_date === success.sessionDate,
  );
  const questionRecord = session?.question_records.find(
    (candidate) => candidate.question.question_id === success.questionId,
  );
  const response = questionRecord?.response;
  if (
    response?.input_mode !== "voice" ||
    response.audio_storage.object_key !== success.objectKey ||
    response.audio_storage.retention_status !== "stored"
  ) {
    return "stale";
  }
  if (response.stt.status === "completed") return "stale";

  const noSpeech = success.result.noSpeech;
  const transcript = noSpeech
    ? null
    : (success.result.text.trim().slice(0, 10_000) || null);
  if (!noSpeech && !transcript) return "stale";
  const annotations = noSpeech
    ? []
    : success.derivedAnnotations
        .filter(
          (annotation) =>
            annotation.entityType.trim().length > 0 &&
            annotation.value.trim().length > 0,
        )
        .slice(0, 24);
  response.raw_user_utterance_transcript = transcript;
  response.stt = {
    engine: success.engine.trim().slice(0, 240) || "haru-local-stt",
    status: noSpeech ? "failed" : "completed",
    no_speech: noSpeech,
    transcript,
    language: success.result.language?.trim().slice(0, 80) || null,
    confidence:
      success.result.confidence !== null &&
      Number.isFinite(success.result.confidence) &&
      success.result.confidence >= 0 &&
      success.result.confidence <= 1
        ? success.result.confidence
        : null,
    processed_at: normalizeTimestamp(success.processedAt, new Date()),
    model: success.result.model?.trim().slice(0, 240) || null,
    model_revision: success.result.modelRevision?.trim().slice(0, 160) || null,
    aligner_model: success.result.alignerModel?.trim().slice(0, 240) || null,
    aligner_revision: success.result.alignerRevision?.trim().slice(0, 160) || null,
    preprocessing_version:
      success.result.preprocessingVersion?.trim().slice(0, 160) || null,
    segments: noSpeech
      ? []
      : success.result.segments
          .filter(
            (segment) =>
              Number.isInteger(segment.id) &&
              segment.id >= 0 &&
              Number.isFinite(segment.start) &&
              segment.start >= 0 &&
              Number.isFinite(segment.end) &&
              segment.end >= segment.start &&
              segment.text.trim().length > 0,
          )
          .slice(0, 2_000)
          .map((segment) => ({
            id: segment.id,
            start: Math.round(segment.start * 1_000) / 1_000,
            end: Math.round(segment.end * 1_000) / 1_000,
            text: segment.text.trim().slice(0, 500),
          })),
  };
  response.derived_annotations = {
    ...response.derived_annotations,
    status: annotations.length > 0 ? "completed" : "empty",
    items: annotations.map((annotation) => ({
      entity_type: annotation.entityType.trim().slice(0, 40),
      value: annotation.value.trim().slice(0, 120),
    })),
  };
  if (!saveRecord(record)) return "retry";
  const questionMeta = HARU_WEEK_QUESTION_META.find(
    (candidate) => candidate.exerciseId === success.questionId,
  );
  if (!noSpeech && transcript && consent.personalizedQuestionUse && questionMeta) {
    patchHaruDemoVoiceResponse(questionMeta.day, success.questionId, {
      transcript,
      derivedAnnotations: annotations,
      sttLanguage: success.result.language ?? undefined,
      sttConfidence: success.result.confidence ?? undefined,
      sttEngine: success.engine,
      sttModel: success.result.model ?? undefined,
      sttModelRevision: success.result.modelRevision ?? undefined,
      sttAlignerModel: success.result.alignerModel ?? undefined,
      sttAlignerRevision: success.result.alignerRevision ?? undefined,
      sttPreprocessingVersion: success.result.preprocessingVersion ?? undefined,
    });
  }
  return "patched";
}

export function completeHaruAdminUsageSession(
  day: HaruWeekDay,
  completionMessage: string,
  now: Date = new Date(),
): HaruAdminUsageSession | null {
  const marketConfig = getRuntimeMarketConfig();
  const record = getHaruAdminUsageRecord();
  const session = record?.sessions.find(
    (candidate) =>
      candidate.session_date === getHaruWeekPlan(day, marketConfig.market).dateISO,
  );
  if (!record || !session) return null;
  if (session.completion_status === "completed") return session;
  if (
    session.completion_status !== "in_progress" ||
    !hasCompleteValidResponses(session, day)
  ) {
    return null;
  }

  const completedAt = toMarketIsoString(now, marketConfig.market);
  const durationSeconds = Math.max(
    0,
    Math.round(
      (new Date(completedAt).getTime() - new Date(session.session_started_at).getTime()) /
        1000,
    ),
  );
  const scoredRecords = session.question_records.filter(
    (questionRecord) => questionRecord.question.scored,
  );
  const correctCount = scoredRecords.filter((questionRecord) => {
    const response = questionRecord.response;
    return response !== null && "evaluation" in response && response.evaluation.is_correct;
  }).length;
  const incorrectCount = scoredRecords.filter((questionRecord) => {
    const response = questionRecord.response;
    return (
      response !== null &&
      "evaluation" in response &&
      response.evaluation.is_correct === false
    );
  }).length;
  session.completion_status = "completed";
  session.session_completed_at = completedAt;
  session.session_summary = {
    duration_seconds: durationSeconds,
    scored_question_count: scoredRecords.length,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    completion_message: completionMessage,
    clinical_interpretation: null,
    risk_classification: null,
    admin_note: ADMIN_MARKET_CONTENT[marketConfig.market].completionAdminNote,
  };
  return saveRecord(record) ? session : null;
}

export function abandonHaruAdminUsageSession(
  day: HaruWeekDay,
  now: Date = new Date(),
): HaruAdminUsageSession | null {
  const marketConfig = getRuntimeMarketConfig();
  const record = getHaruAdminUsageRecord();
  const session = record?.sessions.find(
    (candidate) =>
      candidate.session_date === getHaruWeekPlan(day, marketConfig.market).dateISO,
  );
  if (!record || !session || session.completion_status !== "in_progress") {
    return session ?? null;
  }
  session.completion_status = "abandoned";
  session.session_completed_at = toMarketIsoString(now, marketConfig.market);
  session.session_summary = null;
  saveRecord(record);
  return session;
}

interface HaruAdminVoiceScrubScope {
  transcript: boolean;
  audio: boolean;
}

function scrubVoiceResponseTranscript(response: HaruAdminVoiceResponse): void {
  response.raw_user_utterance_transcript = null;
  response.stt = {
    engine: "haru-local-stt",
    status: "failed",
    no_speech: false,
    transcript: null,
    language: null,
    confidence: null,
    processed_at: null,
    model: null,
    model_revision: null,
    aligner_model: null,
    aligner_revision: null,
    preprocessing_version: null,
    segments: [],
  };
  response.user_correction = {
    was_corrected: false,
    corrected_transcript: null,
  };
  response.derived_annotations = {
    status: "empty",
    items: [],
    note: ADMIN_MARKET_CONTENT[getRuntimeMarketConfig().market].scrubbedVoiceNote,
  };
}

function scrubVoiceResponseAudio(response: HaruAdminVoiceResponse): void {
  response.audio_storage = {
    ...response.audio_storage,
    object_key: "",
    mime_type: null,
    sample_rate_hz: null,
    channels: null,
    retention_status: "not_stored",
  };
}

async function scrubHaruAdminVoiceDataInternal(
  deletionFence: HaruAdminDeletionFence,
  scope: HaruAdminVoiceScrubScope,
): Promise<void> {
  if (!ownsDeletionFence(deletionFence)) {
    throw new Error("haru-admin-deletion-fence-lost");
  }
  const writeEpochAdvanced = advanceAdminWriteEpoch();
  if (!writeEpochAdvanced) throw new Error("haru-admin-consent-sync-failed");
  await waitForDurableAdminWriteIntents(deletionFence);
  await waitForPendingAdminAudioStores();
  if (!ownsDeletionFence(deletionFence)) {
    throw new Error("haru-admin-deletion-fence-lost");
  }
  const record = getHaruAdminUsageRecord();
  const retryOutboxCleared = clearHaruSttRetryOutbox();
  let recordSaveFailed = false;

  if (record) {
    for (const session of record.sessions) {
      for (const questionRecord of session.question_records) {
        const response = questionRecord.response;
        if (response?.input_mode !== "voice") continue;
        if (scope.audio) scrubVoiceResponseAudio(response);
        if (scope.transcript) scrubVoiceResponseTranscript(response);
      }
    }
    recordSaveFailed = !saveRecord(record, {
      requireBackgroundPersistence: true,
      deletionFence,
    });
  }

  const sttQueueCleared = await clearSttJobQueue();
  const finalRetryOutboxCleared = clearHaruSttRetryOutbox();
  await waitForDurableAdminWriteIntents(deletionFence);
  await waitForPendingAdminAudioStores();
  if (!ownsDeletionFence(deletionFence)) {
    throw new Error("haru-admin-deletion-fence-lost");
  }
  if (scope.audio) await clearHaruAdminAudioStorage();
  if (
    recordSaveFailed ||
    !retryOutboxCleared ||
    !finalRetryOutboxCleared ||
    !sttQueueCleared
  ) {
    throw new Error("haru-admin-consent-sync-failed");
  }
}

async function runHaruAdminVoiceScrub(
  kind: Exclude<HaruAdminDeletionKind, "clear">,
  scope: HaruAdminVoiceScrubScope,
): Promise<void> {
  const deletionFence = await acquireAdminDeletionFence(kind);
  if (scope.transcript) activeAdminTranscriptDeletionOperations += 1;
  if (scope.audio) activeAdminAudioDeletionOperations += 1;
  try {
    await scrubHaruAdminVoiceDataInternal(deletionFence, scope);
    if (!releaseAdminDeletionFence(deletionFence)) {
      throw new Error("haru-admin-deletion-fence-release-failed");
    }
  } finally {
    activeAdminDeletionFenceTokens.delete(deletionFence.token);
    if (scope.audio) activeAdminAudioDeletionOperations -= 1;
    if (scope.transcript) activeAdminTranscriptDeletionOperations -= 1;
  }
}

export function scrubHaruAdminTranscriptData(): Promise<void> {
  return runHaruAdminVoiceScrub("transcript_scrub", {
    transcript: true,
    audio: false,
  });
}

export function scrubHaruAdminAudioData(): Promise<void> {
  return runHaruAdminVoiceScrub("audio_scrub", {
    transcript: false,
    audio: true,
  });
}

export function scrubHaruAdminVoiceData(): Promise<void> {
  return runHaruAdminVoiceScrub("voice_scrub", {
    transcript: true,
    audio: true,
  });
}

export function refreshHaruAdminUsageConsent(): boolean {
  const record = getHaruAdminUsageRecord();
  return record
    ? saveRecord(record, { requireBackgroundPersistence: true })
    : true;
}

async function clearHaruAdminUsageRecordsInternal(
  deletionFence: HaruAdminDeletionFence,
): Promise<void> {
  if (!ownsDeletionFence(deletionFence)) {
    throw new Error("haru-admin-deletion-fence-lost");
  }
  const writeEpochAdvanced = advanceAdminWriteEpoch();
  if (!writeEpochAdvanced) throw new Error("haru-admin-clear-incomplete");
  await waitForDurableAdminWriteIntents(deletionFence);
  await waitForPendingAdminAudioStores();
  if (!ownsDeletionFence(deletionFence)) {
    throw new Error("haru-admin-deletion-fence-lost");
  }
  const ragDeletionQueued = enqueueHaruRagUserDeletion(HARU_ADMIN_USER_ID);
  const retryOutboxCleared = clearHaruSttRetryOutbox();
  const ragOutboxCleared = clearHaruRagOutbox();
  const adminRecordInitiallyCleared = removeKey(
    HARU_ADMIN_USAGE_RECORD_STORAGE_KEY,
  );
  dispatchUpdate();

  const sttQueueCleared = await clearSttJobQueue();
  await waitForDurableAdminWriteIntents(deletionFence);
  await waitForPendingAdminAudioStores();
  if (!ownsDeletionFence(deletionFence)) {
    throw new Error("haru-admin-deletion-fence-lost");
  }
  await clearHaruAdminAudioStorage();
  const adminRecordFinallyCleared = removeKey(
    HARU_ADMIN_USAGE_RECORD_STORAGE_KEY,
  );
  dispatchUpdate();
  if (
    !ragDeletionQueued ||
    !retryOutboxCleared ||
    !ragOutboxCleared ||
    !adminRecordInitiallyCleared ||
    !adminRecordFinallyCleared ||
    !sttQueueCleared
  ) {
    throw new Error("haru-admin-clear-incomplete");
  }
}

export async function clearHaruAdminUsageRecords(): Promise<void> {
  const deletionFence = await acquireAdminDeletionFence("clear");
  activeAdminRecordClearOperations += 1;
  activeAdminTranscriptDeletionOperations += 1;
  activeAdminAudioDeletionOperations += 1;
  try {
    await clearHaruAdminUsageRecordsInternal(deletionFence);
    if (!releaseAdminDeletionFence(deletionFence)) {
      throw new Error("haru-admin-deletion-fence-release-failed");
    }
  } finally {
    activeAdminDeletionFenceTokens.delete(deletionFence.token);
    activeAdminAudioDeletionOperations -= 1;
    activeAdminTranscriptDeletionOperations -= 1;
    activeAdminRecordClearOperations -= 1;
  }
}
