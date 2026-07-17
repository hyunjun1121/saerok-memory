export type MemoryTopic =
  | "family"
  | "health"
  | "travel"
  | "work"
  | "food"
  | "hobby"
  | "friends"
  | "daily_life"
  | "unknown";

export interface ReviewState {
  dueAt: string; // ISO date string
  intervalDays: number;
  ease: number;
  lastResult?: "remembered" | "hint_used" | "missed" | "skipped";
  reviewCount: number;
}

export interface MemoryStoryCues {
  people?: string[];
  places?: string[];
  objects?: string[];
  emotions?: string[];
  timeHints?: string[];
}

export interface MemorySttSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface MemoryCard {
  id: string;
  userId: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  source: "daily_lesson" | "family_upload" | "voice_note" | "manual_entry";
  linkedConceptId?: string;
  topic?: MemoryTopic;
  peopleTags?: string[];
  placeTag?: string;
  emotionTag?: string;
  imageAssetIds?: string[];
  textSummary?: string;
  originalTranscript?: string;
  storyCues?: MemoryStoryCues;
  // SP-05: how the story was captured, preserved as metadata only.
  inputMode?: "speech" | "typed" | "mixed" | "skipped";
  speechDurationMs?: number;
  recognitionError?: string | null;
  audioAssetUrl?: string | null;
  sttStatus?: "completed" | "failed";
  sttNoSpeech?: boolean;
  sttEngine?: string | null;
  sttModel?: string | null;
  sttModelRevision?: string | null;
  sttAlignerModel?: string | null;
  sttAlignerRevision?: string | null;
  sttPreprocessingVersion?: string | null;
  sttLanguage?: string | null;
  sttConfidence?: number | null;
  sttSegments?: MemorySttSegment[];
  sensitivity: "low" | "personal" | "sensitive";
  shareWithFamily: boolean;
  reviewState: ReviewState;
}
