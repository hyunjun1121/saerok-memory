export {
  AudioManager,
  NARRATION_MANIFEST_URL,
  UI_AUDIO_PATHS,
  audioManager,
  type AudioElementLike,
  type AudioPlayResult,
  type UiAudioEffect,
} from "@/features/audio/AudioManager";
export {
  NarrationManifestError,
  getNarrationEntry,
  isLocalNarrationPath,
  parseNarrationManifest,
  type NarrationEntry,
  type NarrationLocale,
  type NarrationManifest,
} from "@/features/audio/narrationManifest";
